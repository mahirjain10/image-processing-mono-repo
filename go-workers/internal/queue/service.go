package queue

import (
	"context"
	"errors"
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/mahirjain10/go-workers/config"
	"github.com/mahirjain10/go-workers/internal/aws"
	queueErrors "github.com/mahirjain10/go-workers/internal/queue/errors"
	"github.com/mahirjain10/go-workers/internal/queue/handlers"
	"github.com/mahirjain10/go-workers/internal/queue/models"
	"github.com/mahirjain10/go-workers/internal/types"
	"github.com/mahirjain10/go-workers/internal/utils"
	amqp "github.com/rabbitmq/amqp091-go"
)

type RabbitMqService struct {
	s3Service          *aws.S3Service
	config             *config.Config
	rabbitMqConn       *amqp.Connection
	statusQueueChannel *amqp.Channel
	transformHandler   *handlers.TransformHandler
}

func NewRabbitMqService(s3Service *aws.S3Service, rabbitMqConn *amqp.Connection, config *config.Config) *RabbitMqService {
	return &RabbitMqService{
		s3Service:        s3Service,
		rabbitMqConn:     rabbitMqConn,
		config:           config,
		transformHandler: handlers.NewTransformHandler(s3Service),
	}
}

func (rabbitMqService *RabbitMqService) declareExchange() error {
	if rabbitMqService.statusQueueChannel == nil {
		return fmt.Errorf("statusQueueChannel is nil, cannot declare exchange")
	}
	err := rabbitMqService.statusQueueChannel.ExchangeDeclare(
		"image_processing",
		"direct",
		true,
		false,
		false,
		false,
		nil,
	)
	if err != nil {
		return fmt.Errorf("error while declaring an exchange: %w", err)
	}
	return nil
}

func (rabbitMqService *RabbitMqService) fireBackgroundCleanup(parentCtx context.Context, downloadPath, uploadPath, s3Key, cleanupMode string) {
	go func() {
		ctx, cancel := context.WithTimeout(parentCtx, 90*time.Second)
		defer cancel()

		switch cleanupMode {
		case "delete_s3":
			utils.DeleteS3Object(ctx, rabbitMqService.s3Service, s3Key)
		case "remove_local_and_delete_s3":
			if err := utils.RemoveLocalRaw(downloadPath, s3Key); err != nil {
				log.Printf("[bg-cleanup] error while removing local raw file %v", err)
			}
			utils.DeleteS3Object(ctx, rabbitMqService.s3Service, s3Key)
		case "remove_local_all_and_delete_s3":
			if err := utils.RemoveLocalRaw(downloadPath, s3Key); err != nil {
				log.Printf("[bg-cleanup] error while removing local raw file %v", err)
			}
			if err := utils.RemoveLocalProcessed(uploadPath, s3Key); err != nil {
				log.Printf("[bg-cleanup] error while removing local processed file %v", err)
			}
			utils.DeleteS3Object(ctx, rabbitMqService.s3Service, s3Key)
		case "cleanup_all":
			utils.CleanupAll(ctx, rabbitMqService.s3Service, downloadPath, uploadPath, s3Key)
		default:
			utils.DeleteS3Object(ctx, rabbitMqService.s3Service, s3Key)
		}
	}()
}

func (rabbitMqService *RabbitMqService) PublishToChannelHelper(ctx context.Context, id string, userId string, status string, publicUrl string, errorMsg string) error {
	// DONT NEED CONTEXT HERE
	statusData := utils.InitStatusData(id, userId, status, publicUrl, errorMsg)
	statusMessage := utils.InitStatusMessage(statusData)
	log.Printf("[%s] printing status message: %+v", status, statusMessage)
	if err := rabbitMqService.PublishToChannel(ctx, statusMessage); err != nil {
		if utils.IsFatalError(err) {
			return fmt.Errorf("fatal: cannot publish initial processing status: %w", err)
		}
		log.Printf("Warning: failed to publish initial status: %v", err)
	}
	return nil
}

func (rabbitMqService *RabbitMqService) PublishToChannel(ctx context.Context, message interface{}) error {
	if rabbitMqService.statusQueueChannel == nil {
		return fmt.Errorf("statusQueueChannel is not initialized")
	}
	// EXTENDING BG CONTEXT HERE
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	serializedMessage, err := utils.SerializeJSON(message)
	if err != nil {
		return fmt.Errorf("failed to serialize message: %w", err)
	}

	err = rabbitMqService.statusQueueChannel.PublishWithContext(ctx,
		"image_processing",
		"status",
		true,
		false,
		amqp.Publishing{
			ContentType: "application/json",
			Body:        serializedMessage,
		})
	if err != nil {
		return fmt.Errorf("failed to publish message: %w", err)
	}
	log.Println("Pushed to status queue")
	return nil
}

func (rabbitMqService *RabbitMqService) ProcessMessage(ctx context.Context, d amqp.Delivery) error {
	status := types.PROCESSING
	_, downloadPath, uploadPath := rabbitMqService.s3Service.GetDependencyData()
	log.Printf("Received message: %s", d.Body)
	var publicUrl, errorMsg = "", ""
	var rabbitMqMessage *models.RabbitMqMessage
	if err := utils.ParseJSON(d.Body, &rabbitMqMessage); err != nil {
		return fmt.Errorf("failed to parse message: %w", err)
	}

	log.Printf("Processing S3 event - Pattern: %s, Object: %+v", rabbitMqMessage.Pattern, rabbitMqMessage.Data)
	if err := rabbitMqService.PublishToChannelHelper(ctx, rabbitMqMessage.Data.Id, rabbitMqMessage.Data.UserId, status, publicUrl, errorMsg); err != nil {
		return err
	}

	if rabbitMqMessage.Data.CreatedAt != "" {
		log.Printf("Message created at: %s, processing now - check for delays", rabbitMqMessage.Data.CreatedAt)
	}

	// Download from S3
	var downloadErr error
	for i := 0; i < 3; i++ {
		downloadErr = rabbitMqService.s3Service.DownloadFromS3Object(ctx, rabbitMqMessage.Data.S3RawKey)
		if downloadErr == nil {
			break
		}
		log.Printf("%d try: error while downloading S3 object: %v", i+1, downloadErr)
		if i < 2 {
			time.Sleep(2 * time.Second)
		}
	}

	if downloadErr != nil {
		log.Printf("Download failed after 3 attempts: %v", downloadErr)
		errorMsg = queueErrors.ErrDownload
		status := types.FAILED
		if err := rabbitMqService.PublishToChannelHelper(ctx, rabbitMqMessage.Data.Id, rabbitMqMessage.Data.UserId, status, publicUrl, errorMsg); err != nil {
			return err
		}

		// background: just delete the S3 object 
		rabbitMqService.fireBackgroundCleanup(ctx, downloadPath, uploadPath, rabbitMqMessage.Data.S3RawKey, "delete_s3")
		return models.ProcessingError{Err: fmt.Errorf("download failed for key %s: %w", rabbitMqMessage.Data.S3RawKey, downloadErr), Requeue: false}
	}

	// Transform image
	if err := rabbitMqService.transformHandler.TransformImage(rabbitMqMessage.Data); err != nil {
		log.Printf("Transform failed: %v", err)
		errorMsg = queueErrors.ErrTransform
		status := types.FAILED
		if err := rabbitMqService.PublishToChannelHelper(ctx, rabbitMqMessage.Data.Id, rabbitMqMessage.Data.UserId, status, publicUrl, errorMsg); err != nil {
			return err
		}

		// background: remove local raw and delete s3
		rabbitMqService.fireBackgroundCleanup(ctx, downloadPath, uploadPath, rabbitMqMessage.Data.S3RawKey, "remove_local_and_delete_s3")
		return models.ProcessingError{Err: fmt.Errorf("transform failed for key %s: %w", rabbitMqMessage.Data.S3RawKey, err), Requeue: false}
	}

	// Handle upload
	splitString := strings.Split(rabbitMqMessage.Data.S3RawKey, "/")
	if len(splitString) < 2 {
		errorMsg = queueErrors.ErrUpload
		status = types.FAILED
		_ = rabbitMqService.PublishToChannelHelper(ctx, rabbitMqMessage.Data.Id, rabbitMqMessage.Data.UserId, status, publicUrl, errorMsg)
		return models.ProcessingError{Err: fmt.Errorf("unexpected S3RawKey format: %s", rabbitMqMessage.Data.S3RawKey), Requeue: false}
	}

	finalKey := splitString[1]
	if rabbitMqMessage.Data.TransformationType == "CONVERT" {
		var convert types.Convert
		if err := utils.ParseJSON([]byte(rabbitMqMessage.Data.TransformationParameters), &convert); err != nil {
			return fmt.Errorf("failed to parse message: %w", err)
		}
	
		dotIndex := strings.LastIndex(finalKey, ".")
		if dotIndex == -1 {
			return fmt.Errorf("unexpected S3RawKey format: %s", rabbitMqMessage.Data.S3RawKey)
		}
		base := finalKey[:dotIndex]
		finalKey = fmt.Sprintf("%s.%s", base, convert.Format)
	}

	formattedKey := fmt.Sprintf("processed/%s", finalKey)

	// Upload to S3
	var uploadErr error
	for i := 0; i < 3; i++ {
		publicUrl, uploadErr = rabbitMqService.s3Service.UploadtoS3Object(ctx, formattedKey)
		log.Printf("i:%d Public URL: %s and err: %v", i, publicUrl, uploadErr)
		if uploadErr == nil {
			break
		}
		if i < 2 {
			time.Sleep(2 * time.Second)
		}
	}

	if uploadErr != nil {
		fmt.Printf("error in upload: %v", uploadErr)
		errorMsg = queueErrors.ErrUpload
		status = types.FAILED
		if err := rabbitMqService.PublishToChannelHelper(ctx, rabbitMqMessage.Data.Id, rabbitMqMessage.Data.UserId, status, publicUrl, errorMsg); err != nil {
			return err
		}

		rabbitMqService.fireBackgroundCleanup(ctx, downloadPath, uploadPath, rabbitMqMessage.Data.S3RawKey, "remove_local_all_and_delete_s3")
		return models.ProcessingError{Err: fmt.Errorf("upload failed for key %s: %w", formattedKey, uploadErr), Requeue: false}
	}

	// Mark as processed
	status = types.PROCCESSED
	if err := rabbitMqService.PublishToChannelHelper(ctx, rabbitMqMessage.Data.Id, rabbitMqMessage.Data.UserId, status, publicUrl, errorMsg); err != nil {
		return err
	}

	rabbitMqService.fireBackgroundCleanup(ctx, downloadPath, uploadPath, rabbitMqMessage.Data.S3RawKey, "cleanup_all")
	return nil
}

func (rabbitMqService *RabbitMqService) Start(conn *amqp.Connection, ctx context.Context) error {
	for _, queueName := range rabbitMqService.config.RabbitMqQueues {
		q := queueName

		ch, err := utils.NewChannel(conn)
		if err != nil {
			conn.Close()
			log.Fatal("failed to open RabbitMQ channel :", err)
		}

		_, err = utils.NewQueue(ch, queueName)
		if err != nil {
			ch.Close()
			conn.Close()
			log.Fatalf("failed to declare %s : %v", queueName, err)
		}
		log.Printf("[%s] declared", queueName)
		if q == "status_queue" {
			rabbitMqService.statusQueueChannel = ch
			if err = rabbitMqService.declareExchange(); err != nil {
				log.Fatalf("Failed to declare exchange: %v", err)
			}
			err = ch.QueueBind(
				"status_queue",
				"status",
				"image_processing",
				false,
				nil,
			)
			if err != nil {
				log.Fatalf("Failed to bind status queue: %v", err)
			}
			log.Println("started queue and channel for status queue, skipping the consuming")
			continue
		}

		ch.Close()

		count, ok := config.Worker[queueName]
		if !ok {
			log.Printf("could not get worker count for [%s]", queueName)
			count = 1
		}
		for i := range count {
			log.Printf("[%s] started :  worker no %d", queueName, i+1)
			go func(queueName string) {
				var consumerCh *amqp.Channel
				defer func() {
					if consumerCh != nil {
						consumerCh.Close()
					}
				}()

				for {
					select {
					case <-ctx.Done():
						log.Printf("[%s] Shutting down...", queueName)
						return
					default:
					}

					if consumerCh == nil || consumerCh.IsClosed() {
						if consumerCh != nil {
							consumerCh.Close()
						}

						conn, err := utils.NewRabbitMQClient(rabbitMqService.config.RabbitMqURL)
						if err != nil {
							log.Printf("failed to connect to RabbitMQ: %v", err)
						}
						rabbitMqService.rabbitMqConn = conn
						newCh, err := utils.NewChannel(conn)
						if err != nil {
							log.Printf("[%s] Failed to create channel: %v", queueName, err)
							time.Sleep(5 * time.Second)
							continue
						}
						consumerCh = newCh
						log.Printf("[%s] Channel created", queueName)
					}

					msgs, err := utils.NewQueueConsumer(consumerCh, queueName)
					if err != nil {
						log.Printf("[%s] Failed to start consumer: %v", queueName, err)
						consumerCh.Close()
						consumerCh = nil
						time.Sleep(5 * time.Second)
						continue
					}

					log.Printf("[%s] Worker started, waiting for messages...", queueName)

					channelClosed := false
					for !channelClosed {
						select {
						case <-ctx.Done():
							log.Printf("[%s] Shutting down...", queueName)
							return
						case d, ok := <-msgs:
							if !ok {
								log.Printf("[%s] Channel closed, will recreate", queueName)
								consumerCh = nil
								channelClosed = true
								time.Sleep(2 * time.Second)
								break
							}

							if err := rabbitMqService.ProcessMessage(ctx, d); err != nil {
								log.Printf("[%s] Error processing message: %v", queueName, err)

								var procErr models.ProcessingError
								if errors.As(err, &procErr) {
									if procErr.Requeue {
										d.Nack(false, true)
									} else {
										d.Nack(false, false)
									}
									continue
								}

								if utils.IsTransientError(err) {
									d.Nack(false, true)
								} else {
									d.Nack(false, false)
								}
								continue
							}

							d.Ack(false)
						}
					}
				}
			}(q)
		}

	}

	<-ctx.Done()
	log.Println("Shutting down all consumers gracefully...")
	return nil
}

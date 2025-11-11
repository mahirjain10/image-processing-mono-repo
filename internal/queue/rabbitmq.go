package queue

import (
	"context"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/mahirjain10/go-workers/config"
	"github.com/mahirjain10/go-workers/internal/aws"
	"github.com/mahirjain10/go-workers/internal/transformation"
	"github.com/mahirjain10/go-workers/internal/types"
	"github.com/mahirjain10/go-workers/internal/utils"
	amqp "github.com/rabbitmq/amqp091-go"
)

// ─── STRUCT AND CONSTRUCTOR ────────────────────────────────────────────────

type RabbitMqService struct {
	s3Service          *aws.S3Service
	config             *config.Config
	rabbitMqConn       *amqp.Connection
	statusQueueChannel *amqp.Channel
}

func NewRabbitMqService(s3Service *aws.S3Service, rabbitMqConn *amqp.Connection, config *config.Config) *RabbitMqService {
	return &RabbitMqService{s3Service: s3Service, rabbitMqConn: rabbitMqConn, config: config}
}

func (rabbitMqService *RabbitMqService) GetStatusQueueChannel() *amqp.Channel {
	return rabbitMqService.statusQueueChannel
}

// ─── CONNECTION HANDLING ──────────────────────────────────────────────────

func (rabbitMqService *RabbitMqService) closeRabbitMqConn(queueChannel *amqp.Channel) error {
	if queueChannel != nil {
		if err := queueChannel.Close(); err != nil {
			log.Printf("Error closing channel: %v", err)
		}
	}
	if rabbitMqService.rabbitMqConn != nil {
		if err := rabbitMqService.rabbitMqConn.Close(); err != nil {
			log.Printf("Error closing RabbitMQ connection: %v", err)
		}
	}
	return nil
}

func NewRabbitMQClient(url string) (*amqp.Connection, error) {
	conn, err := amqp.Dial(url)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to RabbitMQ: %v", err)
	}
	return conn, nil
}

func NewChannel(conn *amqp.Connection) (*amqp.Channel, error) {
	ch, err := conn.Channel()
	if err != nil {
		return nil, fmt.Errorf("failed to open channel :%v", err)
	}
	return ch, nil
}

// ─── QUEUE CREATION AND CONSUMER SETUP ─────────────────────────────────────

func NewQueue(ch *amqp.Channel, queueName string) (*amqp.Queue, error) {
	queue, err := ch.QueueDeclare(queueName, true, false, false, false, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to start channel : %v", err)
	}
	return &queue, nil
}

func NewQueueConsumer(ch *amqp.Channel, queueName string) (<-chan amqp.Delivery, error) {
	msgs, err := ch.Consume(queueName, "", false, false, false, false, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to consume : %v", err)
	}
	return msgs, nil
}

func (rabbitMqService *RabbitMqService) DeclareExchange() error {
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
		return fmt.Errorf("error while declaring an exchange %w", err)
	}
	return nil
}

// ─── MESSAGE PUBLISHING ───────────────────────────────────────────────────

func (rabbitMqService *RabbitMqService) PublishToChannel(ctx context.Context, message map[string]string) error {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	serializedMessage, err := utils.SerializeJSON(message)
	if err != nil {
		log.Fatalf("failed to serialize message %v", err)
	}

	err = rabbitMqService.statusQueueChannel.PublishWithContext(ctx,
		"status_exchange",
		"",
		true,
		false,
		amqp.Publishing{
			ContentType: "application/json",
			Body:        serializedMessage,
		})
	if err != nil {
		return fmt.Errorf("failed to publish message: %w", err)
	}
	return nil
}

// ─── HELPER FUNCTIONS ─────────────────────────────────────────────────────

func isTransientError(err error) bool {
	if strings.Contains(err.Error(), "timeout") || strings.Contains(err.Error(), "connection reset") {
		return true
	}
	return false
}

func NewStatus(id string, userId string, status string) *types.Status {
	return &types.Status{Id: id, UserId: userId, Status: status}
}

// ─── IMAGE TRANSFORMATION ─────────────────────────────────────────────────

func (rabbitMqService *RabbitMqService) transformImage(imageProcessing types.ImageProcessing) error {
	dir, err := os.Getwd()
	if err != nil {
		return fmt.Errorf("error while getting dir : %w", err)
	}

	_, pathname := rabbitMqService.s3Service.GetDependencyData()
	imagePath := filepath.Join(dir, pathname)

	err = os.MkdirAll(imagePath, os.ModePerm)
	if err != nil {
		return fmt.Errorf("directory doesnt exists %w", err)
	}

	switch imageProcessing.TransformationType {
	case "RESIZE":
		var resize *types.Resize
		if err := utils.ParseJSON([]byte(imageProcessing.TransformationParameters), &resize); err != nil {
			return fmt.Errorf("failed to parse message: %w", err)
		}

		imageBuffer, err := utils.ReadImageBuffer(imagePath)
		if err != nil {
			return err
		}

		transformedImageBytes, err := transformation.Resize(imageBuffer, resize.Height, resize.Width)
		if err != nil {
			return err
		}

		err = utils.WriteImageBuffer(transformedImageBytes, imageProcessing.FileName)
		if err != nil {
			return err
		}

	default:
		return fmt.Errorf("given queue name doesnt exists")
	}

	return nil
}

// ─── MESSAGE PROCESSING ───────────────────────────────────────────────────

func (rabbitMqService *RabbitMqService) ProcessMessage(ctx context.Context, d amqp.Delivery) error {
	log.Printf("Received message: %s", d.Body)

	var rabbitMqMessage *types.RabbitMQMessage
	if err := utils.ParseJSON(d.Body, &rabbitMqMessage); err != nil {
		return fmt.Errorf("failed to parse message: %w", err)
	}

	log.Printf("Processing S3 event - Pattern: %s, Object: %+v", rabbitMqMessage.Pattern, rabbitMqMessage.Data)

	if rabbitMqMessage.Data.CreatedAt != "" {
		log.Printf("Message created at: %s, processing now - check for delays", rabbitMqMessage.Data.CreatedAt)
	}

	if err := rabbitMqService.s3Service.S3ObjectDownload(ctx, rabbitMqMessage.Data.S3RawKey); err != nil {
		log.Printf("error while downloading s3 object :%v", err)
		return fmt.Errorf("failed to download S3 object: %w", err)
	}

	log.Printf("Successfully processed object: %s", rabbitMqMessage.Data.S3ProcessedKey)

	err := rabbitMqService.transformImage(rabbitMqMessage.Data)
	if err != nil {
		log.Printf("error while transforming image:%v", err)
		return err
	}

	statusMsg := map[string]string{
		"id":     rabbitMqMessage.Data.Id,
		"userId": rabbitMqMessage.Data.UserId,
		"status": "completed",
	}

	if err := rabbitMqService.PublishToChannel(ctx, statusMsg); err != nil {
		return fmt.Errorf("failed to publish status message: %w", err)
	}

	return nil
}

// ─── WORKER START AND CONSUMER LOOP ───────────────────────────────────────

func (rabbitMqService *RabbitMqService) Start(conn *amqp.Connection, ctx context.Context) error {
	for _, queueName := range rabbitMqService.config.RabbitMqQueues {
		q := queueName

		ch, err := NewChannel(conn)
		if err != nil {
			conn.Close()
			log.Fatal("failed to open RabbitMQ channel :", err)
		}

		for _, fetchedQueues := range rabbitMqService.config.RabbitMqQueues {
			_, err = NewQueue(ch, fetchedQueues)
			if err != nil {
				ch.Close()
				conn.Close()
				log.Fatalf("failed to declare %s : %v", fetchedQueues, err)
			}
		}

		defer rabbitMqService.closeRabbitMqConn(ch)

		if q == "status_queue" {
			rabbitMqService.statusQueueChannel = ch
			log.Println("started queue and channel for status queue,skipping the consuming")
			continue
		}

		go func() {
			for {
				msgs, err := NewQueueConsumer(ch, q)
				if err != nil {
					log.Printf("[%s] Failed to start consumer: %v", q, err)
					time.Sleep(5 * time.Second)
					continue
				}

				log.Printf("[%s] Worker started, waiting for messages...", q)

				for {
					select {
					case <-ctx.Done():
						log.Printf("[%s] Shutting down...", q)
						return
					case d, ok := <-msgs:
						if !ok {
							log.Printf("[%s] Channel closed, reconnecting...", q)
							time.Sleep(5 * time.Second)
							break
						}

						if err := rabbitMqService.ProcessMessage(ctx, d); err != nil {
							log.Printf("[%s] Error processing message: %v", q, err)
							if isTransientError(err) {
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
		}()
	}

	<-ctx.Done()
	log.Println("Shutting down all consumers gracefully...")
	return nil
}

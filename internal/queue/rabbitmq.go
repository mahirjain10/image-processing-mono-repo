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

	// "github.com/mahirjain10/go-workers/internal/queue"
	"github.com/mahirjain10/go-workers/internal/transformation"

	"github.com/mahirjain10/go-workers/internal/types"
	"github.com/mahirjain10/go-workers/internal/utils"
	amqp "github.com/rabbitmq/amqp091-go"
)

// Dependency
type RabbitMqService struct {
	s3Service    *aws.S3Service
	config       *config.Config
	rabbitMqConn *amqp.Connection
}

func (rabbitMqService *RabbitMqService) closeRabbitMqConn(queueChannel *amqp.Channel) error {
	if queueChannel != nil {
		if err := queueChannel.Close(); err != nil {
			log.Printf("Error closing channel: %v", err)
		}
	}
	if rabbitMqService.rabbitMqConn != nil {
		if err := queueChannel.Close(); err != nil {
			log.Printf("Error closing RabbitMQ connection: %v", err)
		}
	}
	return nil
}

// Constructor function which returns pointer to RabbitMqService struct
// func NewRabbitMqService(s3Service *aws.S3Service, channel *amqp.Channel, config *config.Config) *RabbitMqService {
// 	return &RabbitMqService{s3Service: s3Service, channel: channel, config: config}
// }

func NewRabbitMqService(s3Service *aws.S3Service, rabbitMqConn *amqp.Connection, config *config.Config) *RabbitMqService {
	return &RabbitMqService{s3Service: s3Service, rabbitMqConn: rabbitMqConn, config: config}
}

// Constructor function to initialize a new client and returns connection on success or error on failure
func NewRabbitMQClient(url string) (*amqp.Connection, error) {
	conn, err := amqp.Dial(url)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to RabbitMQ: %v", err)
	}
	return conn, nil
}

// Constructor Method to intialize a new channel on success or returns error on failure
func NewChannel(conn *amqp.Connection) (*amqp.Channel, error) {
	ch, err := conn.Channel()
	if err != nil {
		return nil, fmt.Errorf("failed to open channel :%v", err)
	}
	return ch, nil
}

// Constructor function to initialize a new queue and returns a queue pointer on success or returns error on failure
func NewQueue(ch *amqp.Channel, queueName string) (*amqp.Queue, error) {
	queue, err := ch.QueueDeclare(
		queueName,
		true,
		false,
		false,
		false,
		nil,
	)

	if err != nil {
		return nil, fmt.Errorf("failed to start channel : %v", err)
	}
	return &queue, nil
}

// Constructor function to initialize a new queue returns delivery channel on success or failure
func NewQueueConsumer(ch *amqp.Channel, queueName string) (<-chan amqp.Delivery, error) {
	msgs, err := ch.Consume(queueName, "", false, false, false, false, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to consume : %v", err)
	}

	return msgs, nil
}

func isTransientError(err error) bool {
	if strings.Contains(err.Error(), "timeout") || strings.Contains(err.Error(), "connection reset") {
		return true
	}
	return false
}

// Private Method to transform the image and push into delivery status queue
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
		transformation.Resize(imageBuffer, resize.Height, resize.Width)
	default:
		return fmt.Errorf("given queue name doesnt exists")
	}
	return nil
}

// Process Messages from delivery
func (rabbitMqService *RabbitMqService) ProcessMessage(ctx context.Context, d amqp.Delivery) error {
	log.Printf("Received message: %s", d.Body)

	var rabbitMqMessage *types.RabbitMQMessage
	if err := utils.ParseJSON(d.Body, &rabbitMqMessage); err != nil {
		return fmt.Errorf("failed to parse message: %w", err)
	}

	log.Printf("Processing S3 event - Pattern: %s, Object: %+v", rabbitMqMessage.Pattern, rabbitMqMessage.Data)

	// Check message age for debugging
	if rabbitMqMessage.Data.CreatedAt != "" {
		log.Printf("Message created at: %s, processing now - check for delays", rabbitMqMessage.Data.CreatedAt)
	}
	// log.Printf("Image Processing : %+v", imageProcessing)

	if err := rabbitMqService.s3Service.S3ObjectDownload(ctx, rabbitMqMessage.Data.S3RawKey); err != nil {
		log.Printf("error while downloading s3 object :%v", err)
		return fmt.Errorf("failed to download S3 object: %w", err)
	}
	log.Printf("Successfully processed object: %s", rabbitMqMessage.Data.S3ProcessedKey)
	rabbitMqService.transformImage(rabbitMqMessage.Data)
	return nil
}

// processMessage handles individual message processing
func (rabbitMqService *RabbitMqService) Start(conn *amqp.Connection, ctx context.Context) error {
	for _, queueName := range rabbitMqService.config.RabbitMqQueues {
		q := queueName
		ch, err := NewChannel(conn)
		if err != nil {
			conn.Close()
			// return nil, fmt.Errorf("failed to open RabbitMQ channel: %w", err)
			log.Fatal("failed to open RabbitMQ channel :", err)
		}
		for _, fetchedQueues := range rabbitMqService.config.RabbitMqQueues {
			_, err = NewQueue(ch, fetchedQueues)
			if err != nil {
				ch.Close()
				conn.Close()
				// return nil, fmt.Errorf("failed to declare %s : %w", fetchedQueues, err)
				log.Fatalf("failed to declare %s : %v", fetchedQueues, err)
			}
		}
		defer rabbitMqService.closeRabbitMqConn(ch)
		go func() {
			for {
				// Try to start consumer
				msgs, err := NewQueueConsumer(ch, q)
				if err != nil {
					log.Printf("[%s] Failed to start consumer: %v", q, err)
					time.Sleep(5 * time.Second)
					continue
				}

				log.Printf("[%s] Worker started, waiting for messages...", q)

				// Main consume loop
				for {
					select {
					case <-ctx.Done():
						log.Printf("[%s] Shutting down...", q)
						return
					case d, ok := <-msgs:
						if !ok {
							log.Printf("[%s] Channel closed, reconnecting...", q)
							time.Sleep(5 * time.Second)
							break // breaks inner loop, reconnects outer loop
						}

						if err := rabbitMqService.ProcessMessage(ctx, d); err != nil {
							log.Printf("[%s] Error processing message: %v", q, err)

							// Only requeue if it's a transient error
							if isTransientError(err) {
								d.Nack(false, true) // requeue
							} else {
								d.Nack(false, false) // discard permanently
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

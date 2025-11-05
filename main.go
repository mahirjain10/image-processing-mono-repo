package main

import (
	"context"
	"fmt"
	"log"

	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/mahirjain10/go-workers/config"
	"github.com/mahirjain10/go-workers/internal/aws"
	"github.com/mahirjain10/go-workers/internal/queue"
	"github.com/mahirjain10/go-workers/internal/types"
	"github.com/mahirjain10/go-workers/internal/utils"

	amqp "github.com/rabbitmq/amqp091-go"
)

type App struct {
	config       *config.Config
	rabbitMqConn *amqp.Connection
	channel      *amqp.Channel
	s3Client     *s3.Client
	s3Service    *aws.S3Service
}

// NewApp creates and initializes a new App instance with all dependencies
func NewApp(ctx context.Context) (*App, error) {
	// Load environment configuration
	envConfig, err := config.InitializeEnvs()
	if err != nil {
		return nil, fmt.Errorf("failed to initialize environment config: %w", err)
	}

	// Initialize AWS configuration
	awsConfig, err := config.InitializeAws()
	if err != nil {
		return nil, fmt.Errorf("failed to initialize AWS config: %w", err)
	}

	// Create S3 client and service
	s3Client := aws.NewS3Client(awsConfig)
	downloadPath := "images" // Path relative to working directory
	s3Service := aws.NewS3Service(s3Client, envConfig.AwsBucketName, downloadPath)

	// Connect to RabbitMQ
	conn, err := queue.NewRabbitMQClient(envConfig.RabbitMqURL)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to RabbitMQ: %w", err)
	}

	// Create RabbitMQ channel
	ch, err := queue.NewChannel(conn)
	if err != nil {
		conn.Close()
		return nil, fmt.Errorf("failed to open RabbitMQ channel: %w", err)
	}

	// Declare queue
	_, err = queue.NewQueue(ch, envConfig.RabbitMqQueue)
	if err != nil {
		ch.Close()
		conn.Close()
		return nil, fmt.Errorf("failed to declare queue: %w", err)
	}

	return &App{
		config:       envConfig,
		rabbitMqConn: conn,
		channel:      ch,
		s3Client:     s3Client,
		s3Service:    s3Service,
	}, nil
}

// Close gracefully shuts down the application
func (a *App) Close() error {
	if a.channel != nil {
		if err := a.channel.Close(); err != nil {
			log.Printf("Error closing channel: %v", err)
		}
	}
	if a.rabbitMqConn != nil {
		if err := a.rabbitMqConn.Close(); err != nil {
			log.Printf("Error closing RabbitMQ connection: %v", err)
		}
	}
	return nil
}

// Start begins consuming messages from the queue
func (a *App) Start(ctx context.Context) error {
	msgs, err := queue.NewQueueConsumer(a.channel, a.config.RabbitMqQueue)
	if err != nil {
		return fmt.Errorf("failed to start queue consumer: %w", err)
	}

	log.Println("Worker started, waiting for messages...")

	for d := range msgs {
		if err := a.processMessage(ctx, d); err != nil {
			log.Printf("Error processing message: %v", err)
			d.Nack(false, false) // Negative acknowledgment, don't requeue
			continue
		}
		d.Ack(false)
	}

	return nil
}

// processMessage handles individual message processing
func (a *App) processMessage(ctx context.Context, d amqp.Delivery) error {
	log.Printf("Received message: %s", d.Body)

	var event *types.S3Event
	if err := utils.ParseJSON(d.Body, &event); err != nil {
		return fmt.Errorf("failed to parse message: %w", err)
	}

	log.Printf("Processing S3 event - Pattern: %s, Object: %+v", event.Pattern, event.Data[0].S3.Object)

	if err := a.s3Service.S3ObjectDownload(ctx, event.Data[0].S3.Object.Key); err != nil {
		return fmt.Errorf("failed to download S3 object: %w", err)
	}

	log.Printf("Successfully processed object: %s", event.Data[0].S3.Object.Key)
	return nil
}

func main() {
	ctx := context.Background()

	// Initialize application
	app, err := NewApp(ctx)
	if err != nil {
		log.Fatalf("Failed to initialize application: %v", err)
	}
	defer app.Close()

	log.Println("Application initialized successfully")

	// Start consuming messages
	if err := app.Start(ctx); err != nil {
		log.Fatalf("Failed to start application: %v", err)
	}
}

package main

import (
	"context"
	"fmt"
	"log"

	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/mahirjain10/go-workers/config"
	"github.com/mahirjain10/go-workers/internal/aws"
	"github.com/mahirjain10/go-workers/internal/queue"

	amqp "github.com/rabbitmq/amqp091-go"
)

type App struct {
	config       *config.Config
	rabbitMqConn *amqp.Connection
	// channel         *amqp.Channel
	s3Client        *s3.Client
	s3Service       *aws.S3Service
	rabbitMqService *queue.RabbitMqService
}

// NewApp creates and initializes a new App instance with all dependencies
func NewApp(ctx context.Context) (*App, error) {
	// Load environment configuration
	envConfig, err := config.InitializeEnvs()
	if err != nil {
		return nil, fmt.Errorf("failed to initialize environment config: %w", err)
	}

	// Initialize AWS configuration
	awsConfig, err := config.InitializeAws(ctx)
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

	// Initialize RabbitMQ service (no need to create channel here)
	rabbitMqService := queue.NewRabbitMqService(s3Service, conn, envConfig)

	// Return the fully initialized App
	return &App{
		config:          envConfig,
		rabbitMqConn:    conn,
		s3Client:        s3Client,
		s3Service:       s3Service,
		rabbitMqService: rabbitMqService,
	}, nil
}

// Close gracefully shuts down the application
// func (a *App) Close() error {
// 	if a.channel != nil {
// 		if err := a.channel.Close(); err != nil {
// 			log.Printf("Error closing channel: %v", err)
// 		}
// 	}
// 	if a.rabbitMqConn != nil {
// 		if err := a.rabbitMqConn.Close(); err != nil {
// 			log.Printf("Error closing RabbitMQ connection: %v", err)
// 		}
// 	}
// 	return nil
// }

func main() {
	ctx := context.Background()

	// Initialize application
	app, err := NewApp(ctx)
	if err != nil {
		log.Fatalf("Failed to initialize application: %v", err)
	}
	// defer app.Close()

	log.Println("Application initialized successfully")

	// Start consuming messages
	if err := app.rabbitMqService.Start(app.rabbitMqConn, ctx); err != nil {
		log.Fatalf("Failed to start application: %v", err)
	}
}

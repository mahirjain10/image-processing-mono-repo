package models

import (
	"github.com/mahirjain10/go-workers/config"
	"github.com/mahirjain10/go-workers/internal/aws"
	"github.com/mahirjain10/go-workers/internal/types"
	amqp "github.com/rabbitmq/amqp091-go"
)

type ProcessingError struct {
	Err     error
	Requeue bool
}

func (p ProcessingError) Error() string {
	return p.Err.Error()
}

type RabbitMqMessage struct {
	Pattern string
	Data    types.ImageProcessing
}

type RabbitMqService struct {
	s3Service          *aws.S3Service
	config             *config.Config
	rabbitMqConn       *amqp.Connection
	statusQueueChannel *amqp.Channel
}

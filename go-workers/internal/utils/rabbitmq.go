package utils

import (
	"fmt"
	"strings"

	amqp "github.com/rabbitmq/amqp091-go"
)

// ─── CONNECTION AND CHANNEL MANAGEMENT ────────────────────────────────────

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

// ─── QUEUE OPERATIONS ─────────────────────────────────────────────────────

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

// ─── ERROR CLASSIFICATION ─────────────────────────────────────────────────

func IsTransientError(err error) bool {
	if strings.Contains(err.Error(), "timeout") || strings.Contains(err.Error(), "connection reset") {
		return true
	}
	return false
}

func IsFatalError(err error) bool {
	// Infrastructure failures that should stop the worker
	errorStr := strings.ToLower(err.Error())
	
	// RabbitMQ connection issues
	if strings.Contains(errorStr, "connection closed") || strings.Contains(errorStr, "channel closed") {
		return true
	}
	
	// AWS authentication issues
	if strings.Contains(errorStr, "invalid credentials") || strings.Contains(errorStr, "access denied") {
		return true
	}
	
	// System resource issues
	if strings.Contains(errorStr, "no space left") || strings.Contains(errorStr, "out of memory") {
		return true
	}
	
	return false
}
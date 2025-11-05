package queue

import (
	"fmt"

	amqp "github.com/rabbitmq/amqp091-go"
)

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

func NewQueueConsumer(ch *amqp.Channel, queueName string) (<-chan amqp.Delivery, error) {
	msgs, err := ch.Consume(queueName, "", false, false, false, false, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to consume : %v", err)
	}

	return msgs, nil
}

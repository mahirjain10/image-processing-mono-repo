package main

import (
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
	s3Client     *s3.Client
}

func main() {
	app := &App{}
	envConfig, err := config.InitializeEnvs()
	if err != nil {
		fmt.Println(err)
		panic(err)
	}
	cfg, err := config.InitializeAws()
	if err != nil {
		fmt.Println(err)
	}
	fmt.Printf("CFG : %v", cfg)
	app.s3Client = aws.NewS3Client(cfg)

	fmt.Println(envConfig)
	app.config = envConfig
	conn, err := queue.NewRabbitMQClient(app.config.RabbitMqURL)
	if err != nil {
		log.Fatal(err)
	}
	defer conn.Close()
	app.rabbitMqConn = conn
	ch, err := queue.NewChannel(app.rabbitMqConn)
	if err != nil {
		log.Fatalf("Failed to open channel :%v", err)
	}
	defer ch.Close()
	newQueue, err := queue.NewQueue(ch, app.config.RabbitMqQueue)
	if err != nil {
		log.Fatalf("Failed to start a queue :%v", err)
	}

	msgs, err := queue.NewQueueConsumer(ch, newQueue.Name)
	if err != nil {
		log.Fatalf("Failed to start a queue :%v", err)
	}
	var forever chan struct{}

	go func() {
		for d := range msgs {
			log.Printf("Received a message: %s", d.Body)
			d.Ack(false)
		}
	}()

	log.Printf(" [*] Waiting for messages. To exit press CTRL+C")
	<-forever
}

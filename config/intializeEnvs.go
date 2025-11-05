package config

import (
	"fmt"
	"os"
	"path/filepath"

	godotenv "github.com/joho/godotenv"
)

type Config struct {
	RabbitMqURL   string
	RabbitMqQueue string
	AwsBucketName string
}

func NewConfig(url string, queueName string, bucketName string) *Config {
	return &Config{
		RabbitMqURL:   url,
		RabbitMqQueue: queueName,
		AwsBucketName: bucketName,
	}
}
func InitializeEnvs() (*Config, error) {
	path, err := os.Getwd()
	if err != nil {
		panic(err)
	}
	fmt.Println("Working dir:", path)

	envPath := filepath.Join(path, ".env")

	err = godotenv.Load(envPath)
	if err != nil {
		return nil, fmt.Errorf("warning: .env file not found, using system environment variables")
	}

	url := os.Getenv("RABBITMQ_URL")
	queue := os.Getenv("RABBITMQ_QUEUE")
	aws_region := os.Getenv("AWS_REGION")
	aws_access_key_id := os.Getenv("AWS_ACCESS_KEY_ID")
	aws_secret_access_key := os.Getenv("AWS_SECRET_ACCESS_KEY")
	aws_bucket_name := os.Getenv("AWS_BUCKET_NAME")

	if url == "" || queue == "" || aws_region == "" || aws_access_key_id == "" || aws_secret_access_key == "" || aws_bucket_name == "" {
		return nil, fmt.Errorf("RABBITMQ_URL or RABBITMQ_QUEUE or AWS_REGION or AWS_ACCESS_KEY_ID or AWS_SECRET_ACCESS_KEY or AWS_BUCKET_NAME is missing")
	}
	config := NewConfig(url, queue, aws_bucket_name)
	return config, nil
}

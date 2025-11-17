package config

import (
	"fmt"
	"log"
	"os"
	"strings"

	godotenv "github.com/joho/godotenv"
)

type Config struct {
	RabbitMqURL    string
	RabbitMqQueues []string
	AwsBucketName  string
	DbURL          string
}

func NewConfig(url string, queueNames []string, bucketName string, dbUrl string) *Config {
	return &Config{
		RabbitMqURL:    url,
		RabbitMqQueues: queueNames,
		AwsBucketName:  bucketName,
		DbURL:          dbUrl,
	}
}

func InitializeEnvs() (*Config, error) {
	wd, err := os.Getwd()
	if err != nil {
		return nil, fmt.Errorf("failed to get working dir: %w", err)
	}
	log.Println("Working dir:", wd)

	switch os.Getenv("APP_ENV") { 
	case "docker":
		if err := godotenv.Overload(".env.docker"); err == nil {
			log.Println("Loaded .env.docker")
		} else {
			log.Println(".env.docker not found, using existing environment")
		}
	case "dev", "":
		if err := godotenv.Overload(".env.dev"); err == nil {
			log.Println("Loaded .env.dev")
		} else if err := godotenv.Overload(".env"); err == nil {
			log.Println("Loaded .env")
		} else {
			log.Println("No .env.dev or .env found, using system environment variables")
		}
	default:
		fname := ".env." + os.Getenv("APP_ENV")
		if err := godotenv.Overload(fname); err == nil {
			log.Printf("Loaded %s", fname)
		} else if err := godotenv.Overload(".env"); err == nil {
			log.Println("Loaded .env")
		} else {
			log.Printf("No %s or .env found, using system environment variables", fname)
		}
	}

	url := os.Getenv("RABBITMQ_URL")
	queues := os.Getenv("RABBITMQ_QUEUES")
	aws_region := os.Getenv("AWS_REGION")
	aws_access_key_id := os.Getenv("AWS_ACCESS_KEY_ID")
	aws_secret_access_key := os.Getenv("AWS_SECRET_ACCESS_KEY")
	aws_bucket_name := os.Getenv("AWS_BUCKET_NAME")
	db_url := os.Getenv("DATABASE_URL")

	fmt.Println("Printing", url, queues, aws_region, aws_access_key_id, aws_secret_access_key)
	if url == "" || queues == "" || aws_region == "" || aws_access_key_id == "" || aws_secret_access_key == "" || aws_bucket_name == "" || db_url == "" {
		return nil, fmt.Errorf("RABBITMQ_URL or RABBITMQ_QUEUES or AWS_REGION or AWS_ACCESS_KEY_ID or AWS_SECRET_ACCESS_KEY or AWS_BUCKET_NAME or DATABASE_URL is missing")
	}
	queuesArray := strings.Split(queues, ",")
	for i := range queuesArray {
		queuesArray[i] = strings.TrimSpace(queuesArray[i])
	}
	config := NewConfig(url, queuesArray, aws_bucket_name, db_url)
	return config, nil
}

package aws

import (
	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/s3"
)

func NewS3Client(cfg aws.Config) *s3.Client {
	return s3.NewFromConfig(cfg)
}

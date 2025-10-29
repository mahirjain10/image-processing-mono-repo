import { Inject, Injectable, LoggerService } from '@nestjs/common';
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';

@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);
  constructor(@Inject('S3_CLIENT') private readonly s3Client: S3Client, private readonly configService: ConfigService) { }
  async generatePresignedUrl(key: string, mimeType: string) {
    
    const uuid = randomUUID()
    const s3Key = `raw/${uuid}+${Date.now()}+${key}`
    
    const command = new PutObjectCommand({
      Bucket: this.configService.get<string>('aws.bucket'),
      Key: s3Key,
      ContentType:mimeType
    });


    const preSignedUrl = await getSignedUrl(this.s3Client, command, {
      expiresIn:3000, // 5 mins
      signableHeaders:new Set(['content-type'])
    });

    this.logger.log('Generated URL : ',preSignedUrl)
    
    return preSignedUrl
    
  }

}



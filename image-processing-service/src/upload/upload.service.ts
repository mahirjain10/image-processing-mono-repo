import { randomUUID } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

import {
  EXPIRES_IN,
  STATUS,
  TRANSFORMATION_TYPE,
} from './constants/upload.constants';
import { PrismaService } from '@shared/prisma/prisma.service';
import { ImageProcessing } from '@shared/prisma/generated/client';
import {
  ImageProcessingResponse,
  TransformationParamters,
} from './interface/upload.interface';
import { stringify } from 'querystring';
import { TransformationType } from 'class-transformer';
import { PubsubService } from '@shared/pubsub/pubsub.service';
import {
  NOTIFICATION_CHANNEL,
  STATUS_TYPE,
  StatusMessage,
} from '@shared/interface/status-pub-sub.interface';

@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);

  // Lazy getter
  private get imageProcessingDb() {
    return this.prismaService.imageProcessing;
  }

  constructor(
    @Inject('S3_CLIENT') private readonly s3Client: S3Client,
    private readonly configService: ConfigService,
    private readonly prismaService: PrismaService,
    @Inject('PUB_SUB') private readonly pubSubService: PubsubService,
  ) {}

  public async updateImageProcessingStatus(
    id: string,
    statusToUpdate: STATUS,
    errorMsg: string | null,
  ): Promise<ImageProcessingResponse> {
    const fetchData = await this.imageProcessingDb.findFirst({ where: { id } });

    if (!fetchData) {
      return {
        data: null,
        message: 'Status not found',
      };
    }

    if (fetchData.status === statusToUpdate) {
      return {
        data: null,
        message: 'Cannot update same status again',
      };
    }

    const updatedData = await this.imageProcessingDb.update({
      where: { id },
      data: { status: statusToUpdate },
    });

    const statusMessage: StatusMessage = {
      userId: updatedData.userId,
      jobId: updatedData.id,
      status: statusToUpdate,
      type: STATUS_TYPE,
      errorMsg: errorMsg,
    };
    this.pubSubService.emit(NOTIFICATION_CHANNEL, statusMessage);
    return {
      data: updatedData,
      message: 'Updated status successfully',
    };
  }

  public async generatePresignedUrl(
    userID: string,
    filename: string,
    mimeType: string,
    transformationType: TRANSFORMATION_TYPE,
    transformationParamters: {
      height?: number;
      width?: number;
      degree?: number;
      format?: string;
    },
  ) {
    // 1. Create image record before upload
    const imageRecord = await this.imageProcessingDb.create({
      data: {
        userId: userID,
        filename,
        status: STATUS.PENDING,
        transformationType,
        transformationParameters: JSON.stringify(transformationParamters),
      },
    });
    this.logger.debug('image record while saving: ', imageRecord);
    // 2. Generate S3 key
    const uuid = randomUUID();
    const s3Key = `raw/${userID}-${uuid}-${filename}`;

    // 3. Create PutObjectCommand
    const Bucket = this.configService.get<string>('aws.bucket');

    if (!Bucket) {
      this.logger.error('AWS bucket configuration is missing.');
      throw new Error('AWS configuration error');
    }

    const command = new PutObjectCommand({
      Bucket,
      Key: s3Key,
      ContentType: mimeType,
    });
    this.logger.debug(`s3Key : ${s3Key}`);
    // 4. Generate pre-signed upload URL
    const preSignedUrl = await getSignedUrl(this.s3Client, command, {
      expiresIn: EXPIRES_IN, // 5 minutes
      signableHeaders: new Set(['content-type']),
    });

    this.logger.log(`Generated upload URL for ${filename}`);

    // Store S3Key into our DB
    await this.imageProcessingDb.update({
      data: { s3RawKey: s3Key },
      where: { id: imageRecord.id },
    });
    return {
      id: imageRecord.id,
      preSignedUrl,
      filename,
    };
  }
}

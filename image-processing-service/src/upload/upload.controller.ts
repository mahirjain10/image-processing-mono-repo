import {
  Controller,
  Post,
  Body,
  InternalServerErrorException,
  Req,
  Logger,
  UseGuards,
  Patch,
  Query,
  BadRequestException,
  Inject,
} from '@nestjs/common';
// FastifyReply import is removed as @Res() is not used

import { UploadService } from './upload.service';
import { AuthGuard } from '@shared/guards/auth.guard';
import { AuthRequest } from '@shared/interface/AuthRequest.interface';
import { PUB_SUB } from '@shared/pubsub/pubsub.module';
import { UpdateStatusQuery } from './interface/upload.interface';
import { TransformImageDto } from './dto/upload.dto';
import { ClientProxy } from '@nestjs/microservices';
import {
  STATUS_TYPE,
  StatusMessage,
  NOTIFICATION_CHANNEL,
} from '@shared/interface/status-pub-sub.interface';

@Controller('upload')
@UseGuards(AuthGuard)
export class UploadController {
  private readonly logger = new Logger(UploadController.name);

  constructor(
    private readonly uploadService: UploadService,
    @Inject(PUB_SUB) private readonly pubSubClient: ClientProxy,
  ) {}

  /**
   * Updates the processing status of an image record.
   */
  @Patch('status')
  async updateStatus(
    @Req() req: AuthRequest,
    @Query() query: UpdateStatusQuery,
  ) {
    const { id, status, errorMsg } = query;
    let errMsg: string | null = null;
    const statusData = await this.uploadService.updateImageProcessingStatus(
      id,
      status,
      errorMsg || null,
    );

    // Throwing the exception lets the Global Exception Filter handle the 400 response.
    if (!statusData.data) {
      throw new BadRequestException(statusData.message);
    }
    if (statusData.data.status.toLowerCase() === 'failed') {
      errMsg =
        statusData.data.errorMessage?.length === 0
          ? null
          : statusData.data.errorMessage;
    }
    const statusMessage: StatusMessage = {
      status: status,
      userId: req.user.id,
      type: STATUS_TYPE,
      jobId: statusData.data.id,
      errorMsg: errMsg,
    };
    this.pubSubClient.emit(NOTIFICATION_CHANNEL, statusMessage);

    // Returning the object lets NestJS automatically send a 200 OK response.
    return {
      message: 'Image processing status updated successfully',
      data: statusData.data,
    };
  }

  /**
   * Generates a pre-signed S3 URL for file upload.
   */
  @Post('url')
  async generatePresignedUrl(
    @Req() req: AuthRequest,
    // Removed @Res() res: FastifyReply
    @Body() body: TransformImageDto,
  ) {
    this.logger.log('Generate presigned URL request received');

    const { filename, mimeType, transformationType, transformationParamters } =
      body;
    const userId = req.user.id;

    const presignData = await this.uploadService.generatePresignedUrl(
      userId,
      filename,
      mimeType,
      transformationType,
      transformationParamters,
    );

    this.logger.log(`Presigned URL generated for file: ${filename}`);

    return {
      message: 'Presigned URL generated successfully',
      data: presignData,
    };
  }
}

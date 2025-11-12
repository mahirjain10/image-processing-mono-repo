import { Injectable, Logger, Controller } from '@nestjs/common';
import {
  Ctx,
  MessagePattern,
  Payload,
  RmqContext,
} from '@nestjs/microservices';
import { PrismaService } from '@shared/prisma/prisma.service';
import { StatusData } from './interface/status.interface';
import { STATUS } from '@src/upload/constants/upload.constants';

@Controller()
@Injectable()
export class StatusService {
  private readonly logger = new Logger(StatusService.name);
  constructor(private readonly prismaService: PrismaService) {
  }
  @MessagePattern('status')
  async handleStatusUpdate(@Payload() data: any, @Ctx() context: RmqContext) {
    this.logger.log('Received status update:', data);

    try {
      // Check if this is a message from Go worker (has id, userId, status fields)
      if (this.isGoWorkerMessage(data)) {
        await this.processGoWorkerStatus(data);
      } else {
        // Handle NestJS microservice format messages
        await this.processNestJSStatus(data);
      }
    } catch (error) {
      this.logger.error('Error processing status update:', error);
    }

    // Acknowledge the message
    const channel = context.getChannelRef();
    const message = context.getMessage();
    channel.ack(message);
  }

  private isGoWorkerMessage(data: any): boolean {
    return data && typeof data === 'object' &&
      'id' in data && 'userId' in data && 'status' in data &&
      !('pattern' in data); // Go messages don't have pattern field
  }

  private async processGoWorkerStatus(data: StatusData) {
    this.logger.log(`Processing Go worker status - User: ${data.userId}, Status: ${data.status}`);
    const status = data.status === STATUS.PROCESSING ? STATUS.PROCESSING :
      data.status === STATUS.PROCESSED ? STATUS.PROCESSED :
        STATUS.FAILED
    const publicUrl = data.publicUrl === "" ? null : data.publicUrl;
    const errorMessage = data.errorMsg === "" ? null : data.errorMsg;
    const updatedData = await this.prismaService.imageProcessing.update({ where: { id: data.id }, data: { status, publicUrl, errorMessage } })
    this.logger.log("updated data: ", updatedData)
  }

  private async processNestJSStatus(data: any) {
    this.logger.log('Processing NestJS microservice status:', data);
    // Handle NestJS format messages here
  }
}

import { Controller, Logger } from '@nestjs/common';
import { Ctx, EventPattern, Payload, RmqContext } from '@nestjs/microservices';
import { PrismaService } from '@shared/prisma/prisma.service';
import { STATUS } from '@src/upload/constants/upload.constants';
import { NOTIFICATION_CHANNEL, STATUS_TYPE, StatusMessage } from '@shared/interface/status-pub-sub.interface';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { StatusData } from './interface/status.interface';

@Controller()
export class StatusEventController {
  private readonly logger = new Logger(StatusEventController.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly eventEmitter: EventEmitter2
  ) {}

  @EventPattern('status')
  async handleStatus(@Payload() data: StatusData, @Ctx() context: RmqContext) {
    this.logger.log(`Received status: ${JSON.stringify(data)}`);
    
    try {
      await this.processGoWorkerStatus(data);
    } catch (error) {
      this.logger.error('Error processing status:', (error as Error).stack ?? error);
    }

    try {
      const channel = context.getChannelRef();
      const originalMsg = context.getMessage();
      channel.ack(originalMsg);
      this.logger.log('RMQ message acknowledged.');
    } catch (ackErr) {
      this.logger.error('Failed to ack RMQ message:', (ackErr as Error).stack ?? ackErr);
    }
  }

  private async processGoWorkerStatus(data: StatusData) {
    const { id, userId, status: statusRaw, publicUrl: publicUrlRaw, errorMsg: errorMsgRaw } = data;

    this.logger.log(`Processing Go worker status - id:${id}, user:${userId}, status:${statusRaw}`);

    const status =
      statusRaw === STATUS.PROCESSING ? STATUS.PROCESSING :
      statusRaw === STATUS.PROCESSED ? STATUS.PROCESSED :
      STATUS.FAILED;

    const publicUrl = publicUrlRaw === undefined || publicUrlRaw === '' ? null : publicUrlRaw;
    const errorMessage = errorMsgRaw === undefined || errorMsgRaw === '' ? null : errorMsgRaw;

    try {
      const updatedData = await this.prismaService.imageProcessing.update({
        where: { id },
        data: { status, publicUrl, errorMessage },
      });

      const statusMessage: StatusMessage = {
        userId: updatedData.userId,
        jobId: updatedData.id,
        type: STATUS_TYPE,
        status,
      };

      this.eventEmitter.emit(NOTIFICATION_CHANNEL, statusMessage);

      this.logger.log(`Updated DB record ${updatedData.id} (user ${updatedData.userId}) - status ${status}`);
    } catch (dbErr) {
      this.logger.error('DB update failed for status message:', (dbErr as Error).stack ?? dbErr);
    }
  }
}
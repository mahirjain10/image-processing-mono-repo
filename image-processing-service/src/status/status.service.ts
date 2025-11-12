import { Injectable, Logger, Controller } from '@nestjs/common';
import {
  Ctx,
  MessagePattern,
  Payload,
  RmqContext,
} from '@nestjs/microservices';

@Controller()
@Injectable()
export class StatusService {
  private readonly logger = new Logger(StatusService.name);

  @MessagePattern('status')
  async handleStatusUpdate(@Payload() data: any, @Ctx() context: RmqContext) {
    this.logger.log('📩 Received status update:', data);
    
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

  private async processGoWorkerStatus(data: any) {
    this.logger.log(`🔧 Processing Go worker status - User: ${data.userId}, Status: ${data.status}`);
    
    if (data.publicUrl) {
      this.logger.log(`📸 Public URL available: ${data.publicUrl}`);
    }
    
    // Add your business logic here:
    // - Update database with new status
    // - Send notifications to users
    // - Trigger webhooks
    // - etc.
  }

  private async processNestJSStatus(data: any) {
    this.logger.log('🏗️ Processing NestJS microservice status:', data);
    // Handle NestJS format messages here
  }
}

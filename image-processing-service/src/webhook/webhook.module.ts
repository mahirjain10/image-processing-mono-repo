import { Module } from '@nestjs/common';
import { WebhookService } from './webhook.service';
import { WebhookController } from './webhook.controller';
import { HttpModule } from '@nestjs/axios';
import { RabbitmqModule } from '../shared/rabbitmq/rabbitmq.module';

@Module({
  imports: [HttpModule],
  providers: [WebhookService],
  controllers: [WebhookController],
  exports: [WebhookService],
})
export class WebhookModule {}

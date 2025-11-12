import { Module } from '@nestjs/common';
import { StatusService } from './status.service';
import { RabbitmqModule } from '../shared/rabbitmq/rabbitmq.module';
import { PrismaModule } from '@shared/prisma/prisma.module';

@Module({
  imports: [
    RabbitmqModule.register([
      {
        name: 'STATUS_QUEUE',
        queue: 'status_queue',
        durable: true,
      },
    ]),
    PrismaModule
  ],
  providers: [StatusService],
  controllers: [StatusService],
  exports: [StatusService],
})
export class StatusModule {}

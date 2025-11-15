import { Module } from '@nestjs/common';
import { StatusEventController } from './status-event.controller';
import { RabbitmqModule } from '../shared/rabbitmq/rabbitmq.module';
import { PrismaModule } from '@shared/prisma/prisma.module';
import { PubsubModule } from '@shared/pubsub/pubsub.module';
import { StatusController } from './status.controller';
import { AuthGuard } from '@shared/guards/auth.guard';
import { JwtService } from '@nestjs/jwt';

@Module({
  imports: [
    RabbitmqModule.register([
      {
        name: 'STATUS_QUEUE',
        queue: 'status_queue',
        durable: true,
    
      },
    ]),
    PrismaModule,
    PubsubModule,
  ],
  providers: [JwtService,],
  controllers: [StatusController,StatusEventController],
  exports: [],
})
export class StatusModule {}

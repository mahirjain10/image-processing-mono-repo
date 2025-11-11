import { Module } from '@nestjs/common';
import { AppController } from '@src/app.controller';
import { AppService } from '@src/app.service';
import { SharedModule } from '@shared/shared.module';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '@auth/auth.module';
import { PrismaModule } from '@shared/prisma/prisma.module';
import { UploadModule } from './upload/upload.module';
import config from '@config/config';
import { ScheduleModule } from '@nestjs/schedule';
import { CronsModule } from '@shared/crons/crons.module';
import { WebhookModule } from '@webhook/webhook.module';
import { SnsModule } from './sns/sns.module';
import { RabbitmqModule } from '@rabbitmq/rabbitmq.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ConfigModule.forRoot({
      isGlobal: true,
      load: [config],
      envFilePath:
        process.env.NODE_ENV === 'docker'
          ? '.env.docker'
          : process.env.NODE_ENV === 'local'
            ? '.env.local'
            : '.env.production',
    }),
    AuthModule,
    SharedModule,
    PrismaModule,
    UploadModule,
    CronsModule,
    WebhookModule,
    SnsModule,
    RabbitmqModule.register([
      {
        name: 'ROTATE_QUEUE',
        queue: 'rotate_queue',
        durable: true,
        prefetchCount: 5,
      },
      {
        name: 'RESIZE_QUEUE',
        queue: 'resize_queue',
        durable: true,
        prefetchCount: 5,
      },
      {
        name: 'FORCE_RESIZE_QUEUE',
        queue: 'force_resize_queue',
        durable: true,
        prefetchCount: 5,
      },
      {
        name: 'CONVERT_QUEUE',
        queue: 'convert_queue',
        durable: true,
        prefetchCount: 5,
      },
      {
        name: 'STATUS_QUEUE',
        queue: 'status_queue',
        durable: true,
        prefetchCount: 5,
      },
    ]),
  ],
  providers: [AppService],
  controllers: [AppController],
})
export class AppModule {}

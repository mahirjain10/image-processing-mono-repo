import { HttpAdapterHost, NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { CatchEverythingFilter } from '@shared/filters/exception.filters';
import { ConfigService } from '@nestjs/config';
import fastifyCookie from '@fastify/cookie';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';

const bootstrap = async () => {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
  );

  const httpAdapter = app.get(HttpAdapterHost);
  const configService = app.get(ConfigService);

  await app.register(fastifyCookie);

  app.useGlobalFilters(new CatchEverythingFilter(httpAdapter, configService));
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      skipMissingProperties: false,
      validateCustomDecorators: true,
    }),
  );

  // RMQ Microservice - Listen for messages from Go worker
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.RMQ,
    options: {
      urls: [
        configService.get<string>('rabbitmq.url') ||
          process.env.RABBITMQ_URL ||
          'amqp://localhost:5672',
      ],
      queue: 'status_queue',
      exchangeType: 'direct',
      queueOptions: {
        durable: true,
      },
      noAck: false,
      persistent: true,
      exchange: 'image_processing',
      routingKey: 'status',
    },
  });

  await app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.REDIS,
    options: {
      host: process.env.REDIS_HOST || 'localhost',
      port: Number(process.env.REDIS_PORT),
    },
  });

  await app.startAllMicroservices();
  await app.listen(process.env.PORT ?? 3000, '0.0.0.0');
};
bootstrap();

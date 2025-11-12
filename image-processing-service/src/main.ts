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

  // app.get => asking dependency manually from the DI container
  const httpAdapter = app.get(HttpAdapterHost);
  const configService = app.get(ConfigService);

  await app.register(fastifyCookie);

  app.useGlobalFilters(new CatchEverythingFilter(httpAdapter, configService));
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: false,
      transform: true, // <--- THIS is the key
      forbidNonWhitelisted: false,
    }),
  );
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.RMQ,
    options: {
      urls: ['amqp://localhost:5672'],
      queue: 'status_queue',
      exchangeType: 'direct',
      queueOptions: {
        durable: true, // false = keep queue in memeory and true = save data to the disk
      },
      noAck: false,
      persistent: true,
      exchange: 'image_processing',
      routingKey: 'status',
    },
  });
  await app.startAllMicroservices();
  await app.listen(process.env.PORT ?? 3000, '0.0.0.0');
};
bootstrap();

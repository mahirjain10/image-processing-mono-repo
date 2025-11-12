import { Transport, ClientsModule, RmqOptions } from '@nestjs/microservices';
import { Global, Module, DynamicModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';

interface QueueConfig {
  name: string;
  queue: string;
  durable?: boolean;
  prefetchCount?: number;
}

@Global()
@Module({})
export class RabbitmqModule {
  static register(queues: QueueConfig[]): DynamicModule {
    const clients = queues.map(
      ({ name, queue, durable = true, prefetchCount }) => ({
        name,
        imports: [ConfigModule],
        useFactory: (configService: ConfigService): RmqOptions => {
          const rmqUrl = configService.get<string>('rabbitmq.url');

          if (!rmqUrl) {
            // Fail early
            throw new Error(
              'Missing required environment variable for RabbitMQ: RABBITMQ_URL',
            );
          }

          return {
            transport: Transport.RMQ,
            options: {
              // routingKey: queue === 'status_queue' ? 'status' : '',
              exchange: 'image_processing',
              urls: [rmqUrl],
              queue,
              queueOptions: { durable },
              ...(prefetchCount && { prefetchCount }),
            },
          };
        },
        inject: [ConfigService],
      }),
    );

    return {
      module: RabbitmqModule,
      imports: [ConfigModule, ClientsModule.registerAsync(clients)],
      exports: [ClientsModule],
    };
  }
}

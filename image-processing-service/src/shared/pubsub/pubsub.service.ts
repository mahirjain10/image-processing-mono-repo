import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { NOTIFICATION_CHANNEL, StatusMessage } from '@shared/interface/status-pub-sub.interface';
import { EventEmitter2 } from '@nestjs/event-emitter';
import Redis from 'ioredis';

@Injectable()
export class PubsubService implements OnModuleInit, OnModuleDestroy {
  private sub: Redis | null = null;
  private logger = new Logger(PubsubService.name);

  constructor(
    @Inject('PUB_SUB') private readonly pubClient: ClientProxy,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async onModuleInit() {
    try {
      await this.pubClient.connect();
      this.logger.log('Connected to Redis Pub/Sub (ClientProxy)');

      // create a dedicated ioredis subscriber client
      this.sub = new Redis(process.env.REDIS_URL ?? `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`);

      // subscribe first, then listen for 'message' events
      await this.sub.subscribe(NOTIFICATION_CHANNEL);
      this.logger.log(`Subscribed to channel ${NOTIFICATION_CHANNEL}`);

      // handle incoming messages
      this.sub.on('message', (_channel: string, message: string) => {
        try {
          const parsed = JSON.parse(message);
          // emit into your Nest event bus
          this.eventEmitter.emit(NOTIFICATION_CHANNEL, parsed);
        } catch (err) {
          this.logger.error('Failed to parse message from Redis', err as any);
        }
      });

      this.sub.on('error', (err) => {
        this.logger.error('Redis subscriber error', err as any);
      });
    } catch (err) {
      this.logger.error('Failed to initialize PubsubService', err as any);
      throw err;
    }
  }

  async onModuleDestroy() {
    try {
      if (this.pubClient) {
        await this.pubClient.close();
        this.logger.log('Closed ClientProxy PUB_SUB');
      }
      if (this.sub) {
        await this.sub.quit();
        this.logger.log('Closed ioredis subscriber');
      }
    } catch (err) {
      this.logger.error('Error closing PubsubService', err as any);
    }
  }

  emit(pattern: string, data: StatusMessage) {
    // pattern should be validated/controlled by you
    this.logger.debug(`checking pattern ${pattern} and data ${data} `)
    this.pubClient.emit(pattern, JSON.stringify(data));
  }
}

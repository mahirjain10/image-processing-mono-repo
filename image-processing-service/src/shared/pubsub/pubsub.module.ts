import { DynamicModule, Module, Global, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientsModule, Transport, ClientOptions } from '@nestjs/microservices';
import { PubsubService } from './pubsub.service';

export const PUB_SUB = 'PUB_SUB'
@Global()
@Module({})
export class PubsubModule {
    static register(): DynamicModule {
        return {
            module: PubsubModule,
            imports: [
                ConfigModule,
                ClientsModule.registerAsync([
                    {
                        name: PUB_SUB,
                        imports: [ConfigModule],
                        useFactory: (configService: ConfigService): ClientOptions => {
                            const redisHost = configService.get<string>('redis.host');
                            const redisPort = configService.get<string>('redis.port');


                            if (!redisHost || !redisPort) {
                                throw new Error('REDIS_HOST or REDIS_PORT is not defined in environment variables');
                            }
                            return {
                                transport: Transport.REDIS,
                                options: {
                                    host: redisHost,
                                    port: Number(redisPort),

                                },
                            };
                        },
                        inject: [ConfigService],
                    },
                ]),
            ],
            providers: [PubsubService]
            ,
            exports: [ClientsModule ,PubsubService],
        };
    }
}


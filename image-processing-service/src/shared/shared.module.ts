import { Module } from '@nestjs/common';
import { S3Module } from './s3/s3.module';
import { CronsModule } from './crons/crons.module';
import { RabbitmqModule } from './rabbitmq/rabbitmq.module';
import { PubsubModule } from './pubsub/pubsub.module';

@Module({
  imports: [S3Module, CronsModule, RabbitmqModule,PubsubModule],
  providers: [],
  exports: [S3Module,PubsubModule],
})
export class SharedModule {}

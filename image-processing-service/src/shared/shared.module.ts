import { Module } from '@nestjs/common';
import { S3Module } from './s3/s3.module';
import { CronsModule } from './crons/crons.module';
import { RabbitmqModule } from './rabbitmq/rabbitmq.module';

@Module({
  imports: [S3Module, CronsModule, RabbitmqModule],
  providers: [],
  exports: [S3Module],
})
export class SharedModule {}

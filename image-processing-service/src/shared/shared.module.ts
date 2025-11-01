import { Module } from '@nestjs/common';
import { S3Module } from './s3/s3.module';
import { CronsModule } from './crons/crons.module';

@Module({
  imports: [S3Module, CronsModule],
  providers: [],
  exports: [S3Module],
})
export class SharedModule {}

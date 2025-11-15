import { Module, Logger } from '@nestjs/common';
import { S3Module } from '@shared/s3/s3.module';
import { UploadService } from './upload.service';
import { UploadController } from './upload.controller';
import { JwtService } from '@nestjs/jwt';
import { SharedModule } from '@shared/shared.module';
import { PUB_SUB, PubsubModule } from '@shared/pubsub/pubsub.module';

@Module({
  imports: [S3Module.register(),SharedModule,], // Only modules here
  providers: [UploadService, Logger,JwtService,], // Providers like Logger go here
  controllers:[UploadController], 
  exports: [UploadService],
})
export class UploadModule {}

import { Module, Logger } from '@nestjs/common';
import { S3Module } from '@shared/s3/s3.module';
import { UploadService } from './upload.service';
import { UploadController } from './upload.controller';
import { JwtService } from '@nestjs/jwt';

@Module({
  imports: [S3Module.register()], // Only modules here
  providers: [UploadService, Logger,JwtService], // Providers like Logger go here
  controllers:[UploadController], 
  exports: [UploadService],
})
export class UploadModule {}

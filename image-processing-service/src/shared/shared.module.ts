import { Module } from '@nestjs/common';
import { S3Module } from './s3/s3.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [DataAccessModule, S3Module, PrismaModule],
})
export class SharedModule {}

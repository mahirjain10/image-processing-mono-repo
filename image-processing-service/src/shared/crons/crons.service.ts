import { Inject, Injectable, LoggerService } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '@shared/prisma/prisma.service';
import handleS3KeysStatusJob from './jobs/handle-s3keys-status.job';
import { ConfigService } from '@nestjs/config';
import { S3Client } from '@aws-sdk/client-s3';

@Injectable()
export class CronsService {
    private readonly logger: LoggerService
    constructor(private readonly prismaService: PrismaService, private readonly configService: ConfigService, @Inject('S3_CLIENT') private readonly s3Client: S3Client) { }

    // @Cron(CronExpression.EVERY_10_SECONDS)
    // async checkStuckUploads() {
    //     await handleS3KeysStatusJob(this.prismaService, this.configService,this.s3Client);
    // }
}

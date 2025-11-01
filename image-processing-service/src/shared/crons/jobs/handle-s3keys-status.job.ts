import { PrismaService } from '@prisma/prisma.service'
import { Logger, LoggerService } from '@nestjs/common/services';
import { GetObjectCommand, HeadObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { ConfigService } from '@nestjs/config';

const handleS3KeysStatusJob = async (prismaService: PrismaService, configService: ConfigService, S3Client: S3Client,) => {
    const logger = new Logger()
    logger.log('Starting Cleanup')
    const THRESHOLD_SECONDS = 10;
    const thresholdDate = new Date(Date.now() - THRESHOLD_SECONDS * 1000);

    const stuckUploads = await prismaService.imageProcessing.findMany({
        where: {
            status: 'UPLOADING',
            updatedAt: {
                lte: thresholdDate
            },
        }
    });
    logger.log('total rows found : ',stuckUploads.length)
    const bucketName = configService.get<string>('aws.bucket')
    let totalDeletedCount = 0
    await Promise.all(
        stuckUploads.map(async ({id, s3RawKey }) => {
            if (!s3RawKey) throw new Error('S3 raw key missing');
            logger.debug(`${id} ${s3RawKey}`)
            try {
                await S3Client.send(
                    new HeadObjectCommand({
                        Bucket: bucketName,
                        Key: s3RawKey,
                    })
                );

            } catch (err: any) {
                if (err?.$metadata?.httpStatusCode === 404) {
                    await prismaService.imageProcessing.delete({where:{id}})
                    totalDeletedCount++;
                } else {
                    logger.error("Error checking S3 object:", err);
                }
            }
        })
    );
    logger.log('Total Deleted Rows (Upload Stuck):',totalDeletedCount)
    logger.log('Starting Finish')
};


export default handleS3KeysStatusJob
import { HttpService } from '@nestjs/axios';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { ImageProcessing } from '@shared/prisma/generated/client';
import { PrismaService } from '@shared/prisma/prisma.service';
import { firstValueFrom, take, timeout } from 'rxjs';
import { S3Record } from './interface/s3Record.interface';
import { TRANSFORMATION_TYPE } from '@src/upload/constants/upload.constants';
let numberOfTimesFuncCalled = 0;
let numberOfTimesSuccessfullyPushed = 0;
@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);
  constructor(
    private readonly httpService: HttpService,
    private readonly prismaService: PrismaService,
    @Inject('ROTATE_QUEUE') private readonly RotateQueue: ClientProxy,
    @Inject('RESIZE_QUEUE') private readonly ResizeQueue: ClientProxy,
    @Inject('FORCE_RESIZE_QUEUE')
    private readonly ForceResizeQueue: ClientProxy,
    @Inject('CONVERT_QUEUE') private readonly ConvertQueue: ClientProxy,
  ) {}
  private getTransformation = async (
    s3RawKey: string,
  ): Promise<ImageProcessing | null> => {
    const data = await this.prismaService.imageProcessing.findFirst({
      where: { s3RawKey },
    });
    return data;
  };
  snsHandshake = async (subscribeUrl: string) => {
    this.logger.log('Received SNS Subscription Confirmation. Confirming...');
    try {
      await firstValueFrom(this.httpService.get(subscribeUrl));

      this.logger.log('Subscription confirmed successfully!');
    } catch (error) {
      this.logger.error('Failed to confirm subscription:', error);
    }

    return;
  };
  handleS3UploadSuccessEvent = async (bodyJson: S3Record) => {
    numberOfTimesFuncCalled++;
    this.logger.log('numberOfTimesFuncCalled: ', numberOfTimesFuncCalled);
    this.logger.debug('body json :', bodyJson);
    this.logger.debug('body key json :', bodyJson.s3.object.key);
    // this.logger.debug(
    //   `traceid: ${randomUUID()} for recorde: `,
    //   bodyJson.s3.object.key,
    // );
    const imageProcessing = await this.getTransformation(
      bodyJson.s3.object.key,
    );
    const transformationType = imageProcessing?.transformationType;
    this.logger.debug('image processing data : ', imageProcessing);
    const dataToSend = {
      ...imageProcessing,
      s3PublicUrl: bodyJson.s3.object.key,
    };
    this.logger.debug('data to send : ', dataToSend);

    let value;
    switch (transformationType) {
      case TRANSFORMATION_TYPE.CONVERT:
        this.ConvertQueue.emit('convert_queue', imageProcessing)
          .pipe(take(1), timeout(5000))
          .subscribe({
            next: () =>
              this.logger.debug(
                `emit succeeded for job ${imageProcessing?.id}`,
              ),
            error: (err) =>
              this.logger.error(
                `emit error for job ${imageProcessing?.id}`,
                err,
              ),
          });
        this.logger.debug('Pushed into convert_queue');
        break;
      case TRANSFORMATION_TYPE.FORCE_RESIZE:
        this.ForceResizeQueue.emit('force_resize_queue', imageProcessing)
          .pipe(take(1), timeout(5000))
          .subscribe({
            next: () =>
              this.logger.debug(
                `emit succeeded for job ${imageProcessing?.id}`,
              ),
            error: (err) =>
              this.logger.error(
                `emit error for job ${imageProcessing?.id}`,
                err,
              ),
          });
        this.logger.debug('Pushed into force_resize_queue');
        break;
      case TRANSFORMATION_TYPE.RESIZE:
        this.ResizeQueue.emit('resize_queue', imageProcessing)
          .pipe(take(1), timeout(5000))
          .subscribe({
            next: () =>
              this.logger.debug(
                `emit succeeded for job ${imageProcessing?.id}`,
              ),
            error: (err) =>
              this.logger.error(
                `emit error for job ${imageProcessing?.id}`,
                err,
              ),
          });
        this.logger.debug('Pushed into resize_queue');
        break;
      case TRANSFORMATION_TYPE.ROTATE:
        this.RotateQueue.emit('rotate_queue', imageProcessing)
          .pipe(take(1), timeout(5000))
          .subscribe({
            next: () =>
              this.logger.debug(
                `emit succeeded for job ${imageProcessing?.id}`,
              ),
            error: (err) =>
              this.logger.error(
                `emit error for job ${imageProcessing?.id}`,
                err,
              ),
          });
        this.logger.debug('Pushed into rotate_queue');
        break;
      default:
        throw new Error(
          'queue me should be rotate_queue or resize_queue or force_resize_queue or convert_queue',
        );
    }
    numberOfTimesSuccessfullyPushed++;
    this.logger.log(
      'numberOfTimesSuccessfullyPushed: ',
      numberOfTimesSuccessfullyPushed,
    );
    this.logger.log('logging value ', value);
  };
}

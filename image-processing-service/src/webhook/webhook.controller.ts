import { Body, Controller, Logger, Post, HttpCode, Req } from '@nestjs/common';
import { WebhookService } from '@webhook/webhook.service';
import { WebhookConfirmationDTO } from '@webhook/dto/webhook.dto';
import { SNSParsePipe } from '@shared/pipes/sns.pipes';
import axios from 'axios';
import { Request } from 'express';

let handlerCalledCount = 0;
@Controller('webhook')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  constructor(private readonly webhookService: WebhookService) {}

  @Post('/upload-success')
  @HttpCode(200) // ensure we return 200 immediately
  async uploadSuccessWebHook(
    @Req() req: Request,
    @Body(SNSParsePipe) body: WebhookConfirmationDTO,
  ) {
    const timestamp = Date.now();
    console.log(`REQUEST RECEIVED: ${timestamp}`);

    // return { status: 'ok', timestamp };
    try {
      this.logger.debug(`raw body keys: ${Object.keys(req.body || {})}`);
    } catch (e) {
      this.logger.debug('could not read raw body', e?.message || e);
    }

    this.logger.log(
      'Received webhook',
      JSON.stringify({
        Type: (body as any)?.Type,
        hasRecords: !!(body as any)?.Records,
      }),
    );

    try {
      if (body.Type === 'SubscriptionConfirmation') {
        const subscribeUrl = body.SubscribeURL;
        if (!subscribeUrl) {
          this.logger.warn('SubscriptionConfirmation without SubscribeURL');
        } else {
          void (async () => {
            try {
              this.logger.log('Confirming SNS subscription via SubscribeURL');
              const resp = await axios.get(subscribeUrl, { timeout: 5000 });
              this.logger.log(
                'SNS subscription confirmed',
                `status=${resp.status}`,
              );
            } catch (err) {
              this.logger.error(
                'Failed confirming SubscribeURL',
                (err as any)?.message || err,
              );
            }
          })();
        }
      } else if (
        body.Records &&
        body.Records[0].eventName === 'ObjectCreated:Put'
      ) {
        this.logger.log(
          `Received ${body.Records?.length || 0} records in this webhook`,
        );
        handlerCalledCount++;
        this.logger.log(
          'number of times handler called : ',
          handlerCalledCount,
        );

        this.logger.debug('RECIEVED MESSAGE IN WEBHOOK');
        const record = body.Records[0];
        // return { status: 'ok' };

        void (async () => {
          try {
            this.logger.log('Handling S3 Upload Success (background)');
            await this.webhookService.handleS3UploadSuccessEvent(record);
            this.logger.log('S3 upload processed');
          } catch (err) {
            this.logger.error(
              'Error processing S3 upload event',
              (err as any)?.stack || err,
            );
          }
        })();
      } else {
        this.logger.log(
          'Unhandled SNS message type or missing records',
          JSON.stringify(body),
        );
      }
    } catch (err) {
      this.logger.error(
        'Unexpected error in webhook handler',
        (err as any)?.stack || err,
      );
    }

    return { status: 'ok' };
  }
}

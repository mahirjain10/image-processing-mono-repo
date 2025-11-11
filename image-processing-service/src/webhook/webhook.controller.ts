import { Body, Controller, Logger, Post } from '@nestjs/common';
import { WebhookService } from '@webhook/webhook.service';
import { WebhookConfirmationDTO } from '@webhook/dto/webhook.dto';
import { SNSParsePipe } from '@shared/pipes/sns.pipes';

@Controller('webhook')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);
  constructor(private readonly webhookService: WebhookService) {}
  @Post('/upload-success')
  uploadSuccessWebHook(@Body(SNSParsePipe) body: WebhookConfirmationDTO) {
    this.logger.debug('body :', body);
    this.logger.debug('body type of :', typeof body);

    this.logger.log(body.SubscribeURL, body.Type);
    this.logger.log('In upload success webhook controller');
    if (body.Type === 'SubscriptionConfirmation') {
      this.logger.log('In upload success webhook controller body type 1');
      if (!body.SubscribeURL) {
        throw new Error('SubscribeURL empty');
      }
      this.logger.error('online 25');

      this.webhookService.snsHandshake(body.SubscribeURL);
    } else if (
      body.Records &&
      body.Records[0].eventName === 'ObjectCreated:Put'
    ) {
      this.logger.log('Handling S3 Upload Success');
      this.webhookService.handleS3UploadSuccessEvent(body.Records[0]);
    }
  }
}

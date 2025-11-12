import { IsString, IsUrl, IsOptional, IsArray } from 'class-validator';

export class WebhookConfirmationDTO {
  @IsString({ message: 'Type needs to be string' })
  @IsOptional()
  Type?: string;

  @IsString({ message: 'Subscription URL needs to be string' })
  @IsOptional()
  SubscribeURL?: string;

  // Add these to handle different casings
  @IsString({ message: 'Type needs to be string' })
  @IsOptional()
  type?: string;

  @IsString({ message: 'Subscription URL needs to be string' })
  @IsOptional()
  subscribeURL?: string;

  @IsArray()
  @IsOptional()
  Records?: [
    {
      eventName: string;
      s3: {
        object: {
          key: string;
        };
      };
    },
  ];
}

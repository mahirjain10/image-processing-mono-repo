import { S3Client } from "@aws-sdk/client-s3";
import { Module, DynamicModule, Global } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
@Global()
@Module({})
export class S3Module {
  static register(): DynamicModule {
    const s3ClientProvider = {
      provide: 'S3_CLIENT',
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const region = configService.get<string>('aws.region');
        const accessKeyId = configService.get<string>('aws.accessKeyId');
        const secretAccessKey = configService.get<string>('aws.secretAccessKey');

        if (!region || !accessKeyId || !secretAccessKey) {
          throw new Error('AWS configuration is missing in environment variables');
        }

        return new S3Client({
          region,
          credentials: { accessKeyId, secretAccessKey },
        });
      }, // ✅ removed stray semicolon
    };

    return {
      module: S3Module,
      providers: [s3ClientProvider],
      exports: [s3ClientProvider],
    };
  }
}

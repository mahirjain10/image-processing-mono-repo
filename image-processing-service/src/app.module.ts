import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { SharedModule } from './shared/shared.module';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from '@shared/prisma/prisma.module';
import { UploadModule } from './shared/upload/upload.module';
import config from '@config/config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load:[config],
      envFilePath:
        process.env.NODE_ENV === 'docker'
          ? '.env.docker'
          : process.env.NODE_ENV === 'local'
          ? '.env.local'
          : '.env.production'
    }),
    AuthModule,
    SharedModule,
    PrismaModule,
    UploadModule,
  ],
  providers: [AppService],
  controllers: [AppController],
})
export class AppModule {}

import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { SharedModule } from './shared/shared.module';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import config from './config/config';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true, load: [config] }), AuthModule],
  providers: [AppService],
  controllers: [AppController],
})
export class AppModule {}

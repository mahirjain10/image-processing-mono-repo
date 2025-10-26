import { HttpAdapterHost, NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { CatchEverythingFilter } from '@shared/filters/exception.filters';
import { ConfigService } from '@nestjs/config';

const bootstrap = async () => {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
  );
  // app.get => asking dependency manually from the DI container
  const httpAdapter = app.get(HttpAdapterHost);
  const configService = app.get(ConfigService);
  app.useGlobalFilters(new CatchEverythingFilter(httpAdapter, configService));
  await app.listen(process.env.PORT ?? 3000, '0.0.0.0');
};
bootstrap();

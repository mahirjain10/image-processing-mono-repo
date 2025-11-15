import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpAdapterHost } from '@nestjs/core';

@Catch()
export class CatchEverythingFilter implements ExceptionFilter {
  private readonly logger = new Logger()
  constructor(
    private readonly httpAdapterHost: HttpAdapterHost,
    private readonly configService: ConfigService,
  ) { }

  catch(exception: unknown, host: ArgumentsHost): void {
    const { httpAdapter } = this.httpAdapterHost;

    const ctx = host.switchToHttp();

    const httpStatus =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const responseBody = {
      statusCode: httpStatus,
      message: '',
      success: false,
    };

    if (exception instanceof BadRequestException) {
      const response = exception.getResponse();
      this.logger.error('Validation Error:', response);

      if (typeof response === 'object' && response !== null) {
        httpAdapter.reply(ctx.getResponse(), {
          ...response,
          success: false,
        }, httpStatus);
        return;
      } else {
        responseBody.message = exception.message;
      }
    } else if (exception instanceof HttpException) {
      this.logger.error(exception.message)

      responseBody.message = exception.message;
    } else if (
      this.configService.get<string>('env') !== 'production' &&
      exception instanceof Error
    ) {
      this.logger.error(exception.message)
      this.logger.error(exception.stack)

      responseBody.message = exception.message;
    } else {
      responseBody.message = 'Internal Server Error';
    }

    httpAdapter.reply(ctx.getResponse(), responseBody, httpStatus);
  }
}

import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpAdapterHost } from '@nestjs/core';

@Catch()
export class CatchEverythingFilter implements ExceptionFilter {
  private readonly logger = new Logger()
  constructor(
    private readonly httpAdapterHost: HttpAdapterHost,
    private readonly configService: ConfigService,
  ) {}

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
    // Now, add the message based on the error type
    if (exception instanceof HttpException) {
      this.logger.error(exception.message)
      // If it's a planned HTTP error, it's safe to show the message.
      responseBody.message = exception.message;
    } else if (
      this.configService.get<string>('env') !== 'production' &&
      exception instanceof Error
    ) {
      this.logger.error(exception.message)
      this.logger.error(exception.stack)

      // If it's an unexpected error AND we're NOT in production, show it.
      responseBody.message = exception.message;
    } else {
      // If it's an unexpected error AND we ARE in production, keep it generic.
      responseBody.message = 'Internal Server Error';
    }

    httpAdapter.reply(ctx.getResponse(), responseBody, httpStatus);
  }
}

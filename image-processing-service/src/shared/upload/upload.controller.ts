import { Controller, Post, Body, InternalServerErrorException, HttpStatus, Req, Res, Logger } from '@nestjs/common';
import { UploadService } from './upload.service';
import type { FastifyRequest, FastifyReply } from 'fastify';

@Controller('upload')
export class UploadController {
    private readonly logger = new Logger()
    constructor(private readonly uploadService: UploadService) { }
    @Post('/generate-url')
    async generatePresignedUrl(
        @Req() req: FastifyRequest,
        @Res() res: FastifyReply,
        @Body() body: {key: string, mimeType: string}) {
        this.logger.log("In API")
        const statusCode = 200;
        const url = await this.uploadService.generatePresignedUrl(body.key, body.mimeType)
        this.logger.log("generated URL : ",url)
        
        if (!url) {
            throw new InternalServerErrorException('Internal Server Error')
        }
        return res.status(statusCode).send({
            message: 'User created successfully',
            statusCode,
            data: { url },
        });
    }
}

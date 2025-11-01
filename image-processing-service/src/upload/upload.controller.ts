import {
    Controller,
    Post,
    Body,
    InternalServerErrorException,
    Req,
    Logger,
    UseGuards,
    Patch,
    Query,
    BadRequestException,
} from '@nestjs/common';
// FastifyReply import is removed as @Res() is not used

import { UploadService } from './upload.service';
import { AuthGuard } from '@shared/guards/auth.guard';
import { AuthRequest } from '@shared/interface/AuthRequest.interface';
import { STATUS } from './constants/upload.constants';
import { GenerateUrlBody, UpdateStatusQuery } from './interface/upload.interface';


@Controller('upload')
@UseGuards(AuthGuard)
export class UploadController {
    private readonly logger = new Logger(UploadController.name);

    constructor(private readonly uploadService: UploadService) { }

    /**
     * Updates the processing status of an image record.
     */
    @Patch('status')
    async updateStatus(
        @Req() req: AuthRequest,
        @Query() query: UpdateStatusQuery,
    ) {
        const { id, status } = query;
        
        const statusData = await this.uploadService.updateImageProcessingStatus(id, status);

        // Throwing the exception lets the Global Exception Filter handle the 400 response.
        if (!statusData.data) {
            throw new BadRequestException(statusData.message);
        }

        // Returning the object lets NestJS automatically send a 200 OK response.
        return {
            message: 'Image processing status updated successfully',
            data: statusData.data,
        };
    }

    /**
     * Generates a pre-signed S3 URL for file upload.
     */
    @Post('url')
    async generatePresignedUrl(
        @Req() req: AuthRequest,
        // Removed @Res() res: FastifyReply
        @Body() body: GenerateUrlBody,
    ) {
        this.logger.log('Generate presigned URL request received');

        const { filename, mimeType } = body;
        const userId = req.user.id; 

        const presignData = await this.uploadService.generatePresignedUrl(
            userId,
            filename,
            mimeType,
        );

        this.logger.log(`Presigned URL generated for file: ${filename}`);

        return {
            message: 'Presigned URL generated successfully',
            data: presignData,
        };
    }
}
import { Injectable, Logger } from '@nestjs/common';
import { UploadService } from '@src/upload/upload.service';
@Injectable()
export class SnsService {
    private readonly logger = new Logger(UploadService.name)
    constructor(){}

    snsHandshake = async () => {
        
    }
}

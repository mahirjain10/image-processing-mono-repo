import { ImageProcessing } from "@shared/prisma/generated/client";
import { STATUS } from "../constants/upload.constants";

export interface UpdateStatusQuery {
    id: string;
    status: STATUS;
}

export interface GenerateUrlBody {
    filename: string;
    mimeType: string;
}

export interface ImageProcessingResponse {
  data: ImageProcessing | null
  message: string
}
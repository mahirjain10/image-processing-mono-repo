import { ImageProcessing } from "@shared/prisma/generated/client";
import { STATUS, TRANSFORMATION_TYPE } from "../constants/upload.constants";

export interface UpdateStatusQuery {
    id: string;
    status: STATUS;
}

export interface GenerateUrlBody {
    filename: string;
    mimeType: string;
    transformationType:TRANSFORMATION_TYPE;
    transformationParamters:Map<string,string|number>
}

export type TransformationParamters = Map<string,string|number>
export interface ImageProcessingResponse {
  data: ImageProcessing | null
  message: string
}
import {
    IsNotEmpty,
    IsString,
    IsIn,
    ValidateNested,
    IsObject,
    IsOptional,
    IsInt,
    Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { TRANSFORMATION_TYPE } from '../constants/upload.constants'; // adjust path as needed

class TransformationParametersDto {
    // For RESIZE and FORCE_RESIZE
    @IsOptional()
    @IsInt({ message: 'Height must be an integer' })
    @Min(1, { message: 'Height must be greater than 0' })
    height?: number;

    @IsOptional()
    @IsInt({ message: 'Width must be an integer' })
    @Min(1, { message: 'Width must be greater than 0' })
    width?: number;

    // For ROTATE
    @IsOptional()
    @IsInt({ message: 'Degree must be an integer' })
    @IsIn([0, 90, 180, 270], {
        message: 'Degree must be one of 0, 90, 180, 270',
    })
    degree?: number;

    // For CONVERT
    @IsOptional()
    @IsString({ message: 'Format must be a string' })
    @IsIn(['PNG', 'JPEG', 'GIF', 'BMP', 'TIFF'], {
        message: 'Supported formats are PNG, JPEG, GIF, BMP, TIFF',
    })
    format?: string;
}

export class TransformImageDto {
    @IsNotEmpty({ message: "Filename can't be empty" })
    @IsString({ message: 'Filename must be a string' })
    filename: string;

    @IsNotEmpty({ message: "MimeType can't be empty" })
    @IsString({ message: 'MimeType must be a string' })
    mimeType: string;

    @IsNotEmpty({ message: "Transformation type can't be empty" })
    @IsString({ message: 'Transformation type must be a string' })
    @IsIn(Object.values(TRANSFORMATION_TYPE), {
        message: `Transformation type must be one of: ${Object.values(TRANSFORMATION_TYPE).join(', ')}`,
    })
    transformationType: TRANSFORMATION_TYPE;

    @IsNotEmpty({ message: 'Transformation parameters are required' })
    @IsObject({ message: 'Transformation parameters must be an object' })
    @ValidateNested()
    @Type(() => TransformationParametersDto)
    transformationParamters: TransformationParametersDto;
}

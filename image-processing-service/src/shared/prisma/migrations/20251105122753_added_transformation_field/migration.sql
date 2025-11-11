/*
  Warnings:

  - Added the required column `transform_parameters` to the `image_processing` table without a default value. This is not possible if the table is not empty.
  - Added the required column `transform_type` to the `image_processing` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "TRANSFORMATION_TYPE" AS ENUM ('ROTATE', 'RESIZE', 'FORCE_RESIZE', 'CONVERT');

-- AlterTable
ALTER TABLE "image_processing" ADD COLUMN     "error_message" TEXT,
ADD COLUMN     "transform_parameters" JSONB NOT NULL,
ADD COLUMN     "transform_type" "TRANSFORMATION_TYPE" NOT NULL;

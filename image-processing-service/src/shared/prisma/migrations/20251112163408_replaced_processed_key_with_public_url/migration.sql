/*
  Warnings:

  - You are about to drop the column `s3_processed_key` on the `image_processing` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "image_processing" DROP COLUMN "s3_processed_key",
ADD COLUMN     "public_url" TEXT;

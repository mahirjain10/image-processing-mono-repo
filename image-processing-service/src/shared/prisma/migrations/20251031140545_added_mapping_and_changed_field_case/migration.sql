/*
  Warnings:

  - You are about to drop the column `createdAt` on the `image_processing` table. All the data in the column will be lost.
  - You are about to drop the column `s3ProcessedKey` on the `image_processing` table. All the data in the column will be lost.
  - You are about to drop the column `s3RawKey` on the `image_processing` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `image_processing` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `user` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `user` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "image_processing" DROP COLUMN "createdAt",
DROP COLUMN "s3ProcessedKey",
DROP COLUMN "s3RawKey",
DROP COLUMN "updatedAt",
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "s3_processed_key" TEXT,
ADD COLUMN     "s3_raw_key" TEXT,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "user" DROP COLUMN "createdAt",
DROP COLUMN "updatedAt",
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

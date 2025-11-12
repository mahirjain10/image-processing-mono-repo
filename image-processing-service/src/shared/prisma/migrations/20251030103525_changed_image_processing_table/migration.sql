/*
  Warnings:

  - You are about to drop the column `email` on the `image_processing` table. All the data in the column will be lost.
  - You are about to drop the column `key` on the `image_processing` table. All the data in the column will be lost.
  - You are about to drop the column `login_limit` on the `image_processing` table. All the data in the column will be lost.
  - You are about to drop the column `password` on the `image_processing` table. All the data in the column will be lost.
  - You are about to drop the column `upload_limit` on the `image_processing` table. All the data in the column will be lost.
  - Added the required column `filename` to the `image_processing` table without a default value. This is not possible if the table is not empty.
  - Added the required column `status` to the `image_processing` table without a default value. This is not possible if the table is not empty.
  - Added the required column `user_id` to the `image_processing` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "STATUS" AS ENUM ('PENDING', 'UPLOAD_SUCESS', 'UPLOAD_FAILED', 'PROCESSING', 'PROCESSED', 'FAILED');

-- DropIndex
DROP INDEX "public"."image_processing_email_key";

-- AlterTable
ALTER TABLE "image_processing" DROP COLUMN "email",
DROP COLUMN "key",
DROP COLUMN "login_limit",
DROP COLUMN "password",
DROP COLUMN "upload_limit",
ADD COLUMN     "filename" TEXT NOT NULL,
ADD COLUMN     "s3ProcessedKey" TEXT,
ADD COLUMN     "s3RawKey" TEXT,
ADD COLUMN     "status" "STATUS" NOT NULL,
ADD COLUMN     "user_id" TEXT NOT NULL,
ADD CONSTRAINT "image_processing_pkey" PRIMARY KEY ("id");

-- DropIndex
DROP INDEX "public"."image_processing_id_key";

-- AddForeignKey
ALTER TABLE "image_processing" ADD CONSTRAINT "image_processing_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

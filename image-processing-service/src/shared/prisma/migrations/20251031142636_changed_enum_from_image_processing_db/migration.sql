/*
  Warnings:

  - The values [UPLOAD_SUCESS,UPLOAD_FAILED] on the enum `STATUS` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "STATUS_new" AS ENUM ('PENDING', 'UPLOADING', 'PROCESSING', 'PROCESSED', 'FAILED');
ALTER TABLE "image_processing" ALTER COLUMN "status" TYPE "STATUS_new" USING ("status"::text::"STATUS_new");
ALTER TYPE "STATUS" RENAME TO "STATUS_old";
ALTER TYPE "STATUS_new" RENAME TO "STATUS";
DROP TYPE "public"."STATUS_old";
COMMIT;

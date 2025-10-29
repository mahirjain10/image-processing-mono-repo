-- AlterTable
ALTER TABLE "user" ADD COLUMN     "login_limit" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "upload_limit" INTEGER NOT NULL DEFAULT 0;

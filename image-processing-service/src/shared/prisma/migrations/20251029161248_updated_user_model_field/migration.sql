-- AlterTable
ALTER TABLE "user" ALTER COLUMN "login_limit" SET DEFAULT 1,
ALTER COLUMN "upload_limit" SET DEFAULT 1;

-- CreateTable
CREATE TABLE "image_processing" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "login_limit" INTEGER NOT NULL DEFAULT 0,
    "upload_limit" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "image_processing_id_key" ON "image_processing"("id");

-- CreateIndex
CREATE UNIQUE INDEX "image_processing_email_key" ON "image_processing"("email");

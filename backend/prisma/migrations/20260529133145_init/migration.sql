-- CreateEnum
CREATE TYPE "ImageStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED');

-- CreateTable
CREATE TABLE "Image" (
    "id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "status" "ImageStatus" NOT NULL DEFAULT 'PENDING',
    "storageUrl" TEXT NOT NULL,
    "publicId" TEXT,
    "dHash" VARCHAR(16) NOT NULL,
    "blurScore" DOUBLE PRECISION NOT NULL,
    "faceCount" INTEGER NOT NULL,
    "faceSizeRatio" DOUBLE PRECISION NOT NULL,
    "rejectionReasons" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Image_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Image_status_idx" ON "Image"("status");

-- CreateIndex
CREATE INDEX "Image_dHash_idx" ON "Image"("dHash");

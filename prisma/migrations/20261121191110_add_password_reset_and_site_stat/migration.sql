-- AlterTable
ALTER TABLE "User" ADD COLUMN     "passwordResetCode" TEXT,
ADD COLUMN     "passwordResetExpiresAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "SiteStat" (
    "id" TEXT NOT NULL,
    "value" INTEGER NOT NULL,

    CONSTRAINT "SiteStat_pkey" PRIMARY KEY ("id")
);

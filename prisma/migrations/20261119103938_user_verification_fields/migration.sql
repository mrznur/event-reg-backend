/*
  Warnings:

  - You are about to drop the `PendingSignup` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterTable
ALTER TABLE "User" ADD COLUMN     "lastResendAt" TIMESTAMP(3),
ADD COLUMN     "verificationCode" TEXT,
ADD COLUMN     "verificationCodeExpiresAt" TIMESTAMP(3),
ADD COLUMN     "verified" BOOLEAN NOT NULL DEFAULT false;

-- DropTable
DROP TABLE "PendingSignup";

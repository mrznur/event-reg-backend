-- CreateEnum
CREATE TYPE "AboutImageKey" AS ENUM ('philosophy', 'mission', 'vision', 'values');

-- CreateTable
CREATE TABLE "AboutImage" (
    "key" "AboutImageKey" NOT NULL,
    "url" TEXT NOT NULL,
    "alt" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AboutImage_pkey" PRIMARY KEY ("key")
);

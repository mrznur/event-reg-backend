-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'ATTENDEE';

-- AlterTable
ALTER TABLE "PendingSignup" ADD COLUMN     "role" "Role" NOT NULL DEFAULT 'ORGANIZER';

-- CreateEnum
CREATE TYPE "ConversationRole" AS ENUM ('OWNER', 'MEMBER');

-- AlterTable
ALTER TABLE "ConversationParticipant" ADD COLUMN     "role" "ConversationRole" NOT NULL DEFAULT 'MEMBER';

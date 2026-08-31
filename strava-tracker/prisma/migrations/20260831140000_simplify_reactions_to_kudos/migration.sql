-- DropIndex
DROP INDEX "Reaction_activityId_userId_emoji_key";

-- AlterTable
ALTER TABLE "Reaction" DROP COLUMN "emoji";

-- DropEnum
DROP TYPE "ReactionEmoji";

-- CreateIndex
CREATE UNIQUE INDEX "Reaction_activityId_userId_key" ON "Reaction"("activityId", "userId");

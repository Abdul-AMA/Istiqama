-- DropForeignKey
ALTER TABLE "MessageLog" DROP CONSTRAINT "MessageLog_categoryId_fkey";

-- AlterTable
ALTER TABLE "MessageLog" ALTER COLUMN "categoryId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "MessageLog" ADD CONSTRAINT "MessageLog_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "MessageCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

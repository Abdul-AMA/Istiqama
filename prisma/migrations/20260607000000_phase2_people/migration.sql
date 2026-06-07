-- AlterEnum: add GUEST to StudentStatus
ALTER TYPE "StudentStatus" ADD VALUE 'GUEST';

-- CreateEnum: SardType
CREATE TYPE "SardType" AS ENUM ('INDIVIDUAL', 'GROUP');

-- AlterTable: add new columns to Student
ALTER TABLE "Student"
  ADD COLUMN "nationalId" TEXT,
  ADD COLUMN "schoolGrade" TEXT,
  ADD COLUMN "neighborhood" TEXT,
  ADD COLUMN "secondaryPhone" TEXT,
  ADD COLUMN "previousHifzPages" INTEGER;

-- CreateTable: SardRecord
CREATE TABLE "SardRecord" (
    "id" TEXT NOT NULL,
    "type" "SardType" NOT NULL,
    "date" DATE NOT NULL,
    "fromJuz" INTEGER NOT NULL,
    "toJuz" INTEGER NOT NULL,
    "rating" INTEGER NOT NULL,
    "mistakes" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "studentId" TEXT NOT NULL,
    "recordedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SardRecord_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "SardRecord" ADD CONSTRAINT "SardRecord_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SardRecord" ADD CONSTRAINT "SardRecord_recordedByUserId_fkey" FOREIGN KEY ("recordedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

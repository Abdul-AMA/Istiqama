-- Roster import fields (from the center's external teacher database)
ALTER TABLE "User" ADD COLUMN "nationalId" TEXT;
ALTER TABLE "User" ADD COLUMN "dateOfBirth" DATE;
ALTER TABLE "User" ADD COLUMN "maritalStatus" TEXT;
ALTER TABLE "User" ADD COLUMN "familySize" INTEGER;
ALTER TABLE "User" ADD COLUMN "incomeSource" TEXT;
ALTER TABLE "User" ADD COLUMN "qualification" TEXT;
ALTER TABLE "User" ADD COLUMN "teachingStage" TEXT;
ALTER TABLE "User" ADD COLUMN "roleTitle" TEXT;

ALTER TABLE "Class" ADD COLUMN "fundingBody" TEXT;

-- Roster import fields (from the center's external student/teacher database)
ALTER TABLE "Student" ADD COLUMN "educationStage" TEXT;
ALTER TABLE "Student" ADD COLUMN "familySize" INTEGER;
ALTER TABLE "Student" ADD COLUMN "tajweedLevel" TEXT;
ALTER TABLE "Student" ADD COLUMN "commitmentLevel" TEXT;
ALTER TABLE "Student" ADD COLUMN "residencyStatus" TEXT;

ALTER TABLE "Class" ADD COLUMN "sponsorship" TEXT;

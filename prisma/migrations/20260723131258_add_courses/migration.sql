-- CreateTable
CREATE TABLE "Course" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdByUserId" TEXT NOT NULL,

    CONSTRAINT "Course_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseBadge" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "courseId" TEXT NOT NULL,

    CONSTRAINT "CourseBadge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseScore" (
    "id" TEXT NOT NULL,
    "score" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "courseId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "recordedByUserId" TEXT NOT NULL,

    CONSTRAINT "CourseScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseBadgeResult" (
    "id" TEXT NOT NULL,
    "earned" BOOLEAN NOT NULL DEFAULT false,
    "courseScoreId" TEXT NOT NULL,
    "badgeId" TEXT NOT NULL,

    CONSTRAINT "CourseBadgeResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CourseBadge_courseId_name_key" ON "CourseBadge"("courseId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "CourseScore_courseId_studentId_key" ON "CourseScore"("courseId", "studentId");

-- CreateIndex
CREATE UNIQUE INDEX "CourseBadgeResult_courseScoreId_badgeId_key" ON "CourseBadgeResult"("courseScoreId", "badgeId");

-- AddForeignKey
ALTER TABLE "Course" ADD CONSTRAINT "Course_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseBadge" ADD CONSTRAINT "CourseBadge_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseScore" ADD CONSTRAINT "CourseScore_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseScore" ADD CONSTRAINT "CourseScore_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseScore" ADD CONSTRAINT "CourseScore_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseScore" ADD CONSTRAINT "CourseScore_recordedByUserId_fkey" FOREIGN KEY ("recordedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseBadgeResult" ADD CONSTRAINT "CourseBadgeResult_courseScoreId_fkey" FOREIGN KEY ("courseScoreId") REFERENCES "CourseScore"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseBadgeResult" ADD CONSTRAINT "CourseBadgeResult_badgeId_fkey" FOREIGN KEY ("badgeId") REFERENCES "CourseBadge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

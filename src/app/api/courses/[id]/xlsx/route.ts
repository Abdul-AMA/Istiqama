import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import ExcelJS from "exceljs"
import { formatDate } from "@/lib/date"

const COLUMN_DEFS: Record<string, { header: string; width: number }> = {
  studentName: { header: "اسم الطالب", width: 24 },
  teacherName: { header: "المعلم", width: 22 },
  courseName:  { header: "اسم الدورة", width: 22 },
  score:       { header: "الدرجة", width: 10 },
  nationalId:  { header: "رقم الهوية", width: 16 },
  dateOfBirth: { header: "تاريخ الميلاد", width: 14 },
}
const COLUMN_ORDER = ["studentName", "teacherName", "courseName", "score", "nationalId", "dateOfBirth"]

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (session?.user?.role !== "PRINCIPAL") {
    return NextResponse.json({ error: "غير مصرح" }, { status: 403 })
  }

  const { id: courseId } = await params
  const { searchParams } = new URL(req.url)
  const classId = searchParams.get("classId")
  const columnsParam = searchParams.get("columns")
  const columns = columnsParam
    ? COLUMN_ORDER.filter((c) => columnsParam.split(",").includes(c))
    : COLUMN_ORDER
  if (columns.length === 0) {
    return NextResponse.json({ error: "لم يتم اختيار أعمدة" }, { status: 400 })
  }

  const course = await prisma.course.findUnique({ where: { id: courseId }, select: { id: true, name: true } })
  if (!course) return NextResponse.json({ error: "الدورة غير موجودة" }, { status: 404 })

  const classes = await prisma.class.findMany({
    where: classId ? { id: classId } : { status: "ACTIVE" },
    select: { id: true, name: true, teacher: { select: { fullName: true, kunya: true } } },
    orderBy: { name: "asc" },
  })
  if (classes.length === 0) return NextResponse.json({ error: "لا توجد حلقات" }, { status: 404 })

  const workbook = new ExcelJS.Workbook()

  for (const cls of classes) {
    const sheet = workbook.addWorksheet(cls.name.slice(0, 31), { views: [{ rightToLeft: true }] })
    sheet.columns = columns.map((c) => ({ header: COLUMN_DEFS[c].header, key: c, width: COLUMN_DEFS[c].width }))
    sheet.getRow(1).font = { bold: true }

    const scores = await prisma.courseScore.findMany({
      where: { courseId, classId: cls.id },
      select: {
        score: true,
        student: { select: { fullName: true, nationalId: true, dateOfBirth: true } },
      },
      orderBy: { student: { fullName: "asc" } },
    })

    const teacherLabel = cls.teacher.kunya || cls.teacher.fullName
    for (const s of scores) {
      sheet.addRow({
        studentName: s.student.fullName,
        teacherName: teacherLabel,
        courseName: course.name,
        score: s.score ?? "",
        nationalId: s.student.nationalId ?? "",
        dateOfBirth: formatDate(s.student.dateOfBirth),
      })
    }
  }

  const buffer = await workbook.xlsx.writeBuffer()
  const filenameBase = classes.length === 1 ? `${course.name}-${classes[0].name}` : `${course.name}-all`

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(filenameBase)}.xlsx"`,
    },
  })
}

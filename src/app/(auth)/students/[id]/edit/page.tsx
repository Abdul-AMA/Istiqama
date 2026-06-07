import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { notFound, redirect } from "next/navigation"
import { StudentForm } from "@/components/student-form"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { ArrowRight } from "lucide-react"

type Props = { params: Promise<{ id: string }> }

export default async function EditStudentPage({ params }: Props) {
  const { id }  = await params
  const session = await auth()
  const role    = session!.user.role!
  const userId  = session!.user.id!

  const student = await prisma.student.findUnique({ where: { id } })
  if (!student) notFound()

  // Teachers can only edit students in their own classes
  if (role === "TEACHER" && student.classId) {
    const cls = await prisma.class.findFirst({ where: { id: student.classId, teacherId: userId } })
    if (!cls) redirect("/dashboard")
  }

  const classes =
    role === "PRINCIPAL"
      ? await prisma.class.findMany({ where: { status: "ACTIVE" }, select: { id: true, name: true }, orderBy: { name: "asc" } })
      : await prisma.class.findMany({ where: { teacherId: userId, status: "ACTIVE" }, select: { id: true, name: true } })

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/students/${id}`}>
          <Button variant="ghost" size="icon"><ArrowRight className="h-5 w-5" /></Button>
        </Link>
        <h1 className="text-2xl font-bold">تعديل بيانات الطالب</h1>
      </div>
      <StudentForm
        student={student}
        classes={classes}
        isPrincipal={role === "PRINCIPAL"}
      />
    </div>
  )
}

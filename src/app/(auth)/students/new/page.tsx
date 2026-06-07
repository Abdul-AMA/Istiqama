import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { StudentForm } from "@/components/student-form"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { ArrowRight } from "lucide-react"

type Props = { searchParams: Promise<{ classId?: string }> }

export default async function NewStudentPage({ searchParams }: Props) {
  const session = await auth()
  const role    = session!.user.role!
  const userId  = session!.user.id!
  const { classId } = await searchParams

  const classes =
    role === "PRINCIPAL"
      ? await prisma.class.findMany({ where: { status: "ACTIVE" }, select: { id: true, name: true }, orderBy: { name: "asc" } })
      : await prisma.class.findMany({ where: { teacherId: userId, status: "ACTIVE" }, select: { id: true, name: true } })

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href={classId ? `/classes/${classId}` : "/students"}>
          <Button variant="ghost" size="icon"><ArrowRight className="h-5 w-5" /></Button>
        </Link>
        <h1 className="text-2xl font-bold">إضافة طالب جديد</h1>
      </div>
      <StudentForm
        classes={classes}
        defaultClassId={classId}
        isPrincipal={role === "PRINCIPAL"}
      />
    </div>
  )
}

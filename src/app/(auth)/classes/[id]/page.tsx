import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { notFound, redirect } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import Link from "next/link"
import { ArrowRight, Plus, Users } from "lucide-react"
import { AddGuestDialog } from "./add-guest-dialog"

type Props = { params: Promise<{ id: string }> }

function getStudentStateBadge(student: {
  status: string
  currentTotalPagesMemorized: number
}) {
  if (student.status === "GUEST") {
    return <Badge className="bg-orange-100 text-orange-800 border-orange-200">ضيف</Badge>
  }
  if (student.currentTotalPagesMemorized === 0) {
    return <Badge variant="secondary">جديد</Badge>
  }
  // Simple heuristic for on-track vs needs-attention (Phase 4 will use actual sessions)
  return <Badge className="bg-green-100 text-green-800 border-green-200">على المسار</Badge>
}

export default async function ClassDetailPage({ params }: Props) {
  const { id } = await params
  const session = await auth()
  const role    = session!.user.role!
  const userId  = session!.user.id!

  const cls = await prisma.class.findUnique({
    where:  { id },
    select: {
      id: true, name: true, level: true, location: true,
      teacherId: true,
      teacher:   { select: { id: true, fullName: true } },
      students:  {
        where:   { status: { in: ["ACTIVE" as const, "GUEST" as const] } },
        orderBy: { fullName: "asc" },
      },
    },
  })

  if (!cls) notFound()

  // Teachers can only view their own classes
  if (role === "TEACHER" && cls.teacherId !== userId) redirect("/dashboard")

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3">
        <Link href="/classes">
          <Button variant="ghost" size="icon">
            <ArrowRight className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{cls.name}</h1>
          <p className="text-muted-foreground">
            {cls.teacher.fullName}
            {cls.location && ` · ${cls.location}`}
            {cls.level && ` · ${cls.level}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="gap-1">
            <Users className="h-3.5 w-3.5" />
            {cls.students.length}
          </Badge>
          <AddGuestDialog classId={cls.id} />
          {role === "PRINCIPAL" && (
            <Link href={`/students/new?classId=${cls.id}`}>
              <Button size="sm" className="gap-2">
                <Plus className="h-4 w-4" />
                طالب جديد
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Student roster */}
      {cls.students.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <GraduationCapIcon />
          <p className="mt-3 text-base">لا يوجد طلاب في هذه الحلقة بعد</p>
          <p className="text-sm mt-1">أضف طالباً جديداً أو أضف ضيفاً مؤقتاً</p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {cls.students.map((student) => (
            <Link key={student.id} href={`/students/${student.id}`}>
              <div className="flex items-center gap-3 p-4 rounded-lg border bg-card hover:shadow-md transition-shadow cursor-pointer">
                <Avatar className="h-12 w-12 shrink-0">
                  <AvatarImage src={student.photoUrl ?? undefined} alt={student.fullName} />
                  <AvatarFallback className="bg-green-100 text-green-800 text-sm font-semibold">
                    {student.fullName.slice(0, 2)}
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{student.fullName}</p>
                  <p className="text-sm text-muted-foreground">
                    {student.currentTotalPagesMemorized} صفحة محفوظة
                  </p>
                </div>

                <div className="shrink-0">
                  {getStudentStateBadge(student)}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

function GraduationCapIcon() {
  return (
    <svg className="h-12 w-12 mx-auto text-muted-foreground/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 14l9-5-9-5-9 5 9 5z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
    </svg>
  )
}

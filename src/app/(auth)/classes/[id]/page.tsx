import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { notFound, redirect } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { ArrowRight, Plus, Users } from "lucide-react"
import { ClassRoster } from "./class-roster"

type Props = { params: Promise<{ id: string }> }

export default async function ClassDetailPage({ params }: Props) {
  const { id } = await params
  const session = await auth()
  const role    = session!.user.role!
  const userId  = session!.user.id!

  const cls = await prisma.class.findUnique({
    where:  { id },
    select: {
      id: true, name: true, level: true, location: true, sponsorship: true,
      teacherId: true,
      teacher:   { select: { id: true, fullName: true, kunya: true } },
      students:  {
        where:   { status: { in: ["ACTIVE" as const, "GUEST" as const] } },
        select: {
          id: true,
          fullName: true,
          photoUrl: true,
          status: true,
          currentTotalPagesMemorized: true,
        },
        orderBy: { fullName: "asc" },
      },
    },
  })

  if (!cls) notFound()

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
            {cls.teacher.fullName}{cls.teacher.kunya ? ` (${cls.teacher.kunya})` : ""}
            {cls.location && ` · ${cls.location}`}
            {cls.level && ` · ${cls.level}`}
            {cls.sponsorship && ` · 🤝 ${cls.sponsorship}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="gap-1">
            <Users className="h-3.5 w-3.5" />
            {cls.students.length}
          </Badge>
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

      <ClassRoster classId={cls.id} initialStudents={cls.students} />
    </div>
  )
}

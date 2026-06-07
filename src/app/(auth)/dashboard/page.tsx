import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { BookOpen, GraduationCap, Users, UserCheck } from "lucide-react"

export default async function DashboardPage() {
  const session = await auth()
  const role    = session!.user.role!
  const userId  = session!.user.id!

  if (role === "PRINCIPAL") {
    const [teacherCount, classCount, studentCount, guestCount] = await Promise.all([
      prisma.user.count({ where: { role: "TEACHER", isActive: true } }),
      prisma.class.count({ where: { status: "ACTIVE" } }),
      prisma.student.count({ where: { status: "ACTIVE" as const } }),
      prisma.student.count({ where: { status: "GUEST" as const } }),
    ])

    const recentClasses = await prisma.class.findMany({
      take:    5,
      where:   { status: "ACTIVE" },
      select:  { id: true, name: true, teacher: { select: { fullName: true } }, _count: { select: { students: true } } },
      orderBy: { createdAt: "desc" },
    })

    return (
      <div className="p-6 space-y-6 max-w-5xl mx-auto">
        <div>
          <h1 className="text-2xl font-bold">لوحة التحكم</h1>
          <p className="text-muted-foreground mt-1">مرحباً، {session!.user.name}</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard title="المعلمون" value={teacherCount} icon={<Users className="h-5 w-5 text-blue-600" />} href="/admin/users" />
          <StatCard title="الحلقات"  value={classCount}   icon={<BookOpen className="h-5 w-5 text-green-600" />} href="/classes" />
          <StatCard title="الطلاب"   value={studentCount} icon={<GraduationCap className="h-5 w-5 text-purple-600" />} href="/students" />
          <StatCard title="الضيوف"   value={guestCount}   icon={<UserCheck className="h-5 w-5 text-orange-600" />} href="/admin/guests" badge={guestCount > 0} />
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">الحلقات النشطة</CardTitle>
          </CardHeader>
          <CardContent className="divide-y">
            {recentClasses.length === 0 && (
              <p className="text-sm text-muted-foreground py-4 text-center">لا توجد حلقات بعد</p>
            )}
            {recentClasses.map((cls) => (
              <Link key={cls.id} href={`/classes/${cls.id}`} className="flex items-center justify-between py-3 hover:bg-muted/50 px-2 rounded-lg -mx-2 transition-colors">
                <div>
                  <p className="font-medium">{cls.name}</p>
                  <p className="text-sm text-muted-foreground">{cls.teacher.fullName}</p>
                </div>
                <Badge variant="secondary">{cls._count.students} طالب</Badge>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>
    )
  }

  // Teacher dashboard
  const classes = await prisma.class.findMany({
    where:   { teacherId: userId, status: "ACTIVE" },
    select:  { id: true, name: true, location: true, _count: { select: { students: { where: { status: { in: ["ACTIVE" as const, "GUEST" as const] } } } } } },
    orderBy: { createdAt: "desc" },
  })

  const studentCount = classes.reduce((sum, c) => sum + c._count.students, 0)

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">لوحة المعلم</h1>
        <p className="text-muted-foreground mt-1">مرحباً، {session!.user.name}</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <StatCard title="حلقاتي"  value={classes.length} icon={<BookOpen className="h-5 w-5 text-green-600" />} href="/classes" />
        <StatCard title="طلابي"   value={studentCount}   icon={<GraduationCap className="h-5 w-5 text-purple-600" />} href="/students" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">حلقاتي</CardTitle>
        </CardHeader>
        <CardContent className="divide-y">
          {classes.length === 0 && (
            <p className="text-sm text-muted-foreground py-4 text-center">لم تُعيَّن لك حلقات بعد</p>
          )}
          {classes.map((cls) => (
            <Link key={cls.id} href={`/classes/${cls.id}`} className="flex items-center justify-between py-3 hover:bg-muted/50 px-2 rounded-lg -mx-2 transition-colors">
              <div>
                <p className="font-medium">{cls.name}</p>
                {cls.location && <p className="text-sm text-muted-foreground">{cls.location}</p>}
              </div>
              <Badge variant="secondary">{cls._count.students} طالب</Badge>
            </Link>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

function StatCard({
  title, value, icon, href, badge,
}: {
  title: string; value: number; icon: React.ReactNode; href: string; badge?: boolean
}) {
  return (
    <Link href={href}>
      <Card className="hover:shadow-md transition-shadow cursor-pointer">
        <CardContent className="pt-5 pb-5">
          <div className="flex items-center justify-between mb-2">
            {icon}
            {badge && value > 0 && <Badge variant="destructive" className="text-xs">{value}</Badge>}
          </div>
          <p className="text-2xl font-bold">{value}</p>
          <p className="text-sm text-muted-foreground">{title}</p>
        </CardContent>
      </Card>
    </Link>
  )
}

import { auth } from "@/auth"
import { redirect, notFound } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowRight } from "lucide-react"
import { getCourseAdminOverview } from "@/lib/actions/course.actions"
import { CourseDetailClient } from "./course-detail-client"

type Props = { params: Promise<{ id: string }> }

export default async function AdminCourseDetailPage({ params }: Props) {
  const session = await auth()
  if (session!.user.role !== "PRINCIPAL") redirect("/dashboard")

  const { id } = await params
  let data: Awaited<ReturnType<typeof getCourseAdminOverview>>
  try {
    data = await getCourseAdminOverview(id)
  } catch {
    notFound()
  }

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-2">
        <Link href="/admin/courses">
          <Button variant="ghost" size="icon"><ArrowRight className="h-5 w-5" /></Button>
        </Link>
        <div>
          <h1 className="text-xl font-bold">{data.course.name}</h1>
          {data.course.description && (
            <p className="text-sm text-muted-foreground">{data.course.description}</p>
          )}
        </div>
      </div>
      <CourseDetailClient course={data.course} halaqas={data.halaqas} />
    </div>
  )
}

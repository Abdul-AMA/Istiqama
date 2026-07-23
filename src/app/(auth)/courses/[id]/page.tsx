import Link from "next/link"
import { notFound } from "next/navigation"
import { Button } from "@/components/ui/button"
import { ArrowRight } from "lucide-react"
import { getCourseForTeacher } from "@/lib/actions/course.actions"
import { CourseScoringClient } from "./course-scoring-client"

type Props = { params: Promise<{ id: string }> }

export default async function CourseScoringPage({ params }: Props) {
  const { id } = await params

  let data: Awaited<ReturnType<typeof getCourseForTeacher>>
  try {
    data = await getCourseForTeacher(id)
  } catch {
    notFound()
  }

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-2">
        <Link href="/courses">
          <Button variant="ghost" size="icon"><ArrowRight className="h-5 w-5" /></Button>
        </Link>
        <div>
          <h1 className="text-xl font-bold">{data.course.name}</h1>
          {data.course.description && (
            <p className="text-sm text-muted-foreground">{data.course.description}</p>
          )}
        </div>
      </div>
      <CourseScoringClient
        course={data.course}
        classes={data.classes}
        initialClassId={data.classes[0]?.id ?? ""}
      />
    </div>
  )
}

import { getMyCourses } from "@/lib/actions/course.actions"
import { CoursesListClient } from "./courses-list-client"

export default async function CoursesPage() {
  const courses = await getMyCourses()

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold">الدورات</h1>
        <p className="text-sm text-muted-foreground">
          اختر دورة لتعبئة درجات وشارات طلابك
        </p>
      </div>
      <CoursesListClient courses={courses} />
    </div>
  )
}

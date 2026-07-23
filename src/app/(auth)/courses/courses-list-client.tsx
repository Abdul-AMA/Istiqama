"use client"

import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Award } from "lucide-react"

type Course = {
  id: string
  name: string
  description: string | null
  badges: { id: string; name: string }[]
}

export function CoursesListClient({ courses }: { courses: Course[] }) {
  if (courses.length === 0) {
    return (
      <div className="py-14 text-center text-muted-foreground rounded-lg border space-y-2">
        <Award className="h-10 w-10 mx-auto opacity-30" />
        <p className="text-sm font-medium">لا توجد دورات متاحة حالياً</p>
      </div>
    )
  }

  return (
    <div className="grid gap-3">
      {courses.map((c) => (
        <Link key={c.id} href={`/courses/${c.id}`}>
          <Card className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{c.name}</CardTitle>
            </CardHeader>
            <CardContent>
              {c.description && (
                <p className="text-sm text-muted-foreground line-clamp-2 mb-2">{c.description}</p>
              )}
              {c.badges.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {c.badges.map((b) => (
                    <Badge key={b.id} variant="secondary" className="gap-1">
                      <Award className="h-3 w-3" />
                      {b.name}
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  )
}

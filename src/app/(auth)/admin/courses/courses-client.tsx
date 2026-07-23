"use client"

import { useState, useActionState } from "react"
import Link from "next/link"
import { createCourse, updateCourse, toggleCourseActive, type CourseFormState } from "@/lib/actions/course.actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Plus, Pencil, PowerOff, Power, Award, X, FolderOpen } from "lucide-react"
import { toast } from "sonner"

type CourseBadgeItem = { id: string; name: string }

type Course = {
  id: string
  name: string
  description: string | null
  isActive: boolean
  badges: CourseBadgeItem[]
}

function BadgeListEditor({ badges, setBadges }: { badges: string[]; setBadges: (b: string[]) => void }) {
  return (
    <div className="space-y-2">
      <Label>الشارات (مثال: فقه الصلاة، قراءة سورة الفاتحة)</Label>
      <div className="space-y-2">
        {badges.map((b, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              type="hidden"
              name="badgeName"
              value={b}
            />
            <Input
              value={b}
              onChange={(e) => {
                const next = [...badges]
                next[i] = e.target.value
                setBadges(next)
              }}
              placeholder="اسم الشارة"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="shrink-0 text-muted-foreground"
              onClick={() => setBadges(badges.filter((_, j) => j !== i))}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-1"
        onClick={() => setBadges([...badges, ""])}
      >
        <Plus className="h-3.5 w-3.5" />
        إضافة شارة
      </Button>
    </div>
  )
}

function CourseForm({ course, onDone }: { course?: Course; onDone: () => void }) {
  const action = course ? updateCourse.bind(null, course.id) : createCourse
  const [state, formAction, pending] = useActionState<CourseFormState, FormData>(action, {})
  const [badges, setBadges] = useState<string[]>(course?.badges.map((b) => b.name) ?? [])

  if (state.success) {
    toast.success(course ? "تم التعديل" : "تم الإنشاء")
    onDone()
  }

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-1">
        <Label htmlFor="name">اسم الدورة</Label>
        <Input id="name" name="name" defaultValue={course?.name} required />
      </div>
      <div className="space-y-1">
        <Label htmlFor="description">الوصف (اختياري)</Label>
        <Textarea id="description" name="description" defaultValue={course?.description ?? ""} rows={3} />
      </div>
      <BadgeListEditor badges={badges} setBadges={setBadges} />
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      <div className="flex gap-2 justify-end">
        <Button type="button" variant="ghost" onClick={onDone}>
          إلغاء
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "جاري الحفظ…" : "حفظ"}
        </Button>
      </div>
    </form>
  )
}

export function CoursesClient({ courses }: { courses: Course[] }) {
  const [showCreate, setShowCreate] = useState(false)
  const [editing, setEditing] = useState<Course | null>(null)

  async function handleToggle(course: Course) {
    await toggleCourseActive(course.id, !course.isActive)
    toast.success(course.isActive ? "تم التعطيل" : "تم التفعيل")
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setShowCreate(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          دورة جديدة
        </Button>
      </div>

      {courses.length === 0 && (
        <div className="py-14 text-center text-muted-foreground rounded-lg border space-y-2">
          <Award className="h-10 w-10 mx-auto opacity-30" />
          <p className="text-sm font-medium">لا توجد دورات بعد</p>
          <p className="text-xs">اضغط «دورة جديدة» لإضافة أول دورة</p>
        </div>
      )}

      <div className="grid gap-3">
        {courses.map((c) => (
          <Card key={c.id} className={c.isActive ? "" : "opacity-60"}>
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-base">{c.name}</CardTitle>
                {c.isActive ? (
                  <Badge variant="outline" className="text-green-600 border-green-300">نشطة</Badge>
                ) : (
                  <Badge variant="outline" className="text-muted-foreground">معطّلة</Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {c.description && (
                <p className="text-sm text-muted-foreground line-clamp-2 mb-2">{c.description}</p>
              )}
              {c.badges.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {c.badges.map((b) => (
                    <Badge key={b.id} variant="secondary" className="gap-1">
                      <Award className="h-3 w-3" />
                      {b.name}
                    </Badge>
                  ))}
                </div>
              )}
              <div className="flex gap-2 flex-wrap">
                <Link href={`/admin/courses/${c.id}`}>
                  <Button variant="outline" size="sm" className="gap-1">
                    <FolderOpen className="h-3.5 w-3.5" />
                    عرض الحلقات والتصدير
                  </Button>
                </Link>
                <Button variant="outline" size="sm" className="gap-1" onClick={() => setEditing(c)}>
                  <Pencil className="h-3.5 w-3.5" />
                  تعديل
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1 text-muted-foreground"
                  onClick={() => handleToggle(c)}
                >
                  {c.isActive ? <PowerOff className="h-3.5 w-3.5" /> : <Power className="h-3.5 w-3.5" />}
                  {c.isActive ? "تعطيل" : "تفعيل"}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>دورة جديدة</DialogTitle>
          </DialogHeader>
          <CourseForm onDone={() => setShowCreate(false)} />
        </DialogContent>
      </Dialog>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>تعديل الدورة</DialogTitle>
          </DialogHeader>
          {editing && <CourseForm course={editing} onDone={() => setEditing(null)} />}
        </DialogContent>
      </Dialog>
    </div>
  )
}

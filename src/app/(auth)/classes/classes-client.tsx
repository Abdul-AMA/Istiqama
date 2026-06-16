"use client"

import { useState, useActionState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Plus, Pencil, Users, BookOpen } from "lucide-react"
import {
  createClass,
  updateClass,
  type ClassFormState,
} from "@/lib/actions/class.actions"
import { toast } from "sonner"

type ClassItem = {
  id:       string
  name:     string
  level:    string | null
  location: string | null
  capacity: number | null
  status:   string
  teacher:  { id: string; fullName: string; kunya: string | null }
  _count:   { students: number }
}

type Teacher = { id: string; fullName: string; kunya: string | null }

export function ClassesClient({
  classes,
  teachers,
  isPrincipal,
}: {
  classes:     ClassItem[]
  teachers:    Teacher[]
  isPrincipal: boolean
}) {
  const [createOpen, setCreateOpen] = useState(false)
  const [editClass, setEditClass]   = useState<ClassItem | null>(null)
  const router = useRouter()

  return (
    <div className="space-y-4">
      {isPrincipal && (
        <div className="flex justify-end">
          <Button className="gap-2" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            إضافة حلقة
          </Button>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogContent className="max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>إضافة حلقة جديدة</DialogTitle>
              </DialogHeader>
              <ClassForm
                teachers={teachers}
                onSuccess={() => { setCreateOpen(false); router.refresh() }}
              />
            </DialogContent>
          </Dialog>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {classes.length === 0 && (
          <div className="col-span-full py-16 text-center text-muted-foreground space-y-2">
            <BookOpen className="h-12 w-12 mx-auto opacity-30" />
            <p className="text-base font-medium">
              {isPrincipal ? "لا توجد حلقات بعد" : "لم تُعيَّن لك حلقات بعد"}
            </p>
            {isPrincipal && <p className="text-sm">اضغط «إضافة حلقة» للبدء</p>}
          </div>
        )}
        {classes.map((cls) => (
          <Card key={cls.id} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-base">{cls.name}</CardTitle>
                  {cls.level && <p className="text-sm text-muted-foreground mt-0.5">{cls.level}</p>}
                </div>
                {isPrincipal && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="shrink-0"
                    onClick={() => setEditClass(cls)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span>{cls._count.students} طالب</span>
                {cls.capacity && (
                  <span className="text-muted-foreground">/ {cls.capacity}</span>
                )}
              </div>
              {cls.location && (
                <p className="text-sm text-muted-foreground">📍 {cls.location}</p>
              )}
              <p className="text-sm text-muted-foreground">👤 {cls.teacher.fullName}{cls.teacher.kunya ? ` (${cls.teacher.kunya})` : ""}</p>
              <div className="flex items-center justify-between pt-1">
                <Badge variant={cls.status === "ACTIVE" ? "default" : "secondary"}>
                  {cls.status === "ACTIVE" ? "نشطة" : "غير نشطة"}
                </Badge>
                <Link href={`/classes/${cls.id}`}>
                  <Button variant="outline" size="sm">فتح الحلقة</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={!!editClass} onOpenChange={(o) => !o && setEditClass(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>تعديل الحلقة</DialogTitle>
          </DialogHeader>
          {editClass && (
            <ClassForm
              cls={editClass}
              teachers={teachers}
              onSuccess={() => { setEditClass(null); router.refresh() }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function ClassForm({
  cls,
  teachers,
  onSuccess,
}: {
  cls?:      ClassItem
  teachers:  Teacher[]
  onSuccess: () => void
}) {
  const action = cls ? updateClass.bind(null, cls.id) : createClass
  const [state, formAction, pending] = useActionState<ClassFormState, FormData>(action, {})
  const [teacherId, setTeacherId] = useState(cls?.teacher.id ?? "")

  if (state.success) {
    onSuccess()
    return null
  }

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">اسم الحلقة</Label>
        <Input id="name" name="name" defaultValue={cls?.name} required />
      </div>

      <div className="space-y-2">
        <Label htmlFor="teacherId">المعلم</Label>
        <Select name="teacherId" value={teacherId} onValueChange={(v) => { if (v != null) setTeacherId(v) }} required>
          <SelectTrigger id="teacherId">
            <SelectValue placeholder="اختر المعلم" />
          </SelectTrigger>
          <SelectContent>
            {teachers.map((t) => (
              <SelectItem key={t.id} value={t.id}>{t.fullName}{t.kunya ? ` (${t.kunya})` : ""}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <input type="hidden" name="teacherId" value={teacherId} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="level">المستوى</Label>
          <Input id="level" name="level" placeholder="مثال: جزء عم" defaultValue={cls?.level ?? ""} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="capacity">الطاقة الاستيعابية</Label>
          <Input id="capacity" name="capacity" type="number" min={1} defaultValue={cls?.capacity ?? ""} />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="location">مكان الحلقة</Label>
        <Input id="location" name="location" defaultValue={cls?.location ?? ""} />
      </div>

      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "جارٍ الحفظ…" : cls ? "حفظ التعديلات" : "إضافة الحلقة"}
      </Button>
    </form>
  )
}

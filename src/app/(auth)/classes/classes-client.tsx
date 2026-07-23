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
  id:          string
  name:        string
  level:       string | null
  location:    string | null
  capacity:    number | null
  sponsorship: string | null
  fundingBody: string | null
  status:      string
  teacher:     { id: string; fullName: string; kunya: string | null }
  _count:      { students: number }
}

type Teacher = { id: string; fullName: string; kunya: string | null }

// Display / sort order: ثانوي، اعدادي، ابتدائي، براعم — always in this order.
const LEVEL_OPTIONS = ["الثانوية", "الإعدادية", "الإبتدائية", "البراعم"]
const FUNDING_BODY_OPTIONS = ["وزارة الاوقاف و الشؤون الدينية", "دار القرآن الكريم والسنة", "اخرى"]

function levelRank(level: string | null): number {
  const i = level ? LEVEL_OPTIONS.indexOf(level) : -1
  return i === -1 ? LEVEL_OPTIONS.length : i
}

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
  const [levelFilter, setLevelFilter] = useState("_all")
  const router = useRouter()

  const levelFilterItems = [
    { value: "_all", label: "كل المستويات" },
    ...LEVEL_OPTIONS.map((l) => ({ value: l, label: l })),
  ]

  const visibleClasses = classes
    .filter((c) => levelFilter === "_all" || c.level === levelFilter)
    .sort((a, b) => levelRank(a.level) - levelRank(b.level))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="w-52">
          <Select
            items={levelFilterItems}
            value={levelFilter}
            onValueChange={(v) => { if (v != null) setLevelFilter(v) }}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="المستوى" />
            </SelectTrigger>
            <SelectContent>
              {levelFilterItems.map((it) => (
                <SelectItem key={it.value} value={it.value}>{it.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {isPrincipal && (
          <Button className="gap-2" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            إضافة حلقة
          </Button>
        )}
      </div>
      {isPrincipal && (
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
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {visibleClasses.length === 0 && (
          <div className="col-span-full py-16 text-center text-muted-foreground space-y-2">
            <BookOpen className="h-12 w-12 mx-auto opacity-30" />
            <p className="text-base font-medium">
              {classes.length === 0
                ? (isPrincipal ? "لا توجد حلقات بعد" : "لم تُعيَّن لك حلقات بعد")
                : "لا توجد حلقات بهذا المستوى"}
            </p>
            {isPrincipal && classes.length === 0 && <p className="text-sm">اضغط «إضافة حلقة» للبدء</p>}
          </div>
        )}
        {visibleClasses.map((cls) => (
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
              {cls.sponsorship && (
                <p className="text-sm text-muted-foreground">🤝 {cls.sponsorship}</p>
              )}
              {cls.fundingBody && (
                <p className="text-sm text-muted-foreground">🏛️ {cls.fundingBody}</p>
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
  const [level, setLevel] = useState(cls?.level ?? "")
  const [fundingBody, setFundingBody] = useState(cls?.fundingBody ?? "")

  const teacherItems = teachers.map((t) => ({
    value: t.id,
    label: `${t.fullName}${t.kunya ? ` (${t.kunya})` : ""}`,
  }))
  const levelItems = [{ value: "_none", label: "بدون" }, ...LEVEL_OPTIONS.map((l) => ({ value: l, label: l }))]
  const fundingBodyItems = [{ value: "_none", label: "بدون" }, ...FUNDING_BODY_OPTIONS.map((f) => ({ value: f, label: f }))]

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
        <Select
          items={teacherItems}
          name="teacherId"
          value={teacherId}
          onValueChange={(v) => { if (v != null) setTeacherId(v) }}
          required
        >
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
          <Select
            items={levelItems}
            value={level || "_none"}
            onValueChange={(v) => { if (v != null) setLevel(v === "_none" ? "" : v) }}
          >
            <SelectTrigger id="level" className="w-full">
              <SelectValue placeholder="اختر المستوى" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_none">بدون</SelectItem>
              {LEVEL_OPTIONS.map((l) => (
                <SelectItem key={l} value={l}>{l}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <input type="hidden" name="level" value={level} />
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

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="sponsorship">الكفالة</Label>
          <Input id="sponsorship" name="sponsorship" defaultValue={cls?.sponsorship ?? ""} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="fundingBody">جهة إحتساب الحلقة</Label>
          <Select
            items={fundingBodyItems}
            value={fundingBody || "_none"}
            onValueChange={(v) => { if (v != null) setFundingBody(v === "_none" ? "" : v) }}
          >
            <SelectTrigger id="fundingBody" className="w-full">
              <SelectValue placeholder="اختر الجهة" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_none">بدون</SelectItem>
              {FUNDING_BODY_OPTIONS.map((f) => (
                <SelectItem key={f} value={f}>{f}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <input type="hidden" name="fundingBody" value={fundingBody} />
        </div>
      </div>

      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "جارٍ الحفظ…" : cls ? "حفظ التعديلات" : "إضافة الحلقة"}
      </Button>
    </form>
  )
}

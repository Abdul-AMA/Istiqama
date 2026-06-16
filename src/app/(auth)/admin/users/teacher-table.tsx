"use client"

import { useState, useActionState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import Link from "next/link"
import { Plus, Pencil, KeyRound, ToggleLeft, ToggleRight, Eye } from "lucide-react"
import {
  createTeacher,
  updateTeacher,
  resetTeacherPassword,
  toggleTeacherActive,
  type TeacherFormState,
} from "@/lib/actions/user.actions"
import { toast } from "sonner"

type Teacher = {
  id:       string
  fullName: string
  kunya:    string | null
  email:    string
  phone:    string | null
  isActive: boolean
  createdAt: Date
  _count:   { classes: number }
}

export function TeacherTable({ teachers }: { teachers: Teacher[] }) {
  const [createOpen, setCreateOpen] = useState(false)
  const [editTeacher, setEditTeacher] = useState<Teacher | null>(null)
  const [resetTeacher, setResetTeacher] = useState<Teacher | null>(null)
  const router = useRouter()

  async function handleToggle(teacher: Teacher) {
    await toggleTeacherActive(teacher.id, !teacher.isActive)
    toast.success(teacher.isActive ? "تم تعطيل الحساب" : "تم تفعيل الحساب")
    router.refresh()
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button className="gap-2" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          إضافة معلم
        </Button>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>إضافة معلم جديد</DialogTitle>
            </DialogHeader>
            <TeacherForm
              onSuccess={() => { setCreateOpen(false); router.refresh() }}
            />
          </DialogContent>
        </Dialog>
      </div>

      {teachers.length === 0 ? (
        <div className="rounded-lg border py-12 text-center text-muted-foreground">
          <p className="text-sm">لا يوجد معلمون بعد — أضف معلماً جديداً</p>
        </div>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {teachers.map((t) => (
              <div key={t.id} className="rounded-lg border bg-card p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{t.fullName}{t.kunya ? ` (${t.kunya})` : ""}</p>
                    <p className="text-sm text-muted-foreground truncate" dir="ltr">{t.email}</p>
                    {t.phone && <p className="text-xs text-muted-foreground" dir="ltr">{t.phone}</p>}
                  </div>
                  <Badge variant={t.isActive ? "default" : "secondary"}>
                    {t.isActive ? "نشط" : "معطل"}
                  </Badge>
                </div>
                <div className="flex items-center gap-1">
                  <Link href={`/teachers/${t.id}`}>
                    <Button variant="ghost" size="icon" className="h-9 w-9" title="عرض الملف">
                      <Eye className="h-4 w-4" />
                    </Button>
                  </Link>
                  <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setEditTeacher(t)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setResetTeacher(t)}>
                    <KeyRound className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => handleToggle(t)}>
                    {t.isActive
                      ? <ToggleRight className="h-5 w-5 text-green-600" />
                      : <ToggleLeft className="h-5 w-5 text-muted-foreground" />}
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block rounded-lg border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الاسم</TableHead>
                  <TableHead>البريد الإلكتروني</TableHead>
                  <TableHead>الجوال</TableHead>
                  <TableHead>الحلقات</TableHead>
                  <TableHead>الحالة</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {teachers.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">{t.fullName}{t.kunya ? ` (${t.kunya})` : ""}</TableCell>
                    <TableCell className="text-sm" dir="ltr">{t.email}</TableCell>
                    <TableCell className="text-sm" dir="ltr">{t.phone ?? "—"}</TableCell>
                    <TableCell>{t._count.classes}</TableCell>
                    <TableCell>
                      <Badge variant={t.isActive ? "default" : "secondary"}>
                        {t.isActive ? "نشط" : "معطل"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 justify-end">
                        <Link href={`/teachers/${t.id}`}>
                          <Button variant="ghost" size="icon" title="عرض الملف"><Eye className="h-4 w-4" /></Button>
                        </Link>
                        <Button variant="ghost" size="icon" onClick={() => setEditTeacher(t)} title="تعديل"><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => setResetTeacher(t)} title="إعادة تعيين"><KeyRound className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => handleToggle(t)}>
                          {t.isActive
                            ? <ToggleRight className="h-5 w-5 text-green-600" />
                            : <ToggleLeft className="h-5 w-5 text-muted-foreground" />}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      <Dialog open={!!editTeacher} onOpenChange={(o) => !o && setEditTeacher(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>تعديل بيانات المعلم</DialogTitle>
          </DialogHeader>
          {editTeacher && (
            <TeacherForm
              teacher={editTeacher}
              onSuccess={() => { setEditTeacher(null); router.refresh() }}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!resetTeacher} onOpenChange={(o) => !o && setResetTeacher(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>إعادة تعيين كلمة المرور</DialogTitle>
          </DialogHeader>
          {resetTeacher && (
            <ResetPasswordForm
              teacher={resetTeacher}
              onSuccess={() => { setResetTeacher(null); toast.success("تم تغيير كلمة المرور") }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function TeacherForm({
  teacher,
  onSuccess,
}: {
  teacher?: Teacher
  onSuccess: () => void
}) {
  const action = teacher
    ? updateTeacher.bind(null, teacher.id)
    : createTeacher

  const [state, formAction, pending] = useActionState<TeacherFormState, FormData>(action, {})

  if (state.success) {
    onSuccess()
    return null
  }

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="fullName">الاسم الكامل</Label>
        <Input id="fullName" name="fullName" defaultValue={teacher?.fullName} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="kunya">الكنية</Label>
        <Input id="kunya" name="kunya" placeholder="أبو محمد" defaultValue={teacher?.kunya ?? ""} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">البريد الإلكتروني</Label>
        <Input id="email" name="email" type="email" dir="ltr" defaultValue={teacher?.email} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="phone">رقم الجوال</Label>
        <Input id="phone" name="phone" dir="ltr" placeholder="+9665xxxxxxxx" defaultValue={teacher?.phone ?? ""} />
      </div>
      {!teacher && (
        <div className="space-y-2">
          <Label htmlFor="password">كلمة المرور</Label>
          <Input id="password" name="password" type="password" required minLength={6} />
        </div>
      )}
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "جارٍ الحفظ…" : teacher ? "حفظ التعديلات" : "إضافة المعلم"}
      </Button>
    </form>
  )
}

function ResetPasswordForm({ teacher, onSuccess }: { teacher: Teacher; onSuccess: () => void }) {
  const action = resetTeacherPassword.bind(null, teacher.id)
  const [state, formAction, pending] = useActionState<TeacherFormState, FormData>(action, {})

  if (state.success) {
    onSuccess()
    return null
  }

  return (
    <form action={formAction} className="space-y-4">
      <p className="text-sm text-muted-foreground">تغيير كلمة مرور {teacher.fullName}</p>
      <div className="space-y-2">
        <Label htmlFor="password">كلمة المرور الجديدة</Label>
        <Input id="password" name="password" type="password" required minLength={6} />
      </div>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "جارٍ الحفظ…" : "تغيير كلمة المرور"}
      </Button>
    </form>
  )
}

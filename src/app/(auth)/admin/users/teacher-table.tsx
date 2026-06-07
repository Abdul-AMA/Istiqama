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
import { Plus, Pencil, KeyRound, ToggleLeft, ToggleRight } from "lucide-react"
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
          <DialogContent>
            <DialogHeader>
              <DialogTitle>إضافة معلم جديد</DialogTitle>
            </DialogHeader>
            <TeacherForm
              onSuccess={() => { setCreateOpen(false); router.refresh() }}
            />
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-lg border overflow-x-auto">
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
            {teachers.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  لا يوجد معلمون بعد
                </TableCell>
              </TableRow>
            )}
            {teachers.map((t) => (
              <TableRow key={t.id}>
                <TableCell className="font-medium">{t.fullName}</TableCell>
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
                    <Button variant="ghost" size="icon" onClick={() => setEditTeacher(t)} title="تعديل">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setResetTeacher(t)} title="إعادة تعيين كلمة المرور">
                      <KeyRound className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleToggle(t)} title={t.isActive ? "تعطيل" : "تفعيل"}>
                      {t.isActive
                        ? <ToggleRight className="h-5 w-5 text-green-600" />
                        : <ToggleLeft className="h-5 w-5 text-muted-foreground" />
                      }
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!editTeacher} onOpenChange={(o) => !o && setEditTeacher(null)}>
        <DialogContent>
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
        <DialogContent>
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

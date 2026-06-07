"use client"

import { useState, useActionState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { confirmGuest, type StudentFormState } from "@/lib/actions/student.actions"
import { toast } from "sonner"

type Guest = {
  id:           string
  fullName:     string
  gender:       string
  guardianPhone: string | null
  notes:        string | null
  createdAt:    Date
  class:        { id: string; name: string; teacher: { fullName: string } } | null
}

type ClassOption = { id: string; name: string }

export function GuestsClient({ guests, classes }: { guests: Guest[]; classes: ClassOption[] }) {
  const [selected, setSelected] = useState<Guest | null>(null)
  const router = useRouter()

  if (guests.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground border rounded-lg">
        <p className="text-4xl mb-3">✅</p>
        <p>لا يوجد طلاب ضيوف في الانتظار</p>
      </div>
    )
  }

  return (
    <>
      <div className="grid gap-3 md:grid-cols-2">
        {guests.map((guest) => (
          <Card key={guest.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => setSelected(guest)}>
            <CardContent className="pt-4 pb-4 space-y-2">
              <div className="flex items-center justify-between">
                <p className="font-semibold">{guest.fullName}</p>
                <Badge className="bg-orange-100 text-orange-800 border-orange-200">ضيف</Badge>
              </div>
              {guest.class && (
                <p className="text-sm text-muted-foreground">
                  الحلقة: {guest.class.name} — {guest.class.teacher.fullName}
                </p>
              )}
              {guest.guardianPhone && (
                <p className="text-sm text-muted-foreground" dir="ltr">{guest.guardianPhone}</p>
              )}
              {guest.notes && <p className="text-sm text-muted-foreground">{guest.notes}</p>}
              <Button size="sm" className="w-full mt-1">إكمال البيانات وتحويل لطالب نظامي</Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>تحويل الضيف إلى طالب نظامي</DialogTitle>
          </DialogHeader>
          {selected && (
            <ConfirmGuestForm
              guest={selected}
              classes={classes}
              onSuccess={() => {
                setSelected(null)
                toast.success("تم تحويل الضيف إلى طالب نظامي")
                router.refresh()
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

function ConfirmGuestForm({
  guest,
  classes,
  onSuccess,
}: {
  guest:     Guest
  classes:   ClassOption[]
  onSuccess: () => void
}) {
  const action = confirmGuest.bind(null, guest.id)
  const [state, formAction, pending] = useActionState<StudentFormState, FormData>(action, {})
  const [gender, setGender]   = useState(guest.gender || "MALE")
  const [classId, setClassId] = useState(guest.class?.id ?? "")

  if (state.success) {
    onSuccess()
    return null
  }

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="gender" value={gender} />
      <input type="hidden" name="classId" value={classId} />

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2 col-span-2">
          <Label htmlFor="fullName">الاسم الكامل <span className="text-destructive">*</span></Label>
          <Input id="fullName" name="fullName" defaultValue={guest.fullName} required />
        </div>

        <div className="space-y-2">
          <Label>الجنس</Label>
          <Select value={gender} onValueChange={(v) => { if (v != null) setGender(v) }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="MALE">ذكر</SelectItem>
              <SelectItem value="FEMALE">أنثى</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="dateOfBirth">تاريخ الميلاد</Label>
          <Input id="dateOfBirth" name="dateOfBirth" type="date" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="nationalId">رقم الهوية</Label>
          <Input id="nationalId" name="nationalId" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="schoolGrade">المرحلة الدراسية</Label>
          <Input id="schoolGrade" name="schoolGrade" placeholder="السادس الابتدائي" />
        </div>

        <div className="space-y-2 col-span-2">
          <Label htmlFor="neighborhood">الحي</Label>
          <Input id="neighborhood" name="neighborhood" />
        </div>

        <div className="space-y-2 col-span-2">
          <Label htmlFor="guardianName">اسم ولي الأمر</Label>
          <Input id="guardianName" name="guardianName" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="guardianPhone">هاتف ولي الأمر</Label>
          <Input id="guardianPhone" name="guardianPhone" dir="ltr" placeholder="+9665xxxxxxxx" defaultValue={guest.guardianPhone ?? ""} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="secondaryPhone">هاتف ثانوي</Label>
          <Input id="secondaryPhone" name="secondaryPhone" dir="ltr" placeholder="+9665xxxxxxxx" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="previousHifzPages">صفحات محفوظة قبل الالتحاق</Label>
          <Input id="previousHifzPages" name="previousHifzPages" type="number" min={0} max={604} />
        </div>

        <div className="space-y-2">
          <Label>الحلقة</Label>
          <Select value={classId} onValueChange={(v) => { if (v != null) setClassId(v) }}>
            <SelectTrigger><SelectValue placeholder="اختر الحلقة" /></SelectTrigger>
            <SelectContent>
              {classes.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2 col-span-2">
          <Label htmlFor="notes">ملاحظات</Label>
          <Textarea id="notes" name="notes" defaultValue={guest.notes ?? ""} rows={2} />
        </div>
      </div>

      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "جارٍ الحفظ…" : "تأكيد التحويل إلى طالب نظامي"}
      </Button>
    </form>
  )
}

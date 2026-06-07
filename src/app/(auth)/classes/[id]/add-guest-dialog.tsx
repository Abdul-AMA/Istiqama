"use client"

import { useState, useActionState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { UserPlus } from "lucide-react"
import { addGuestStudent, type StudentFormState } from "@/lib/actions/student.actions"
import { toast } from "sonner"

export function AddGuestDialog({ classId }: { classId: string }) {
  const [open, setOpen] = useState(false)
  const [gender, setGender] = useState<string>("MALE")
  const router = useRouter()

  const [state, formAction, pending] = useActionState<StudentFormState, FormData>(addGuestStudent, {})

  if (state.success && open) {
    setOpen(false)
    toast.success("تمت إضافة الطالب الضيف")
    router.refresh()
  }

  return (
    <>
      <Button variant="outline" size="sm" className="gap-2" onClick={() => setOpen(true)}>
        <UserPlus className="h-4 w-4" />
        إضافة ضيف
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>إضافة طالب ضيف</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground -mt-2">
          يُضاف الضيف فوراً إلى الحلقة بمعلومات مبسطة. يمكن للمدير لاحقاً إكمال البيانات وتحويله لطالب نظامي.
        </p>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="classId" value={classId} />
          <input type="hidden" name="gender" value={gender} />

          <div className="space-y-2">
            <Label htmlFor="fullName">اسم الطالب <span className="text-destructive">*</span></Label>
            <Input id="fullName" name="fullName" required />
          </div>

          <div className="space-y-2">
            <Label>الجنس</Label>
            <Select value={gender} onValueChange={(v) => { if (v != null) setGender(v) }}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="MALE">ذكر</SelectItem>
                <SelectItem value="FEMALE">أنثى</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="guardianPhone">هاتف ولي الأمر</Label>
            <Input id="guardianPhone" name="guardianPhone" dir="ltr" placeholder="+9665xxxxxxxx" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">ملاحظات</Label>
            <Textarea id="notes" name="notes" rows={2} />
          </div>

          {state.error && <p className="text-sm text-destructive">{state.error}</p>}
          <Button type="submit" disabled={pending} className="w-full">
            {pending ? "جارٍ الإضافة…" : "إضافة الضيف"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
    </>
  )
}

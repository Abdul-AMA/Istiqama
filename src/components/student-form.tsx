"use client"

import { useState, useActionState, useRef } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  createStudent,
  updateStudent,
  type StudentFormState,
} from "@/lib/actions/student.actions"
import { toast } from "sonner"
import { Camera } from "lucide-react"

type ClassOption = { id: string; name: string }

type StudentData = {
  id:               string
  fullName:         string
  gender:           string
  dateOfBirth:      Date | null
  nationalId:       string | null
  schoolGrade:      string | null
  neighborhood:     string | null
  guardianName:     string | null
  guardianPhone:    string | null
  secondaryPhone:   string | null
  previousHifzPages: number | null
  classId:          string | null
  notes:            string | null
  status:           string
  photoUrl:         string | null
}

export function StudentForm({
  student,
  classes,
  defaultClassId,
  isPrincipal,
}: {
  student?:       StudentData
  classes:        ClassOption[]
  defaultClassId?: string
  isPrincipal:    boolean
}) {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)

  const action = student
    ? updateStudent.bind(null, student.id)
    : createStudent

  const [state, formAction, pending] = useActionState<StudentFormState, FormData>(action, {})

  const [gender,  setGender]  = useState(student?.gender ?? "MALE")
  const [classId, setClassId] = useState(student?.classId ?? defaultClassId ?? "")
  const [status,  setStatus]  = useState(student?.status ?? "ACTIVE")
  const [photoPreview, setPhotoPreview] = useState<string | null>(student?.photoUrl ?? null)
  const [uploading, setUploading] = useState(false)

  if (state.success) {
    toast.success(student ? "تم تحديث بيانات الطالب" : "تم إضافة الطالب")
    router.back()
    return null
  }

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (!student?.id) return
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    const fd = new FormData()
    fd.append("studentId", student.id)
    fd.append("file", file)

    const res = await fetch("/api/students/photo", { method: "POST", body: fd })
    const json = await res.json()
    if (json.url) {
      setPhotoPreview(json.url)
      toast.success("تم رفع الصورة")
    } else {
      toast.error(json.error || "فشل رفع الصورة")
    }
    setUploading(false)
  }

  const formatDate = (d: Date | null) => {
    if (!d) return ""
    return new Date(d).toISOString().split("T")[0]
  }

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="gender" value={gender} />
      <input type="hidden" name="classId" value={classId} />
      {isPrincipal && <input type="hidden" name="status" value={status} />}

      {/* Photo — only shown for existing students */}
      {student && (
        <div className="flex items-center gap-4">
          <Avatar className="h-20 w-20">
            <AvatarImage src={photoPreview ?? undefined} />
            <AvatarFallback className="bg-green-100 text-green-800 text-lg font-bold">
              {student.fullName.slice(0, 2)}
            </AvatarFallback>
          </Avatar>
          <div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2"
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
            >
              <Camera className="h-4 w-4" />
              {uploading ? "جارٍ الرفع…" : "تغيير الصورة"}
            </Button>
            <p className="text-xs text-muted-foreground mt-1">JPG, PNG أو WebP — حتى 5 ميجابايت</p>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handlePhotoChange}
            />
          </div>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="fullName">الاسم الكامل <span className="text-destructive">*</span></Label>
          <Input id="fullName" name="fullName" defaultValue={student?.fullName} required />
        </div>

        <div className="space-y-2">
          <Label>الجنس <span className="text-destructive">*</span></Label>
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
          <Input id="dateOfBirth" name="dateOfBirth" type="date" defaultValue={formatDate(student?.dateOfBirth ?? null)} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="nationalId">رقم الهوية</Label>
          <Input id="nationalId" name="nationalId" defaultValue={student?.nationalId ?? ""} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="schoolGrade">المرحلة الدراسية</Label>
          <Input id="schoolGrade" name="schoolGrade" placeholder="السادس الابتدائي" defaultValue={student?.schoolGrade ?? ""} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="neighborhood">الحي</Label>
          <Input id="neighborhood" name="neighborhood" defaultValue={student?.neighborhood ?? ""} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="previousHifzPages">صفحات محفوظة قبل الالتحاق</Label>
          <Input id="previousHifzPages" name="previousHifzPages" type="number" min={0} max={604} defaultValue={student?.previousHifzPages ?? ""} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="guardianName">اسم ولي الأمر</Label>
          <Input id="guardianName" name="guardianName" defaultValue={student?.guardianName ?? ""} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="guardianPhone">هاتف ولي الأمر</Label>
          <Input id="guardianPhone" name="guardianPhone" dir="ltr" placeholder="+9665xxxxxxxx" defaultValue={student?.guardianPhone ?? ""} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="secondaryPhone">هاتف ثانوي</Label>
          <Input id="secondaryPhone" name="secondaryPhone" dir="ltr" placeholder="+9665xxxxxxxx" defaultValue={student?.secondaryPhone ?? ""} />
        </div>

        <div className="space-y-2">
          <Label>الحلقة</Label>
          <Select value={classId || "_none"} onValueChange={(v) => { if (v != null) setClassId(v === "_none" ? "" : v) }}>
            <SelectTrigger><SelectValue placeholder="بدون حلقة" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="_none">بدون حلقة</SelectItem>
              {classes.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isPrincipal && (
          <div className="space-y-2">
            <Label>الحالة</Label>
            <Select value={status} onValueChange={(v) => { if (v != null) setStatus(v) }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ACTIVE">نشط</SelectItem>
                <SelectItem value="INACTIVE">غير نشط</SelectItem>
                <SelectItem value="GRADUATED">متخرج</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="notes">ملاحظات</Label>
          <Textarea id="notes" name="notes" rows={3} defaultValue={student?.notes ?? ""} />
        </div>
      </div>

      {state.error && <p className="text-sm text-destructive">{state.error}</p>}

      <div className="flex gap-3 justify-end">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          إلغاء
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "جارٍ الحفظ…" : student ? "حفظ التعديلات" : "إضافة الطالب"}
        </Button>
      </div>
    </form>
  )
}

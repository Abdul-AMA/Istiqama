"use client"

import { useState, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
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
import { UserPlus } from "lucide-react"
import { addGuestStudent } from "@/lib/actions/student.actions"
import { db } from "@/lib/db"
import { toast } from "sonner"

type OfflineGuest = {
  id: string
  fullName: string
  photoUrl: null
  status: "GUEST"
  currentTotalPagesMemorized: number
  lastSabaqReference: null
}

interface Props {
  classId: string
  onOfflineGuestAdded?: (guest: OfflineGuest) => void
}

export function AddGuestDialog({ classId, onOfflineGuestAdded }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fullName, setFullName] = useState("")
  const [gender, setGender] = useState<"MALE" | "FEMALE">("MALE")
  const [guardianPhone, setGuardianPhone] = useState("")
  const [notes, setNotes] = useState("")

  const resetForm = () => {
    setFullName("")
    setGender("MALE")
    setGuardianPhone("")
    setNotes("")
    setError(null)
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!fullName.trim()) { setError("اسم الطالب مطلوب"); return }
    setPending(true)
    setError(null)

    if (!navigator.onLine) {
      // Queue for offline sync
      const localId = `offline-${Date.now()}-${Math.random().toString(36).slice(2)}`
      const payload = {
        localId,
        fullName: fullName.trim(),
        gender,
        guardianPhone: guardianPhone || null,
        notes: notes || null,
        classId,
      }

      await db.pendingOps.add({
        type: "CREATE_GUEST_STUDENT",
        payload,
        createdAt: Date.now(),
        status: "PENDING",
        retries: 0,
      })

      // Add to roster cache so daily session sees them offline
      const cached = await db.cachedData.get(`roster:${classId}`)
      const existing = (cached?.value as OfflineGuest[] | undefined) ?? []
      const newGuest: OfflineGuest = {
        id: localId,
        fullName: fullName.trim(),
        photoUrl: null,
        status: "GUEST",
        currentTotalPagesMemorized: 0,
        lastSabaqReference: null,
      }
      await db.cachedData.put({
        key: `roster:${classId}`,
        value: [...existing, newGuest],
        updatedAt: Date.now(),
      })

      onOfflineGuestAdded?.(newGuest)
      toast.success("سيتم المزامنة لاحقاً ✓")
      resetForm()
      setOpen(false)
      setPending(false)
      return
    }

    // Online: use server action via FormData
    const formData = new FormData()
    formData.set("fullName", fullName.trim())
    formData.set("gender", gender)
    formData.set("guardianPhone", guardianPhone)
    formData.set("notes", notes)
    formData.set("classId", classId)

    const result = await addGuestStudent({}, formData)
    setPending(false)
    if (result.error) {
      setError(result.error)
    } else {
      toast.success("تمت إضافة الطالب الضيف")
      resetForm()
      setOpen(false)
      router.refresh()
    }
  }

  return (
    <>
      <Button variant="outline" size="sm" className="gap-2" onClick={() => setOpen(true)}>
        <UserPlus className="h-4 w-4" />
        إضافة ضيف
      </Button>
      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm() }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>إضافة طالب ضيف</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground -mt-2">
            يُضاف الضيف فوراً إلى الحلقة بمعلومات مبسطة. يمكن للمدير لاحقاً إكمال البيانات وتحويله لطالب نظامي.
          </p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">اسم الطالب <span className="text-destructive">*</span></Label>
              <Input
                id="fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>الجنس</Label>
              <Select value={gender} onValueChange={(v) => { if (v) setGender(v as "MALE" | "FEMALE") }}>
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
              <Input
                id="guardianPhone"
                value={guardianPhone}
                onChange={(e) => setGuardianPhone(e.target.value)}
                dir="ltr"
                placeholder="+9665xxxxxxxx"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">ملاحظات</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button type="submit" disabled={pending} className="w-full">
              {pending ? "جارٍ الإضافة…" : "إضافة الضيف"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}

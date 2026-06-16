"use client"

import { useState, useActionState } from "react"
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
import { Plus } from "lucide-react"
import { createSardRecord, type SardFormState } from "@/lib/actions/sard.actions"
import { toast } from "sonner"

const RATING_OPTIONS = [
  { value: "4", label: "4 — ممتاز" },
  { value: "3", label: "3 — جيد جداً" },
  { value: "2", label: "2 — جيد" },
  { value: "1", label: "1 — يحتاج إعادة" },
]

export function SardDialog({
  studentId,
  defaultType,
  defaultSource,
  defaultKind,
}: {
  studentId:     string
  defaultType:   "INDIVIDUAL" | "GROUP"
  defaultSource?: "LOCAL" | "DARUL_QURAN" | "AWQAF"
  defaultKind?:  "SARD" | "EXAM"
}) {
  const [open, setOpen] = useState(false)
  const [type,   setType]   = useState<string>(defaultType)
  const [source, setSource] = useState<string>(defaultSource ?? "LOCAL")
  const [kind,   setKind]   = useState<string>(defaultKind ?? "SARD")
  const [rating, setRating] = useState<string>("4")
  const router = useRouter()

  const boundAction = createSardRecord.bind(null, studentId)
  const [state, formAction, pending] = useActionState<SardFormState, FormData>(boundAction, {})

  if (state.success && open) {
    setOpen(false)
    toast.success("تم تسجيل السرد")
    router.refresh()
  }

  const today = new Date().toISOString().split("T")[0]

  return (
    <>
      <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={() => setOpen(true)}>
        <Plus className="h-3.5 w-3.5" />
        سرد جديد
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>تسجيل سرد جديد</DialogTitle>
          </DialogHeader>
          <form action={formAction} className="space-y-4">
            <input type="hidden" name="type"   value={type} />
            <input type="hidden" name="source" value={source} />
            <input type="hidden" name="kind"   value={kind} />
            <input type="hidden" name="rating" value={rating} />

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>الجهة</Label>
                <Select value={source} onValueChange={(v) => { if (v != null) setSource(v) }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LOCAL">المدرسة المحلية</SelectItem>
                    <SelectItem value="DARUL_QURAN">دار القران الكريم والسنة</SelectItem>
                    <SelectItem value="AWQAF">وزارة الأوقاف والشؤون الدينية</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>النوع</Label>
                <Select value={kind} onValueChange={(v) => { if (v != null) setKind(v) }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SARD">سرد</SelectItem>
                    <SelectItem value="EXAM">اختبار</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>فردي / مجتمعي</Label>
                <Select value={type} onValueChange={(v) => { if (v != null) setType(v) }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="INDIVIDUAL">فردي</SelectItem>
                    <SelectItem value="GROUP">مجتمعي</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="sard-date">التاريخ</Label>
                <Input id="sard-date" name="date" type="date" defaultValue={today} required />
              </div>

              <div className="space-y-2">
                <Label htmlFor="fromJuz">من الجزء</Label>
                <Input id="fromJuz" name="fromJuz" type="number" min={1} max={30} placeholder="1" required />
              </div>

              <div className="space-y-2">
                <Label htmlFor="toJuz">إلى الجزء</Label>
                <Input id="toJuz" name="toJuz" type="number" min={1} max={30} placeholder="30" required />
              </div>

              <div className="space-y-2">
                <Label>التقييم</Label>
                <Select value={rating} onValueChange={(v) => { if (v != null) setRating(v) }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {RATING_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="mistakes">عدد الأخطاء</Label>
                <Input id="mistakes" name="mistakes" type="number" min={0} defaultValue="0" />
              </div>

              <div className="space-y-2 col-span-2">
                <Label htmlFor="sard-notes">ملاحظات</Label>
                <Textarea id="sard-notes" name="notes" rows={2} />
              </div>
            </div>

            {state.error && <p className="text-sm text-destructive">{state.error}</p>}
            <Button type="submit" disabled={pending} className="w-full">
              {pending ? "جارٍ الحفظ…" : "تسجيل السرد"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}

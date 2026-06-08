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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Plus, Pencil, Trash2, Calendar } from "lucide-react"
import { toast } from "sonner"
import {
  createSlot,
  updateSlot,
  deleteSlot,
  type SlotFormState,
} from "@/lib/actions/schedule.actions"
import type { DayOfWeek } from "@prisma/client"

// ─── Types ────────────────────────────────────────────────────────────────────

type Slot = {
  id:        string
  classId:   string
  dayOfWeek: DayOfWeek
  startTime: string
  endTime:   string
}

type ClassData = {
  id:    string
  name:  string
  teacher: { id: string; fullName: string }
  scheduleSlots: Slot[]
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DAYS: { key: DayOfWeek; label: string }[] = [
  { key: "SUN", label: "الأحد" },
  { key: "MON", label: "الاثنين" },
  { key: "TUE", label: "الثلاثاء" },
  { key: "WED", label: "الأربعاء" },
  { key: "THU", label: "الخميس" },
  { key: "FRI", label: "الجمعة" },
  { key: "SAT", label: "السبت" },
]

const TEACHER_COLORS = [
  { bg: "bg-blue-100",   text: "text-blue-900",   border: "border-blue-300"   },
  { bg: "bg-purple-100", text: "text-purple-900",  border: "border-purple-300" },
  { bg: "bg-amber-100",  text: "text-amber-900",   border: "border-amber-300"  },
  { bg: "bg-rose-100",   text: "text-rose-900",    border: "border-rose-300"   },
  { bg: "bg-teal-100",   text: "text-teal-900",    border: "border-teal-300"   },
  { bg: "bg-indigo-100", text: "text-indigo-900",  border: "border-indigo-300" },
  { bg: "bg-orange-100", text: "text-orange-900",  border: "border-orange-300" },
  { bg: "bg-lime-100",   text: "text-lime-900",    border: "border-lime-300"   },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildTeacherColorMap(classes: ClassData[]): Record<string, (typeof TEACHER_COLORS)[0]> {
  const teacherIds = [...new Set(classes.map((c) => c.teacher.id))]
  return Object.fromEntries(
    teacherIds.map((id, i) => [id, TEACHER_COLORS[i % TEACHER_COLORS.length]]),
  )
}

function fmt12(time: string): string {
  const [hStr, mStr] = time.split(":")
  const h = parseInt(hStr, 10)
  const m = mStr
  const period = h >= 12 ? "م" : "ص"
  const h12 = h % 12 || 12
  return `${h12}:${m} ${period}`
}

// ─── Main component ───────────────────────────────────────────────────────────

export function TimetableClient({
  classes,
  role,
}: {
  classes: ClassData[]
  role: string
}) {
  const [addOpen,  setAddOpen]  = useState(false)
  const [editSlot, setEditSlot] = useState<(Slot & { className: string }) | null>(null)
  const [delSlot,  setDelSlot]  = useState<(Slot & { className: string }) | null>(null)
  const [deleting, setDeleting] = useState(false)
  const router = useRouter()

  const teacherColorMap = buildTeacherColorMap(classes)

  // Flatten all slots with their class info for easy lookup
  const allSlots = classes.flatMap((cls) =>
    cls.scheduleSlots.map((s) => ({ ...s, class: cls })),
  )

  async function handleDelete() {
    if (!delSlot) return
    setDeleting(true)
    try {
      await deleteSlot(delSlot.id)
      toast.success("تم حذف الحصة")
      setDelSlot(null)
      router.refresh()
    } catch {
      toast.error("حدث خطأ أثناء الحذف")
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Add slot button (principal only) */}
      {role === "PRINCIPAL" && (
        <div className="flex items-center gap-3">
          <Button onClick={() => setAddOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            إضافة حصة
          </Button>
          {/* Color legend */}
          <div className="flex flex-wrap gap-2 ms-2">
            {[...new Map(classes.map((c) => [c.teacher.id, c.teacher])).values()].map(
              (teacher) => {
                const color = teacherColorMap[teacher.id]
                return (
                  <span
                    key={teacher.id}
                    className={`inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-full border ${color.bg} ${color.text} ${color.border}`}
                  >
                    <span className="w-2 h-2 rounded-full bg-current opacity-60" />
                    {teacher.fullName}
                  </span>
                )
              },
            )}
          </div>
        </div>
      )}

      {/* Teacher color legend (teacher view) */}
      {role === "TEACHER" && classes.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {classes.map((cls) => {
            const color = teacherColorMap[cls.teacher.id]
            return (
              <span
                key={cls.id}
                className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border ${color.bg} ${color.text} ${color.border}`}
              >
                {cls.name}
              </span>
            )
          })}
        </div>
      )}

      {/* Empty state */}
      {classes.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <Calendar className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="text-base">لا توجد حلقات نشطة</p>
        </div>
      ) : (
        <>
          {/* Desktop grid */}
          <div className="hidden md:block overflow-x-auto">
            <div className="grid grid-cols-7 gap-2 min-w-[700px]">
              {DAYS.map((day) => {
                const daySlots = allSlots
                  .filter((s) => s.dayOfWeek === day.key)
                  .sort((a, b) => a.startTime.localeCompare(b.startTime))

                return (
                  <div key={day.key} className="flex flex-col gap-2">
                    <div className="text-center text-sm font-semibold py-2 bg-muted rounded-lg">
                      {day.label}
                    </div>
                    {daySlots.length === 0 ? (
                      <div className="flex-1 min-h-[80px] rounded-lg border-2 border-dashed border-muted-foreground/20 flex items-center justify-center">
                        <span className="text-xs text-muted-foreground/40">—</span>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {daySlots.map((slot) => {
                          const color = teacherColorMap[slot.class.teacher.id]
                          return (
                            <SlotCard
                              key={slot.id}
                              slot={slot}
                              color={color}
                              isPrincipal={role === "PRINCIPAL"}
                              onEdit={() =>
                                setEditSlot({ ...slot, className: slot.class.name })
                              }
                              onDelete={() =>
                                setDelSlot({ ...slot, className: slot.class.name })
                              }
                            />
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Mobile list (grouped by day) */}
          <div className="md:hidden space-y-4">
            {DAYS.map((day) => {
              const daySlots = allSlots
                .filter((s) => s.dayOfWeek === day.key)
                .sort((a, b) => a.startTime.localeCompare(b.startTime))

              if (daySlots.length === 0) return null

              return (
                <div key={day.key}>
                  <h3 className="text-sm font-semibold text-muted-foreground mb-2">
                    {day.label}
                  </h3>
                  <div className="space-y-2">
                    {daySlots.map((slot) => {
                      const color = teacherColorMap[slot.class.teacher.id]
                      return (
                        <SlotCard
                          key={slot.id}
                          slot={slot}
                          color={color}
                          isPrincipal={role === "PRINCIPAL"}
                          onEdit={() =>
                            setEditSlot({ ...slot, className: slot.class.name })
                          }
                          onDelete={() =>
                            setDelSlot({ ...slot, className: slot.class.name })
                          }
                        />
                      )
                    })}
                  </div>
                </div>
              )
            })}
            {allSlots.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <p className="text-sm">لا توجد حصص مجدولة بعد</p>
                {role === "PRINCIPAL" && (
                  <p className="text-xs mt-1">اضغط "إضافة حصة" للبدء</p>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {/* Add slot dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>إضافة حصة جديدة</DialogTitle>
          </DialogHeader>
          <SlotForm
            classes={classes}
            onSuccess={() => { setAddOpen(false); router.refresh() }}
          />
        </DialogContent>
      </Dialog>

      {/* Edit slot dialog — keyed by slot.id to force remount */}
      <Dialog open={!!editSlot} onOpenChange={(o) => !o && setEditSlot(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>تعديل الحصة</DialogTitle>
          </DialogHeader>
          {editSlot && (
            <SlotForm
              key={editSlot.id}
              slot={editSlot}
              classes={classes}
              onSuccess={() => { setEditSlot(null); router.refresh() }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog open={!!delSlot} onOpenChange={(o) => !o && setDelSlot(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>حذف الحصة</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            هل أنت متأكد من حذف حصة <span className="font-medium text-foreground">{delSlot?.className}</span>؟
            لا يمكن التراجع عن هذا الإجراء.
          </p>
          <div className="flex gap-3 justify-end pt-2">
            <Button variant="outline" onClick={() => setDelSlot(null)}>
              إلغاء
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? "جارٍ الحذف…" : "حذف"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Slot card ─────────────────────────────────────────────────────────────────

function SlotCard({
  slot,
  color,
  isPrincipal,
  onEdit,
  onDelete,
}: {
  slot: { startTime: string; endTime: string; class: ClassData }
  color: (typeof TEACHER_COLORS)[0]
  isPrincipal: boolean
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <div
      className={`rounded-lg border p-2.5 ${color.bg} ${color.border} transition-shadow hover:shadow-sm`}
    >
      <p className={`text-xs font-semibold leading-tight ${color.text}`}>
        {slot.class.name}
      </p>
      <p className={`text-xs mt-0.5 ${color.text} opacity-70`} dir="ltr">
        {fmt12(slot.startTime)} – {fmt12(slot.endTime)}
      </p>
      <p className={`text-xs mt-0.5 ${color.text} opacity-60`}>
        {slot.class.teacher.fullName}
      </p>
      {isPrincipal && (
        <div className="flex gap-1 mt-1.5">
          <button
            onClick={onEdit}
            className={`p-1 rounded hover:bg-black/5 ${color.text}`}
            title="تعديل"
          >
            <Pencil className="h-3 w-3" />
          </button>
          <button
            onClick={onDelete}
            className="p-1 rounded hover:bg-black/5 text-rose-700"
            title="حذف"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Slot form (create / edit) ─────────────────────────────────────────────────

function SlotForm({
  slot,
  classes,
  onSuccess,
}: {
  slot?: Slot & { className: string }
  classes: ClassData[]
  onSuccess: () => void
}) {
  const action = slot ? updateSlot.bind(null, slot.id) : createSlot
  const [state, formAction, pending] = useActionState<SlotFormState, FormData>(action, {})

  // Controlled selects (needed because shadcn Select doesn't use native hidden input)
  const [classId,   setClassId]   = useState(slot?.classId   ?? "")
  const [dayOfWeek, setDayOfWeek] = useState<DayOfWeek | "">(slot?.dayOfWeek ?? "")

  if (state.success) {
    onSuccess()
    return null
  }

  return (
    <form action={formAction} className="space-y-4">
      {/* Hidden inputs for Select values */}
      <input type="hidden" name="classId"   value={classId} />
      <input type="hidden" name="dayOfWeek" value={dayOfWeek} />

      <div className="space-y-2">
        <Label>الحلقة</Label>
        <Select value={classId} onValueChange={(v) => setClassId(v ?? "")}>
          <SelectTrigger>
            <SelectValue placeholder="اختر الحلقة" />
          </SelectTrigger>
          <SelectContent>
            {classes.map((cls) => (
              <SelectItem key={cls.id} value={cls.id}>
                {cls.name} — {cls.teacher.fullName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>اليوم</Label>
        <Select value={dayOfWeek} onValueChange={(v) => setDayOfWeek(v as DayOfWeek)}>
          <SelectTrigger>
            <SelectValue placeholder="اختر اليوم" />
          </SelectTrigger>
          <SelectContent>
            {DAYS.map((d) => (
              <SelectItem key={d.key} value={d.key}>
                {d.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="startTime">وقت البداية</Label>
          <Input
            id="startTime"
            name="startTime"
            type="time"
            defaultValue={slot?.startTime ?? ""}
            required
            dir="ltr"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="endTime">وقت النهاية</Label>
          <Input
            id="endTime"
            name="endTime"
            type="time"
            defaultValue={slot?.endTime ?? ""}
            required
            dir="ltr"
          />
        </div>
      </div>

      {state.error && (
        <p className="text-sm text-destructive">{state.error}</p>
      )}

      <Button type="submit" disabled={pending || !classId || !dayOfWeek} className="w-full">
        {pending ? "جارٍ الحفظ…" : slot ? "حفظ التعديلات" : "إضافة الحصة"}
      </Button>
    </form>
  )
}

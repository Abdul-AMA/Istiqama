"use client"

import { useState, useCallback, useTransition, useEffect, useRef } from "react"
import { toast } from "sonner"
import { ChevronDown, ChevronUp, Save, Loader2, BookOpen } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import {
  loadDailySession,
  saveDailySession,
  getSurahsForRange,
  type SaveSessionInput,
} from "@/lib/actions/daily-session.actions"

// ─── Types ────────────────────────────────────────────────────────────────────

type MyClass = { id: string; name: string; teacher: { fullName: string } }

type StudentRow = {
  student: {
    id: string
    fullName: string
    photoUrl: string | null
    status: string
    currentTotalPagesMemorized: number
    lastSabaqReference: string | null
  }
  attendance: { studentId: string; status: string; notes: string | null } | null
  hifzSession: {
    id: string
    generalNotes: string | null
    entries: {
      id: string
      type: string
      fromPage: number
      toPage: number
      rating: number
      mistakeCount: number
      notes: string | null
    }[]
  } | null
}

type RecEntry = {
  type: "NEW" | "RECENT_REVISION" | "OLD_REVISION"
  fromPage: string
  toPage: string
  rating: string
  mistakeCount: string
  notes: string
  surahs: string
}

type StudentState = {
  attendance: "PRESENT" | "ABSENT" | "LATE" | "EXCUSED"
  attendanceNotes: string
  generalNotes: string
  recitations: RecEntry[]
}

const ATTENDANCE_OPTIONS = [
  { value: "PRESENT", label: "حاضر", className: "bg-green-100 text-green-800 border-green-200" },
  { value: "LATE", label: "متأخر", className: "bg-yellow-100 text-yellow-800 border-yellow-200" },
  { value: "ABSENT", label: "غائب", className: "bg-red-100 text-red-800 border-red-200" },
  { value: "EXCUSED", label: "معذور", className: "bg-gray-100 text-gray-700 border-gray-200" },
]

const REC_TYPES: { type: "NEW" | "RECENT_REVISION" | "OLD_REVISION"; label: string; color: string }[] = [
  { type: "NEW", label: "سبق (حفظ جديد)", color: "text-green-700 bg-green-50 border-green-200" },
  { type: "RECENT_REVISION", label: "سبقي (مراجعة قريبة)", color: "text-blue-700 bg-blue-50 border-blue-200" },
  { type: "OLD_REVISION", label: "منزل (مراجعة قديمة)", color: "text-purple-700 bg-purple-50 border-purple-200" },
]

const RATING_LABELS: Record<number, string> = { 4: "ممتاز", 3: "جيد جداً", 2: "جيد", 1: "يحتاج إعادة" }

function emptyRec(type: "NEW" | "RECENT_REVISION" | "OLD_REVISION"): RecEntry {
  return { type, fromPage: "", toPage: "", rating: "", mistakeCount: "0", notes: "", surahs: "" }
}

function initStudentState(row: StudentRow): StudentState {
  const attendance = (row.attendance?.status as StudentState["attendance"]) ?? "PRESENT"
  const recitations: RecEntry[] = []
  const usedTypes = new Set<string>()

  if (row.hifzSession) {
    for (const e of row.hifzSession.entries) {
      usedTypes.add(e.type)
      recitations.push({
        type: e.type as "NEW" | "RECENT_REVISION" | "OLD_REVISION",
        fromPage: String(e.fromPage),
        toPage: String(e.toPage),
        rating: String(e.rating),
        mistakeCount: String(e.mistakeCount),
        notes: e.notes ?? "",
        surahs: "",
      })
    }
  }

  return {
    attendance,
    attendanceNotes: row.attendance?.notes ?? "",
    generalNotes: row.hifzSession?.generalNotes ?? "",
    recitations,
  }
}

// ─── Surah label hook ────────────────────────────────────────────────────────

function useSurahLabel(fromPage: string, toPage: string) {
  const [label, setLabel] = useState("")
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const from = parseInt(fromPage)
    const to = parseInt(toPage)
    if (!from || !to || from > to || from < 1 || to > 604) {
      setLabel("")
      return
    }
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(async () => {
      const surahs = await getSurahsForRange(from, to)
      if (surahs.length === 0) {
        setLabel("")
      } else {
        setLabel(surahs.map((s) => s.nameAr).join(" ، "))
      }
    }, 400)
    return () => { if (timer.current) clearTimeout(timer.current) }
  }, [fromPage, toPage])

  return label
}

// ─── Recitation entry block ───────────────────────────────────────────────────

function RecitationBlock({
  rec,
  onChange,
  onRemove,
}: {
  rec: RecEntry
  onChange: (updated: RecEntry) => void
  onRemove: () => void
}) {
  const surahLabel = useSurahLabel(rec.fromPage, rec.toPage)
  const meta = REC_TYPES.find((t) => t.type === rec.type)!

  const set = (field: keyof RecEntry, val: string) => onChange({ ...rec, [field]: val })

  return (
    <div className={cn("rounded-lg border p-3 space-y-3", meta.color)}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold">{meta.label}</span>
        <button
          type="button"
          onClick={onRemove}
          className="text-xs text-muted-foreground hover:text-destructive"
        >
          حذف
        </button>
      </div>

      {/* Page range */}
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs">من صفحة</Label>
          <Input
            type="number"
            min={1}
            max={604}
            value={rec.fromPage}
            onChange={(e) => set("fromPage", e.target.value)}
            className="h-10 text-center text-base"
            placeholder="1"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">إلى صفحة</Label>
          <Input
            type="number"
            min={1}
            max={604}
            value={rec.toPage}
            onChange={(e) => set("toPage", e.target.value)}
            className="h-10 text-center text-base"
            placeholder="604"
          />
        </div>
      </div>

      {/* Surah names */}
      {surahLabel && (
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <BookOpen className="h-3 w-3 shrink-0" />
          {surahLabel}
        </p>
      )}

      {/* Rating */}
      <div className="space-y-1">
        <Label className="text-xs">التقييم</Label>
        <div className="grid grid-cols-4 gap-1">
          {[4, 3, 2, 1].map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => set("rating", String(r))}
              className={cn(
                "rounded-md border py-2 text-xs font-medium transition-colors",
                rec.rating === String(r)
                  ? r === 4
                    ? "bg-green-600 text-white border-green-600"
                    : r === 3
                    ? "bg-blue-600 text-white border-blue-600"
                    : r === 2
                    ? "bg-yellow-500 text-white border-yellow-500"
                    : "bg-red-500 text-white border-red-500"
                  : "bg-background hover:bg-muted",
              )}
            >
              {RATING_LABELS[r]}
            </button>
          ))}
        </div>
      </div>

      {/* Mistakes */}
      <div className="flex items-center gap-3">
        <Label className="text-xs shrink-0">عدد الأخطاء</Label>
        <Input
          type="number"
          min={0}
          value={rec.mistakeCount}
          onChange={(e) => set("mistakeCount", e.target.value)}
          className="h-9 w-20 text-center text-base"
        />
      </div>

      {/* Notes */}
      <div className="space-y-1">
        <Label className="text-xs">ملاحظات</Label>
        <Textarea
          value={rec.notes}
          onChange={(e) => set("notes", e.target.value)}
          rows={2}
          className="text-sm resize-none"
          placeholder="اختياري"
        />
      </div>
    </div>
  )
}

// ─── Student card ─────────────────────────────────────────────────────────────

function StudentCard({
  row,
  state,
  isExpanded,
  onToggle,
  onChange,
}: {
  row: StudentRow
  state: StudentState
  isExpanded: boolean
  onToggle: () => void
  onChange: (s: StudentState) => void
}) {
  const s = row.student
  const isPresent = state.attendance === "PRESENT" || state.attendance === "LATE"
  const attMeta = ATTENDANCE_OPTIONS.find((o) => o.value === state.attendance)!

  const usedTypes = new Set(state.recitations.map((r) => r.type))
  const availableTypes = REC_TYPES.filter((t) => !usedTypes.has(t.type))

  const addRecitation = (type: "NEW" | "RECENT_REVISION" | "OLD_REVISION") => {
    onChange({ ...state, recitations: [...state.recitations, emptyRec(type)] })
  }

  const updateRec = (idx: number, updated: RecEntry) => {
    const next = [...state.recitations]
    next[idx] = updated
    onChange({ ...state, recitations: next })
  }

  const removeRec = (idx: number) => {
    onChange({ ...state, recitations: state.recitations.filter((_, i) => i !== idx) })
  }

  const setAttendance = (val: string) => {
    const newAtt = val as StudentState["attendance"]
    const newPresent = newAtt === "PRESENT" || newAtt === "LATE"
    onChange({
      ...state,
      attendance: newAtt,
      recitations: newPresent ? state.recitations : [],
    })
  }

  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      {/* Card header — always visible */}
      <button
        type="button"
        className="w-full flex items-center gap-3 p-4 text-right"
        onClick={onToggle}
      >
        <Avatar className="h-11 w-11 shrink-0">
          <AvatarImage src={s.photoUrl ?? undefined} alt={s.fullName} />
          <AvatarFallback className="bg-green-100 text-green-800 text-sm font-semibold">
            {s.fullName.slice(0, 2)}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0 text-right">
          <div className="flex items-center gap-2">
            <span className="font-semibold truncate">{s.fullName}</span>
            {s.status === "GUEST" && (
              <Badge className="bg-orange-100 text-orange-800 border-orange-200 text-xs shrink-0">ضيف</Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {s.currentTotalPagesMemorized} ص محفوظة
            {s.lastSabaqReference && ` · آخر سبق: ${s.lastSabaqReference}`}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className={cn("text-xs font-medium px-2 py-1 rounded-full border", attMeta.className)}>
            {attMeta.label}
          </span>
          {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>

      {/* Expanded body */}
      {isExpanded && (
        <div className="border-t px-4 pb-4 pt-3 space-y-4">
          {/* Attendance selector */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">الحضور</Label>
            <div className="grid grid-cols-4 gap-2">
              {ATTENDANCE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setAttendance(opt.value)}
                  className={cn(
                    "rounded-lg border py-2.5 text-sm font-medium transition-colors",
                    state.attendance === opt.value
                      ? opt.className
                      : "bg-background hover:bg-muted text-muted-foreground",
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Hifz section — only when present/late */}
          {isPresent && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">الحفظ والمراجعة</Label>
              </div>

              {/* Existing recitation blocks */}
              {state.recitations.map((rec, idx) => (
                <RecitationBlock
                  key={rec.type}
                  rec={rec}
                  onChange={(updated) => updateRec(idx, updated)}
                  onRemove={() => removeRec(idx)}
                />
              ))}

              {/* Add recitation type buttons */}
              {availableTypes.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {availableTypes.map((t) => (
                    <button
                      key={t.type}
                      type="button"
                      onClick={() => addRecitation(t.type)}
                      className={cn(
                        "text-xs rounded-lg border px-3 py-2 font-medium transition-colors hover:opacity-80",
                        t.color,
                      )}
                    >
                      + {t.label}
                    </button>
                  ))}
                </div>
              )}

              {/* General notes */}
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">ملاحظات عامة للجلسة</Label>
                <Textarea
                  value={state.generalNotes}
                  onChange={(e) => onChange({ ...state, generalNotes: e.target.value })}
                  rows={2}
                  className="text-sm resize-none"
                  placeholder="اختياري"
                />
              </div>
            </div>
          )}

          {/* Attendance notes for absent/excused */}
          {!isPresent && (
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">سبب الغياب (اختياري)</Label>
              <Textarea
                value={state.attendanceNotes}
                onChange={(e) => onChange({ ...state, attendanceNotes: e.target.value })}
                rows={2}
                className="text-sm resize-none"
                placeholder="اختياري"
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Main client component ────────────────────────────────────────────────────

export function DailySessionClient({
  classes,
  initialClassId,
  initialDate,
}: {
  classes: MyClass[]
  initialClassId: string
  initialDate: string
}) {
  const [classId, setClassId] = useState(initialClassId || classes[0]?.id || "")
  const [date, setDate] = useState(initialDate)
  const [rows, setRows] = useState<StudentRow[]>([])
  const [states, setStates] = useState<Record<string, StudentState>>({})
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, startSaving] = useTransition()

  const load = useCallback(async (cid: string, d: string) => {
    if (!cid) return
    setLoading(true)
    try {
      const data = await loadDailySession(cid, d)
      setRows(data)
      const initStates: Record<string, StudentState> = {}
      for (const row of data) {
        initStates[row.student.id] = initStudentState(row)
      }
      setStates(initStates)
      // Auto-expand first student
      setExpandedId(data[0]?.student.id ?? null)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل تحميل البيانات")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load(classId, date)
  }, [classId, date, load])

  const updateState = (studentId: string, s: StudentState) =>
    setStates((prev) => ({ ...prev, [studentId]: s }))

  const handleSave = () => {
    startSaving(async () => {
      const entries: SaveSessionInput["entries"] = rows.map((row) => {
        const st = states[row.student.id]
        const recitations = st.recitations
          .filter((r) => r.fromPage && r.toPage && r.rating)
          .map((r) => ({
            type: r.type,
            fromPage: parseInt(r.fromPage),
            toPage: parseInt(r.toPage),
            rating: parseInt(r.rating),
            mistakeCount: parseInt(r.mistakeCount || "0"),
            notes: r.notes || undefined,
          }))
        return {
          studentId: row.student.id,
          attendance: st.attendance,
          attendanceNotes: st.attendanceNotes || undefined,
          generalNotes: st.generalNotes || undefined,
          recitations,
        }
      })

      const result = await saveDailySession({ classId, date, entries })
      if ("error" in result) {
        toast.error(result.error)
      } else {
        toast.success("تم الحفظ بنجاح")
      }
    })
  }

  const today = new Date().toISOString().slice(0, 10)
  const isFuture = date > today

  return (
    <div className="space-y-4">
      {/* Class + date selectors */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>الحلقة</Label>
          <Select value={classId} onValueChange={(v) => setClassId(v ?? "")}>
            <SelectTrigger className="h-11">
              <SelectValue placeholder="اختر حلقة" />
            </SelectTrigger>
            <SelectContent>
              {classes.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>التاريخ</Label>
          <Input
            type="date"
            value={date}
            max={today}
            onChange={(e) => setDate(e.target.value)}
            className="h-11"
          />
        </div>
      </div>

      {isFuture && (
        <p className="text-sm text-destructive text-center">لا يمكن تسجيل جلسة لتاريخ مستقبلي</p>
      )}

      {/* Roster */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
        </div>
      ) : rows.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <p>{classId ? "لا يوجد طلاب في هذه الحلقة" : "اختر حلقة أولاً"}</p>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{rows.length} طالب</p>
            <button
              type="button"
              onClick={() => setExpandedId(null)}
              className="text-xs text-muted-foreground hover:underline"
            >
              طي الكل
            </button>
          </div>

          <div className="space-y-3">
            {rows.map((row) => (
              <StudentCard
                key={row.student.id}
                row={row}
                state={states[row.student.id] ?? initStudentState(row)}
                isExpanded={expandedId === row.student.id}
                onToggle={() =>
                  setExpandedId((prev) => (prev === row.student.id ? null : row.student.id))
                }
                onChange={(s) => updateState(row.student.id, s)}
              />
            ))}
          </div>

          {/* Save button */}
          {!isFuture && (
            <div className="sticky bottom-4 pt-2">
              <Button
                size="lg"
                className="w-full h-14 text-base font-semibold gap-2 shadow-lg"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Save className="h-5 w-5" />
                )}
                حفظ الجلسة
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

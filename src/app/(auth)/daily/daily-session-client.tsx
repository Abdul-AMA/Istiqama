"use client"

import { useState, useCallback, useTransition, useEffect, useRef } from "react"
import { toast } from "sonner"
import { Save, Loader2, BookMarked, GraduationCap, ChevronDown, ChevronUp, Plus, Trash2, WifiOff } from "lucide-react"
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
  type SaveSessionInput,
} from "@/lib/actions/daily-session.actions"
import { db } from "@/lib/db"

// ─── Types ────────────────────────────────────────────────────────────────────

type MyClass = { id: string; name: string; teacher: { fullName: string } }

type SurahInfo = { number: number; nameAr: string; ayahCount: number; startPage: number }

type StudentData = {
  id: string
  fullName: string
  photoUrl: string | null
  status: string
  currentTotalPagesMemorized: number
  lastSabaqReference: string | null
}

type StudentRow = {
  student: StudentData
  attendance: { studentId: string; status: string; notes: string | null } | null
  hifzSession: {
    id: string
    generalNotes: string | null
    entries: {
      id: string
      type: string
      fromSurah: number | null
      fromAyah: number | null
      toSurah: number | null
      toAyah: number | null
      surahCompleted: boolean
      pagesCount: number | null
      rating: number
      mistakeCount: number
      notes: string | null
    }[]
  } | null
}

type SurahEntry = {
  surahNumber: string   // "" = not selected
  fromAyah: string
  toAyah: string
  completed: boolean
  pagesCount: string    // teacher-entered, 0.5 increments
  rating: string
  mistakeCount: string
  notes: string
}

type StudentState = {
  attendance: "PRESENT" | "ABSENT" | "LATE" | "EXCUSED" | ""   // "" = not yet set
  attendanceNotes: string
  generalNotes: string
  didNotRecite: boolean   // present but no recitation today
  hifz: SurahEntry[]
  muraja: SurahEntry[]
}

const ATTENDANCE_OPTIONS = [
  { value: "PRESENT",  label: "حاضر",  className: "bg-green-100 text-green-800 border-green-200" },
  { value: "LATE",     label: "متأخر", className: "bg-yellow-100 text-yellow-800 border-yellow-200" },
  { value: "ABSENT",   label: "غائب",  className: "bg-red-100 text-red-800 border-red-200" },
  { value: "EXCUSED",  label: "معذور", className: "bg-gray-100 text-gray-700 border-gray-200" },
]

const RATING_LABELS: Record<number, string> = { 4: "ممتاز", 3: "جيد جداً", 2: "جيد", 1: "يحتاج إعادة" }

function emptySurahEntry(): SurahEntry {
  return { surahNumber: "", fromAyah: "1", toAyah: "", completed: false, pagesCount: "", rating: "", mistakeCount: "0", notes: "" }
}

function initStudentState(row: StudentRow): StudentState {
  const hifz: SurahEntry[] = []
  const muraja: SurahEntry[] = []

  if (row.hifzSession) {
    for (const e of row.hifzSession.entries) {
      const entry: SurahEntry = {
        surahNumber: String(e.fromSurah ?? ""),
        fromAyah: String(e.fromAyah ?? "1"),
        toAyah: String(e.toAyah ?? ""),
        completed: e.surahCompleted,
        pagesCount: e.pagesCount !== null ? String(e.pagesCount) : "",
        rating: String(e.rating),
        mistakeCount: String(e.mistakeCount),
        notes: e.notes ?? "",
      }
      if (e.type === "NEW") hifz.push(entry)
      else muraja.push(entry)
    }
  }

  const savedAtt = row.attendance?.status as "PRESENT" | "ABSENT" | "LATE" | "EXCUSED" | undefined
  const isPresent = savedAtt === "PRESENT" || savedAtt === "LATE"
  const didNotRecite = !!savedAtt && isPresent && !row.hifzSession

  return {
    attendance: savedAtt ?? "",
    attendanceNotes: row.attendance?.notes ?? "",
    generalNotes: row.hifzSession?.generalNotes ?? "",
    didNotRecite,
    hifz,
    muraja,
  }
}

// ─── Surah Combobox ───────────────────────────────────────────────────────────

function SurahCombobox({
  value,
  surahs,
  onChange,
}: {
  value: string
  surahs: SurahInfo[]
  onChange: (num: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const containerRef = useRef<HTMLDivElement>(null)

  const selected = surahs.find((s) => String(s.number) === value)

  const filtered = query === ""
    ? surahs
    : surahs.filter(
        (s) => s.nameAr.includes(query) || String(s.number).startsWith(query)
      )

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery("")
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [open])

  const handleSelect = (num: string) => {
    onChange(num)
    setOpen(false)
    setQuery("")
  }

  return (
    <div ref={containerRef} className="relative flex-1">
      <input
        type="text"
        value={open ? query : (selected ? `${selected.number}. ${selected.nameAr}` : "")}
        onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
        onFocus={() => { setOpen(true); setQuery("") }}
        placeholder="ابحث عن سورة باسمها أو رقمها..."
        className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        autoComplete="off"
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-50 mt-1 w-full max-h-52 overflow-y-auto rounded-md border bg-popover shadow-md">
          {filtered.map((s) => (
            <div
              key={s.number}
              className={cn(
                "px-3 py-2 text-sm cursor-pointer hover:bg-muted",
                String(s.number) === value && "bg-muted font-semibold"
              )}
              onMouseDown={(e) => { e.preventDefault(); handleSelect(String(s.number)) }}
            >
              {s.number}. {s.nameAr}
              <span className="text-muted-foreground text-xs me-1"> ({s.ayahCount} آية)</span>
            </div>
          ))}
        </div>
      )}
      {open && filtered.length === 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover px-3 py-2 text-sm text-muted-foreground shadow-md">
          لا توجد نتائج
        </div>
      )}
    </div>
  )
}

// ─── Surah Entry Block ────────────────────────────────────────────────────────

function SurahEntryBlock({
  entry,
  surahs,
  onChange,
  onRemove,
}: {
  entry: SurahEntry
  surahs: SurahInfo[]
  onChange: (e: SurahEntry) => void
  onRemove: () => void
}) {
  const surah = surahs.find((s) => String(s.number) === entry.surahNumber)

  const set = <K extends keyof SurahEntry>(field: K, val: SurahEntry[K]) =>
    onChange({ ...entry, [field]: val })

  const handleSurahChange = (num: string) => {
    const s = surahs.find((x) => String(x.number) === num)
    onChange({
      ...entry,
      surahNumber: num,
      fromAyah: "1",
      toAyah: s ? String(s.ayahCount) : "",
      completed: false,
    })
  }

  const handleCompleted = (checked: boolean) => {
    if (checked && surah) {
      onChange({ ...entry, completed: true, fromAyah: "1", toAyah: String(surah.ayahCount) })
    } else {
      onChange({ ...entry, completed: false })
    }
  }

  return (
    <div className="rounded-lg border bg-background p-3 space-y-3">
      {/* Surah combobox + remove */}
      <div className="flex items-center gap-2">
        <SurahCombobox value={entry.surahNumber} surahs={surahs} onChange={handleSurahChange} />
        <button
          type="button"
          onClick={onRemove}
          className="shrink-0 text-muted-foreground hover:text-destructive transition-colors"
          aria-label="حذف"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {surah && (
        <>
          {/* Completed checkbox */}
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={entry.completed}
              onChange={(e) => handleCompleted(e.target.checked)}
              className="h-4 w-4 rounded accent-green-600"
            />
            <span className="text-sm font-medium">تم الحفظ كاملاً</span>
            <span className="text-xs text-muted-foreground">(الآية 1 – {surah.ayahCount})</span>
          </label>

          {/* Ayah range */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">من آية</Label>
              <Input
                type="number"
                min={1}
                max={surah.ayahCount}
                value={entry.fromAyah}
                onChange={(e) => set("fromAyah", e.target.value)}
                readOnly={entry.completed}
                className={cn("h-10 text-center text-base", entry.completed && "bg-muted cursor-not-allowed")}
                placeholder="1"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">إلى آية</Label>
              <Input
                type="number"
                min={1}
                max={surah.ayahCount}
                value={entry.toAyah}
                onChange={(e) => set("toAyah", e.target.value)}
                readOnly={entry.completed}
                className={cn("h-10 text-center text-base", entry.completed && "bg-muted cursor-not-allowed")}
                placeholder={String(surah.ayahCount)}
              />
            </div>
          </div>

          {/* Pages count */}
          <div className="flex items-center gap-3">
            <Label className="text-xs shrink-0">عدد الصفحات</Label>
            <Input
              type="number"
              min={0.5}
              step={0.5}
              value={entry.pagesCount}
              onChange={(e) => set("pagesCount", e.target.value)}
              className="h-9 w-24 text-center text-base"
              placeholder="0.5"
            />
          </div>

          {/* Rating */}
          <div className="space-y-1">
            <Label className="text-xs">التقييم</Label>
            <div className="grid grid-cols-4 gap-1">
              {([4, 3, 2, 1] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => set("rating", String(r))}
                  className={cn(
                    "rounded-md border py-2 text-xs font-medium transition-colors",
                    entry.rating === String(r)
                      ? r === 4 ? "bg-green-600 text-white border-green-600"
                        : r === 3 ? "bg-blue-600 text-white border-blue-600"
                        : r === 2 ? "bg-yellow-500 text-white border-yellow-500"
                        : "bg-red-500 text-white border-red-500"
                      : "bg-background hover:bg-muted",
                  )}
                >
                  {RATING_LABELS[r]}
                </button>
              ))}
            </div>
          </div>

          {/* Mistake count */}
          <div className="flex items-center gap-3">
            <Label className="text-xs shrink-0">عدد الأخطاء</Label>
            <Input
              type="number"
              min={0}
              value={entry.mistakeCount}
              onChange={(e) => set("mistakeCount", e.target.value)}
              className="h-9 w-20 text-center text-base"
            />
          </div>

          {/* Notes */}
          <div className="space-y-1">
            <Label className="text-xs">ملاحظات</Label>
            <Textarea
              value={entry.notes}
              onChange={(e) => set("notes", e.target.value)}
              rows={2}
              className="text-sm resize-none"
              placeholder="اختياري"
            />
          </div>
        </>
      )}
    </div>
  )
}

// ─── Section Block (حفظ or مراجعة) ──────────────────────────────────────────

function SectionBlock({
  title,
  colorClass,
  entries,
  surahs,
  onChange,
}: {
  title: string
  colorClass: string
  entries: SurahEntry[]
  surahs: SurahInfo[]
  onChange: (entries: SurahEntry[]) => void
}) {
  const add = () => onChange([...entries, emptySurahEntry()])
  const update = (idx: number, e: SurahEntry) => {
    const next = [...entries]
    next[idx] = e
    onChange(next)
  }
  const remove = (idx: number) => onChange(entries.filter((_, i) => i !== idx))

  return (
    <div className={cn("rounded-xl border-2 p-3 space-y-3", colorClass)}>
      <p className="text-sm font-bold">{title}</p>

      {entries.length === 0 && (
        <p className="text-xs text-muted-foreground text-center py-2">لا يوجد — اضغط + لإضافة سورة</p>
      )}

      {entries.map((entry, idx) => (
        <SurahEntryBlock
          key={idx}
          entry={entry}
          surahs={surahs}
          onChange={(e) => update(idx, e)}
          onRemove={() => remove(idx)}
        />
      ))}

      <button
        type="button"
        onClick={add}
        className="flex items-center justify-center gap-1.5 w-full rounded-lg border border-dashed py-2.5 text-xs font-medium hover:bg-muted/50 transition-colors"
      >
        <Plus className="h-3.5 w-3.5" />
        إضافة سورة
      </button>
    </div>
  )
}

// ─── Student Card ─────────────────────────────────────────────────────────────

function StudentCard({
  row,
  state,
  isExpanded,
  onToggle,
  onChange,
  surahs,
  highlightUnfilled,
}: {
  row: StudentRow
  state: StudentState
  isExpanded: boolean
  onToggle: () => void
  onChange: (s: StudentState) => void
  surahs: SurahInfo[]
  highlightUnfilled: boolean
}) {
  const s = row.student
  const isPresent = state.attendance === "PRESENT" || state.attendance === "LATE"
  const attMeta = state.attendance
    ? ATTENDANCE_OPTIONS.find((o) => o.value === state.attendance) ?? null
    : null
  const isBlank = !state.attendance
  const needsAttention = highlightUnfilled && isBlank

  const setAttendance = (val: string) => {
    const newAtt = val as StudentState["attendance"]
    const newPresent = newAtt === "PRESENT" || newAtt === "LATE"
    onChange({
      ...state,
      attendance: newAtt,
      didNotRecite: false,
      hifz: newPresent ? state.hifz : [],
      muraja: newPresent ? state.muraja : [],
    })
  }

  return (
    <div className={cn(
      "rounded-xl border bg-card shadow-sm overflow-hidden",
      needsAttention && "border-red-400 ring-1 ring-red-300",
    )}>
      {/* Header */}
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
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {attMeta ? (
            <span className={cn("text-xs font-medium px-2 py-1 rounded-full border", attMeta.className)}>
              {state.didNotRecite && isPresent ? "لم يسمع" : attMeta.label}
            </span>
          ) : (
            <span className={cn(
              "text-xs font-medium px-2 py-1 rounded-full border border-dashed",
              needsAttention
                ? "border-red-400 text-red-500"
                : "border-muted-foreground/30 text-muted-foreground/50",
            )}>
              لم يُحدَّد
            </span>
          )}
          {isExpanded
            ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
            : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>

      {/* Expanded body */}
      {isExpanded && (
        <div className="border-t px-4 pb-4 pt-3 space-y-4">
          {/* Attendance */}
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
                    state.attendance === opt.value ? opt.className : "bg-background hover:bg-muted text-muted-foreground",
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {isPresent && (
            <div className="space-y-3">
              {/* لم يسمع toggle */}
              <button
                type="button"
                onClick={() => onChange({
                  ...state,
                  didNotRecite: !state.didNotRecite,
                  hifz: state.didNotRecite ? state.hifz : [],
                  muraja: state.didNotRecite ? state.muraja : [],
                })}
                className={cn(
                  "w-full rounded-lg border py-2.5 text-sm font-medium transition-colors",
                  state.didNotRecite
                    ? "bg-orange-100 text-orange-800 border-orange-300"
                    : "bg-background hover:bg-muted text-muted-foreground border-dashed",
                )}
              >
                {state.didNotRecite ? "✓ لم يسمع اليوم" : "لم يسمع اليوم"}
              </button>

              {!state.didNotRecite && (
                <>
                  <SectionBlock
                    title="حفظ جديد"
                    colorClass="border-green-300 bg-green-50/50"
                    entries={state.hifz}
                    surahs={surahs}
                    onChange={(entries) => onChange({ ...state, hifz: entries })}
                  />

                  <SectionBlock
                    title="مراجعة"
                    colorClass="border-blue-300 bg-blue-50/50"
                    entries={state.muraja}
                    surahs={surahs}
                    onChange={(entries) => onChange({ ...state, muraja: entries })}
                  />

                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">ملاحظات عامة</Label>
                    <Textarea
                      value={state.generalNotes}
                      onChange={(e) => onChange({ ...state, generalNotes: e.target.value })}
                      rows={2}
                      className="text-sm resize-none"
                      placeholder="اختياري"
                    />
                  </div>
                </>
              )}
            </div>
          )}

          {state.attendance && !isPresent && (
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

// ─── Main Client Component ────────────────────────────────────────────────────

export function DailySessionClient({
  classes: classesProp,
  initialClassId,
  initialDate,
  surahs: surahsProp,
}: {
  classes: MyClass[]
  initialClassId: string
  initialDate: string
  surahs: SurahInfo[]
}) {
  const [classes, setClasses] = useState<MyClass[]>(classesProp)
  const [surahs, setSurahs] = useState<SurahInfo[]>(surahsProp)
  const [classId, setClassId] = useState(initialClassId || classesProp[0]?.id || "")
  const [date, setDate] = useState(initialDate)
  const [rows, setRows] = useState<StudentRow[]>([])
  const [states, setStates] = useState<Record<string, StudentState>>({})
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, startSaving] = useTransition()
  const [isOffline, setIsOffline] = useState(false)
  const [fromCache, setFromCache] = useState(false)
  const [highlightUnfilled, setHighlightUnfilled] = useState(false)

  useEffect(() => {
    const offline = typeof navigator !== "undefined" && !navigator.onLine
    setIsOffline(offline)
    const onOnline = () => setIsOffline(false)
    const onOffline = () => setIsOffline(true)
    window.addEventListener("online", onOnline)
    window.addEventListener("offline", onOffline)
    return () => {
      window.removeEventListener("online", onOnline)
      window.removeEventListener("offline", onOffline)
    }
  }, [])

  // Persist classes + surahs to IndexedDB when online so offline visits can use them
  useEffect(() => {
    if (classesProp.length > 0) {
      db.cachedData.put({ key: "my-classes", value: classesProp, updatedAt: Date.now() })
    }
    if (surahsProp.length > 0) {
      db.cachedData.put({ key: "all-surahs", value: surahsProp, updatedAt: Date.now() })
    }
  }, [classesProp, surahsProp])

  // If we booted offline (props empty because server wasn't reachable), load from IndexedDB
  useEffect(() => {
    if (typeof navigator === "undefined" || navigator.onLine) return
    if (classes.length === 0) {
      db.cachedData.get("my-classes").then((cached) => {
        if (cached && Array.isArray(cached.value) && cached.value.length > 0) {
          const cachedClasses = cached.value as MyClass[]
          setClasses(cachedClasses)
          setClassId((prev) => prev || cachedClasses[0]?.id || "")
        }
      })
    }
    if (surahs.length === 0) {
      db.cachedData.get("all-surahs").then((cached) => {
        if (cached && Array.isArray(cached.value)) {
          setSurahs(cached.value as SurahInfo[])
        }
      })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const load = useCallback(async (cid: string, d: string) => {
    if (!cid) return
    setLoading(true)
    setFromCache(false)
    try {
      if (!navigator.onLine) {
        const cached = await db.cachedData.get(`roster:${cid}`)
        if (cached && Array.isArray(cached.value)) {
          const students = cached.value as StudentData[]
          const rosterRows: StudentRow[] = students.map((s) => ({
            student: s,
            attendance: null,
            hifzSession: null,
          }))
          setRows(rosterRows)
          const initStates: Record<string, StudentState> = {}
          for (const row of rosterRows) initStates[row.student.id] = initStudentState(row)
          setStates(initStates)
          setExpandedId(rosterRows[0]?.student.id ?? null)
          setFromCache(true)
        } else {
          toast.error("لا تتوفر بيانات محفوظة — اتصل بالإنترنت لتحميل قائمة الطلاب")
          setRows([])
        }
        return
      }

      const data = await loadDailySession(cid, d)
      setRows(data)
      const initStates: Record<string, StudentState> = {}
      for (const row of data) initStates[row.student.id] = initStudentState(row)
      setStates(initStates)
      setExpandedId(data[0]?.student.id ?? null)

      await db.cachedData.put({
        key: `roster:${cid}`,
        value: data.map((r) => r.student),
        updatedAt: Date.now(),
      })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل تحميل البيانات")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load(classId, date) }, [classId, date, load])

  const updateState = (studentId: string, s: StudentState) =>
    setStates((prev) => ({ ...prev, [studentId]: s }))

  const handleSave = () => {
    startSaving(async () => {
      // Validate: all students must have attendance set
      const blankRows = rows.filter((row) => !states[row.student.id]?.attendance)
      if (blankRows.length > 0) {
        setHighlightUnfilled(true)
        setExpandedId(blankRows[0].student.id)
        toast.error(`${blankRows.length} ${blankRows.length === 1 ? "طالب" : "طلاب"} لم يُحدَّد حضورهم`)
        return
      }

      // Validate: present students must have حفظ/مراجعة or "لم يسمع"
      const presentNoData = rows.filter((row) => {
        const st = states[row.student.id]
        const isPresent = st.attendance === "PRESENT" || st.attendance === "LATE"
        return isPresent && !st.didNotRecite && st.hifz.length === 0 && st.muraja.length === 0
      })
      if (presentNoData.length > 0) {
        setExpandedId(presentNoData[0].student.id)
        toast.error(`${presentNoData.length} ${presentNoData.length === 1 ? "طالب حضر" : "طلاب حضروا"} بدون تسجيل — أضف حفظاً أو اضغط "لم يسمع اليوم"`)
        return
      }

      setHighlightUnfilled(false)

      const entries: SaveSessionInput["entries"] = rows.map((row) => {
        const st = states[row.student.id]

        const toRec = (type: "NEW" | "RECENT_REVISION", list: SurahEntry[]) =>
          list
            .filter((e) => e.surahNumber && e.toAyah && e.rating)
            .map((e) => ({
              type,
              surahNumber: parseInt(e.surahNumber),
              fromAyah: parseInt(e.fromAyah || "1"),
              toAyah: parseInt(e.toAyah),
              surahCompleted: e.completed,
              pagesCount: e.pagesCount ? parseFloat(e.pagesCount) : undefined,
              rating: parseInt(e.rating),
              mistakeCount: parseInt(e.mistakeCount || "0"),
              notes: e.notes || undefined,
            }))

        const notesOverride = st.didNotRecite ? "لم يسمع اليوم" : (st.attendanceNotes || undefined)

        return {
          studentId: row.student.id,
          attendance: st.attendance as "PRESENT" | "ABSENT" | "LATE" | "EXCUSED",
          attendanceNotes: notesOverride,
          generalNotes: st.generalNotes || undefined,
          recitations: st.didNotRecite ? [] : [
            ...toRec("NEW", st.hifz),
            ...toRec("RECENT_REVISION", st.muraja),
          ],
        }
      })

      if (!navigator.onLine) {
        await db.pendingOps.add({
          type: "SAVE_DAILY_SESSION",
          payload: { classId, date, entries },
          createdAt: Date.now(),
          status: "PENDING",
          retries: 0,
        })
        toast.success("سيتم المزامنة لاحقاً ✓")
        return
      }

      const result = await saveDailySession({ classId, date, entries })
      if ("error" in result) {
        toast.error(result.error)
      } else {
        toast.success("تم الحفظ بنجاح")
        await db.cachedData.put({
          key: `roster:${classId}`,
          value: rows.map((r) => r.student),
          updatedAt: Date.now(),
        })
      }
    })
  }

  const today = new Date().toISOString().slice(0, 10)
  const isFuture = date > today

  return (
    <div className="space-y-4">
      {/* Offline indicator */}
      {isOffline && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          <WifiOff className="h-4 w-4 shrink-0" />
          <span>
            {fromCache
              ? "وضع عدم الاتصال — يتم عرض بيانات محفوظة مسبقاً"
              : "لا يوجد اتصال بالإنترنت"}
          </span>
        </div>
      )}

      {/* Class + date */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>الحلقة</Label>
          <Select
            value={classId}
            onValueChange={(v) => setClassId(v ?? "")}
            items={classes.map((c) => ({ value: c.id, label: c.name }))}
          >
            <SelectTrigger className="h-11">
              <SelectValue placeholder="اختر حلقة" />
            </SelectTrigger>
            <SelectContent>
              {classes.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
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
        <div className="text-center py-16 text-muted-foreground space-y-3">
          {classId ? (
            <>
              <GraduationCap className="h-12 w-12 mx-auto opacity-30" />
              <p className="text-base font-medium">لا يوجد طلاب في هذه الحلقة</p>
              <p className="text-sm">
                {isOffline
                  ? "لا تتوفر بيانات محفوظة لهذه الحلقة — اتصل بالإنترنت لتحميل القائمة"
                  : "أضف طلاباً للحلقة من صفحة إدارة الطلاب"}
              </p>
            </>
          ) : (
            <>
              <BookMarked className="h-12 w-12 mx-auto opacity-30" />
              <p className="text-base font-medium">اختر حلقة للبدء</p>
            </>
          )}
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
                surahs={surahs}
                highlightUnfilled={highlightUnfilled}
              />
            ))}
          </div>

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
                ) : isOffline ? (
                  <WifiOff className="h-5 w-5" />
                ) : (
                  <Save className="h-5 w-5" />
                )}
                {isOffline ? "حفظ (سيُزامَن لاحقاً)" : "حفظ الجلسة"}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

"use client"

import { useState, useEffect, useCallback, useTransition } from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, Award, Users, Save } from "lucide-react"
import { toast } from "sonner"
import { loadCourseRoster, saveCourseScores } from "@/lib/actions/course.actions"

type CourseBadgeItem = { id: string; name: string }
type CourseInfo = { id: string; name: string; description: string | null; badges: CourseBadgeItem[] }
type ClassOption = { id: string; name: string }
type RosterRow = {
  student: { id: string; fullName: string; photoUrl: string | null; status: string }
  score: { studentId: string; score: number | null; notes: string | null; badgeResults: { badgeId: string }[] } | null
}

type StudentState = { score: string; badgeIds: string[] }

function initState(row: RosterRow): StudentState {
  return {
    score: row.score?.score != null ? String(row.score.score) : "",
    badgeIds: row.score?.badgeResults.map((b) => b.badgeId) ?? [],
  }
}

export function CourseScoringClient({
  course,
  classes,
  initialClassId,
}: {
  course: CourseInfo
  classes: ClassOption[]
  initialClassId: string
}) {
  const [classId, setClassId] = useState(initialClassId)
  const [rows, setRows] = useState<RosterRow[]>([])
  const [states, setStates] = useState<Record<string, StudentState>>({})
  const [loading, setLoading] = useState(false)
  const [saving, startSaving] = useTransition()

  const load = useCallback(async (cid: string) => {
    if (!cid) return
    setLoading(true)
    try {
      const data = await loadCourseRoster(course.id, cid)
      setRows(data)
      const init: Record<string, StudentState> = {}
      for (const row of data) init[row.student.id] = initState(row)
      setStates(init)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل تحميل البيانات")
    } finally {
      setLoading(false)
    }
  }, [course.id])

  useEffect(() => { load(classId) }, [classId, load])

  const updateState = (studentId: string, s: StudentState) =>
    setStates((prev) => ({ ...prev, [studentId]: s }))

  function handleSave() {
    startSaving(async () => {
      const entries = rows.map((row) => {
        const st = states[row.student.id]
        return {
          studentId: row.student.id,
          score: st.score.trim() ? Number(st.score) : undefined,
          badgeIds: st.badgeIds,
        }
      })
      const result = await saveCourseScores({ courseId: course.id, classId, entries })
      if ("error" in result) toast.error(result.error)
      else toast.success("تم حفظ الدرجات بنجاح")
    })
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label>الحلقة</Label>
        <Select
          value={classId}
          onValueChange={(v) => setClassId(v ?? "")}
          items={classes.map((c) => ({ value: c.id, label: c.name }))}
        >
          <SelectTrigger className="h-11 w-full">
            <SelectValue placeholder="اختر حلقة" />
          </SelectTrigger>
          <SelectContent>
            {classes.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="py-16 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : rows.length === 0 ? (
        <div className="py-14 text-center text-muted-foreground rounded-lg border space-y-2">
          <Users className="h-10 w-10 mx-auto opacity-30" />
          <p className="text-sm font-medium">
            {classId ? "لا يوجد طلاب في هذه الحلقة" : "اختر حلقة لعرض الطلاب"}
          </p>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {rows.map((row) => {
              const s = row.student
              const st = states[s.id] ?? { score: "", badgeIds: [] }
              return (
                <div key={s.id} className="rounded-xl border bg-card shadow-sm p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-11 w-11 shrink-0">
                      <AvatarImage src={s.photoUrl ?? undefined} alt={s.fullName} />
                      <AvatarFallback className="bg-green-100 text-green-800 text-sm font-semibold">
                        {s.fullName.slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold truncate">{s.fullName}</span>
                        {s.status === "GUEST" && (
                          <Badge className="bg-orange-100 text-orange-800 border-orange-200 text-xs shrink-0">ضيف</Badge>
                        )}
                      </div>
                    </div>
                    <div className="w-24 shrink-0">
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        placeholder="الدرجة"
                        value={st.score}
                        onChange={(e) => updateState(s.id, { ...st, score: e.target.value })}
                      />
                    </div>
                  </div>
                  {course.badges.length > 0 && (
                    <div className="flex flex-wrap gap-3 pr-14">
                      {course.badges.map((b) => {
                        const checked = st.badgeIds.includes(b.id)
                        return (
                          <div key={b.id} className="flex items-center gap-1.5">
                            <Checkbox
                              id={`${s.id}-${b.id}`}
                              checked={checked}
                              onCheckedChange={(c) => {
                                updateState(s.id, {
                                  ...st,
                                  badgeIds: c ? [...st.badgeIds, b.id] : st.badgeIds.filter((id) => id !== b.id),
                                })
                              }}
                            />
                            <Label htmlFor={`${s.id}-${b.id}`} className="font-normal text-sm gap-1 flex items-center">
                              <Award className="h-3 w-3" />
                              {b.name}
                            </Label>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          <div className="sticky bottom-4 pt-2">
            <Button
              size="lg"
              className="w-full h-14 text-base font-semibold gap-2 shadow-lg"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
              حفظ الدرجات
            </Button>
          </div>
        </>
      )}
    </div>
  )
}

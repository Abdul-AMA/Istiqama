// Pure, DB-free parsing of the ISTQ| Telegram offline-submission payload.
// Format spec: docs/telegram-architecture.md — follow it exactly, do not
// invent a variant. Roster/teacher/halaqa existence checks are NOT done
// here (they need the database) — see lib/telegram/processIstqMessage.ts.

import { recitationSchema, type RecitationInput } from "@/lib/daily-session/save"

export const ISTQ_PREFIX = "ISTQ|"

const ATTENDANCE_CODE_MAP: Record<string, "PRESENT" | "ABSENT" | "LATE" | "EXCUSED"> = {
  P: "PRESENT",
  A: "ABSENT",
  L: "LATE",
  E: "EXCUSED",
}

const HIFZ_TYPE_MAP: Record<string, "NEW" | "RECENT_REVISION"> = {
  N: "NEW",
  R: "RECENT_REVISION",
}

export interface ParsedStudentRowOk {
  studentId: string
  ok: true
  attendance: "PRESENT" | "ABSENT" | "LATE" | "EXCUSED"
  recitations: RecitationInput[]
  note: string
}

export interface ParsedStudentRowFail {
  studentId: string
  ok: false
  reason: string
}

export type ParsedStudentRow = ParsedStudentRowOk | ParsedStudentRowFail

export type ParsedPayload =
  | { ok: true; teacherId: string; halaqaId: string; date: string; rows: ParsedStudentRow[] }
  | { ok: false; reason: string }

// hifz_entries is zero or more "_"-joined entries, each formatted:
// type:surah:from_ayah:to_ayah:completed:pages:rating:mistakes
// (surah/ayah-based, matching the online daily-session page's data model —
// see docs/telegram-architecture.md §6.3). Because each entry's own fields
// are colon-delimited too, the caller must hand us the raw slice already
// isolated from student_id/attendance_code/note (see parseStudentBlock
// below) — this function only handles the "_" layer.
function parseHifzEntries(hifzEntriesStr: string): { entries: RecitationInput[]; error: string | null } {
  // A payload with no entries collapses to "" (or a lone separator colon in
  // some client-generated edge cases) — treat both as "zero entries".
  const cleaned = hifzEntriesStr.replace(/^:+|:+$/g, "")
  if (cleaned === "") return { entries: [], error: null }

  const entries: RecitationInput[] = []
  for (const rawEntry of cleaned.split("_")) {
    const parts = rawEntry.split(":")
    if (parts.length !== 8) {
      return { entries: [], error: `صيغة تسميع غير صحيحة: ${rawEntry}` }
    }
    const [typeCode, surahStr, fromAyahStr, toAyahStr, completedStr, pagesStr, ratingStr, mistakesStr] = parts
    const type = HIFZ_TYPE_MAP[typeCode]
    if (!type) {
      return { entries: [], error: `نوع تسميع غير معروف: ${typeCode}` }
    }

    const result = recitationSchema.safeParse({
      type,
      surahNumber: surahStr,
      fromAyah: fromAyahStr,
      toAyah: toAyahStr,
      surahCompleted: completedStr === "1",
      pagesCount: pagesStr === "" ? undefined : pagesStr,
      rating: ratingStr,
      mistakeCount: mistakesStr,
    })
    if (!result.success) {
      return { entries: [], error: `بيانات تسميع غير صالحة: ${rawEntry}` }
    }
    entries.push(result.data)
  }
  return { entries, error: null }
}

function parseStudentBlock(block: string): ParsedStudentRow {
  const parts = block.split(":")
  if (parts.length < 4) {
    return { studentId: parts[0] || block, ok: false, reason: "صيغة صف الطالب غير صحيحة" }
  }

  const studentId = parts[0]
  const attendanceCode = parts[1]
  const note = parts[parts.length - 1]
  const hifzEntriesStr = parts.slice(2, -1).join(":")

  if (!studentId) {
    return { studentId: block, ok: false, reason: "معرف الطالب مفقود" }
  }

  const attendance = ATTENDANCE_CODE_MAP[attendanceCode]
  if (!attendance) {
    return { studentId, ok: false, reason: `رمز حضور غير معروف: ${attendanceCode}` }
  }

  const { entries, error } = parseHifzEntries(hifzEntriesStr)
  if (error) {
    return { studentId, ok: false, reason: error }
  }

  return { studentId, ok: true, attendance, recitations: entries, note }
}

export function parseIstqPayload(rawText: string): ParsedPayload {
  if (!rawText.startsWith(ISTQ_PREFIX)) {
    return { ok: false, reason: "NO_PREFIX" }
  }

  const body = rawText.slice(ISTQ_PREFIX.length)

  // Split into exactly 4 top-level fields by position rather than a plain
  // "|".split — a free-text student note could in principle contain "|",
  // and this still recovers teacher_id/halaqa_id/date correctly either way.
  const firstPipe = body.indexOf("|")
  const secondPipe = firstPipe === -1 ? -1 : body.indexOf("|", firstPipe + 1)
  const thirdPipe = secondPipe === -1 ? -1 : body.indexOf("|", secondPipe + 1)
  if (firstPipe === -1 || secondPipe === -1 || thirdPipe === -1) {
    return { ok: false, reason: "صيغة الرسالة غير مكتملة" }
  }

  const teacherId = body.slice(0, firstPipe)
  const halaqaId = body.slice(firstPipe + 1, secondPipe)
  const date = body.slice(secondPipe + 1, thirdPipe)
  const studentBlocksStr = body.slice(thirdPipe + 1)

  if (!teacherId || !halaqaId) {
    return { ok: false, reason: "معرف المعلم أو الحلقة مفقود" }
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { ok: false, reason: "صيغة التاريخ غير صحيحة" }
  }

  const rows = studentBlocksStr
    .split(";")
    .map((b) => b.trim())
    .filter((b) => b !== "")
    .map(parseStudentBlock)

  return { ok: true, teacherId, halaqaId, date, rows }
}

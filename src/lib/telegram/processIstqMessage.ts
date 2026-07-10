// Orchestrates a single incoming Telegram message: parse, lock check,
// per-student-row validation/save, and reply text — called by the webhook
// route AFTER the raw message has already been stored (see route.ts).
// Writes go through saveDailySessionCore, the same function the web app's
// session-edit screen uses (CLAUDE.md: never duplicate this logic).

import { prisma } from "@/lib/prisma"
import { saveDailySessionCore, type StudentEntry } from "@/lib/daily-session/save"
import { parseIstqPayload } from "@/lib/telegram/parsePayload"

export interface ProcessResult {
  replyText: string
  parsed: boolean
  parseError: string | null
}

const NO_PREFIX_REPLY = "هذه الرسالة لا تبدو من نموذج الحصة، تأكد من استخدام الصفحة الصحيحة"

const ALREADY_SUBMITTED_REPLY =
  "تم استلام بيانات هذا اليوم مسبقاً. لتعديل البيانات، يرجى استخدام الموقع الإلكتروني."

const GENERIC_PARSE_FAIL_REPLY = "تعذّرت قراءة بيانات الرسالة، يرجى التأكد من الصفحة والمحاولة مرة أخرى."

const UNKNOWN_TEACHER_REPLY = "تعذّر التعرف على المعلم المرسل، يرجى استخدام الصفحة الصحيحة أو التواصل مع الإدارة."

const UNKNOWN_HALAQA_REPLY = "تعذّر التعرف على الحلقة، يرجى استخدام الصفحة الصحيحة أو التواصل مع الإدارة."

export async function processIstqMessage(rawText: string): Promise<ProcessResult> {
  const payload = parseIstqPayload(rawText)

  if (!payload.ok) {
    if (payload.reason === "NO_PREFIX") {
      return { replyText: NO_PREFIX_REPLY, parsed: false, parseError: null }
    }
    return { replyText: GENERIC_PARSE_FAIL_REPLY, parsed: false, parseError: payload.reason }
  }

  const { teacherId, halaqaId, date, rows } = payload

  const [teacher, halaqa] = await Promise.all([
    prisma.user.findUnique({ where: { id: teacherId }, select: { id: true } }),
    prisma.class.findUnique({ where: { id: halaqaId }, select: { id: true } }),
  ])

  if (!teacher) {
    return { replyText: UNKNOWN_TEACHER_REPLY, parsed: false, parseError: `unknown teacherId: ${teacherId}` }
  }
  if (!halaqa) {
    return { replyText: UNKNOWN_HALAQA_REPLY, parsed: false, parseError: `unknown halaqaId: ${halaqaId}` }
  }

  const sessionDate = new Date(date)

  // One-submission-per-day lock, keyed on the date embedded in the payload.
  // A halaqa has exactly one teacher (Class.teacherId), so (halaqaId, date)
  // already captures the (teacherId, halaqaId, date) combo from the spec.
  const alreadySubmitted = await prisma.attendanceRecord.findFirst({
    where: { classId: halaqaId, date: sessionDate },
    select: { id: true },
  })
  if (alreadySubmitted) {
    return {
      replyText: ALREADY_SUBMITTED_REPLY,
      parsed: false,
      parseError: `duplicate submission for halaqaId=${halaqaId} date=${date} — not processed`,
    }
  }

  const rosterStudents = await prisma.student.findMany({
    where: { classId: halaqaId, status: { in: ["ACTIVE", "GUEST"] } },
    select: { id: true },
  })
  const rosterIds = new Set(rosterStudents.map((s) => s.id))

  let successCount = 0
  const failures: { studentId: string; reason: string }[] = []

  for (const row of rows) {
    if (!row.ok) {
      failures.push({ studentId: row.studentId, reason: row.reason })
      continue
    }

    if (!rosterIds.has(row.studentId)) {
      failures.push({ studentId: row.studentId, reason: "الطالب غير موجود في هذه الحلقة" })
      continue
    }

    const entry: StudentEntry = {
      studentId: row.studentId,
      attendance: row.attendance,
      generalNotes: row.note || undefined,
      recitations: row.recitations,
    }

    try {
      // One student per call so a save failure on one row can never take
      // down another valid row's transaction.
      await saveDailySessionCore({ classId: halaqaId, date: sessionDate, entries: [entry], userId: teacherId })
      successCount++
    } catch (err) {
      console.error("[telegram] failed to save row", row.studentId, err)
      failures.push({ studentId: row.studentId, reason: "خطأ أثناء الحفظ" })
    }
  }

  const parseError = failures.length > 0 ? failures.map((f) => `${f.studentId}: ${f.reason}`).join("; ") : null

  const replyText =
    failures.length === 0
      ? `✅ تم حفظ بيانات اليوم لـ ${successCount} طالب`
      : `تم حفظ بيانات ${successCount} طالب بنجاح. لم يتم حفظ بيانات الطلاب التالية أسماؤهم: ${failures
          .map((f) => `${f.studentId} (${f.reason})`)
          .join("، ")}. يرجى مراجعة المدير أو استخدام الموقع الإلكتروني.`

  return { replyText, parsed: true, parseError }
}

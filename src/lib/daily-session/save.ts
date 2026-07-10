import { z } from "zod"
import { prisma } from "@/lib/prisma"

// ─── Zod schemas (shared between API route, server action, and Telegram parser) ─

// 604-page Madani Mushaf (see CLAUDE.md non-negotiables)
export const MAX_MUSHAF_PAGE = 604

// Either a surah/ayah reference (web form) or a raw page range (Telegram
// payload, which has no ayah granularity) must be present — RecitationEntry
// already stores fromPage/toPage as the required fields and fromSurah/
// fromAyah/toSurah/toAyah as optional, so both shapes are valid at the DB level.
export const recitationSchema = z
  .object({
    type: z.enum(["NEW", "RECENT_REVISION", "OLD_REVISION"]),
    surahNumber: z.coerce.number().int().min(1).max(114).optional(),
    fromAyah: z.coerce.number().int().min(1).optional(),
    toAyah: z.coerce.number().int().min(1).optional(),
    fromPage: z.coerce.number().int().min(1).max(MAX_MUSHAF_PAGE).optional(),
    toPage: z.coerce.number().int().min(1).max(MAX_MUSHAF_PAGE).optional(),
    surahCompleted: z.boolean().default(false),
    pagesCount: z.coerce.number().min(0.5).optional(),
    rating: z.coerce.number().int().min(1).max(4),
    mistakeCount: z.coerce.number().int().min(0).default(0),
    notes: z.string().optional(),
  })
  .refine(
    (data) =>
      (data.surahNumber != null && data.fromAyah != null && data.toAyah != null) ||
      (data.fromPage != null && data.toPage != null),
    { message: "recitation entry requires either surah/ayah or from/to page" }
  )

export const studentEntrySchema = z.object({
  studentId: z.string(),
  attendance: z.enum(["PRESENT", "ABSENT", "LATE", "EXCUSED"]).default("PRESENT"),
  attendanceNotes: z.string().optional(),
  generalNotes: z.string().optional(),
  recitations: z.array(recitationSchema),
})

export const sessionInputSchema = z.object({
  classId: z.string(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  entries: z.array(studentEntrySchema),
})

export type SessionInput = z.infer<typeof sessionInputSchema>
export type StudentEntry = z.infer<typeof studentEntrySchema>
export type RecitationInput = z.infer<typeof recitationSchema>

// ─── Core save function ───────────────────────────────────────────────────────
//
// Accepts already-validated, already-parsed input. Auth and revalidatePath are
// the caller's responsibility. Throws on DB error so callers can handle it.

export async function saveDailySessionCore(params: {
  classId: string
  date: Date
  entries: StudentEntry[]
  userId: string
}): Promise<void> {
  const { classId, date, entries, userId } = params

  // Pre-fetch all referenced surahs in one query (page-based entries have no surahNumber)
  const surahNumbers = [
    ...new Set(
      entries.flatMap((e) => e.recitations.map((r) => r.surahNumber).filter((n): n is number => n != null))
    ),
  ]
  const surahMap = new Map(
    (
      await prisma.surah.findMany({
        where: { number: { in: surahNumbers } },
        select: { number: true, nameAr: true, ayahCount: true, startPage: true },
      })
    ).map((s) => [s.number, s])
  )

  // Build end-page map: surah N ends on (surah N+1 startPage - 1), last surah ends on 604
  const allSurahs = await prisma.surah.findMany({
    select: { number: true, startPage: true },
    orderBy: { number: "asc" },
  })
  const surahEndPage = new Map<number, number>()
  for (let i = 0; i < allSurahs.length; i++) {
    surahEndPage.set(allSurahs[i].number, i + 1 < allSurahs.length ? allSurahs[i + 1].startPage - 1 : 604)
  }

  await prisma.$transaction(async (tx) => {
    for (const entry of entries) {
      const { studentId, attendance, attendanceNotes, generalNotes, recitations } = entry

      await tx.attendanceRecord.upsert({
        where: { studentId_date: { studentId, date } },
        create: { studentId, classId, date, status: attendance, notes: attendanceNotes ?? null, recordedByUserId: userId },
        update: { status: attendance, notes: attendanceNotes ?? null, recordedByUserId: userId },
      })

      const isPresent = attendance === "PRESENT" || attendance === "LATE"

      if (!isPresent || recitations.length === 0) {
        const existing = await tx.hifzSession.findUnique({ where: { studentId_date: { studentId, date } } })
        if (existing) await tx.hifzSession.delete({ where: { id: existing.id } })
        continue
      }

      const hifzSession = await tx.hifzSession.upsert({
        where: { studentId_date: { studentId, date } },
        create: { studentId, classId, date, generalNotes: generalNotes ?? null, recordedByUserId: userId },
        update: { generalNotes: generalNotes ?? null, recordedByUserId: userId },
      })

      await tx.recitationEntry.deleteMany({ where: { hifzSessionId: hifzSession.id } })

      for (const rec of recitations) {
        let fromPage: number
        let toPage: number
        if (rec.fromPage != null && rec.toPage != null) {
          fromPage = rec.fromPage
          toPage = rec.toPage
        } else {
          const surah = surahMap.get(rec.surahNumber!)
          fromPage = surah?.startPage ?? 1
          toPage = rec.surahCompleted ? (surahEndPage.get(rec.surahNumber!) ?? fromPage) : fromPage
        }

        await tx.recitationEntry.create({
          data: {
            hifzSessionId: hifzSession.id,
            type: rec.type,
            fromPage,
            toPage,
            fromSurah: rec.surahNumber ?? null,
            fromAyah: rec.fromAyah ?? null,
            toSurah: rec.surahNumber ?? null,
            toAyah: rec.toAyah ?? null,
            surahCompleted: rec.surahCompleted,
            pagesCount: rec.pagesCount ?? null,
            rating: rec.rating,
            mistakeCount: rec.mistakeCount,
            notes: rec.notes ?? null,
          },
        })
      }

      // Update student snapshot from NEW recitation entries only
      const newEntries = recitations.filter((r) => r.type === "NEW")
      if (newEntries.length > 0) {
        const lastNew = newEntries[newEntries.length - 1]

        let sabaqRef: string
        let lastJuz: number
        if (lastNew.surahNumber != null) {
          const lastSurah = surahMap.get(lastNew.surahNumber)
          const surahName = lastSurah?.nameAr ?? ""
          sabaqRef = lastNew.surahCompleted
            ? `${surahName} (كاملة)`
            : `${surahName}: ${lastNew.fromAyah}–${lastNew.toAyah}`
          lastJuz = Math.ceil((lastSurah?.startPage ?? 1) / 20)
        } else {
          const fromPage = lastNew.fromPage!
          const toPage = lastNew.toPage!
          sabaqRef = fromPage === toPage ? `صفحة ${fromPage}` : `صفحة ${fromPage}–${toPage}`
          lastJuz = Math.ceil(fromPage / 20)
        }

        const allNewEntries = await tx.recitationEntry.findMany({
          where: { hifzSession: { studentId }, type: "NEW" },
          select: { fromPage: true, toPage: true, pagesCount: true },
        })
        const student = await tx.student.findUnique({
          where: { id: studentId },
          select: { previousHifzPages: true },
        })
        const basePrev = student?.previousHifzPages ?? 0
        let manualPages = 0
        const legacyPageSet = new Set<number>()
        for (const e of allNewEntries) {
          if (e.pagesCount !== null) {
            manualPages += e.pagesCount
          } else {
            for (let p = e.fromPage; p <= e.toPage; p++) legacyPageSet.add(p)
          }
        }
        const total = Math.round(basePrev + manualPages + legacyPageSet.size)

        await tx.student.update({
          where: { id: studentId },
          data: {
            currentTotalPagesMemorized: total,
            currentJuz: lastJuz,
            lastSabaqReference: sabaqRef,
          },
        })
      }
    }
  })
}

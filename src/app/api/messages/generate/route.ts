import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

const GROQ_BASE = "https://api.groq.com/openai/v1"
const MODEL = "llama-3.3-70b-versatile"

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "غير مصرح" }, { status: 401 })

  const { studentId, categoryId } = await req.json()
  if (!studentId || !categoryId) {
    return NextResponse.json({ error: "بيانات ناقصة" }, { status: 400 })
  }

  const [student, category, allSurahs] = await Promise.all([
    prisma.student.findUnique({
      where: { id: studentId },
      select: {
        fullName: true,
        guardianName: true,
        currentTotalPagesMemorized: true,
        class: { select: { name: true, teacher: { select: { fullName: true } } } },
        hifzSessions: {
          orderBy: { date: "desc" },
          take: 1,
          select: {
            date: true,
            generalNotes: true,
            entries: {
              select: {
                type: true,
                fromSurah: true,
                fromAyah: true,
                toAyah: true,
                surahCompleted: true,
                pagesCount: true,
                rating: true,
                mistakeCount: true,
                notes: true,
              },
            },
          },
        },
        attendanceRecords: {
          orderBy: { date: "desc" },
          take: 1,
          select: { status: true },
        },
      },
    }),
    prisma.messageCategory.findUnique({
      where: { id: categoryId },
      select: { name: true, tone: true, template: true },
    }),
    prisma.surah.findMany({ select: { number: true, nameAr: true } }),
  ])

  if (!student || !category) {
    return NextResponse.json({ error: "بيانات غير موجودة" }, { status: 404 })
  }

  const surahMap = new Map(allSurahs.map((s) => [s.number, s.nameAr]))
  const RATING_AR = ["", "يحتاج إعادة", "جيد", "جيد جداً", "ممتاز"]

  const lastSession = student.hifzSessions[0]
  const newEntries = lastSession?.entries.filter((e) => e.type === "NEW") ?? []
  const revEntries = lastSession?.entries.filter((e) => e.type === "RECENT_REVISION") ?? []

  function fmtEntry(e: typeof newEntries[number], withRating = false) {
    const name = e.fromSurah ? (surahMap.get(e.fromSurah) ?? `سورة ${e.fromSurah}`) : "؟"
    const ayahs = e.surahCompleted ? "(كاملة)" : `الآيات ${e.fromAyah}–${e.toAyah}`
    const pages = e.pagesCount ? ` | ${e.pagesCount} صفحة` : ""
    const rating = withRating ? ` | التقييم: ${RATING_AR[e.rating] ?? ""}` : ""
    const mistakes = withRating && e.mistakeCount > 0 ? ` | الأخطاء: ${e.mistakeCount}` : ""
    const note = e.notes ? ` | ملاحظة: ${e.notes}` : ""
    return `• ${name} ${ayahs}${pages}${rating}${mistakes}${note}`
  }

  const toneAr = category.tone === "POSITIVE" ? "تشجيعية" : category.tone === "WARNING" ? "تحذيرية" : "محايدة"
  const sabaqLines = newEntries.length ? newEntries.map((e) => fmtEntry(e, true)).join("\n") : "• لا يوجد حفظ جديد"
  const revLines = revEntries.length ? revEntries.map((e) => fmtEntry(e, false)).join("\n") : "• لا يوجد مراجعة"
  const totalMistakes = newEntries.reduce((sum, e) => sum + e.mistakeCount, 0)

  const attendanceAr =
    student.attendanceRecords[0]?.status === "PRESENT" ? "حاضر"
    : student.attendanceRecords[0]?.status === "ABSENT" ? "غائب"
    : student.attendanceRecords[0]?.status === "LATE" ? "متأخر"
    : "معذور"

  const prompt = `أنت مساعد لمركز تحفيظ قرآن كريم. اكتب رسالة واتساب قصيرة باللغة العربية لولي أمر الطالب.

فئة الرسالة: ${category.name}
النبرة المطلوبة: ${toneAr}

بيانات الطالب:
- اسم الطالب: ${student.fullName}
- اسم ولي الأمر: ${student.guardianName ?? "ولي الأمر"}
- الحلقة: ${student.class?.name ?? ""}
- المعلم: ${student.class?.teacher?.fullName ?? ""}
- إجمالي المحفوظ: ${student.currentTotalPagesMemorized} صفحة
- الحضور: ${attendanceAr}

الحفظ الجديد (آخر جلسة):
${sabaqLines}

المراجعة:
${revLines}

إجمالي الأخطاء في الحفظ الجديد: ${totalMistakes}
${lastSession?.generalNotes ? `ملاحظات عامة: ${lastSession.generalNotes}` : ""}

اكتب رسالة طبيعية وودية تناسب النبرة ${toneAr}. لا تتجاوز 150 كلمة. ابدأ بالسلام وانتهِ بالدعاء.`

  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) {
    // Fall back to template
    return NextResponse.json({ text: null, fallback: true })
  }

  try {
    const groqRes = await fetch(`${GROQ_BASE}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: "user", content: prompt }],
        max_tokens: 400,
        temperature: 0.7,
      }),
      signal: AbortSignal.timeout(15000),
    })

    if (!groqRes.ok) {
      return NextResponse.json({ text: null, fallback: true })
    }

    const data = await groqRes.json()
    const text = data.choices?.[0]?.message?.content ?? null
    return NextResponse.json({ text, fallback: !text })
  } catch {
    return NextResponse.json({ text: null, fallback: true })
  }
}

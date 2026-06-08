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

  const [student, category] = await Promise.all([
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
            entries: { select: { type: true, fromPage: true, toPage: true, rating: true, mistakeCount: true } },
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
  ])

  if (!student || !category) {
    return NextResponse.json({ error: "بيانات غير موجودة" }, { status: 404 })
  }

  const lastSession = student.hifzSessions[0]
  const newEntry = lastSession?.entries.find((e) => e.type === "NEW")
  const revEntry = lastSession?.entries.find((e) => e.type === "RECENT_REVISION")

  const toneAr = category.tone === "POSITIVE" ? "تشجيعية" : category.tone === "WARNING" ? "تحذيرية" : "محايدة"
  const sabaq = newEntry ? `من صفحة ${newEntry.fromPage} إلى ${newEntry.toPage}` : "لا يوجد حفظ جديد"
  const revision = revEntry ? `من صفحة ${revEntry.fromPage} إلى ${revEntry.toPage}` : "لا يوجد مراجعة"
  const rating = newEntry
    ? ["", "يحتاج إعادة", "جيد", "جيد جداً", "ممتاز"][newEntry.rating] ?? ""
    : ""
  const attendanceAr = student.attendanceRecords[0]?.status === "PRESENT"
    ? "حاضر"
    : student.attendanceRecords[0]?.status === "ABSENT"
    ? "غائب"
    : student.attendanceRecords[0]?.status === "LATE"
    ? "متأخر"
    : "معذور"

  const prompt = `أنت مساعد لمركز تحفيظ قرآن كريم. اكتب رسالة واتساب قصيرة باللغة العربية لولي أمر الطالب.

فئة الرسالة: ${category.name}
النبرة المطلوبة: ${toneAr}

بيانات الطالب:
- اسم الطالب: ${student.fullName}
- اسم ولي الأمر: ${student.guardianName ?? "ولي الأمر"}
- الحلقة: ${student.class?.name ?? ""}
- المعلم: ${student.class?.teacher?.fullName ?? ""}
- المجموع المحفوظ: ${student.currentTotalPagesMemorized} صفحة
- الحفظ الجديد (آخر جلسة): ${sabaq}
- المراجعة: ${revision}
- التقييم: ${rating}
- الحضور: ${attendanceAr}
- الأخطاء: ${newEntry?.mistakeCount ?? 0}

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

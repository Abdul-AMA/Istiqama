import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

function csvRow(cells: (string | number | null | undefined)[]): string {
  return cells
    .map((c) => {
      const val = c == null ? "" : String(c)
      return val.includes(",") || val.includes('"') || val.includes("\n")
        ? `"${val.replace(/"/g, '""')}"`
        : val
    })
    .join(",")
}

function toDateStr(d: Date | null | undefined): string {
  if (!d) return ""
  return new Date(d).toISOString().slice(0, 10)
}

export async function GET(req: NextRequest) {
  const session = await auth()
  if (session?.user?.role !== "PRINCIPAL") {
    return NextResponse.json({ error: "غير مصرح" }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const type = searchParams.get("type") ?? "attendance"

  const BOM = "﻿"
  const date = new Date().toISOString().slice(0, 10)

  if (type === "attendance") {
    const records = await prisma.attendanceRecord.findMany({
      include: {
        student: { select: { fullName: true } },
        class: { select: { name: true } },
        recordedBy: { select: { fullName: true } },
      },
      orderBy: { date: "desc" },
    })

    const STATUS_AR: Record<string, string> = {
      PRESENT: "حاضر",
      ABSENT: "غائب",
      LATE: "متأخر",
      EXCUSED: "معذور",
    }

    const headers = csvRow(["اسم الطالب", "الحلقة", "التاريخ", "الحضور", "ملاحظات", "سجّل بواسطة"])
    const rows = records.map((r) =>
      csvRow([
        r.student.fullName,
        r.class.name,
        toDateStr(r.date),
        STATUS_AR[r.status] ?? r.status,
        r.notes ?? "",
        r.recordedBy.fullName,
      ])
    )

    const csv = BOM + [headers, ...rows].join("\n")
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="attendance-${date}.csv"`,
      },
    })
  }

  // hifz history
  const entries = await prisma.recitationEntry.findMany({
    include: {
      hifzSession: {
        include: {
          student: { select: { fullName: true } },
          class: { select: { name: true } },
          recordedBy: { select: { fullName: true } },
        },
      },
    },
    orderBy: { hifzSession: { date: "desc" } },
  })

  const TYPE_AR: Record<string, string> = {
    NEW: "سبق",
    RECENT_REVISION: "سبقي",
    OLD_REVISION: "منزل",
  }
  const RATING_AR: Record<number, string> = {
    4: "ممتاز",
    3: "جيد جداً",
    2: "جيد",
    1: "يحتاج إعادة",
  }

  const headers = csvRow([
    "اسم الطالب", "الحلقة", "التاريخ", "النوع",
    "من صفحة", "إلى صفحة", "التقييم", "الأخطاء", "ملاحظات", "سجّل بواسطة",
  ])
  const rows = entries.map((e) =>
    csvRow([
      e.hifzSession.student.fullName,
      e.hifzSession.class.name,
      toDateStr(e.hifzSession.date),
      TYPE_AR[e.type] ?? e.type,
      e.fromPage,
      e.toPage,
      RATING_AR[e.rating] ?? e.rating,
      e.mistakeCount,
      e.notes ?? "",
      e.hifzSession.recordedBy.fullName,
    ])
  )

  const csv = BOM + [headers, ...rows].join("\n")
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="hifz-history-${date}.csv"`,
    },
  })
}

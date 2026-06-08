"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Download } from "lucide-react"

export type StudentRow = {
  id: string
  fullName: string
  photoUrl: string | null
  status: string
  totalPages: number
  attendanceRate: number | null
  avgRating: number | null
  lastSessionDate: string | null
  velocity: number
}

export type Coverage = {
  complete: number
  partial: number
  missed: number
  total: number
}

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "على المسار",
  INACTIVE: "غير نشط",
  GRADUATED: "متخرج",
  GUEST: "ضيف",
}

const RATING_LABELS: Record<number, string> = {
  4: "ممتاز", 3: "جيد جداً", 2: "جيد", 1: "يحتاج إعادة",
}

export function ReportClient({
  classId,
  students,
  coverage,
  from,
  to,
}: {
  classId: string
  students: StudentRow[]
  coverage: Coverage
  from: string
  to: string
}) {
  const router = useRouter()
  const [fromDate, setFromDate] = useState(from)
  const [toDate, setToDate] = useState(to)

  function applyFilter() {
    const params = new URLSearchParams()
    if (fromDate) params.set("from", fromDate)
    if (toDate) params.set("to", toDate)
    router.push(`/classes/${classId}/report?${params.toString()}`)
  }

  function downloadCSV() {
    const BOM = "﻿"
    const headers = [
      "الاسم",
      "إجمالي الصفحات المحفوظة",
      "نسبة الحضور",
      "متوسط التقييم",
      "آخر جلسة",
      "سرعة الحفظ (صفحات/أسبوع)",
      "الحالة",
    ]
    const rows = students.map((s) => [
      s.fullName,
      String(s.totalPages),
      s.attendanceRate != null ? `${s.attendanceRate}%` : "",
      s.avgRating != null ? s.avgRating.toFixed(1) : "",
      s.lastSessionDate ?? "",
      s.velocity.toFixed(1),
      STATUS_LABELS[s.status] ?? s.status,
    ])
    const csv =
      BOM +
      [headers, ...rows]
        .map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(","))
        .join("\r\n")

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `تقرير-الحلقة-${from}-${to}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const avgRatingAll =
    students.length > 0
      ? students
          .filter((s) => s.avgRating != null)
          .reduce((sum, s, _, arr) => sum + (s.avgRating ?? 0) / arr.length, 0)
      : null

  return (
    <div className="space-y-6">
      {/* Date range + export */}
      <div className="flex flex-wrap gap-3 items-end p-4 rounded-lg border bg-muted/30">
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">من تاريخ</p>
          <Input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="w-40"
          />
        </div>
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">إلى تاريخ</p>
          <Input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="w-40"
          />
        </div>
        <Button onClick={applyFilter} className="bg-green-600 hover:bg-green-700 text-white">
          تطبيق
        </Button>
        <Button variant="outline" className="gap-2 mr-auto" onClick={downloadCSV}>
          <Download className="h-4 w-4" />
          تصدير CSV
        </Button>
      </div>

      {/* Coverage summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border bg-green-50 p-4 text-center">
          <p className="text-2xl font-bold text-green-700">{coverage.complete}</p>
          <p className="text-sm text-muted-foreground mt-0.5">مكتملة</p>
        </div>
        <div className="rounded-lg border bg-yellow-50 p-4 text-center">
          <p className="text-2xl font-bold text-yellow-700">{coverage.partial}</p>
          <p className="text-sm text-muted-foreground mt-0.5">جزئية</p>
        </div>
        <div className="rounded-lg border bg-red-50 p-4 text-center">
          <p className="text-2xl font-bold text-red-700">{coverage.missed}</p>
          <p className="text-sm text-muted-foreground mt-0.5">مهملة</p>
        </div>
      </div>

      {/* Roster table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">قائمة الطلاب</CardTitle>
            <span className="text-sm text-muted-foreground">
              {students.length} طالب
              {avgRatingAll != null &&
                ` · متوسط التقييم: ${avgRatingAll.toFixed(1)}`}
            </span>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {students.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              لا يوجد طلاب
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-right px-4 py-3 font-medium">الطالب</th>
                    <th className="text-center px-3 py-3 font-medium whitespace-nowrap">
                      إجمالي الصفحات
                    </th>
                    <th className="text-center px-3 py-3 font-medium whitespace-nowrap">
                      نسبة الحضور
                    </th>
                    <th className="text-center px-3 py-3 font-medium whitespace-nowrap">
                      متوسط التقييم
                    </th>
                    <th className="text-center px-3 py-3 font-medium whitespace-nowrap">
                      سرعة الحفظ
                    </th>
                    <th className="text-center px-3 py-3 font-medium whitespace-nowrap">
                      آخر جلسة
                    </th>
                    <th className="text-center px-3 py-3 font-medium">الحالة</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {students.map((s) => (
                    <tr key={s.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9 shrink-0">
                            <AvatarImage
                              src={s.photoUrl ?? undefined}
                              alt={s.fullName}
                            />
                            <AvatarFallback className="bg-green-100 text-green-800 text-xs font-semibold">
                              {s.fullName.slice(0, 2)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-medium">{s.fullName}</span>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-center">{s.totalPages}</td>
                      <td className="px-3 py-3 text-center">
                        {s.attendanceRate != null ? (
                          <span
                            className={
                              s.attendanceRate < 70
                                ? "text-red-600 font-medium"
                                : "text-green-700 font-medium"
                            }
                          >
                            {s.attendanceRate}%
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-center">
                        {s.avgRating != null ? (
                          <span>{s.avgRating.toFixed(1)}</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span className="text-muted-foreground">
                          {s.velocity > 0
                            ? `${s.velocity.toFixed(1)} ص/أ`
                            : "—"}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span className="text-muted-foreground text-xs">
                          {s.lastSessionDate ?? "—"}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <Badge
                          variant="secondary"
                          className={
                            s.status === "ACTIVE"
                              ? "bg-green-100 text-green-800"
                              : s.status === "GUEST"
                              ? "bg-orange-100 text-orange-800"
                              : ""
                          }
                        >
                          {STATUS_LABELS[s.status] ?? s.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

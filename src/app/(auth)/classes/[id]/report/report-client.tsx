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


export function ReportClient({
  classId,
  students,
  coverage,
  from,
  to,
  filterPath,
}: {
  classId: string
  students: StudentRow[]
  coverage: Coverage
  from: string
  to: string
  filterPath?: string
}) {
  const router = useRouter()
  const [fromDate, setFromDate] = useState(from)
  const [toDate, setToDate] = useState(to)

  function applyFilter() {
    const params = new URLSearchParams()
    if (fromDate) params.set("from", fromDate)
    if (toDate) params.set("to", toDate)
    const base = filterPath ?? `/classes/${classId}/report`
    const sep = base.includes("?") ? "&" : "?"
    router.push(`${base}${sep}${params.toString()}`)
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

  const ratedStudents = students.filter((s) => s.avgRating != null)
  const avgRatingAll =
    ratedStudents.length > 0
      ? ratedStudents.reduce((sum, s) => sum + (s.avgRating ?? 0), 0) / ratedStudents.length
      : null

  const attendedStudents = students.filter((s) => s.attendanceRate != null)
  const avgAttendance =
    attendedStudents.length > 0
      ? Math.round(
          attendedStudents.reduce((sum, s) => sum + (s.attendanceRate ?? 0), 0) /
            attendedStudents.length,
        )
      : null

  const totalPagesAll = students.reduce((sum, s) => sum + s.totalPages, 0)

  const avgVelocity =
    students.length > 0
      ? students.reduce((sum, s) => sum + s.velocity, 0) / students.length
      : 0

  const RATING_LABELS_AR: Record<number, string> = {
    4: "ممتاز", 3: "جيد جداً", 2: "جيد", 1: "يحتاج إعادة",
  }

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
        <Button variant="outline" className="gap-2 ms-auto" onClick={downloadCSV}>
          <Download className="h-4 w-4" />
          تصدير CSV
        </Button>
      </div>

      {/* Class aggregate stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border bg-green-50 p-4 text-center">
          <p className="text-2xl font-bold text-green-700">{totalPagesAll}</p>
          <p className="text-xs text-muted-foreground mt-1">إجمالي الصفحات</p>
          <p className="text-xs text-muted-foreground">لجميع الطلاب</p>
        </div>
        <div className="rounded-lg border bg-blue-50 p-4 text-center">
          <p className="text-2xl font-bold text-blue-700">
            {avgAttendance != null ? `${avgAttendance}%` : "—"}
          </p>
          <p className="text-xs text-muted-foreground mt-1">متوسط الحضور</p>
          <p className="text-xs text-muted-foreground">في الفترة المحددة</p>
        </div>
        <div className="rounded-lg border bg-purple-50 p-4 text-center">
          <p className="text-2xl font-bold text-purple-700">
            {avgRatingAll != null
              ? (RATING_LABELS_AR[Math.round(avgRatingAll)] ?? avgRatingAll.toFixed(1))
              : "—"}
          </p>
          <p className="text-xs text-muted-foreground mt-1">متوسط التقييم</p>
          <p className="text-xs text-muted-foreground">
            {avgVelocity > 0 ? `${avgVelocity.toFixed(1)} ص/أ سرعة الحفظ` : "في الفترة المحددة"}
          </p>
        </div>
      </div>

      {/* Session coverage — secondary */}
      {coverage.total > 0 && (
        <div className="flex gap-3 text-sm text-muted-foreground rounded-lg border bg-muted/20 px-4 py-3 items-center flex-wrap">
          <span className="font-medium text-foreground">تغطية الجلسات:</span>
          <span className="text-green-700 font-medium">{coverage.complete} مكتملة</span>
          <span className="text-yellow-700 font-medium">{coverage.partial} جزئية</span>
          <span className="text-red-600 font-medium">{coverage.missed} مهملة</span>
          <span className="text-muted-foreground">من أصل {coverage.total}</span>
        </div>
      )}

      {/* Roster table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">قائمة الطلاب</CardTitle>
            <span className="text-sm text-muted-foreground">
              {students.length} طالب
            </span>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {students.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground text-sm">
              لا يوجد طلاب في هذه الحلقة
            </div>
          ) : (
            <>
              {/* Mobile cards */}
              <div className="md:hidden divide-y">
                {students.map((s) => (
                  <div key={s.id} className="px-4 py-3 space-y-1.5">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8 shrink-0">
                        <AvatarImage src={s.photoUrl ?? undefined} alt={s.fullName} />
                        <AvatarFallback className="bg-green-100 text-green-800 text-xs font-semibold">
                          {s.fullName.slice(0, 2)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{s.fullName}</p>
                        <p className="text-xs text-muted-foreground">
                          {s.lastSessionDate ?? "لا توجد جلسات"}
                        </p>
                      </div>
                      <Badge variant="secondary" className={
                        s.status === "ACTIVE" ? "bg-green-100 text-green-800" :
                        s.status === "GUEST" ? "bg-orange-100 text-orange-800" : ""
                      }>
                        {STATUS_LABELS[s.status] ?? s.status}
                      </Badge>
                    </div>
                    <div className="flex gap-4 text-xs text-muted-foreground">
                      <span>{s.totalPages} صفحة</span>
                      {s.attendanceRate != null && (
                        <span className={s.attendanceRate < 70 ? "text-red-600 font-medium" : "text-green-700"}>
                          {s.attendanceRate}% حضور
                        </span>
                      )}
                      {s.avgRating != null && <span>تقييم {s.avgRating.toFixed(1)}</span>}
                      {s.velocity > 0 && <span>{s.velocity.toFixed(1)} ص/أ</span>}
                    </div>
                  </div>
                ))}
              </div>
              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="text-right px-4 py-3 font-medium">الطالب</th>
                      <th className="text-center px-3 py-3 font-medium whitespace-nowrap">إجمالي الصفحات</th>
                      <th className="text-center px-3 py-3 font-medium whitespace-nowrap">نسبة الحضور</th>
                      <th className="text-center px-3 py-3 font-medium whitespace-nowrap">متوسط التقييم</th>
                      <th className="text-center px-3 py-3 font-medium whitespace-nowrap">سرعة الحفظ</th>
                      <th className="text-center px-3 py-3 font-medium whitespace-nowrap">آخر جلسة</th>
                      <th className="text-center px-3 py-3 font-medium">الحالة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {students.map((s) => (
                      <tr key={s.id} className="hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-9 w-9 shrink-0">
                              <AvatarImage src={s.photoUrl ?? undefined} alt={s.fullName} />
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
                            <span className={s.attendanceRate < 70 ? "text-red-600 font-medium" : "text-green-700 font-medium"}>
                              {s.attendanceRate}%
                            </span>
                          ) : <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="px-3 py-3 text-center">
                          {s.avgRating != null ? <span>{s.avgRating.toFixed(1)}</span> : <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="px-3 py-3 text-center">
                          <span className="text-muted-foreground">{s.velocity > 0 ? `${s.velocity.toFixed(1)} ص/أ` : "—"}</span>
                        </td>
                        <td className="px-3 py-3 text-center">
                          <span className="text-muted-foreground text-xs">{s.lastSessionDate ?? "—"}</span>
                        </td>
                        <td className="px-3 py-3 text-center">
                          <Badge variant="secondary" className={
                            s.status === "ACTIVE" ? "bg-green-100 text-green-800" :
                            s.status === "GUEST" ? "bg-orange-100 text-orange-800" : ""
                          }>
                            {STATUS_LABELS[s.status] ?? s.status}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

"use client"

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"

export type AttendancePoint = {
  date: string
  rate: number
}

export function AttendanceChart({ data }: { data: AttendancePoint[] }) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
        لا توجد بيانات كافية
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis dataKey="date" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
        <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
        <Tooltip formatter={(v) => [`${v}%`, "نسبة الحضور"]} />
        <Bar dataKey="rate" fill="#16a34a" name="نسبة الحضور" radius={[2, 2, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Plus, Search, GraduationCap } from "lucide-react"

type Student = {
  id:                        string
  fullName:                  string
  photoUrl:                  string | null
  status:                    string
  currentTotalPagesMemorized: number
  class:                     { id: string; name: string } | null
}

type ClassOption = { id: string; name: string }

const STATUS_MAP: Record<string, { label: string; className: string }> = {
  ACTIVE:    { label: "نشط",     className: "bg-green-100 text-green-800 border-green-200" },
  INACTIVE:  { label: "غير نشط", className: "" },
  GRADUATED: { label: "متخرج",   className: "bg-blue-100 text-blue-800 border-blue-200" },
  GUEST:     { label: "ضيف",     className: "bg-orange-100 text-orange-800 border-orange-200" },
}

export function StudentsList({
  students,
  classes,
  isPrincipal,
}: {
  students:    Student[]
  classes:     ClassOption[]
  isPrincipal: boolean
}) {
  const [search, setSearch] = useState("")
  const router = useRouter()

  const filtered = students.filter((s) =>
    s.fullName.includes(search) || s.class?.name.includes(search) || search === "",
  )

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="ابحث باسم الطالب أو الحلقة…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pr-9"
          />
        </div>
        {isPrincipal && (
          <Link href="/students/new">
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              طالب جديد
            </Button>
          </Link>
        )}
      </div>

      <div className="divide-y rounded-lg border bg-card">
        {filtered.length === 0 && (
          <div className="py-12 text-center text-muted-foreground space-y-2">
            <GraduationCap className="h-10 w-10 mx-auto opacity-30" />
            <p className="text-sm font-medium">
              {search ? "لا توجد نتائج مطابقة للبحث" : "لا يوجد طلاب بعد"}
            </p>
            {!search && isPrincipal && (
              <p className="text-xs">اضغط «طالب جديد» لإضافة أول طالب</p>
            )}
          </div>
        )}
        {filtered.map((student) => {
          const statusInfo = STATUS_MAP[student.status] ?? { label: student.status, className: "" }
          return (
            <Link key={student.id} href={`/students/${student.id}`}>
              <div className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors">
                <Avatar className="h-10 w-10 shrink-0">
                  <AvatarImage src={student.photoUrl ?? undefined} alt={student.fullName} />
                  <AvatarFallback className="bg-green-100 text-green-700 text-xs font-semibold">
                    {student.fullName.slice(0, 2)}
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{student.fullName}</p>
                  <p className="text-sm text-muted-foreground truncate">
                    {student.class?.name ?? "بدون حلقة"} · {student.currentTotalPagesMemorized} صفحة
                  </p>
                </div>

                <Badge className={statusInfo.className} variant={student.status === "ACTIVE" ? "default" : "secondary"}>
                  {statusInfo.label}
                </Badge>
              </div>
            </Link>
          )
        })}
      </div>

      {filtered.length > 0 && (
        <p className="text-xs text-muted-foreground text-center">{filtered.length} طالب</p>
      )}
    </div>
  )
}

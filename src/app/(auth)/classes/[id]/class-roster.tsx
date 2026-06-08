"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { AddGuestDialog } from "./add-guest-dialog"
import { db } from "@/lib/db"
import { GraduationCap } from "lucide-react"

type Student = {
  id: string
  fullName: string
  photoUrl: string | null
  status: string
  currentTotalPagesMemorized: number
}

type OfflineGuest = {
  id: string
  fullName: string
  photoUrl: null
  status: "GUEST"
  currentTotalPagesMemorized: number
  lastSabaqReference: null
}

function StateBadge({ student }: { student: { status: string; currentTotalPagesMemorized: number } }) {
  if (student.status === "GUEST") {
    return <Badge className="bg-orange-100 text-orange-800 border-orange-200">ضيف</Badge>
  }
  if (student.currentTotalPagesMemorized === 0) {
    return <Badge variant="secondary">جديد</Badge>
  }
  return <Badge className="bg-green-100 text-green-800 border-green-200">على المسار</Badge>
}

export function ClassRoster({
  classId,
  initialStudents,
}: {
  classId: string
  initialStudents: Student[]
}) {
  const [offlineGuests, setOfflineGuests] = useState<OfflineGuest[]>([])

  useEffect(() => {
    // Load any pending offline guests for this class not already in server list
    async function loadOfflineGuests() {
      const ops = await db.pendingOps
        .where("type")
        .equals("CREATE_GUEST_STUDENT")
        .toArray()

      const serverIds = new Set(initialStudents.map((s) => s.id))
      const pending: OfflineGuest[] = ops
        .filter((op) => {
          const p = op.payload as { classId: string; localId: string }
          return p.classId === classId && !serverIds.has(p.localId)
        })
        .map((op) => {
          const p = op.payload as { localId: string; fullName: string }
          return {
            id: p.localId,
            fullName: p.fullName,
            photoUrl: null,
            status: "GUEST" as const,
            currentTotalPagesMemorized: 0,
            lastSabaqReference: null,
          }
        })

      setOfflineGuests(pending)
    }

    loadOfflineGuests()
  }, [classId, initialStudents])

  const handleOfflineGuestAdded = (guest: OfflineGuest) => {
    setOfflineGuests((prev) => [...prev, guest])
  }

  const allStudents = [...initialStudents, ...offlineGuests]

  return (
    <>
      <AddGuestDialog classId={classId} onOfflineGuestAdded={handleOfflineGuestAdded} />

      {allStudents.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <GraduationCap className="h-12 w-12 mx-auto opacity-30" />
          <p className="mt-3 text-base">لا يوجد طلاب في هذه الحلقة بعد</p>
          <p className="text-sm mt-1">أضف طالباً جديداً أو أضف ضيفاً مؤقتاً</p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {allStudents.map((student) => {
            const isOffline = offlineGuests.some((g) => g.id === student.id)
            const card = (
              <div className="flex items-center gap-3 p-4 rounded-lg border bg-card hover:shadow-md transition-shadow cursor-pointer">
                <Avatar className="h-12 w-12 shrink-0">
                  <AvatarImage src={student.photoUrl ?? undefined} alt={student.fullName} />
                  <AvatarFallback className="bg-green-100 text-green-800 text-sm font-semibold">
                    {student.fullName.slice(0, 2)}
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{student.fullName}</p>
                  <p className="text-sm text-muted-foreground">
                    {student.currentTotalPagesMemorized} صفحة محفوظة
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {isOffline && (
                    <span className="text-xs text-muted-foreground bg-muted rounded px-1.5 py-0.5">
                      في الانتظار
                    </span>
                  )}
                  <StateBadge student={student} />
                </div>
              </div>
            )

            return isOffline ? (
              <div key={student.id}>{card}</div>
            ) : (
              <Link key={student.id} href={`/students/${student.id}`}>
                {card}
              </Link>
            )
          })}
        </div>
      )}
    </>
  )
}

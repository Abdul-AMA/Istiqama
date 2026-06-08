import { type NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const phoneRegex = /^\+\d{7,15}$/

const schema = z.object({
  localId: z.string().optional(),
  fullName: z.string().min(2),
  gender: z.enum(["MALE", "FEMALE"]),
  guardianPhone: z.string().regex(phoneRegex).nullable().optional(),
  notes: z.string().nullable().optional(),
  classId: z.string(),
})

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "غير مصرح" }, { status: 401 })

  const body = await req.json()
  const parsed = schema.safeParse(body.payload)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 })
  }

  const { fullName, gender, guardianPhone, notes, classId } = parsed.data
  const userId = session.user.id!
  const role = session.user.role!

  if (role !== "PRINCIPAL") {
    const cls = await prisma.class.findFirst({ where: { id: classId, teacherId: userId } })
    if (!cls) return NextResponse.json({ error: "غير مصرح" }, { status: 403 })
  }

  const student = await prisma.student.create({
    data: {
      fullName: fullName.trim(),
      gender,
      guardianPhone: guardianPhone ?? null,
      notes: notes ?? null,
      classId,
      status: "GUEST",
    },
    select: { id: true },
  })

  return NextResponse.json({ success: true, studentId: student.id })
}

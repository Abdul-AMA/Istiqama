"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { auth } from "@/auth"

const sardSchema = z.object({
  type:     z.enum(["INDIVIDUAL", "GROUP"]),
  date:     z.string().min(1, "التاريخ مطلوب"),
  fromJuz:  z.coerce.number().int().min(1).max(30),
  toJuz:    z.coerce.number().int().min(1).max(30),
  rating:   z.coerce.number().int().min(1).max(4),
  mistakes: z.coerce.number().int().min(0).default(0),
  notes:    z.string().optional(),
})

export type SardFormState = {
  error?: string
  success?: boolean
}

export async function createSardRecord(
  studentId: string,
  _prev: SardFormState,
  formData: FormData,
): Promise<SardFormState> {
  const session = await auth()
  if (!session?.user) return { error: "غير مصرح" }

  const userId = session.user.id!
  const role = session.user.role!

  // Check access: teacher must own the student's class
  const student = await prisma.student.findUnique({ where: { id: studentId } })
  if (!student) return { error: "الطالب غير موجود" }

  if (role === "TEACHER") {
    const cls = await prisma.class.findFirst({
      where: { id: student.classId ?? "", teacherId: userId },
    })
    if (!cls) return { error: "غير مصرح بتسجيل سرد لهذا الطالب" }
  }

  const raw = {
    type:     formData.get("type"),
    date:     formData.get("date"),
    fromJuz:  formData.get("fromJuz"),
    toJuz:    formData.get("toJuz"),
    rating:   formData.get("rating"),
    mistakes: formData.get("mistakes") || 0,
    notes:    formData.get("notes") || undefined,
  }

  const parsed = sardSchema.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.errors[0].message }

  const data = parsed.data
  if (data.fromJuz > data.toJuz) return { error: "الجزء الأول يجب أن يكون أصغر من أو مساوياً للجزء الأخير" }

  await prisma.sardRecord.create({
    data: {
      type:            data.type,
      date:            new Date(data.date),
      fromJuz:         data.fromJuz,
      toJuz:           data.toJuz,
      rating:          data.rating,
      mistakes:        data.mistakes,
      notes:           data.notes || null,
      studentId,
      recordedByUserId: userId,
    },
  })

  revalidatePath(`/students/${studentId}`)
  return { success: true }
}

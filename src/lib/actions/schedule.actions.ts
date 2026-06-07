"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { auth } from "@/auth"
import { DayOfWeek } from "@prisma/client"

const slotSchema = z.object({
  classId:   z.string().min(1, "الحلقة مطلوبة"),
  dayOfWeek: z.nativeEnum(DayOfWeek, { errorMap: () => ({ message: "اليوم مطلوب" }) }),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "صيغة الوقت غير صحيحة (HH:MM)"),
  endTime:   z.string().regex(/^\d{2}:\d{2}$/, "صيغة الوقت غير صحيحة (HH:MM)"),
}).refine((d) => d.startTime < d.endTime, { message: "وقت البداية يجب أن يكون قبل وقت النهاية" })

export type SlotFormState = { error?: string; success?: boolean }

export async function createSlot(
  _prev: SlotFormState,
  formData: FormData,
): Promise<SlotFormState> {
  const session = await auth()
  if (session?.user?.role !== "PRINCIPAL") return { error: "غير مصرح" }

  const parsed = slotSchema.safeParse({
    classId:   formData.get("classId"),
    dayOfWeek: formData.get("dayOfWeek"),
    startTime: formData.get("startTime"),
    endTime:   formData.get("endTime"),
  })
  if (!parsed.success) return { error: parsed.error.errors[0].message }

  await prisma.scheduleSlot.create({ data: parsed.data })
  revalidatePath("/timetable")
  return { success: true }
}

export async function updateSlot(
  id: string,
  _prev: SlotFormState,
  formData: FormData,
): Promise<SlotFormState> {
  const session = await auth()
  if (session?.user?.role !== "PRINCIPAL") return { error: "غير مصرح" }

  const parsed = slotSchema.safeParse({
    classId:   formData.get("classId"),
    dayOfWeek: formData.get("dayOfWeek"),
    startTime: formData.get("startTime"),
    endTime:   formData.get("endTime"),
  })
  if (!parsed.success) return { error: parsed.error.errors[0].message }

  await prisma.scheduleSlot.update({ where: { id }, data: parsed.data })
  revalidatePath("/timetable")
  return { success: true }
}

export async function deleteSlot(id: string): Promise<void> {
  const session = await auth()
  if (session?.user?.role !== "PRINCIPAL") throw new Error("غير مصرح")
  await prisma.scheduleSlot.delete({ where: { id } })
  revalidatePath("/timetable")
}

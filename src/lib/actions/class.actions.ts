"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { auth } from "@/auth"

const classSchema = z.object({
  name:        z.string().min(1, "اسم الحلقة مطلوب"),
  teacherId:   z.string().min(1, "المعلم مطلوب"),
  level:       z.string().optional(),
  location:    z.string().optional(),
  capacity:    z.coerce.number().int().positive().optional(),
  sponsorship: z.string().optional(),
})

export type ClassFormState = {
  error?: string
  success?: boolean
}

export async function createClass(
  _prev: ClassFormState,
  formData: FormData,
): Promise<ClassFormState> {
  const session = await auth()
  if (session?.user?.role !== "PRINCIPAL") return { error: "غير مصرح" }

  const raw = {
    name:        formData.get("name"),
    teacherId:   formData.get("teacherId"),
    level:       formData.get("level") || undefined,
    location:    formData.get("location") || undefined,
    capacity:    formData.get("capacity") || undefined,
    sponsorship: formData.get("sponsorship") || undefined,
  }

  const parsed = classSchema.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.errors[0].message }

  try {
    await prisma.class.create({ data: { ...parsed.data, status: "ACTIVE" } })
  } catch {
    return { error: "حدث خطأ أثناء إنشاء الحلقة — يرجى المحاولة مرة أخرى" }
  }
  revalidatePath("/classes")
  return { success: true }
}

export async function updateClass(
  id: string,
  _prev: ClassFormState,
  formData: FormData,
): Promise<ClassFormState> {
  const session = await auth()
  if (session?.user?.role !== "PRINCIPAL") return { error: "غير مصرح" }

  const raw = {
    name:        formData.get("name"),
    teacherId:   formData.get("teacherId"),
    level:       formData.get("level") || undefined,
    location:    formData.get("location") || undefined,
    capacity:    formData.get("capacity") || undefined,
    sponsorship: formData.get("sponsorship") || undefined,
  }

  const parsed = classSchema.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.errors[0].message }

  try {
    await prisma.class.update({ where: { id }, data: parsed.data })
  } catch {
    return { error: "حدث خطأ أثناء تعديل الحلقة — يرجى المحاولة مرة أخرى" }
  }
  revalidatePath("/classes")
  revalidatePath(`/classes/${id}`)
  return { success: true }
}

export async function deleteClass(id: string) {
  const session = await auth()
  if (session?.user?.role !== "PRINCIPAL") throw new Error("غير مصرح")
  await prisma.class.delete({ where: { id } })
  revalidatePath("/classes")
}

export async function toggleClassStatus(id: string, status: "ACTIVE" | "INACTIVE") {
  const session = await auth()
  if (session?.user?.role !== "PRINCIPAL") throw new Error("غير مصرح")
  await prisma.class.update({ where: { id }, data: { status } })
  revalidatePath("/classes")
}

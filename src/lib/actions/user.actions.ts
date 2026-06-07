"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { auth } from "@/auth"

function requirePrincipal(role: string | undefined) {
  if (role !== "PRINCIPAL") throw new Error("غير مصرح")
}

const teacherSchema = z.object({
  fullName: z.string().min(2, "الاسم مطلوب"),
  email:    z.string().email("بريد إلكتروني غير صحيح"),
  phone:    z.string().optional(),
  password: z.string().min(6, "كلمة المرور 6 أحرف على الأقل").optional(),
})

export type TeacherFormState = {
  error?: string
  success?: boolean
}

export async function createTeacher(
  _prev: TeacherFormState,
  formData: FormData,
): Promise<TeacherFormState> {
  const session = await auth()
  requirePrincipal(session?.user?.role)

  const raw = {
    fullName: formData.get("fullName"),
    email:    formData.get("email"),
    phone:    formData.get("phone") || undefined,
    password: formData.get("password"),
  }

  const parsed = teacherSchema.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.errors[0].message }

  const { fullName, email, phone, password } = parsed.data
  if (!password) return { error: "كلمة المرور مطلوبة" }

  const exists = await prisma.user.findUnique({ where: { email } })
  if (exists) return { error: "البريد الإلكتروني مستخدم مسبقاً" }

  const passwordHash = await bcrypt.hash(password, 12)
  await prisma.user.create({
    data: { fullName, email, phone, passwordHash, role: "TEACHER", isActive: true },
  })

  revalidatePath("/admin/users")
  return { success: true }
}

export async function updateTeacher(
  id: string,
  _prev: TeacherFormState,
  formData: FormData,
): Promise<TeacherFormState> {
  const session = await auth()
  requirePrincipal(session?.user?.role)

  const raw = {
    fullName: formData.get("fullName"),
    email:    formData.get("email"),
    phone:    formData.get("phone") || undefined,
  }

  const parsed = teacherSchema.omit({ password: true }).safeParse(raw)
  if (!parsed.success) return { error: parsed.error.errors[0].message }

  const { fullName, email, phone } = parsed.data

  const existing = await prisma.user.findFirst({ where: { email, NOT: { id } } })
  if (existing) return { error: "البريد الإلكتروني مستخدم مسبقاً" }

  await prisma.user.update({ where: { id }, data: { fullName, email, phone } })
  revalidatePath("/admin/users")
  return { success: true }
}

export async function toggleTeacherActive(id: string, isActive: boolean) {
  const session = await auth()
  requirePrincipal(session?.user?.role)
  await prisma.user.update({ where: { id }, data: { isActive } })
  revalidatePath("/admin/users")
}

export async function resetTeacherPassword(
  id: string,
  _prev: TeacherFormState,
  formData: FormData,
): Promise<TeacherFormState> {
  const session = await auth()
  requirePrincipal(session?.user?.role)

  const password = formData.get("password") as string
  if (!password || password.length < 6) return { error: "كلمة المرور 6 أحرف على الأقل" }

  const passwordHash = await bcrypt.hash(password, 12)
  await prisma.user.update({ where: { id }, data: { passwordHash } })
  return { success: true }
}

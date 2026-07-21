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
  kunya:    z.string().optional(),
  email:    z.string().email("بريد إلكتروني غير صحيح"),
  phone:    z.string().optional(),
  password: z.string().min(6, "كلمة المرور 6 أحرف على الأقل").optional(),

  // Roster fields
  nationalId:    z.string().optional(),
  dateOfBirth:   z.coerce.date().optional(),
  maritalStatus: z.string().optional(),
  familySize:    z.coerce.number().int().min(0).optional(),
  incomeSource:  z.string().optional(),
  qualification: z.string().optional(),
  teachingStage: z.string().optional(),
  roleTitle:     z.string().optional(),
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
    kunya:    formData.get("kunya") || undefined,
    email:    formData.get("email"),
    phone:    formData.get("phone") || undefined,
    password: formData.get("password"),

    nationalId:    formData.get("nationalId") || undefined,
    dateOfBirth:   formData.get("dateOfBirth") || undefined,
    maritalStatus: formData.get("maritalStatus") || undefined,
    familySize:    formData.get("familySize") || undefined,
    incomeSource:  formData.get("incomeSource") || undefined,
    qualification: formData.get("qualification") || undefined,
    teachingStage: formData.get("teachingStage") || undefined,
    roleTitle:     formData.get("roleTitle") || undefined,
  }

  const parsed = teacherSchema.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.errors[0].message }

  const {
    fullName, kunya, email, phone, password,
    nationalId, dateOfBirth, maritalStatus, familySize,
    incomeSource, qualification, teachingStage, roleTitle,
  } = parsed.data
  if (!password) return { error: "كلمة المرور مطلوبة" }

  const exists = await prisma.user.findUnique({ where: { email } })
  if (exists) return { error: "البريد الإلكتروني مستخدم مسبقاً" }

  const passwordHash = await bcrypt.hash(password, 12)
  try {
    await prisma.user.create({
      data: {
        fullName, kunya: kunya || null, email, phone, passwordHash, role: "TEACHER", isActive: true,
        nationalId: nationalId || null,
        dateOfBirth: dateOfBirth ?? null,
        maritalStatus: maritalStatus || null,
        familySize: familySize ?? null,
        incomeSource: incomeSource || null,
        qualification: qualification || null,
        teachingStage: teachingStage || null,
        roleTitle: roleTitle || null,
      },
    })
  } catch {
    return { error: "حدث خطأ أثناء إنشاء الحساب — يرجى المحاولة مرة أخرى" }
  }

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
    kunya:    formData.get("kunya") || undefined,
    email:    formData.get("email"),
    phone:    formData.get("phone") || undefined,

    nationalId:    formData.get("nationalId") || undefined,
    dateOfBirth:   formData.get("dateOfBirth") || undefined,
    maritalStatus: formData.get("maritalStatus") || undefined,
    familySize:    formData.get("familySize") || undefined,
    incomeSource:  formData.get("incomeSource") || undefined,
    qualification: formData.get("qualification") || undefined,
    teachingStage: formData.get("teachingStage") || undefined,
    roleTitle:     formData.get("roleTitle") || undefined,
  }

  const parsed = teacherSchema.omit({ password: true }).safeParse(raw)
  if (!parsed.success) return { error: parsed.error.errors[0].message }

  const {
    fullName, kunya, email, phone,
    nationalId, dateOfBirth, maritalStatus, familySize,
    incomeSource, qualification, teachingStage, roleTitle,
  } = parsed.data

  const existing = await prisma.user.findFirst({ where: { email, NOT: { id } } })
  if (existing) return { error: "البريد الإلكتروني مستخدم مسبقاً" }

  await prisma.user.update({
    where: { id },
    data: {
      fullName, kunya: kunya || null, email, phone,
      nationalId: nationalId || null,
      dateOfBirth: dateOfBirth ?? null,
      maritalStatus: maritalStatus || null,
      familySize: familySize ?? null,
      incomeSource: incomeSource || null,
      qualification: qualification || null,
      teachingStage: teachingStage || null,
      roleTitle: roleTitle || null,
    },
  })
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

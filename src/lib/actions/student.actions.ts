"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { put } from "@vercel/blob"
import { prisma } from "@/lib/prisma"
import { auth } from "@/auth"

const phoneRegex = /^\+\d{7,15}$/

const studentSchema = z.object({
  fullName:          z.string().min(2, "الاسم مطلوب"),
  gender:            z.enum(["MALE", "FEMALE"]),
  dateOfBirth:       z.string().optional(),
  nationalId:        z.string().optional(),
  schoolGrade:       z.string().optional(),
  neighborhood:      z.string().optional(),
  guardianName:      z.string().optional(),
  guardianPhone:     z.string().regex(phoneRegex, "الرقم يجب أن يكون بصيغة دولية مثل +9665xxxxxxxx").optional().or(z.literal("")),
  secondaryPhone:    z.string().regex(phoneRegex, "الرقم يجب أن يكون بصيغة دولية مثل +9665xxxxxxxx").optional().or(z.literal("")),
  previousHifzPages: z.coerce.number().int().min(0).optional(),
  classId:           z.string().optional(),
  notes:             z.string().optional(),
  status:            z.enum(["ACTIVE", "INACTIVE", "GRADUATED", "GUEST"]).default("ACTIVE"),
})

export type StudentFormState = {
  error?: string
  success?: boolean
}

async function getSessionOrThrow() {
  const session = await auth()
  if (!session?.user) throw new Error("غير مصرح — يرجى تسجيل الدخول")
  return session
}

async function canManageClass(userId: string, role: string, classId: string | undefined) {
  if (role === "PRINCIPAL") return true
  if (!classId) return false
  const cls = await prisma.class.findFirst({ where: { id: classId, teacherId: userId } })
  return !!cls
}

export async function createStudent(
  _prev: StudentFormState,
  formData: FormData,
): Promise<StudentFormState> {
  const session = await getSessionOrThrow()
  const role = session.user.role!
  const userId = session.user.id!

  const classId = formData.get("classId") as string | null || undefined

  if (!(await canManageClass(userId, role, classId))) {
    return { error: "غير مصرح بإضافة طلاب في هذه الحلقة" }
  }

  const raw = {
    fullName:          formData.get("fullName"),
    gender:            formData.get("gender"),
    dateOfBirth:       formData.get("dateOfBirth") || undefined,
    nationalId:        formData.get("nationalId") || undefined,
    schoolGrade:       formData.get("schoolGrade") || undefined,
    neighborhood:      formData.get("neighborhood") || undefined,
    guardianName:      formData.get("guardianName") || undefined,
    guardianPhone:     formData.get("guardianPhone") || undefined,
    secondaryPhone:    formData.get("secondaryPhone") || undefined,
    previousHifzPages: formData.get("previousHifzPages") || undefined,
    classId:           classId || undefined,
    notes:             formData.get("notes") || undefined,
    status:            "ACTIVE" as const,
  }

  const parsed = studentSchema.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.errors[0].message }

  const data = parsed.data
  try {
    await prisma.student.create({
      data: {
        fullName:          data.fullName,
        gender:            data.gender,
        dateOfBirth:       data.dateOfBirth ? new Date(data.dateOfBirth) : null,
        nationalId:        data.nationalId || null,
        schoolGrade:       data.schoolGrade || null,
        neighborhood:      data.neighborhood || null,
        guardianName:      data.guardianName || null,
        guardianPhone:     data.guardianPhone || null,
        secondaryPhone:    data.secondaryPhone || null,
        previousHifzPages: data.previousHifzPages ?? null,
        classId:           data.classId || null,
        notes:             data.notes || null,
        status:            "ACTIVE",
      },
    })
  } catch {
    return { error: "حدث خطأ أثناء إضافة الطالب — يرجى المحاولة مرة أخرى" }
  }

  revalidatePath("/students")
  if (data.classId) revalidatePath(`/classes/${data.classId}`)
  return { success: true }
}

export async function updateStudent(
  id: string,
  _prev: StudentFormState,
  formData: FormData,
): Promise<StudentFormState> {
  const session = await getSessionOrThrow()
  const role = session.user.role!
  const userId = session.user.id!

  const student = await prisma.student.findUnique({ where: { id } })
  if (!student) return { error: "الطالب غير موجود" }

  if (!(await canManageClass(userId, role, student.classId ?? undefined))) {
    return { error: "غير مصرح بتعديل هذا الطالب" }
  }

  const classId = formData.get("classId") as string | null || undefined

  const raw = {
    fullName:          formData.get("fullName"),
    gender:            formData.get("gender"),
    dateOfBirth:       formData.get("dateOfBirth") || undefined,
    nationalId:        formData.get("nationalId") || undefined,
    schoolGrade:       formData.get("schoolGrade") || undefined,
    neighborhood:      formData.get("neighborhood") || undefined,
    guardianName:      formData.get("guardianName") || undefined,
    guardianPhone:     formData.get("guardianPhone") || undefined,
    secondaryPhone:    formData.get("secondaryPhone") || undefined,
    previousHifzPages: formData.get("previousHifzPages") || undefined,
    classId:           classId || undefined,
    notes:             formData.get("notes") || undefined,
    status:            (formData.get("status") || "ACTIVE") as string,
  }

  const parsed = studentSchema.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.errors[0].message }

  const data = parsed.data
  await prisma.student.update({
    where: { id },
    data: {
      fullName:          data.fullName,
      gender:            data.gender,
      dateOfBirth:       data.dateOfBirth ? new Date(data.dateOfBirth) : null,
      nationalId:        data.nationalId || null,
      schoolGrade:       data.schoolGrade || null,
      neighborhood:      data.neighborhood || null,
      guardianName:      data.guardianName || null,
      guardianPhone:     data.guardianPhone || null,
      secondaryPhone:    data.secondaryPhone || null,
      previousHifzPages: data.previousHifzPages ?? null,
      classId:           data.classId || null,
      notes:             data.notes || null,
      status:            data.status,
    },
  })

  revalidatePath("/students")
  revalidatePath(`/students/${id}`)
  if (student.classId) revalidatePath(`/classes/${student.classId}`)
  if (data.classId) revalidatePath(`/classes/${data.classId}`)
  return { success: true }
}

export async function deleteStudent(id: string) {
  const session = await getSessionOrThrow()
  const role = session.user.role!
  const userId = session.user.id!

  const student = await prisma.student.findUnique({ where: { id } })
  if (!student) throw new Error("الطالب غير موجود")

  if (!(await canManageClass(userId, role, student.classId ?? undefined))) {
    throw new Error("غير مصرح بحذف هذا الطالب")
  }

  await prisma.student.delete({ where: { id } })
  revalidatePath("/students")
  if (student.classId) revalidatePath(`/classes/${student.classId}`)
}

// Guest student — teacher adds minimal info, immediately in their class
export async function addGuestStudent(
  _prev: StudentFormState,
  formData: FormData,
): Promise<StudentFormState> {
  const session = await getSessionOrThrow()
  const role = session.user.role!
  const userId = session.user.id!

  const fullName = formData.get("fullName") as string
  const guardianPhone = (formData.get("guardianPhone") as string) || null
  const notes = (formData.get("notes") as string) || null
  const classId = formData.get("classId") as string

  if (!fullName?.trim()) return { error: "اسم الطالب مطلوب" }
  if (!classId) return { error: "لا توجد حلقة محددة" }

  // Validate teacher owns this class
  if (!(await canManageClass(userId, role, classId))) {
    return { error: "غير مصرح — يمكنك إضافة ضيوف في حلقاتك فقط" }
  }

  if (guardianPhone && !phoneRegex.test(guardianPhone)) {
    return { error: "رقم الهاتف يجب أن يكون بصيغة دولية مثل +9665xxxxxxxx" }
  }

  const gender = (formData.get("gender") as "MALE" | "FEMALE") || "MALE"

  await prisma.student.create({
    data: {
      fullName: fullName.trim(),
      gender,
      guardianPhone,
      notes,
      classId,
      status: "GUEST",
    },
  })

  revalidatePath(`/classes/${classId}`)
  return { success: true }
}

// Principal confirms a guest — either keeps class or assigns new class
export async function confirmGuest(
  studentId: string,
  _prev: StudentFormState,
  formData: FormData,
): Promise<StudentFormState> {
  const session = await getSessionOrThrow()
  if (session.user.role !== "PRINCIPAL") return { error: "غير مصرح" }

  const newClassId = (formData.get("classId") as string) || null
  const fullName = formData.get("fullName") as string

  if (!fullName?.trim()) return { error: "الاسم مطلوب" }

  const raw = {
    fullName:          formData.get("fullName"),
    gender:            formData.get("gender"),
    dateOfBirth:       formData.get("dateOfBirth") || undefined,
    nationalId:        formData.get("nationalId") || undefined,
    schoolGrade:       formData.get("schoolGrade") || undefined,
    neighborhood:      formData.get("neighborhood") || undefined,
    guardianName:      formData.get("guardianName") || undefined,
    guardianPhone:     formData.get("guardianPhone") || undefined,
    secondaryPhone:    formData.get("secondaryPhone") || undefined,
    previousHifzPages: formData.get("previousHifzPages") || undefined,
    notes:             formData.get("notes") || undefined,
    status:            "ACTIVE" as const,
    classId:           newClassId || undefined,
  }

  const parsed = studentSchema.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.errors[0].message }

  const data = parsed.data
  await prisma.student.update({
    where: { id: studentId },
    data: {
      fullName:          data.fullName,
      gender:            data.gender,
      dateOfBirth:       data.dateOfBirth ? new Date(data.dateOfBirth) : null,
      nationalId:        data.nationalId || null,
      schoolGrade:       data.schoolGrade || null,
      neighborhood:      data.neighborhood || null,
      guardianName:      data.guardianName || null,
      guardianPhone:     data.guardianPhone || null,
      secondaryPhone:    data.secondaryPhone || null,
      previousHifzPages: data.previousHifzPages ?? null,
      classId:           newClassId,
      notes:             data.notes || null,
      status:            "ACTIVE",
    },
  })

  revalidatePath("/admin/guests")
  revalidatePath("/students")
  if (newClassId) revalidatePath(`/classes/${newClassId}`)
  return { success: true }
}

// Photo upload — called from the API route handler
export async function uploadStudentPhoto(studentId: string, file: File, userId: string, role: string) {
  const student = await prisma.student.findUnique({ where: { id: studentId } })
  if (!student) throw new Error("الطالب غير موجود")

  if (!(await canManageClass(userId, role, student.classId ?? undefined))) {
    throw new Error("غير مصرح")
  }

  const blob = await put(`students/${studentId}/${Date.now()}_${file.name}`, file, {
    access: "public",
    contentType: file.type,
  })

  await prisma.student.update({ where: { id: studentId }, data: { photoUrl: blob.url } })
  revalidatePath(`/students/${studentId}`)
  return blob.url
}

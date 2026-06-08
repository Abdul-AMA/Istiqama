"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { auth } from "@/auth"

const categorySchema = z.object({
  name:      z.string().min(1, "الاسم مطلوب"),
  tone:      z.enum(["NEUTRAL", "POSITIVE", "WARNING"]),
  template:  z.string().min(1, "القالب مطلوب"),
  sortOrder: z.coerce.number().int().default(0),
  isActive:  z.boolean().default(true),
})

async function requirePrincipal() {
  const session = await auth()
  if (!session?.user) throw new Error("غير مصرح")
  if (session.user.role !== "PRINCIPAL") throw new Error("للمدير فقط")
  return session.user
}

export async function createCategory(_prev: { error?: string; success?: boolean }, formData: FormData) {
  try {
    const user = await requirePrincipal()
    const raw = {
      name:      formData.get("name"),
      tone:      formData.get("tone"),
      template:  formData.get("template"),
      sortOrder: formData.get("sortOrder"),
      isActive:  true,
    }
    const data = categorySchema.parse(raw)
    await prisma.messageCategory.create({
      data: { ...data, createdByUserId: user.id! },
    })
    revalidatePath("/admin/message-categories")
    return { success: true }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "خطأ"
    return { error: msg }
  }
}

export async function updateCategory(
  id: string,
  _prev: { error?: string; success?: boolean },
  formData: FormData,
) {
  try {
    await requirePrincipal()
    const raw = {
      name:      formData.get("name"),
      tone:      formData.get("tone"),
      template:  formData.get("template"),
      sortOrder: formData.get("sortOrder"),
      isActive:  formData.get("isActive") === "true",
    }
    const data = categorySchema.parse(raw)
    await prisma.messageCategory.update({ where: { id }, data })
    revalidatePath("/admin/message-categories")
    return { success: true }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "خطأ"
    return { error: msg }
  }
}

export async function toggleCategoryActive(id: string, isActive: boolean) {
  await requirePrincipal()
  await prisma.messageCategory.update({ where: { id }, data: { isActive } })
  revalidatePath("/admin/message-categories")
}

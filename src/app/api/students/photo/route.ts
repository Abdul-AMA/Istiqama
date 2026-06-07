import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { uploadStudentPhoto } from "@/lib/actions/student.actions"

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "غير مصرح" }, { status: 401 })

  const formData = await req.formData()
  const studentId = formData.get("studentId") as string
  const file = formData.get("file") as File

  if (!studentId || !file) {
    return NextResponse.json({ error: "بيانات غير مكتملة" }, { status: 400 })
  }

  const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"]
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: "نوع الملف غير مدعوم" }, { status: 400 })
  }

  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: "حجم الملف يجب أن لا يتجاوز 5 ميجابايت" }, { status: 400 })
  }

  try {
    const url = await uploadStudentPhoto(
      studentId,
      file,
      session.user.id!,
      session.user.role!,
    )
    return NextResponse.json({ url })
  } catch (err) {
    const message = err instanceof Error ? err.message : "حدث خطأ"
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

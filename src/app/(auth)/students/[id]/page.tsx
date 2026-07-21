import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ArrowRight, Pencil, Phone } from "lucide-react"
import { SardDialog } from "./sard-dialog"

type Props = { params: Promise<{ id: string }> }

const RATING_LABELS: Record<number, string> = { 4: "ممتاز", 3: "جيد جداً", 2: "جيد", 1: "يحتاج إعادة" }
const RATING_COLORS: Record<number, string> = {
  4: "bg-green-100 text-green-800",
  3: "bg-blue-100 text-blue-800",
  2: "bg-yellow-100 text-yellow-800",
  1: "bg-red-100 text-red-800",
}

function WhatsAppLink({ phone, label }: { phone: string | null; label: string }) {
  if (!phone) return <span className="text-muted-foreground">—</span>
  const href = `https://wa.me/${phone.replace(/\D/g, "")}`
  return (
    <div className="flex items-center gap-2">
      <span dir="ltr">{phone}</span>
      <a href={href} target="_blank" rel="noopener noreferrer" title={`واتساب — ${label}`}>
        <Button variant="ghost" size="icon" className="h-7 w-7 text-green-600">
          <Phone className="h-3.5 w-3.5" />
        </Button>
      </a>
    </div>
  )
}

export default async function StudentDetailPage({ params }: Props) {
  const { id }  = await params
  const session = await auth()
  const role    = session!.user.role!
  const userId  = session!.user.id!

  const student = await prisma.student.findUnique({
    where:  { id },
    select: {
      id: true, fullName: true, gender: true, dateOfBirth: true, photoUrl: true,
      nationalId: true, schoolGrade: true, neighborhood: true,
      guardianName: true, guardianPhone: true, secondaryPhone: true,
      guardianOccupation: true, paymentNumber: true, paymentMethod: true,
      previousHifzPages: true, enrollmentDate: true, status: true, notes: true,
      currentTotalPagesMemorized: true, classId: true,
      educationStage: true, familySize: true, tajweedLevel: true,
      commitmentLevel: true, residencyStatus: true,
      class: { select: { id: true, name: true } },
      sardRecords: {
        orderBy: { date: "desc" },
        select: { id: true, type: true, source: true, kind: true, date: true, fromJuz: true, toJuz: true, rating: true, mistakes: true, notes: true },
      },
      hifzSessions: {
        take:    5,
        orderBy: { date: "desc" },
        select:  { date: true, entries: { select: { type: true, fromPage: true, toPage: true, rating: true } } },
      },
      attendanceRecords: {
        take:    30,
        orderBy: { date: "desc" },
        select:  { status: true },
      },
    },
  })

  if (!student) notFound()

  // Teachers can only view their assigned students
  if (role === "TEACHER" && student.classId) {
    const cls = await prisma.class.findFirst({ where: { id: student.classId, teacherId: userId } })
    if (!cls) redirect("/dashboard")
  }

  // Attendance %
  const totalAttendance = student.attendanceRecords.length
  const presentCount    = student.attendanceRecords.filter((r) => r.status === "PRESENT" || r.status === "LATE").length
  const attendancePct   = totalAttendance > 0 ? Math.round((presentCount / totalAttendance) * 100) : null

  // Average rating from all hifz entries
  const allEntries = student.hifzSessions.flatMap((s) => s.entries)
  const avgRating  = allEntries.length > 0
    ? (allEntries.reduce((sum, e) => sum + e.rating, 0) / allEntries.length).toFixed(1)
    : null

  const lastSession = student.hifzSessions[0]?.date

  const SARD_SOURCES = ["LOCAL", "DARUL_QURAN", "AWQAF"] as const
  type SardSource = typeof SARD_SOURCES[number]
  const SOURCE_LABELS: Record<SardSource, string> = {
    LOCAL:       "المدرسة المحلية",
    DARUL_QURAN: "دار القران الكريم والسنة",
    AWQAF:       "وزارة الأوقاف والشؤون الدينية",
  }
  const findLatestSard = (source: string, type: string, kind: string) =>
    student.sardRecords.find((r) => r.source === source && r.type === type && r.kind === kind) ?? null

  const statusMap: Record<string, { label: string; className: string }> = {
    ACTIVE:    { label: "على المسار",     className: "bg-green-100 text-green-800" },
    INACTIVE:  { label: "غير نشط",        className: "" },
    GRADUATED: { label: "متخرج",          className: "bg-blue-100 text-blue-800" },
    GUEST:     { label: "ضيف",            className: "bg-orange-100 text-orange-800" },
  }
  const statusInfo = statusMap[student.status] ?? { label: student.status, className: "" }

  const formatDate = (d: Date | null | undefined) => {
    if (!d) return "—"
    return new Date(d).toLocaleDateString("ar-SA", { year: "numeric", month: "long", day: "numeric" })
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Link href={student.classId ? `/classes/${student.classId}` : "/students"}>
          <Button variant="ghost" size="icon"><ArrowRight className="h-5 w-5" /></Button>
        </Link>

        <Avatar className="h-20 w-20 shrink-0">
          <AvatarImage src={student.photoUrl ?? undefined} alt={student.fullName} />
          <AvatarFallback className="bg-green-100 text-green-800 text-2xl font-bold">
            {student.fullName.slice(0, 2)}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold">{student.fullName}</h1>
            <Badge className={statusInfo.className}>{statusInfo.label}</Badge>
            {student.class && (
              <Link href={`/classes/${student.class.id}`}>
                <Badge variant="outline">{student.class.name}</Badge>
              </Link>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {student.gender === "MALE" ? "ذكر" : "أنثى"}
            {student.dateOfBirth && ` · ${formatDate(student.dateOfBirth)}`}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Link href={`/students/${id}/history`}>
            <Button variant="outline" size="sm" className="gap-2">
              السجل
            </Button>
          </Link>
          <Link href={`/students/${id}/edit`}>
            <Button variant="outline" size="sm" className="gap-2">
              <Pencil className="h-4 w-4" />
              تعديل
            </Button>
          </Link>
        </div>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-3 gap-3">
        <MetricCard label="نسبة الحضور" value={attendancePct !== null ? `${attendancePct}%` : "—"} />
        <MetricCard label="متوسط التقييم" value={avgRating ?? "—"} />
        <MetricCard label="إجمالي الجلسات" value={student.hifzSessions.length.toString()} />
      </div>

      {/* Personal info */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">البيانات الشخصية</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-y-3 text-sm">
          <InfoRow label="تاريخ الميلاد"  value={formatDate(student.dateOfBirth)} />
          <InfoRow label="رقم الهوية"      value={student.nationalId ?? "—"} />
          <InfoRow label="المرحلة الدراسية" value={student.schoolGrade ?? "—"} />
          <InfoRow label="الحي"            value={student.neighborhood ?? "—"} />
          <InfoRow label="تاريخ الالتحاق"  value={formatDate(student.enrollmentDate)} />
          <InfoRow label="المرحلة"        value={student.educationStage ?? "—"} />
          <InfoRow label="عدد أفراد الأسرة" value={student.familySize != null ? String(student.familySize) : "—"} />
          <InfoRow label="الأحكام"        value={student.tajweedLevel ?? "—"} />
          <InfoRow label="الإلتزام"       value={student.commitmentLevel ?? "—"} />
          <InfoRow label="نازح / مقيم"    value={student.residencyStatus ?? "—"} />
        </CardContent>
      </Card>

      {/* Guardian info */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">بيانات ولي الأمر</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-y-3 text-sm md:grid-cols-2">
          <InfoRow label="اسم ولي الأمر"  value={student.guardianName ?? "—"} />
          <InfoRow label="مهنة ولي الأمر" value={student.guardianOccupation ?? "—"} />
          <div>
            <p className="text-muted-foreground mb-0.5">الهاتف الأول</p>
            <WhatsAppLink phone={student.guardianPhone} label="ولي الأمر" />
          </div>
          <div>
            <p className="text-muted-foreground mb-0.5">الهاتف الثاني</p>
            <WhatsAppLink phone={student.secondaryPhone} label="ولي الأمر 2" />
          </div>
          {(student.paymentNumber || student.paymentMethod) && (
            <>
              <InfoRow label="رقم التحويل" value={student.paymentNumber ?? "—"} />
              <InfoRow label="طريقة الدفع" value={
                student.paymentMethod === "PALPAL"          ? "فلسطيني (PalPay)"
                : student.paymentMethod === "JAWWAL_PAY"   ? "جوال باي"
                : student.paymentMethod === "MALCHAT"      ? "ملكات"
                : student.paymentMethod === "BANK_PALESTINE" ? "بنك فلسطين"
                : student.paymentMethod === "OTHER"        ? "أخرى"
                : "—"
              } />
            </>
          )}
        </CardContent>
      </Card>

      {/* Hifz progress */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">التقدم في الحفظ</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-3 text-sm">
            <InfoRow label="إجمالي المحفوظ"     value={`${student.currentTotalPagesMemorized} صفحة`} />
            <InfoRow label="محفوظ قبل الالتحاق" value={student.previousHifzPages != null ? `${student.previousHifzPages} صفحة` : "—"} />
            <InfoRow label="آخر جلسة"           value={formatDate(lastSession)} />
          </div>

          <Separator />

          {/* سرد sections — one per source */}
          <div className="space-y-5">
            {SARD_SOURCES.map((src) => (
              <div key={src} className="space-y-2">
                <p className="text-sm font-semibold">{SOURCE_LABELS[src]}</p>
                <div className="grid grid-cols-2 gap-3">
                  <SardCard title="سرد فردي"     sard={findLatestSard(src, "INDIVIDUAL", "SARD")} studentId={id} defaultSource={src} defaultType="INDIVIDUAL" defaultKind="SARD" />
                  <SardCard title="سرد مجتمعي"   sard={findLatestSard(src, "GROUP",      "SARD")} studentId={id} defaultSource={src} defaultType="GROUP"      defaultKind="SARD" />
                  <SardCard title="اختبار فردي"  sard={findLatestSard(src, "INDIVIDUAL", "EXAM")} studentId={id} defaultSource={src} defaultType="INDIVIDUAL" defaultKind="EXAM" />
                  <SardCard title="اختبار مجتمعي" sard={findLatestSard(src, "GROUP",     "EXAM")} studentId={id} defaultSource={src} defaultType="GROUP"      defaultKind="EXAM" />
                </div>
              </div>
            ))}
          </div>

          {/* Full sard history */}
          {student.sardRecords.length > 0 && (
            <>
              <Separator />
              <details className="group">
                <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground transition-colors list-none flex items-center gap-2">
                  <span className="group-open:rotate-90 transition-transform inline-block">▶</span>
                  سجل السرد الكامل ({student.sardRecords.length})
                </summary>
                <div className="mt-3 space-y-2">
                  {student.sardRecords.map((r) => (
                    <div key={r.id} className="flex items-center gap-3 text-sm py-2 border-b last:border-0">
                      <Badge variant="outline" className="shrink-0 text-xs">
                        {r.kind === "EXAM" ? "اختبار" : "سرد"} {r.type === "INDIVIDUAL" ? "فردي" : "مجتمعي"}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {r.source === "DARUL_QURAN" ? "دار القران" : r.source === "AWQAF" ? "الأوقاف" : "محلي"}
                      </span>
                      <span>جزء {r.fromJuz}{r.toJuz !== r.fromJuz ? ` ← ${r.toJuz}` : ""}</span>
                      <Badge className={`text-xs ${RATING_COLORS[r.rating] ?? ""}`}>
                        {RATING_LABELS[r.rating] ?? r.rating}
                      </Badge>
                      <span className="text-muted-foreground ms-auto">{formatDate(r.date)}</span>
                    </div>
                  ))}
                </div>
              </details>
            </>
          )}
        </CardContent>
      </Card>

      {/* Notes */}
      {student.notes && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">ملاحظات</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{student.notes}</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-card p-3 text-center">
      <p className="text-xl font-bold">{value}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-muted-foreground">{label}</p>
      <p className="font-medium mt-0.5">{value}</p>
    </div>
  )
}

type SardRecord = {
  id:      string
  type:    string
  source:  string
  kind:    string
  date:    Date
  fromJuz: number
  toJuz:   number
  rating:  number
  mistakes: number
  notes:   string | null
}

function SardCard({
  title,
  sard,
  studentId,
  defaultType,
  defaultSource,
  defaultKind,
}: {
  title:         string
  sard:          SardRecord | null
  studentId:     string
  defaultType:   "INDIVIDUAL" | "GROUP"
  defaultSource: "LOCAL" | "DARUL_QURAN" | "AWQAF"
  defaultKind:   "SARD" | "EXAM"
}) {
  const formatDate = (d: Date) =>
    new Date(d).toLocaleDateString("ar-SA", { year: "numeric", month: "short", day: "numeric" })

  return (
    <div className="rounded-lg border p-3 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">{title}</p>
        <SardDialog studentId={studentId} defaultType={defaultType} defaultSource={defaultSource} defaultKind={defaultKind} />
      </div>
      {sard ? (
        <div className="text-sm space-y-1">
          <p className="text-muted-foreground">{formatDate(sard.date)}</p>
          <p>جزء {sard.fromJuz}{sard.toJuz !== sard.fromJuz ? ` ← جزء ${sard.toJuz}` : ""}</p>
          <Badge className={`text-xs ${RATING_COLORS[sard.rating] ?? ""}`}>
            {RATING_LABELS[sard.rating] ?? sard.rating}
          </Badge>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">لا يوجد سرد بعد</p>
      )}
    </div>
  )
}

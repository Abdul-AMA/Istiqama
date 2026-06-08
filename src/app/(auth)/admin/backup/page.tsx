import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Download, DatabaseBackup, FileSpreadsheet, AlertCircle } from "lucide-react"

export default async function BackupPage() {
  const session = await auth()
  if (session?.user?.role !== "PRINCIPAL") redirect("/dashboard")

  const today = new Date().toLocaleDateString("ar-SA", {
    year: "numeric", month: "long", day: "numeric",
  })

  const exports = [
    {
      id: "json",
      icon: <DatabaseBackup className="h-6 w-6 text-green-600" />,
      title: "نسخة احتياطية كاملة (JSON)",
      description:
        "جميع البيانات: الطلاب، الحلقات، المعلمون، سجلات الحضور، جلسات الحفظ، سجل السرد، سجل الرسائل، وفئات الرسائل.",
      href: "/api/backup/json",
      label: "تنزيل JSON",
      note: `تاريخ التصدير: ${today}`,
    },
    {
      id: "csv-attendance",
      icon: <FileSpreadsheet className="h-6 w-6 text-blue-600" />,
      title: "سجل الحضور الكامل (CSV)",
      description:
        "جميع سجلات الحضور لجميع الطلاب والحلقات منذ البداية — يمكن فتحه في Excel أو Google Sheets.",
      href: "/api/backup/csv?type=attendance",
      label: "تنزيل CSV",
      note: "يشمل: اسم الطالب، الحلقة، التاريخ، الحضور، الملاحظات",
    },
    {
      id: "csv-hifz",
      icon: <FileSpreadsheet className="h-6 w-6 text-purple-600" />,
      title: "سجل الحفظ والمراجعة الكامل (CSV)",
      description:
        "جميع إدخالات التلاوة (سبق، سبقي، منزل) لجميع الطلاب منذ البداية.",
      href: "/api/backup/csv?type=hifz",
      label: "تنزيل CSV",
      note: "يشمل: اسم الطالب، الحلقة، التاريخ، النوع، النطاق الصفحي، التقييم، الأخطاء",
    },
  ]

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">النسخ الاحتياطي والتصدير</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          صادر يوم {today} — تُولِّد هذه الروابط ملفات في اللحظة ذاتها من بيانات قاعدة البيانات الحالية.
        </p>
      </div>

      {/* Notice */}
      <div className="flex gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-medium">ملاحظة حول النسخ الاحتياطية</p>
          <p>
            هذه الأدوات تُصدِّر نسخة فورية من البيانات. للنسخ الاحتياطي الكامل على مستوى قاعدة
            البيانات، استخدم الأمر{" "}
            <code className="bg-amber-100 px-1 rounded text-xs" dir="ltr">
              pg_dump $DATABASE_URL &gt; backup.sql
            </code>
            . يوصى بالتشغيل الأسبوعي أو الاستفادة من النسخ الاحتياطية التلقائية لـ Neon.
          </p>
        </div>
      </div>

      {/* Export cards */}
      <div className="space-y-4">
        {exports.map((exp) => (
          <Card key={exp.id}>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                {exp.icon}
                <CardTitle className="text-base">{exp.title}</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">{exp.description}</p>
              <p className="text-xs text-muted-foreground/70">{exp.note}</p>
              <a href={exp.href} download>
                <Button className="gap-2 min-h-[44px]" variant="outline">
                  <Download className="h-4 w-4" />
                  {exp.label}
                </Button>
              </a>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* pg_dump hint */}
      <Card className="border-dashed">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">نسخ احتياطي لقاعدة البيانات (للمطوّرين)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>للحصول على نسخة احتياطية كاملة يمكن استعادتها بالكامل، نفِّذ هذا الأمر:</p>
          <code className="block bg-muted rounded-md p-3 text-xs font-mono" dir="ltr">
            pg_dump $DATABASE_URL &gt; backup-$(date +%Y-%m-%d).sql
          </code>
          <p>
            أو استخدم لوحة تحكم Neon لتنزيل نسخة احتياطية مباشرة من{" "}
            <span className="font-medium">console.neon.tech</span>.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

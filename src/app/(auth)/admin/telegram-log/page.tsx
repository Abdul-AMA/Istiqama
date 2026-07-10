import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { Badge } from "@/components/ui/badge"

export default async function TelegramLogPage() {
  const session = await auth()
  if (session?.user?.role !== "PRINCIPAL") redirect("/dashboard")

  const rows = await prisma.rawTelegramMessage.findMany({
    where: { OR: [{ parsed: false }, { parseError: { not: null } }] },
    orderBy: { receivedAt: "desc" },
    take: 200,
    select: { id: true, chatId: true, rawText: true, parsed: true, parseError: true, receivedAt: true },
  })

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">سجل رسائل تيليجرام غير المعالجة</h1>
        <p className="text-muted-foreground mt-1">
          عرض تشخيصي فقط — الرسائل التي لم تُعالج بنجاح أو حدثت فيها مشكلة أثناء المعالجة
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="text-center py-16 text-muted-foreground">لا توجد رسائل بها مشاكل حالياً</p>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <div key={r.id} className="rounded-xl border bg-card p-4 space-y-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-xs text-muted-foreground">
                  {r.receivedAt.toLocaleString("ar-EG")} — chat {r.chatId.toString()}
                </span>
                <Badge className={r.parsed ? "bg-yellow-100 text-yellow-800 border-yellow-200" : "bg-red-100 text-red-800 border-red-200"}>
                  {r.parsed ? "معالجة جزئياً" : "لم تُعالَج"}
                </Badge>
              </div>
              <p className="text-sm font-mono break-all bg-muted rounded-md p-2">{r.rawText}</p>
              {r.parseError && (
                <p className="text-sm text-destructive break-all">{r.parseError}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

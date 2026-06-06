import { auth, signOut } from "@/auth"
import { redirect } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default async function HomePage() {
  const session = await auth()
  if (!session) redirect("/login")

  const roleLabel =
    session.user.role === "PRINCIPAL" ? "مدير" : "معلم"

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md text-center shadow-lg">
        <CardHeader>
          <div className="text-5xl mb-2">🕌</div>
          <CardTitle className="text-2xl font-bold">مرحباً بك في استقامة</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-muted rounded-lg p-4 text-right space-y-1">
            <p className="text-sm text-muted-foreground">الاسم</p>
            <p className="font-semibold">{session.user.name}</p>
            <p className="text-sm text-muted-foreground mt-2">الصلاحية</p>
            <p className="font-semibold">{roleLabel}</p>
          </div>

          <form
            action={async () => {
              "use server"
              await signOut({ redirectTo: "/login" })
            }}
          >
            <Button variant="outline" className="w-full">
              تسجيل الخروج
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}

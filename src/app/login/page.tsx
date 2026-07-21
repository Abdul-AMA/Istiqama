"use client"

import { useState } from "react"
import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input }  from "@/components/ui/input"
import { Label }  from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { useRouteLoading } from "@/components/route-loading"
import { toast }  from "sonner"

export default function LoginPage() {
  const router = useRouter()
  const { start, stop } = useRouteLoading()
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    start()

    const form     = new FormData(e.currentTarget)
    const email    = form.get("email")    as string
    const password = form.get("password") as string

    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
    })

    setLoading(false)

    if (res?.error) {
      stop()
      toast.error("بيانات الدخول غير صحيحة. يرجى المحاولة مجدداً.")
      return
    }

    router.push("/")
    router.refresh()
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-sm shadow-lg">
        <CardHeader className="text-center pb-2">
          <Image
            src="/icons/icon-192.png"
            alt="استقامة"
            width={72}
            height={72}
            priority
            className="mx-auto mb-3"
          />
          <CardTitle className="text-2xl font-bold tracking-wide">استقامة</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">نظام إدارة حلقات القرآن الكريم</p>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="email">البريد الإلكتروني</Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                placeholder="admin@istiqama.app"
                dir="ltr"
                className="text-right"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="password">كلمة المرور</Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                placeholder="••••••••"
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "جارٍ الدخول…" : "تسجيل الدخول"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}

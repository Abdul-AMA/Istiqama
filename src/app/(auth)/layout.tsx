import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { MainNav } from "@/components/main-nav"

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session) redirect("/login")

  return (
    <div className="min-h-screen">
      <MainNav role={session.user.role!} userName={session.user.name!} />
      {/* Push content right on desktop to account for fixed sidebar */}
      <main className="md:mr-60 min-h-screen bg-background">
        {children}
      </main>
    </div>
  )
}

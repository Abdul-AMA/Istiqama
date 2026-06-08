import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { MainNav } from "@/components/main-nav"
import { SyncManager } from "@/components/sync-manager"
import { CacheWarmer } from "@/components/cache-warmer"
import { InstallPrompt } from "@/components/install-prompt"

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session) redirect("/login")

  const role = session.user.role!

  return (
    <div className="min-h-screen">
      <MainNav role={role} userName={session.user.name!} />
      {role === "TEACHER" && (
        <>
          <SyncManager />
          <CacheWarmer />
        </>
      )}
      <main className="md:mr-60 min-h-screen bg-background">
        {children}
      </main>
      <InstallPrompt role={role} />
    </div>
  )
}

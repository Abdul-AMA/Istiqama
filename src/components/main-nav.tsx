"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
import { signOut } from "next-auth/react"
import {
  LayoutDashboard,
  BookOpen,
  UserCog,
  UserCheck,
  LogOut,
  Menu,
  X,
  GraduationCap,
  CalendarDays,
  ClipboardList,
  MessageSquare,
  FileText,
  Tags,
  DatabaseBackup,
  BarChart3,
  FileDown,
  AlertTriangle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import { cn } from "@/lib/utils"
import { SyncStatus } from "@/components/sync-status"
import { OfflineReadiness } from "@/components/offline-readiness"

type NavItem = {
  label: string
  href:  string
  icon:  React.ReactNode
}

const principalNav: NavItem[] = [
  { label: "الرئيسية",       href: "/dashboard",  icon: <LayoutDashboard className="h-5 w-5" /> },
  { label: "الجلسة اليومية", href: "/daily",      icon: <ClipboardList className="h-5 w-5" /> },
  { label: "التقويم",        href: "/calendar",   icon: <CalendarDays className="h-5 w-5" /> },
  { label: "الحلقات",        href: "/classes",    icon: <BookOpen className="h-5 w-5" /> },
  { label: "الطلاب",         href: "/students",   icon: <GraduationCap className="h-5 w-5" /> },
  { label: "الجدول",         href: "/timetable",  icon: <CalendarDays className="h-5 w-5" /> },
  { label: "الرسائل",         href: "/messages",    icon: <MessageSquare className="h-5 w-5" /> },
  { label: "التقارير",        href: "/report",      icon: <BarChart3 className="h-5 w-5" /> },
  { label: "كشف الدرجات",    href: "/report-cards", icon: <FileText className="h-5 w-5" /> },
  { label: "المعلمون",       href: "/admin/users", icon: <UserCog className="h-5 w-5" /> },
  { label: "الضيوف",         href: "/admin/guests", icon: <UserCheck className="h-5 w-5" /> },
  { label: "فئات الرسائل",   href: "/admin/message-categories", icon: <Tags className="h-5 w-5" /> },
  { label: "النسخ الاحتياطي", href: "/admin/backup",             icon: <DatabaseBackup className="h-5 w-5" /> },
  { label: "نموذج غير متصل",  href: "/admin/offline-form",       icon: <FileDown className="h-5 w-5" /> },
  { label: "سجل تيليجرام",    href: "/admin/telegram-log",       icon: <AlertTriangle className="h-5 w-5" /> },
]

const teacherNav: NavItem[] = [
  { label: "الرئيسية",       href: "/dashboard",  icon: <LayoutDashboard className="h-5 w-5" /> },
  { label: "الجلسة اليومية", href: "/daily",      icon: <ClipboardList className="h-5 w-5" /> },
  { label: "التقويم",        href: "/calendar",   icon: <CalendarDays className="h-5 w-5" /> },
  { label: "حلقاتي",         href: "/classes",    icon: <BookOpen className="h-5 w-5" /> },
  { label: "الطلاب",         href: "/students",   icon: <GraduationCap className="h-5 w-5" /> },
  { label: "الجدول",         href: "/timetable",  icon: <CalendarDays className="h-5 w-5" /> },
  { label: "الرسائل",        href: "/messages",   icon: <MessageSquare className="h-5 w-5" /> },
  { label: "التقارير",       href: "/report",     icon: <BarChart3 className="h-5 w-5" /> },
  { label: "كشف الدرجات",   href: "/report-cards", icon: <FileText className="h-5 w-5" /> },
  { label: "نموذج غير متصل", href: "/teacher/offline-form", icon: <FileDown className="h-5 w-5" /> },
]

type Props = {
  role: string
  userName: string
}

function NavLinks({ items, pathname, onClose }: { items: NavItem[]; pathname: string; onClose?: () => void }) {
  return (
    <nav className="flex flex-col gap-1">
      {items.map((item) => {
        const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href))
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onClose}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
              active
                ? "bg-green-100 text-green-800"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {item.icon}
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}

export function MainNav({ role, userName }: Props) {
  const pathname  = usePathname()
  const [open, setOpen] = useState(false)
  const items     = role === "PRINCIPAL" ? principalNav : teacherNav

  const handleSignOut = () => signOut({ callbackUrl: "/login" })

  const SidebarContent = ({ onClose }: { onClose?: () => void }) => (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-3 py-4 border-b">
        <span className="text-2xl">🕌</span>
        <span className="font-bold text-lg text-green-700">استقامة</span>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        <NavLinks items={items} pathname={pathname} onClose={onClose} />
      </div>

      <div className="border-t p-3 space-y-2">
        {role === "TEACHER" && <OfflineReadiness />}
        <SyncStatus role={role} />
        <div className="px-3 py-2">
          <p className="text-sm font-medium truncate">{userName}</p>
          <p className="text-xs text-muted-foreground">
            {role === "PRINCIPAL" ? "مدير" : "معلم"}
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-destructive hover:text-destructive gap-2"
          onClick={handleSignOut}
        >
          <LogOut className="h-4 w-4" />
          تسجيل الخروج
        </Button>
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-60 border-l bg-card shadow-sm fixed inset-y-0 right-0 z-30">
        <SidebarContent />
      </aside>

      {/* Mobile header */}
      <header className="md:hidden flex items-center justify-between px-4 py-3 border-b bg-card sticky top-0 z-30">
        <div className="flex items-center gap-2">
          <span className="text-xl">🕌</span>
          <span className="font-bold text-green-700">استقامة</span>
        </div>
        <Button variant="ghost" size="icon" onClick={() => setOpen(true)}>
          <Menu className="h-5 w-5" />
        </Button>

        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent side="right" className="w-64 p-0">
            <div className="absolute top-3 left-3">
              <Button variant="ghost" size="icon" onClick={() => setOpen(false)}>
                <X className="h-5 w-5" />
              </Button>
            </div>
            <div className="pt-12">
              <SidebarContent onClose={() => setOpen(false)} />
            </div>
          </SheetContent>
        </Sheet>
      </header>
    </>
  )
}

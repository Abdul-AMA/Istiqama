import type { Metadata } from "next"
import { Cairo } from "next/font/google"
import { Toaster } from "@/components/ui/sonner"
import { cn } from "@/lib/utils"
import "./globals.css"

// Cairo covers both Arabic and Latin — no need for a separate Latin font
const cairo = Cairo({
  subsets:  ["arabic", "latin"],
  variable: "--font-sans",
  display:  "swap",
})

export const metadata: Metadata = {
  title:       "استقامة",
  description: "نظام إدارة حلقات القرآن الكريم",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" className={cn("font-sans", cairo.variable)}>
      <body className="min-h-screen bg-background antialiased">
        {children}
        <Toaster richColors position="top-center" />
      </body>
    </html>
  )
}

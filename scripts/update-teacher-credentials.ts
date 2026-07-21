// One-time swap of teacher login credentials (email + password) to the
// final list the center wants distributed, from
// /home/abood/Documents/falah-credentials.csv (name, email, plaintext
// password columns). Matches teachers by exact fullName against the 26
// existing TEACHER users.
//
// Run with: pnpm exec tsx scripts/update-teacher-credentials.ts

import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"
import { readFileSync } from "fs"

const prisma = new PrismaClient()
const CSV_PATH = "/home/abood/Documents/falah-credentials.csv"

function parseCsv(text: string): { name: string; email: string; password: string }[] {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean)
  const [, ...rows] = lines // skip header
  return rows.map((line) => {
    const [name, email, password] = line.split(",")
    return { name: name.trim(), email: email.trim(), password: password.trim() }
  })
}

async function main() {
  const rows = parseCsv(readFileSync(CSV_PATH, "utf-8"))
  console.log(`📥 Loaded ${rows.length} credential rows`)

  const teachers = await prisma.user.findMany({
    where: { role: "TEACHER" },
    select: { id: true, fullName: true, email: true },
  })
  const teacherByName = new Map(teachers.map((t) => [t.fullName.trim(), t]))

  const emails = rows.map((r) => r.email)
  if (new Set(emails).size !== emails.length) {
    console.error("❌ Duplicate emails found in CSV — aborting")
    process.exit(1)
  }

  let updated = 0
  const unmatched: string[] = []

  for (const row of rows) {
    const teacher = teacherByName.get(row.name)
    if (!teacher) {
      unmatched.push(row.name)
      continue
    }

    const conflict = await prisma.user.findFirst({ where: { email: row.email, NOT: { id: teacher.id } } })
    if (conflict) {
      console.error(`❌ Email "${row.email}" (for "${row.name}") already used by another user — skipped`)
      continue
    }

    const passwordHash = await bcrypt.hash(row.password, 12)
    await prisma.user.update({
      where: { id: teacher.id },
      data: { email: row.email, passwordHash },
    })
    updated++
  }

  console.log(`✅ Updated credentials for ${updated} teachers`)
  if (unmatched.length) {
    console.log(`\n⚠️  ${unmatched.length} unmatched CSV row(s) (no teacher found by name):`)
    unmatched.forEach((n) => console.log("   " + n))
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())

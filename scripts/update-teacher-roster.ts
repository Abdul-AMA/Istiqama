// One-time backfill of teacher roster fields (نسخة "المحفظين" sheet in
// "Falah all students 2026.xlsx") onto the 26 teacher Users + their Classes
// that were already imported by scripts/import-falah.ts.
//
// Input: scratchpad/falah-teachers.json — a plain array dump of the
// "المحفظين" sheet rows (raw spreadsheet values), produced by a one-off
// Python/openpyxl extraction — see the conversation for the extraction
// script.
//
// Matches teachers by exact fullName (confirmed 1:1 against the 26
// existing TEACHER users before running). Only fills the new roster
// columns — does not touch fullName/email/phone/password.
//
// Run with: pnpm exec tsx scripts/update-teacher-roster.ts

import { PrismaClient } from "@prisma/client"
import { readFileSync } from "fs"

const prisma = new PrismaClient()

const DATA_PATH = "/tmp/claude-1000/-home-abood-coding-Istiqama/3057a6fd-4b6d-4582-a150-bb8450099775/scratchpad/falah-teachers.json"

type RawRow = {
  "الاسم باعي": string
  "رقم الهوية": number | string | null
  "تاريخ الميلاد": string | null
  "الحالة الاجتماعية ": string | null
  "عدد أفراد الأسرة": number | string | null
  "مصدر الدخل": string | null
  "المؤهل العلمي": string | null
  "المرحلة": string | null
  "طبيعة العمل في الملف ": string | null
  "عدد طلاب الحلقة": number | string | null
  "جهة إحتساب حلقة المعلم": string | null
}

function parseNationalId(raw: number | string | null): string | null {
  if (raw == null) return null
  if (typeof raw === "number") return String(Math.round(raw))
  const s = raw.trim()
  return s || null
}

function parseInt0(raw: number | string | null): number | null {
  if (raw == null) return null
  const n = typeof raw === "number" ? raw : parseFloat(raw)
  return Number.isNaN(n) ? null : Math.round(n)
}

function parseDate(raw: string | null): Date | null {
  if (raw == null) return null
  const s = raw.trim()
  if (!s) return null

  // ISO (already normalized by the extraction script for real datetime cells)
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (iso) {
    const [, y, m, d] = iso
    return new Date(Date.UTC(parseInt(y, 10), parseInt(m, 10) - 1, parseInt(d, 10)))
  }

  // Textual "DD/MM/YYYY" (cells stored as plain text in the sheet)
  const m = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/)
  if (m) {
    let [, a, b, year] = m
    let day = parseInt(a, 10)
    let month = parseInt(b, 10)
    if (month > 12 && day <= 12) { [day, month] = [month, day] }
    if (month < 1 || month > 12 || day < 1 || day > 31) return null
    return new Date(Date.UTC(parseInt(year, 10), month - 1, day))
  }

  return null
}

function nonEmpty(s: string | null): string | null {
  if (s == null) return null
  const t = s.trim()
  return t || null
}

async function main() {
  const rows = JSON.parse(readFileSync(DATA_PATH, "utf-8")) as RawRow[]
  console.log(`📥 Loaded ${rows.length} teacher roster rows`)

  const teachers = await prisma.user.findMany({
    where: { role: "TEACHER" },
    select: { id: true, fullName: true, classes: { select: { id: true }, orderBy: { createdAt: "asc" } } },
  })
  const teacherByName = new Map(teachers.map((t) => [t.fullName.trim(), t]))

  let updated = 0
  let classesUpdated = 0
  const unmatched: string[] = []
  const dateAnomalies: string[] = []

  for (const row of rows) {
    const name = row["الاسم باعي"]?.trim()
    if (!name) continue

    const teacher = teacherByName.get(name)
    if (!teacher) {
      unmatched.push(name)
      continue
    }

    const dob = parseDate(row["تاريخ الميلاد"])
    if (row["تاريخ الميلاد"] && !dob) dateAnomalies.push(`"${name}": unparsed dateOfBirth "${row["تاريخ الميلاد"]}"`)

    await prisma.user.update({
      where: { id: teacher.id },
      data: {
        nationalId:    parseNationalId(row["رقم الهوية"]),
        dateOfBirth:   dob,
        maritalStatus: nonEmpty(row["الحالة الاجتماعية "]),
        familySize:    parseInt0(row["عدد أفراد الأسرة"]),
        incomeSource:  nonEmpty(row["مصدر الدخل"]),
        qualification: nonEmpty(row["المؤهل العلمي"]),
        teachingStage: nonEmpty(row["المرحلة"]),
        roleTitle:     nonEmpty(row["طبيعة العمل في الملف "]),
      },
    })
    updated++

    const fundingBody = nonEmpty(row["جهة إحتساب حلقة المعلم"])
    const rosterCapacity = parseInt0(row["عدد طلاب الحلقة"])
    if ((fundingBody || rosterCapacity != null) && teacher.classes[0]) {
      await prisma.class.update({
        where: { id: teacher.classes[0].id },
        data: {
          fundingBody,
          ...(rosterCapacity != null ? { capacity: rosterCapacity } : {}),
        },
      })
      classesUpdated++
    }
  }

  console.log(`✅ Updated ${updated} teachers, ${classesUpdated} classes`)
  if (unmatched.length) {
    console.log(`\n⚠️  ${unmatched.length} unmatched roster row(s) (no teacher found by name):`)
    unmatched.forEach((n) => console.log("   " + n))
  }
  if (dateAnomalies.length) {
    console.log(`\n⚠️  ${dateAnomalies.length} unparsed date(s) (left null):`)
    dateAnomalies.forEach((a) => console.log("   " + a))
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())

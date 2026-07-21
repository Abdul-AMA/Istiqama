// One-time import of the real Falah center roster (teachers + halaqas +
// students) from the extracted spreadsheet data. Run AFTER scripts/wipe-demo.ts
// and after the roster-fields migration has been applied.
//
// Input: scratchpad/falah-data.json (produced by extracting
// "Falah all students 2026.xlsx" — see the conversation for the extraction
// script; it's a plain { students: [...], teachers: [...] } JSON dump of the
// two sheets, values as raw spreadsheet strings).
//
// Output: creates User+Class rows for each teacher, Student rows for each
// student (linked to their teacher's halaqa when a match exists), and writes
// a plaintext credentials CSV to /home/abood/Documents/falah-credentials.csv
// (kept outside the repo — contains real passwords).
//
// Run with: pnpm exec tsx scripts/import-falah.ts

import { PrismaClient, Gender } from "@prisma/client"
import bcrypt from "bcryptjs"
import { readFileSync, writeFileSync } from "fs"

const prisma = new PrismaClient()

const DATA_PATH = "/tmp/claude-1000/-home-abood-coding-Istiqama/1e6a4331-94d2-4f7b-beac-3f1f8eb350a8/scratchpad/falah-data.json"
const CREDENTIALS_PATH = "/home/abood/Documents/falah-credentials.csv"

type RawStudent = {
  fullName: string
  nationalId: string | null
  secondaryPhone: string | null
  guardianPhone: string | null
  dateOfBirth: string | null
  teacherName: string
  educationStage: string | null
  familySize: string | null
  tajweedLevel: string | null
  previousHifzPages: string | null
  schoolGrade: string | null
  commitmentLevel: string | null
  residencyStatus: string | null
  neighborhood: string | null
  guardianOccupation: string | null
}

type RawTeacher = {
  fullName: string
  phone: string | null
  sponsorship: string | null
}

// ── Normalization helpers ───────────────────────────────────────────────

function normalizePhone(raw: string | null): string | null {
  if (raw == null) return null
  let s = String(raw).trim()
  if (s === "" || s === "-" || s === "لا يوجد" || s === "لايوجد") return null

  // Scientific-notation / float strings from xlsx (e.g. "5.95735757E8")
  if (/^\d+\.\d+[eE][+-]?\d+$/.test(s) || /^\d+\.\d+$/.test(s)) {
    const n = Math.round(parseFloat(s))
    if (!Number.isNaN(n)) s = String(n)
  }

  let digits = s.replace(/\D/g, "")
  if (!digits) return null
  if (digits.startsWith("00")) digits = digits.slice(2)

  if (digits.startsWith("972") || digits.startsWith("970")) {
    if (digits.length === 12) return "+" + digits
    return null
  }
  if (digits.startsWith("0") && digits.length === 10) return "+972" + digits.slice(1)
  if (digits.length === 9 && digits.startsWith("5")) return "+972" + digits

  return null
}

function parseNationalId(raw: string | null): string | null {
  if (raw == null) return null
  const s = String(raw).trim()
  if (!s) return null
  if (/^\d+\.\d+[eE][+-]?\d+$/.test(s) || /^\d+\.\d+$/.test(s)) {
    const n = Math.round(parseFloat(s))
    if (!Number.isNaN(n)) return String(n)
  }
  return s
}

function excelSerialToDate(n: number): Date {
  // Excel epoch is 1899-12-30 (accounts for the 1900 leap-year bug)
  const ms = Date.UTC(1899, 11, 30) + n * 86400000
  return new Date(ms)
}

function parseDate(raw: string | null): Date | null {
  if (raw == null) return null
  const s = String(raw).trim()
  if (!s) return null

  // Plain Excel serial (possibly "41857.0")
  if (/^\d+(\.\d+)?$/.test(s)) {
    const n = parseFloat(s)
    if (!Number.isNaN(n) && n > 0) return excelSerialToDate(n)
    return null
  }

  // Textual date like "27-2-2008", "03/19/2013", "29/2/2019"
  const m = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/)
  if (m) {
    let [, a, b, year] = m
    let day = parseInt(a, 10)
    let month = parseInt(b, 10)
    // If the first part can't be a valid month, it must be day-first; if the
    // second part can't be a valid month, the first part must be the month.
    if (month > 12 && day <= 12) { [day, month] = [month, day] }
    if (month < 1 || month > 12 || day < 1 || day > 31) return null
    const d = new Date(Date.UTC(parseInt(year, 10), month - 1, day))
    return d
  }

  return null
}

// Arabic → Latin transliteration for generating email local-parts. Best
// effort only — not linguistically perfect, just deterministic and unique
// enough for login purposes.
const AR_MAP: Record<string, string> = {
  "ا": "a", "أ": "a", "إ": "i", "آ": "a", "ى": "a", "ئ": "y", "ؤ": "w", "ء": "a",
  "ب": "b", "ت": "t", "ث": "th", "ج": "j", "ح": "h", "خ": "kh", "د": "d", "ذ": "th",
  "ر": "r", "ز": "z", "س": "s", "ش": "sh", "ص": "s", "ض": "d", "ط": "t", "ظ": "z",
  "ع": "a", "غ": "gh", "ف": "f", "ق": "q", "ك": "k", "ل": "l", "م": "m", "ن": "n",
  "ه": "h", "و": "w", "ي": "y", "ة": "a",
}

function transliterate(word: string): string {
  let out = ""
  for (const ch of word) out += AR_MAP[ch] ?? ""
  return out
}

function emailLocalPart(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).slice(0, 2) // first + father's name
  return parts.map(transliterate).filter(Boolean).join(".") || "teacher"
}

function easyPassword(seq: number): string {
  return `falah${String(seq).padStart(3, "0")}`
}

// ── Main ─────────────────────────────────────────────────────────────────

async function main() {
  const raw = JSON.parse(readFileSync(DATA_PATH, "utf-8")) as {
    students: RawStudent[]
    teachers: RawTeacher[]
  }

  console.log(`📥 Loaded ${raw.teachers.length} teachers, ${raw.students.length} students from source data`)

  const phoneAnomalies: string[] = []
  const dateAnomalies: string[] = []
  const usedEmails = new Set<string>()
  const credentials: { name: string; email: string; password: string }[] = []
  const classIdByTeacherName = new Map<string, string>()

  // ── Teachers + one halaqa each ──────────────────────────────────────────
  let seq = 1
  for (const t of raw.teachers) {
    let local = emailLocalPart(t.fullName)
    let email = `${local}@falah.ps`
    let n = 2
    while (usedEmails.has(email)) {
      email = `${local}${n}@falah.ps`
      n++
    }
    usedEmails.add(email)

    const password = easyPassword(seq)
    const passwordHash = await bcrypt.hash(password, 12)
    const phone = normalizePhone(t.phone)
    if (t.phone && !phone) phoneAnomalies.push(`teacher "${t.fullName}": unparsed phone "${t.phone}"`)

    const user = await prisma.user.create({
      data: {
        fullName: t.fullName,
        email,
        phone,
        passwordHash,
        role: "TEACHER",
        isActive: true,
      },
    })

    const cls = await prisma.class.create({
      data: {
        name: `حلقة ${t.fullName}`,
        teacherId: user.id,
        sponsorship: t.sponsorship || null,
        status: "ACTIVE",
      },
    })

    classIdByTeacherName.set(t.fullName.trim(), cls.id)
    credentials.push({ name: t.fullName, email, password })
    seq++
  }
  console.log(`✅ Created ${raw.teachers.length} teachers + halaqas`)

  // ── Students ─────────────────────────────────────────────────────────────
  let linked = 0
  let unassigned = 0
  let unmatched = 0
  for (const s of raw.students) {
    const classId = s.teacherName ? classIdByTeacherName.get(s.teacherName.trim()) ?? null : null
    if (s.teacherName && !classId) {
      unmatched++
      console.warn(`⚠️  student "${s.fullName}": teacher name "${s.teacherName}" did not match any imported teacher — importing unassigned`)
    } else if (classId) {
      linked++
    } else {
      unassigned++
    }

    const guardianPhone = normalizePhone(s.guardianPhone)
    if (s.guardianPhone && !guardianPhone) phoneAnomalies.push(`student "${s.fullName}": unparsed guardianPhone "${s.guardianPhone}"`)
    const secondaryPhone = normalizePhone(s.secondaryPhone)
    if (s.secondaryPhone && !secondaryPhone) phoneAnomalies.push(`student "${s.fullName}": unparsed secondaryPhone "${s.secondaryPhone}"`)

    const dob = parseDate(s.dateOfBirth)
    if (s.dateOfBirth && !dob) dateAnomalies.push(`student "${s.fullName}": unparsed dateOfBirth "${s.dateOfBirth}"`)

    const familySize = s.familySize ? Math.round(parseFloat(s.familySize)) : null

    await prisma.student.create({
      data: {
        fullName: s.fullName,
        gender: Gender.MALE,
        dateOfBirth: dob,
        nationalId: parseNationalId(s.nationalId),
        schoolGrade: s.schoolGrade,
        neighborhood: s.neighborhood,
        guardianPhone,
        secondaryPhone,
        guardianOccupation: s.guardianOccupation,
        educationStage: s.educationStage,
        familySize: familySize && !Number.isNaN(familySize) ? familySize : null,
        tajweedLevel: s.tajweedLevel,
        commitmentLevel: s.commitmentLevel,
        residencyStatus: s.residencyStatus,
        classId,
        status: "ACTIVE",
      },
    })
  }
  console.log(`✅ Created ${raw.students.length} students (${linked} linked, ${unassigned} unassigned, ${unmatched} unmatched-teacher-name)`)

  // ── Credentials CSV ──────────────────────────────────────────────────────
  const csv = ["الاسم,البريد الإلكتروني,كلمة المرور", ...credentials.map((c) => `"${c.name}",${c.email},${c.password}`)].join("\n")
  writeFileSync(CREDENTIALS_PATH, csv, "utf-8")
  console.log(`🔑 Credentials written to ${CREDENTIALS_PATH} — keep this file private, delete after distributing to teachers`)

  // ── Anomaly report ───────────────────────────────────────────────────────
  if (phoneAnomalies.length > 0) {
    console.log(`\n⚠️  ${phoneAnomalies.length} unparsed phone number(s) (left null):`)
    phoneAnomalies.forEach((a) => console.log("   " + a))
  }
  if (dateAnomalies.length > 0) {
    console.log(`\n⚠️  ${dateAnomalies.length} unparsed date(s) (left null):`)
    dateAnomalies.forEach((a) => console.log("   " + a))
  }

  console.log("\n✅ Import complete.")
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())

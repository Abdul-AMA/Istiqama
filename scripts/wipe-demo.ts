// One-time cleanup: removes all demo/seed data before importing the real
// Falah center roster. Keeps the principal account, the 114-surah reference
// table, and the default message-category templates.
//
// Run with: pnpm exec tsx scripts/wipe-demo.ts

import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function counts() {
  const [users, principals, classes, students, att, hifz, rec, sard, msg, raw, cats, surahs] =
    await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { role: "PRINCIPAL" } }),
      prisma.class.count(),
      prisma.student.count(),
      prisma.attendanceRecord.count(),
      prisma.hifzSession.count(),
      prisma.recitationEntry.count(),
      prisma.sardRecord.count(),
      prisma.messageLog.count(),
      prisma.rawTelegramMessage.count(),
      prisma.messageCategory.count(),
      prisma.surah.count(),
    ])
  return { users, principals, classes, students, att, hifz, rec, sard, msg, raw, cats, surahs }
}

async function main() {
  console.log("📊 Before:", await counts())

  console.log("🗑  Deleting recitation entries…")
  await prisma.recitationEntry.deleteMany({})
  console.log("🗑  Deleting message logs…")
  await prisma.messageLog.deleteMany({})
  console.log("🗑  Deleting attendance records…")
  await prisma.attendanceRecord.deleteMany({})
  console.log("🗑  Deleting sard records…")
  await prisma.sardRecord.deleteMany({})
  console.log("🗑  Deleting hifz sessions…")
  await prisma.hifzSession.deleteMany({})
  console.log("🗑  Deleting raw telegram messages…")
  await prisma.rawTelegramMessage.deleteMany({})
  console.log("🗑  Deleting schedule slots…")
  await prisma.scheduleSlot.deleteMany({})
  console.log("🗑  Deleting students…")
  await prisma.student.deleteMany({})
  console.log("🗑  Deleting classes…")
  await prisma.class.deleteMany({})
  console.log("🗑  Deleting non-principal users…")
  await prisma.user.deleteMany({ where: { role: { not: "PRINCIPAL" } } })

  const after = await counts()
  console.log("📊 After:", after)

  if (after.users !== after.principals) {
    console.error("❌ Unexpected: non-principal users remain")
    process.exit(1)
  }
  if (after.classes !== 0 || after.students !== 0) {
    console.error("❌ Unexpected: classes or students remain")
    process.exit(1)
  }
  if (after.surahs !== 114) {
    console.error("❌ Unexpected: surah count changed —", after.surahs)
    process.exit(1)
  }

  console.log("✅ Demo data wiped. Principal, surahs, and message categories kept.")
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())

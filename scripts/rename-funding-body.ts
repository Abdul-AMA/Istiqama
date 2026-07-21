// One-time rename of Class.fundingBody values to match the new fixed lookup
// list used by the classes form (وزارة الاوقاف و الشؤون الدينية / دار
// القرآن الكريم والسنة / اخرى). The roster import used the short "أوقاف"
// label; renaming it to the full official name so existing classes still
// match an option in the new dropdown instead of showing blank.
//
// Run with: pnpm exec tsx scripts/rename-funding-body.ts

import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()

async function main() {
  const { count } = await prisma.class.updateMany({
    where: { fundingBody: "أوقاف" },
    data: { fundingBody: "وزارة الاوقاف و الشؤون الدينية" },
  })
  console.log(`✅ Renamed fundingBody on ${count} class(es)`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())

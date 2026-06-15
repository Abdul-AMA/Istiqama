import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()
async function main() {
  const users = await prisma.user.findMany({ select: { email: true, fullName: true, role: true, isActive: true }, orderBy: { role: "asc" } })
  console.table(users)
}
main().finally(() => prisma.$disconnect())

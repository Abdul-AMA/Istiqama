/**
 * Runs `prisma migrate deploy` with Neon auto-suspend wakeup.
 *
 * Neon free-tier computes suspend after ~5 min of inactivity.
 * TCP connections (used by `prisma migrate deploy`) time out while
 * the compute wakes up (~5-10 s). This script uses Neon's HTTP driver
 * to wake the endpoint first, then runs the migration.
 */

import { neon } from "@neondatabase/serverless"
import { execSync } from "child_process"

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) {
  console.error("DATABASE_URL is not set")
  process.exit(1)
}

const MAX_ATTEMPTS = 6
const DELAY_MS = 5_000

async function wakeUp(): Promise<void> {
  const sql = neon(DATABASE_URL!)
  await sql`SELECT 1`
}

async function main() {
  console.log("⏳ Waking up Neon database…")

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      await wakeUp()
      console.log("✅ Database is awake")
      break
    } catch (err) {
      if (attempt === MAX_ATTEMPTS) {
        console.error("❌ Could not reach database after", MAX_ATTEMPTS, "attempts")
        throw err
      }
      console.log(`   Attempt ${attempt} failed — retrying in ${DELAY_MS / 1000}s…`)
      await new Promise((r) => setTimeout(r, DELAY_MS))
    }
  }

  console.log("📦 Running prisma migrate deploy…")
  execSync("npx prisma migrate deploy", { stdio: "inherit" })
  console.log("✅ Migrations applied")
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

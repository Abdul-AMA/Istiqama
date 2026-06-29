/*
 * Telegram webhook receiver — Phase 9a (raw storage only)
 *
 * SETUP REQUIRED AFTER DEPLOYMENT:
 *   After every deployment (the URL changes on preview deployments), register
 *   this endpoint with Telegram by calling setWebhook:
 *
 *     curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook" \
 *          -H "Content-Type: application/json" \
 *          -d '{"url": "https://<your-domain>/api/telegram/webhook"}'
 *
 *   Verify registration with getWebhookInfo:
 *     curl "https://api.telegram.org/bot<TOKEN>/getWebhookInfo"
 *
 * IMPORTANT INVARIANTS (see CLAUDE.md):
 *   - Raw message is stored FIRST, unconditionally, before any other logic.
 *   - This route ALWAYS returns 200 OK to Telegram. A non-200 triggers
 *     Telegram's retry mechanism and causes duplicate deliveries.
 */

import { type NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

const TELEGRAM_API = "https://api.telegram.org"

export async function POST(req: NextRequest) {
  let rawBody: unknown
  try {
    rawBody = await req.json()
  } catch {
    // Unparseable body — still return 200 so Telegram doesn't retry.
    return new NextResponse(null, { status: 200 })
  }

  const update = rawBody as {
    update_id?: number
    message?: {
      chat?: { id?: number }
      text?: string
    }
  }

  const updateId = update.update_id ?? null
  const chatId = update.message?.chat?.id ?? null
  const text = update.message?.text ?? null

  // ── Raw-storage-first: persist before anything else ──────────────────────
  // If there is no chatId or text, skip storage (not a message update).
  if (chatId == null || text == null) {
    return new NextResponse(null, { status: 200 })
  }

  await prisma.rawTelegramMessage.create({
    data: {
      telegramUpdateId: updateId != null ? BigInt(updateId) : null,
      chatId: BigInt(chatId),
      rawText: text,
    },
  })
  // ─────────────────────────────────────────────────────────────────────────

  // Everything after the raw insert is best-effort; errors are swallowed.
  try {
    const token = process.env.TELEGRAM_BOT_TOKEN
    if (!token) {
      console.error("[telegram/webhook] TELEGRAM_BOT_TOKEN is not set")
    } else {
      const res = await fetch(
        `${TELEGRAM_API}/bot${token}/sendMessage`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: "تم استلام رسالتك",
          }),
        }
      )
      if (!res.ok) {
        console.error(
          `[telegram/webhook] sendMessage failed: ${res.status}`,
          await res.text()
        )
      }
    }
  } catch (err) {
    console.error("[telegram/webhook] downstream error:", err)
  }

  return new NextResponse(null, { status: 200 })
}

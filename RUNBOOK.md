# Istiqama — Operations Runbook

Internal reference for the sole admin/operator. Not shown to teachers. Covers day-to-day operation and troubleshooting of the Telegram offline submission system (Phases 9–12, see `docs/02-implementation-phases.md` and `docs/telegram-architecture.md`).

---

## 1. Finding stuck or failed submissions

Every inbound Telegram message is stored in `RawTelegramMessage` before parsing (raw-storage-first — see CLAUDE.md). Rows worth checking:

- `parsed = false` → the message was never successfully processed (bad prefix, malformed payload, unknown teacher/halaqa, or a duplicate-day rejection).
- `parseError` not null → either a total parse failure, or a partial success where one or more student rows were skipped.

**Fastest way — the built-in admin page:**

```
/admin/telegram-log
```

(`src/app/(auth)/admin/telegram-log/page.tsx`, PRINCIPAL-only). Lists the 200 most recent rows where `parsed = false` OR `parseError IS NOT NULL`, newest first, with the raw text and error visible inline. Check here first before touching the database directly.

**Direct query (psql / Neon SQL console):**

```sql
SELECT id, "chatId", "receivedAt", parsed, "parseError", "rawText"
FROM "RawTelegramMessage"
WHERE parsed = false OR "parseError" IS NOT NULL
ORDER BY "receivedAt" DESC
LIMIT 50;
```

**Same thing via Prisma (one-off script, run with `pnpm exec tsx`):**

```ts
import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()
async function main() {
  const rows = await prisma.rawTelegramMessage.findMany({
    where: { OR: [{ parsed: false }, { parseError: { not: null } }] },
    orderBy: { receivedAt: "desc" },
    take: 50,
  })
  console.table(rows)
}
main().finally(() => prisma.$disconnect())
```

### What the common `parseError` values mean

These come from `src/lib/telegram/processIstqMessage.ts` and `src/lib/telegram/parsePayload.ts`:

| `parseError` (or reply text) | Meaning | What to do |
|---|---|---|
| `NO_PREFIX` (reply only, `parsed=false`, no error stored) | Message didn't start with `ISTQ\|` — not from the offline form at all | Nothing to do; likely a teacher testing the bot manually or a stray message |
| `صيغة الرسالة غير مكتملة` | Fewer than 3 `\|` delimiters found | The teacher's HTML page may be an old/corrupted version — ask them to redownload |
| `معرف المعلم أو الحلقة مفقود` | `teacher_id` or `halaqa_id` field was empty | Same as above — stale/broken generated page |
| `صيغة التاريخ غير صحيحة` | Date field isn't `YYYY-MM-DD` | Same as above |
| `unknown teacherId: <id>` | `teacher_id` in the payload doesn't exist in `User` | Teacher account may have been deleted after the page was generated — regenerate their page |
| `unknown halaqaId: <id>` | `halaqa_id` doesn't exist in `Class` | Halaqa was deleted/renamed — regenerate the page |
| `duplicate submission for halaqaId=... date=...` | An `AttendanceRecord` already exists for that halaqa+date — the one-submission-per-day lock rejected it | Expected behavior if the teacher already submitted today. Direct them to the website for corrections. If they *didn't* submit today, check `AttendanceRecord` for that date/halaqa — it may have been entered manually |
| Per-student reasons inside a comma-joined `parseError` (e.g. `abc123: الطالب غير موجود في هذه الحلقة`) | Partial success — some rows saved, these specific student rows didn't | `الطالب غير موجود في هذه الحلقة` = student isn't on the current roster (removed after the page was generated, or wrong halaqa). Other reasons come from `parseStudentBlock`/`parseHifzEntries` (bad attendance code, bad hifz format, invalid rating/page range) — usually a corrupted or hand-edited payload |
| `خطأ أثناء الحفظ` | `saveDailySessionCore` threw for this one student row | Check server logs (`console.error("[telegram] failed to save row", ...)`) for the underlying DB error |

A row with `parsed = true` and a `parseError` is a **partial success** — some students saved, others didn't. A row with `parsed = false` means **nothing was saved** for that message.

---

## 2. Reprocessing a raw message after fixing a parsing bug

Never hand-edit `AttendanceRecord`/`HifzSession` rows or hand-craft data to patch around a bug. Instead, re-run the real parser against the stored `rawText` after the bug fix is deployed.

1. Get the row's `id` and `rawText` from `/admin/telegram-log` or the SQL query above.
2. Confirm no `AttendanceRecord` was written for that `(halaqaId, date)` yet if you expect a full reprocess — `processIstqMessage` will refuse to write anything if the one-submission-per-day lock already sees a record for that day (see the `duplicate submission` case above). If a partial save already happened, only the still-missing student rows will actually write new records — already-saved students are not the lock's concern (the lock checks per halaqa+date, not per student), so re-running after a partial failure is safe as long as the original run didn't fully lock the day out via a *different* prior submission.
3. Run a one-off script (pattern matches `scripts/list-users.ts` — plain `tsx`, no CLI framework):

   ```ts
   // scripts/reprocess-telegram-message.ts
   import { PrismaClient } from "@prisma/client"
   import { processIstqMessage } from "../src/lib/telegram/processIstqMessage"

   const prisma = new PrismaClient()

   async function main() {
     const id = process.argv[2]
     if (!id) throw new Error("usage: tsx scripts/reprocess-telegram-message.ts <RawTelegramMessage id>")

     const row = await prisma.rawTelegramMessage.findUniqueOrThrow({ where: { id } })
     const result = await processIstqMessage(row.rawText)

     await prisma.rawTelegramMessage.update({
       where: { id },
       data: { parsed: result.parsed, parseError: result.parseError },
     })

     console.log("reply that would have been sent:", result.replyText)
     console.log("parsed:", result.parsed, "parseError:", result.parseError)
   }

   main().finally(() => prisma.$disconnect())
   ```

   Run it:
   ```
   pnpm exec tsx scripts/reprocess-telegram-message.ts <id>
   ```

   This is a temporary/throwaway script — write it when needed, delete after use, don't keep it committed unless reprocessing becomes a recurring need.

4. The teacher does **not** get a second Telegram reply from a manual reprocess (the script only prints what the reply would have been) — if the fix succeeded, tell them directly or have them check the website.

---

## 3. Re-registering the Telegram webhook after a deployment URL change

Every redeploy that changes the Vercel deployment URL breaks delivery until the webhook is re-registered. This is manual — there is no automation for it (CLAUDE.md non-negotiable).

`TELEGRAM_BOT_TOKEN` lives in Vercel env vars (Production + Development — see `.env.example`) and locally in `.env`/`.env.local`.

```bash
curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook" \
     -H "Content-Type: application/json" \
     -d '{"url": "https://<your-domain>/api/telegram/webhook"}'
```

Replace `<your-domain>` with the current production domain (custom domain if set, otherwise the `*.vercel.app` production alias — not a preview URL). Then verify with the health check in section 5 below.

Note: `/api/telegram/webhook` is explicitly excluded from the auth middleware matcher in `src/proxy.ts` (Telegram's servers carry no session cookie). If this route ever starts redirecting to `/login`, check that exclusion first before assuming it's a webhook registration problem.

---

## 4. Rotating the bot token if it's ever exposed

1. In Telegram, message **@BotFather** → `/mybots` → select the bot → **API Token** → **Revoke current token**. BotFather immediately invalidates the old token and issues a new one.
2. Update the token everywhere it's stored:
   - Vercel env vars: `TELEGRAM_BOT_TOKEN` (Production + Development)
   - Local `.env` and `.env.local`
   - Anywhere else it may have been pasted (password manager, notes) — remove the old value
3. Redeploy so the new env var takes effect.
4. Re-run `setWebhook` (section 3) with the new token — the old token's webhook registration is invalidated along with the token itself.
5. Confirm with `getWebhookInfo` (section 5) that the new registration is live.

---

## 5. Health check — is the bot currently receiving messages correctly?

```bash
curl "https://api.telegram.org/bot<TOKEN>/getWebhookInfo"
```

**Healthy response looks like:**
```json
{
  "ok": true,
  "result": {
    "url": "https://<your-domain>/api/telegram/webhook",
    "pending_update_count": 0,
    "last_error_message": null (or absent)
  }
}
```

**Signs of a problem:**
- `url` is empty, or doesn't match the current production domain → webhook was never registered, or was registered against a stale deployment URL. Fix with section 3.
- `pending_update_count` climbing / staying above 0 → Telegram is retrying deliveries because it isn't getting a 200 back, or the URL is unreachable. Since the webhook route always returns 200 even on internal errors (see `src/app/api/telegram/webhook/route.ts`), a nonzero count almost always means the URL itself is wrong or the deployment is down — check `/admin/telegram-log` won't help here since messages aren't even arriving; check Vercel deployment status instead.
- `last_error_message` present and recent → read it, it's usually self-explanatory (e.g. wrong URL, TLS issue, 4xx/5xx from the route).

A quick end-to-end sanity check: send any `ISTQ|...` test message to the bot yourself and confirm (a) a new row appears in `RawTelegramMessage`, and (b) you get a reply.

---

## 6. Old Dexie/IndexedDB/Background Sync system — status

**As of 2026-07-21: REMOVED.** A real end-to-end Telegram submission succeeded (attendance + surah/ayah-based حفظ/مراجعة data all saved correctly), which unblocked cleanup per `docs/03-operational-readiness.md` Section 0. `src/lib/db.ts`, `src/lib/sync.ts`, `src/components/sync-manager.tsx`, `src/components/sync-status.tsx`, `src/components/cache-warmer.tsx`, `src/components/offline-readiness.tsx`, `src/app/api/sync/guest-student/route.ts`, `src/app/api/sync/daily-session/route.ts`, and the `dexie` package are all gone. The daily-session page, guest-add dialog, and class roster no longer have any offline/queued-write code paths — they are online-only now, same as the rest of the app.

So: any future bug report mentioning a "غير متصل — N في الانتظار" indicator, a sync queue, or offline guest creation refers to a system that no longer exists — don't go looking for it in the current code.

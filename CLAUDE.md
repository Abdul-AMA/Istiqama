# Istiqama — Project Rules

## App
Quran center management system. Full spec in quran-center-requirements.md — read it before doing anything.

## Stack
- Next.js App Router, TypeScript
- Tailwind CSS + shadcn/ui (RTL configured)
- Prisma ORM + PostgreSQL (Neon)
- Auth.js credentials provider, bcrypt, JWT, server-side RBAC
- Vercel Blob — student photos only
- Groq API — AI parent messages, server-side only
- @react-pdf/renderer — Arabic RTL PDFs (embed Amiri font)
- Dexie.js — IndexedDB offline queue
- @ducanh2912/next-pwa — service worker + manifest
- Recharts — dashboards
- Telegram Bot API used for offline session submission (webhook-based, no polling)
- Raw-storage-first pattern: every inbound Telegram message is persisted to raw_telegram_messages BEFORE any parsing is attempted. This is non-negotiable — never parse-then-store.
- Telegram webhook route must respond 200 OK even on internal parse errors, to prevent Telegram's retry mechanism from re-delivering the same message repeatedly.
- After any redeploy that changes the Vercel deployment URL, the Telegram webhook MUST be re-registered via setWebhook. This is a manual operational step, not automated. See docs/telegram-architecture.md for the setWebhook call format.

## Non-negotiables
- root html element: dir="rtl" lang="ar" always
- RBAC enforced server-side on every route and action, never UI-only
- Rating: integer 1–4 (4=ممتاز 3=جيد جداً 2=جيد 1=يحتاج إعادة)
- Quran: 604-page Madani Mushaf, seed all 114 surahs
- Guardian phones in international format for wa.me links
- Groq errors: silent fallback to template mode, teacher never blocked
- Arabic PDF: embed Amiri or Cairo font explicitly
- Never save uploads to local filesystem — Vercel Blob only
- Zod validation on all inputs

## Build rule
One phase at a time. Finish and confirm each phase works before starting the next.
Phases are in quran-center-requirements.md section 11.

## Telegram offline submission
- Telegram payload format: ISTQ|teacher_id|halaqa_id|date|student_blocks
  (see docs/telegram-architecture.md for full spec — keep that file in
  sync with the parser implementation)
- Telegram and web session-save paths MUST call the same shared
  server-side validation/save function (`saveDailySessionCore` in
  `lib/daily-session/save.ts`). Never duplicate this logic.
- Parsing lives in `lib/telegram/parsePayload.ts` (pure, no DB access);
  orchestration (teacher/halaqa lookups, lock check, per-row save) lives
  in `lib/telegram/processIstqMessage.ts`.
- Parsing granularity is per-student-row. One malformed or stale row
  must never cause the rest of a valid payload to be discarded.
- One submission per (teacherId, halaqaId, date) per day, keyed on the
  date EMBEDDED IN THE PAYLOAD, not server receipt time.
- Generated offline-submission HTML pages (`lib/telegram/generateOfflineForm.ts`)
  are fully static (no fetch calls to our server at all) and must work
  with zero network connection once downloaded/opened.
- Generated HTML embeds: magic-prefix-aware payload builder JS,
  teacher_id, halaqa_id, full current roster (id + name), and a visible
  "آخر تحديث" timestamp.
- Regenerate-on-demand: there is no auto-push of updated HTML to
  teachers' phones. A teacher must redownload after any roster change to
  pick up new/removed students.
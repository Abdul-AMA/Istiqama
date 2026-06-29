# Istiqama — Telegram Offline Submission: Implementation Phases

Companion to `01-telegram-architecture.md` — read that first. This document breaks the build into sequential phases matching your existing phase-by-phase discipline. Each phase has its own ready-to-paste Claude Code prompt, plus explicit notes on `CLAUDE.md` updates and any new files/dependencies.

Suggested phase numbering: since Phases 1–8 are complete and Phase 9 (Dexie/PWA) is abandoned, these are labeled **Phase 9 (replacement)** through **Phase 12** to keep your numbering coherent. Adjust numbers to match your actual repo history if needed.

---

## Before Phase 9: One-time setup (not code — do this yourself first)

1. Create the Telegram bot via [@BotFather](https://t.me/BotFather) on Telegram (`/newbot`), get the bot token.
2. Decide the bot's username (e.g. `IstiqamaBot`) — this is what `t.me/<username>` deep links will point to.
3. Add `TELEGRAM_BOT_TOKEN` to your Vercel environment variables (Production + Development, same lesson as your earlier Prisma postinstall issue — scope it to both).
4. Do **not** call `setWebhook` yet — that happens at the end of Phase 9 once the route exists and is deployed.

---

## Phase 9 (replacement): Raw storage table + Telegram webhook skeleton

**Goal:** Get a working webhook endpoint that receives any Telegram message, stores it raw, and replies with a placeholder confirmation. No parsing logic yet — this phase proves the pipe works end to end before any business logic is added.

### CLAUDE.md updates

Add to the stack/rules list:
```
- Telegram Bot API used for offline session submission (webhook-based, no polling)
- Raw-storage-first pattern: every inbound Telegram message is persisted to raw_telegram_messages BEFORE any parsing is attempted. This is non-negotiable — never parse-then-store.
- Telegram webhook route must respond 200 OK even on internal parse errors, to prevent Telegram's retry mechanism from re-delivering the same message repeatedly.
```

### New files/dependencies expected this phase

- New Prisma model + migration for `raw_telegram_messages`
- New API route: `app/api/telegram/webhook/route.ts` (or equivalent)
- No new npm packages required — Telegram's Bot API is plain HTTPS, no SDK needed (though `node-telegram-bot-api` or `grammy` are acceptable if Claude Code prefers a typed wrapper; raw `fetch` calls to `https://api.telegram.org/bot<token>/...` are also fine and keep dependencies minimal)

### Claude Code prompt

```
We are building the first phase of a Telegram-based offline data submission
system for Istiqama, replacing the abandoned Dexie/Background Sync PWA
(Phase 9 original). This phase ONLY sets up raw message storage and a working
webhook — no payload parsing yet.

1. Add a new Prisma model:

   model RawTelegramMessage {
     id                String   @id @default(cuid())
     telegramUpdateId  BigInt?
     chatId            BigInt
     rawText           String
     receivedAt        DateTime @default(now())
     parsed            Boolean  @default(false)
     parseError        String?
   }

   Run the migration.

2. Create a new API route at app/api/telegram/webhook/route.ts that:
   - Accepts POST requests from Telegram (Telegram sends an "Update" object
     as JSON — see https://core.telegram.org/bots/api#update for the shape;
     the relevant fields are update.update_id, update.message.chat.id, and
     update.message.text)
   - On receiving a message, its FIRST action — before anything else,
     before any try/catch around other logic — must be inserting a new
     RawTelegramMessage row with the raw text, chat id, and update id.
     This insert must happen unconditionally for every incoming message,
     even ones that are clearly not from our app.
   - After the raw insert succeeds, send a placeholder reply back to the
     chat via the Telegram Bot API's sendMessage endpoint
     (https://api.telegram.org/bot<TOKEN>/sendMessage), saying in Arabic:
     "تم استلام رسالتك" (no parsing logic yet, this is just to confirm
     the round trip works)
   - ALWAYS return a 200 OK HTTP status to Telegram, even if something
     downstream of the raw insert throws — Telegram will retry-deliver
     messages that don't get a 200, and we never want a retry storm.
     Wrap everything after the raw insert in a try/catch that swallows
     errors (but logs them server-side) rather than letting them propagate
     to the HTTP response.
   - Read the bot token from process.env.TELEGRAM_BOT_TOKEN — do not
     hardcode it.

3. Add a short README note (or a comment block at the top of the route file)
   explaining that this route must be registered with Telegram via the
   setWebhook API call after deployment, and that the webhook URL changes
   if the deployment URL changes, requiring re-registration.

Do not implement any payload parsing, magic prefix checking, or
attendance/hifz record creation in this phase — that is the next phase.
Keep this phase strictly to: raw storage + working webhook round trip.
```

### Manual step after this phase deploys

Call Telegram's `setWebhook` once, pointing at your deployed route:
```
https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://yourapp.vercel.app/api/telegram/webhook
```
Then send any test message to the bot from your own Telegram account and confirm a row appears in `raw_telegram_messages` and you receive the placeholder reply.

---

## Phase 10: Payload parsing + per-student record writing

**Goal:** Implement the actual `ISTQ|...` payload format parsing, magic-prefix checking, per-student-row validation, one-submission-per-day locking, and writing real `AttendanceRecord`/`HifzSession` records.

### CLAUDE.md updates

Add:
```
- Telegram payload format: ISTQ|teacher_id|halaqa_id|date|student_blocks
  (see docs/telegram-architecture.md for full spec — keep that file in
  sync with the parser implementation)
- Telegram and web session-save paths MUST call the same shared
  server-side validation/save function. Never duplicate this logic.
- Parsing granularity is per-student-row. One malformed or stale row
  must never cause the rest of a valid payload to be discarded.
- One submission per (teacherId, halaqaId, date) per day, keyed on the
  date EMBEDDED IN THE PAYLOAD, not server receipt time.
```

### New files/dependencies expected this phase

- A shared parsing module, e.g. `lib/telegram/parsePayload.ts`
- A shared save function used by both the web edit route and the Telegram
  webhook (refactor existing Phase 4 save logic into a shared function if
  it isn't already isolated from the API route handler)
- Copy `01-telegram-architecture.md` into the repo, e.g. as
  `docs/telegram-architecture.md`, so it's available to Claude Code and
  future contributors as the canonical spec

### Claude Code prompt

```
This phase implements real parsing and saving for the Telegram offline
submission system. The webhook skeleton and raw storage from the previous
phase already exist and work — build on top of them, don't replace them.

Read docs/telegram-architecture.md (copy it into the repo from the provided
file if it isn't there yet) for the full payload format spec before writing
any parsing code. The format, delimiters, and field order are fully
specified there — follow it exactly rather than inventing a variant.

1. Magic prefix check: any incoming message NOT starting with "ISTQ|"
   should get this Arabic reply and skip all further processing:
   "هذه الرسالة لا تبدو من نموذج الحصة، تأكد من استخدام الصفحة الصحيحة"

2. Parse the payload per the spec:
   ISTQ|teacher_id|halaqa_id|date|student_block;student_block;...
   where each student_block is:
   student_id:attendance_code:hifz_entries:note
   and hifz_entries is zero or more entries joined by "_", each:
   type:from_page:to_page:rating:mistakes

3. One-submission-per-day lock: before writing anything, check whether a
   submission already exists for this (teacherId, halaqaId, date) combo,
   using the date PARSED FROM THE PAYLOAD (not the current server time or
   message receipt time). If one exists, do not write anything — instead
   reply in Arabic directing the teacher to use the website to make
   corrections, something like:
   "تم استلام بيانات هذا اليوم مسبقاً. لتعديل البيانات، يرجى استخدام
   الموقع الإلكتروني."

4. Per-student-row validation and writing — this is the most important
   behavior in this phase, implement it carefully:
   - Process each student_block independently.
   - For a given student_id: confirm it exists AND belongs to the
     halaqa_id given in the payload. If not, skip this row, do not throw,
     and record a note for this row (collect it for the reply message and
     also store it against the raw message's parseError field, appending
     if multiple rows fail).
   - Validate rating is within the app's existing valid range and page
     numbers are within the app's existing valid page range (reuse
     whatever constants/validation the web app's existing hifz entry
     form already uses — do not invent new range constants).
   - If a row fails validation, skip ONLY that row and continue
     processing the remaining rows in the same payload. A bad row must
     never cause the rest of the payload to be discarded.
   - For valid rows, call the SAME shared save function the web app's
     session-edit screen uses to write AttendanceRecord and HifzSession
     records (refactor that logic into a shared function first if it's
     currently only callable from the API route handler directly).
   - A roster student who is simply not mentioned anywhere in the
     payload (e.g. they were added to the halaqa after this teacher's
     HTML was generated) is NOT an error and is not logged as one —
     there's just no record for them today.

5. After processing all rows, update the RawTelegramMessage row: set
   parsed = true, and if any rows failed, store a summary of which
   student IDs failed and why in parseError (the message still counts
   as successfully processed overall if at least the prefix and date
   parsed correctly — parseError here means "partial issues", not
   "total failure").

6. Send a final reply to the teacher in Arabic summarizing the result:
   - Full success: "✅ تم حفظ بيانات اليوم لـ {count} طالب"
   - Partial success: success count plus which student IDs were skipped
     and a short reason, so the teacher knows to check with the principal
     or use the website rather than assuming everything saved.

Keep all of this inside the existing try/catch-and-always-return-200
pattern from the webhook skeleton — Telegram must always get a 200 OK
regardless of what happens during parsing.
```

---

## Phase 11: Teacher-facing HTML generation (teacher page + admin page)

**Goal:** Build the feature in the web app that generates the personalized static HTML submission form, downloadable from the teacher's own page, plus the admin variant with a halaqa/teacher picker.

### CLAUDE.md updates

Add:
```
- Generated offline-submission HTML pages are fully static (no fetch
  calls to our server at all) and must work with zero network connection
  once downloaded/opened.
- Generated HTML embeds: magic-prefix-aware payload builder JS,
  teacher_id, halaqa_id, full current roster (id + name), and a visible
  "آخر تحديث" timestamp.
- Regenerate-on-demand: there is no auto-push of updated HTML to
  teachers' phones. A teacher must redownload after any roster change to
  pick up new/removed students.
```

### New files/dependencies expected this phase

- A new route/page, e.g. `app/teacher/offline-form/page.tsx`, that generates and serves the personalized HTML as a downloadable file
- A new admin route, e.g. `app/admin/offline-form/page.tsx`, with a halaqa/teacher select dropdown
- A shared HTML-generation template/function, e.g. `lib/telegram/generateOfflineForm.ts`, used by both routes so they don't diverge
- Client-side validation JS embedded in the generated HTML (completeness checks — every student needs attendance + hifz-or-لم-يُسمَع)
- Client-side note-length cap (recommend setting the exact character limit here, e.g. 100 characters, and keep it consistent with whatever Phase 10's parser/save logic expects, if there's any server-side length assumption)

### Claude Code prompt

```
This phase builds the teacher-facing and admin-facing generation of the
offline submission HTML form described in docs/telegram-architecture.md
(Section 9 specifically). Read that section before starting.

1. Create a shared generation function (e.g.
   lib/telegram/generateOfflineForm.ts) that takes a teacherId, halaqaId,
   and the current roster for that halaqa, and returns a complete,
   self-contained HTML string with no external dependencies (inline
   <style> and <script>, no CDN links, no fetch calls to our server
   anywhere in the generated page). This function is the single source
   of truth for the generated page — both the teacher route and the
   admin route must call it, not duplicate its logic.

2. The generated HTML must include, baked in as JS constants:
   - The magic prefix "ISTQ|"
   - teacher_id and halaqa_id
   - The full current roster (student id + display name) as a JS array
   - A "آخر تحديث: {timestamp}" line displayed prominently at the top of
     the page, using the generation time

3. The generated page's UI, per student in the roster:
   - Attendance selector: حاضر / غائب / متأخر / معذور
   - If غائب or معذور is selected, automatically collapse/hide that
     student's hifz fields (consistent with existing web app behavior
     for absent students — check the existing session entry screen's
     logic for this and mirror it)
   - Hifz entry fields for up to three entries (سبق / سبقي / منزل), each
     with from-page, to-page, rating, and mistake count
   - A لم يُسمَع checkbox per student as an alternative to filling hifz
   - A free-text note field per student, hard-capped client-side at 100
     characters (enforce via maxlength attribute AND JS validation, not
     just one or the other)

4. Client-side completeness validation before allowing submission: every
   student must have an attendance value, AND (a hifz entry OR لم يُسمَع
   ticked) unless they are غائب/معذور. The submit button should be
   disabled or show a clear Arabic error until this is satisfied — do
   not allow submission of an incomplete form.

5. On submit, build the payload string exactly per the format in
   docs/telegram-architecture.md Section 6, then construct a Telegram
   deep link in the form:
   https://t.me/<BOT_USERNAME>?text=<url-encoded-payload>
   and navigate to it (e.g. window.location.href). Show the teacher a
   short Arabic instruction visible on the page near the submit button,
   something like: "بعد الضغط على إرسال، افتح تيليجرام واضغط على زر
   الإرسال لإكمال العملية" — make clear the manual send tap in Telegram
   is still required, don't imply this is fully automatic.

6. Teacher-facing route (app/teacher/offline-form or similar): generates
   and serves the HTML for the currently logged-in teacher's own
   halaqa(s), downloadable as a file (e.g. via a download link/button
   that triggers a Blob download of the generated HTML string).

7. Admin-facing route (app/admin/offline-form or similar): same
   generation function, but the page includes a select dropdown to
   choose teacher + halaqa first; choosing a combination regenerates
   the embedded roster/IDs in the preview before download. This is
   still a single static file once downloaded — the dropdown is only
   used at generation time on this admin page, not inside the
   downloaded file itself, UNLESS you judge it cleaner to bake multiple
   halaqa datasets into one downloadable file with an in-page picker
   for shared-device use — if so, make the picker simply switch which
   baked-in roster/IDs are active, with no network calls either way.

8. Respect the existing RTL-only Arabic UI convention used throughout
   the rest of the app for all visible text and layout direction.

Do not add any authentication, PIN, or confirmation-beyond-visual-
roster-check step to either route — this is an intentional simplification
already agreed for this application given its low-risk data.
```

---

## Phase 12: Operational hardening and confirmation polish

**Goal:** Small but important refinements once the core pipeline (Phases 9–11) is live and being used for real: webhook re-registration documentation, reviewing real payload sizes, and confirming the bot's reply messages read well to actual teachers.

This phase is intentionally light — most of the heavy design decisions were made up front. Treat it as a check-in rather than a large build.

### CLAUDE.md updates

Add:
```
- After any redeploy that changes the Vercel deployment URL, the
  Telegram webhook MUST be re-registered via setWebhook. This is a
  manual operational step, not automated. See docs/telegram-architecture.md
  for the setWebhook call format.
```

### Claude Code prompt

```
This is a light operational-hardening pass on the already-working
Telegram offline submission system (Phases 9-11). No new features —
just review and small fixes.

1. Review the raw_telegram_messages table from real usage so far (if any
   exists in the dev/staging database). Check the actual character
   length of stored rawText values against the 4096 limit discussed in
   docs/telegram-architecture.md Section 6.5. If anything is approaching
   3000+ characters in practice, flag it back to me before changing
   anything — do not implement payload chunking/splitting unless I
   confirm it's actually needed.

2. Add a small admin-only view (or extend an existing admin dashboard
   page) listing recent raw_telegram_messages rows where parsed = false
   or parseError is not null, so issues are visible without querying the
   database directly. Sort by receivedAt descending. This is a read-only
   diagnostic view, not an editing interface.

3. Double check every Arabic-facing bot reply message (magic-prefix
   rejection, already-submitted-today rejection, success confirmation,
   partial-success confirmation) for clarity — read them back to me in
   this conversation rather than just committing them, since wording
   quality here matters more than code correctness.

4. Confirm in code comments on the webhook route that re-registering the
   webhook via setWebhook after any deployment URL change is a manual
   step — link to or quote the relevant section of
   docs/telegram-architecture.md.

Do not modify the core parsing or save logic from Phase 10 in this pass
unless real usage data from step 1 specifically shows a problem.
```

---

## Summary checklist

| Phase | Delivers | New DB table/model | New routes | CLAUDE.md update |
|---|---|---|---|---|
| 9 | Raw storage + webhook skeleton | `RawTelegramMessage` | `/api/telegram/webhook` | Yes |
| 10 | Payload parsing + record writing | — | — (extends Phase 9 route) | Yes |
| 11 | Teacher + admin HTML generation | — | `/teacher/offline-form`, `/admin/offline-form` | Yes |
| 12 | Operational hardening | — | Optional admin diagnostic view | Yes |

Keep `docs/telegram-architecture.md` (the companion document) in the repo and treat it as the canonical spec — if any decision changes during implementation, update that file so it stays accurate for future reference, rather than letting the code and the doc drift apart.

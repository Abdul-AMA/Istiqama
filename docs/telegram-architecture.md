# Istiqama — Telegram Offline Submission Architecture

This document explains **how** the Telegram-based offline submission system works end to end, and why each decision was made. It is the reference document for the phase-by-phase implementation prompts in `02-implementation-phases.md`. Read this first; it is not itself a prompt for Claude Code.

This replaces the abandoned Phase 9 (Dexie.js / Background Sync PWA), which never synced reliably and had no iOS support.

---

## 1. The problem being solved

Teachers in halaqas frequently have no internet connection during class. They need to record daily attendance + hifz data for their students, and that data needs to end up in the same Postgres database the web app uses — without requiring the teacher to be online at the moment of entry.

## 2. The solution, in one paragraph

Each teacher gets a **personalized static HTML file** (no server calls, works fully offline) containing their own teacher ID, halaqa ID, and current student roster baked in. The teacher fills in attendance and hifz data while offline. On submit, the page builds a single structured text payload and opens a Telegram deep link with that payload pre-filled into a message to a dedicated Istiqama bot. The teacher taps **send** in Telegram. If they're offline, Telegram queues the message in its own outbox and sends it automatically the moment the phone reconnects — no further action needed from the teacher. The Istiqama bot receives the message via webhook, stores the raw text immediately, then parses it and writes attendance/hifz records into the same database the web app uses.

## 3. Why Telegram and not WhatsApp

- Telegram's Bot API is free, has no business-verification process, and webhooks can be live within an hour.
- WhatsApp's official Business API (Cloud API) requires Meta business verification and approval. Unofficial libraries that puppet WhatsApp Web violate WhatsApp's Terms of Service and risk account bans — unacceptable for a tool teachers depend on daily.
- Telegram message text is plain UTF-8 with a 4096-character limit, which comfortably fits a full class's daily payload (estimated 450–1000 characters for typical class sizes — see Section 6).

## 4. What this system does NOT need (compared to the abandoned Phase 9)

No Dexie.js, no IndexedDB sync queue, no Background Sync API registration, no service worker sync logic, no conflict resolution between offline and online writes. The "queue and retry over unreliable network" problem is fully delegated to Telegram's own infrastructure.

The only client-side offline piece that remains is: the static HTML file itself must be cacheable/openable with zero network (this is just a saved file or a minimal installable PWA shell with no sync logic — see Section 9).

## 5. End-to-end flow

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Principal/Teacher generates HTML page from web app        │
│    (teacher's own page, or admin page with halaqa picker)    │
└───────────────────────────┬───────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. Teacher downloads/saves HTML file to phone                │
│    File contains: magic prefix marker, teacher_id, halaqa_id,│
│    full student roster, "last updated" timestamp              │
└───────────────────────────┬───────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. OFFLINE: Teacher opens HTML file in browser, fills in      │
│    attendance + hifz for each student. Client-side JS blocks  │
│    submission until every present student has hifz-or-       │
│    لم-يُسمَع, and every student has an attendance value.      │
└───────────────────────────┬───────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. Teacher taps "إرسال" (submit). JS constructs the payload   │
│    text and builds a Telegram deep link                      │
│    (https://t.me/IstiqamaBot?text=ISTQ%7C...)                 │
│    and opens it — Telegram app opens with message pre-filled  │
└───────────────────────────┬───────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 5. Teacher taps SEND inside Telegram (manual, unavoidable —   │
│    no app can silently send on the user's behalf)             │
│    If offline: Telegram queues it in its own outbox.          │
│    If online: sends immediately.                               │
└───────────────────────────┬───────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 6. ONLINE (whenever it happens — could be hours later):       │
│    Telegram delivers the message to the bot, which fires      │
│    Telegram's webhook against our Next.js API route            │
└───────────────────────────┬───────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 7. Webhook handler:                                            │
│    a) INSERT raw message text into raw_telegram_messages      │
│       immediately (this step basically cannot fail)            │
│    b) Check magic prefix — if absent, reply with a friendly    │
│       "this doesn't look like a session payload" message       │
│    c) Check one-payload-per-day lock (by date embedded IN      │
│       the payload, not received timestamp)                     │
│       — if already submitted today, reply telling them to      │
│         edit via the website instead                            │
│    d) Parse payload PER STUDENT ROW (not all-or-nothing)        │
│    e) For each student row: if student ID exists in that       │
│       teacher's halaqa AND rating/page are in valid range →     │
│       write the record. If malformed → skip that row, log a    │
│       parse_error note, continue with the rest.                 │
│    f) Any current roster student NOT mentioned in the payload   │
│       at all (e.g. added after this HTML was generated) is      │
│       simply absent from today's data — not an error.           │
│    g) Reply to the teacher in Telegram with a confirmation      │
│       (success count, or which rows failed)                     │
└───────────────────────────┬───────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 8. Data now lives in the same AttendanceRecord / HifzSession   │
│    tables the web app reads and writes. Web app UI is          │
│    unaffected — it just sees new rows.                          │
└─────────────────────────────────────────────────────────────┘
```

## 6. Payload format

### 6.1 Magic prefix

Every real payload begins with `ISTQ|`. This is checked first, before any other parsing. Any incoming message without this prefix is treated as a stray message (someone fat-fingered the bot chat) and gets a friendly Arabic reply rather than an error.

### 6.2 Delimiters

Chosen specifically to avoid mobile keyboard autocorrect / smart-quote substitution:

| Delimiter | Used for |
|---|---|
| `\|` (pipe) | Top-level field separator |
| `:` (colon) | Sub-field separator within a field |
| `;` (semicolon) | Separator between repeated student blocks |
| `_` (underscore) | Separator within a single recitation entry |

Avoid `'`, `"`, `“`, `”` entirely — these get silently substituted by phone keyboards and will break parsing.

### 6.3 Field layout

```
ISTQ|teacher_id|halaqa_id|YYYY-MM-DD|student_block;student_block;...
```

Each `student_block`:

```
student_id:attendance_code:hifz_entries:note
```

- `attendance_code` — single letter: `P` (حاضر), `A` (غائب), `L` (متأخر), `E` (معذور)
- `hifz_entries` — zero or more recitation entries separated by `_`, each formatted:
  `type:from_page:to_page:rating:mistakes`
  where `type` is `N` (new/سبق), `R` (recent revision/سبقي), `O` (old revision/منزل)
  Empty if the student is absent or has `لم_يُسمَع` ticked (see attendance_code `A`/`E` handling below).
- `note` — free text, capped at a fixed character limit enforced client-side (limit to be set during implementation — recommend 80–100 characters). Omit entirely (empty string between delimiters) if no note.

### 6.4 Example payload

A class of 3 students, one absent, one with two recitation entries:

```
ISTQ|7|3|2026-06-24|101:P:N:12:15:4:1:|102:A:::|103:P:N:8:10:3:0_R:1:5:4:0:كرر صفحة 9
```

Breaking down student 103: present, one new entry (pages 8–10, rating 3, 0 mistakes) and one recent-revision entry (pages 1–5, rating 4, 0 mistakes), with a note "كرر صفحة 9".

### 6.5 Size estimate

A single student block with one recitation entry and no note runs roughly 20–25 characters. For a 20-student halaqa with every student fully filled, total payload length is approximately 500–700 characters — well under Telegram's 4096-character limit. Even a class of 40 students with multiple recitation entries each is unlikely to approach the limit unless notes are heavily used, which the character cap (Section 6.3) prevents.

No message-splitting/chunking logic is needed at current or realistic future class sizes. Revisit only if production logs ever show payloads approaching ~3000 characters.

## 7. Identity and authorization model

- No link is made between Telegram account identity (`chat_id`) and teacher identity. The teacher_id is baked directly into the payload by the HTML file itself.
- This is a deliberate, accepted simplification given the low-risk nature of the data — anyone could in principle send a forged payload, but this is not treated as a meaningful threat for this application.
- For shared-device scenarios, the admin-generated HTML includes a teacher/halaqa picker. Once selected, the visible student roster lets the teacher visually confirm it's the correct halaqa before filling data in. No PIN or confirmation step is added beyond this — the teacher recognizing their own class is considered sufficient.

## 8. One-submission-per-day rule

- Enforced by the bot, keyed on `(teacher_id, halaqa_id, date)` where `date` is the date **embedded in the payload**, not the timestamp the message was received by the server.
- A second submission for the same `(teacher_id, halaqa_id, date)` is rejected by the bot with a reply directing the teacher to use the website to make corrections.
- The website's existing session-edit screen (Phase 4 logic — blank-default, validated, reopens existing records for correction) is reused unchanged for this purpose. The Telegram path and the web path must call the **same server-side validation/save function** — this logic should not be duplicated, to avoid the two paths drifting apart over time.

## 9. HTML generation and distribution

- Each teacher's personalized HTML page is generated **on demand** from their profile page in the web app, whenever their roster changes (student added/removed) or whenever they request a fresh copy.
- The generated file embeds: magic prefix capability (the JS that builds payloads with the `ISTQ|` prefix), teacher_id, halaqa_id, the full current student roster (id + name), and a visible "آخر تحديث: [timestamp]" stamp at the top of the page so a teacher can self-check staleness.
- The admin variant (`/admin/...`) generates the same kind of page but with a halaqa/teacher select dropdown at the top; selecting an option swaps the embedded teacher_id/halaqa_id and visible roster in-page (still a single static file, the dropdown just switches which baked-in dataset is active — no network call).
- If a teacher submits using a stale HTML file (a student was added to the halaqa after their copy was generated), the missing student simply has no record for that day — this is not an error condition (see Section 10).
- Distribution mechanics (file download vs. installable static-asset PWA shell with no sync logic) are an implementation detail for Phase 9-replacement work — either is acceptable; an installable shell is recommended for easier "open instantly, refresh on next online launch" behavior, but is not required for correctness.

## 10. Validation split — what lives where

This is the most important design rule in the whole system and should not be collapsed into "no validation":

| Validation | Where it lives | What it checks |
|---|---|---|
| **Completeness** | Client-side JS in the HTML form | Every student has an attendance value; every present student has either a hifz entry or لم يُسمَع ticked. Submission is blocked entirely until this passes. |
| **Structural sanity** | Bot-side parser, per student row | Student ID is a valid number, rating is in range, page numbers are in range. A row failing this check is skipped and logged with a `parse_error` note — but does NOT reject the rest of the payload. |
| **Roster membership** | Bot-side parser, per student row | Student ID actually belongs to this teacher's halaqa (catches stale-but-otherwise-valid-looking IDs, e.g. a removed student). Same per-row skip-and-log behavior. |
| **Missing-from-payload** | Not validation at all | A current roster student simply absent from the payload (stale HTML) is not flagged as an error anywhere — there's nothing to validate, just a gap to fill on next submission. |

The parsing granularity is **per student row, not per whole payload.** One malformed or stale row must never cause the other valid rows in the same submission to be discarded.

## 11. Raw-storage-first pattern

Every incoming Telegram message is inserted into a `raw_telegram_messages` table **before** any parsing is attempted. This is a single fast INSERT that essentially cannot fail (short of the database itself being down). Parsing happens afterward; if parsing throws or any row fails validation, the error is recorded against that raw row (`parse_error` column) — the raw text itself is never lost. This means a bug in the parsing logic can be fixed and the raw row reprocessed later, rather than data being silently dropped.

```sql
CREATE TABLE raw_telegram_messages (
  id              SERIAL PRIMARY KEY,
  telegram_update_id  BIGINT,
  chat_id         BIGINT,
  raw_text        TEXT NOT NULL,
  received_at     TIMESTAMPTZ DEFAULT now(),
  parsed          BOOLEAN DEFAULT FALSE,
  parse_error     TEXT
);
```

The webhook handler's first action, with no exceptions, is writing to this table. Only after that succeeds does parsing begin.

## 12. Bot replies (confirmation loop)

The bot always replies to a processed message — this is "zero additional cost" to the raw-write path because it happens strictly after the raw insert and parse attempt, never blocking or gating them. Reply cases:

- **No magic prefix found** → friendly Arabic message indicating this doesn't look like a session submission.
- **Already submitted today** → message directing the teacher to use the website for corrections.
- **Fully successful** → confirmation with a count, e.g. "✅ تم حفظ بيانات اليوم لـ 15 طالب".
- **Partially successful** (some rows skipped) → confirmation of what saved plus which student rows failed and why, so the teacher knows to check the website or contact the principal rather than assuming everything saved.

## 13. Edge cases explicitly decided

| Edge case | Decision |
|---|---|
| Teacher submits twice same day | Bot rejects the second; replies pointing to the website for edits. |
| Student added mid-cycle, teacher's HTML is stale | Missing student has no record that day; not an error. Re-generate HTML to fix going forward. |
| Multi-halaqa teacher, shared device | Admin HTML variant with picker; teacher visually confirms correct halaqa by seeing the roster — no extra confirmation step. |
| Garbled/non-payload message sent to bot | Magic prefix check catches this before parsing; friendly reply, no crash. |
| One malformed student row among many valid ones | Only that row is skipped and logged; the rest of the payload saves normally. |
| Webhook URL changes after redeployment | Telegram's `setWebhook` must be re-called manually; not automatic. Operational checklist item, not code. |
| Date ambiguity (filled offline late at night, sent after midnight) | Date is taken from the payload's embedded date field, never from message-received timestamp. |

## 14. What is explicitly out of scope / not being built

- No link between Telegram `chat_id` and teacher identity.
- No PIN, password, or confirmation step beyond visual roster recognition for the admin/shared-device picker.
- No WhatsApp integration (Telegram only, per Section 3).
- No payload chunking/splitting across multiple Telegram messages.
- No revival of any Phase 9 Dexie/Background Sync code — that approach is fully retired.

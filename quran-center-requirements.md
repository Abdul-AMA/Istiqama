# Istiqama (استقامة) — Quran Center Management System — Requirements Specification (v1)

> **App name:** Istiqama. A web app for a local Quran teaching center to track hifz, attendance, timetables, reporting, and parent communications.

> **How to use this document:** This is the build spec to hand to Claude Code. It is written to be implemented incrementally (see *Build Phases* at the end). Anything marked **[DECIDE]** is an open choice the owner should confirm before or during the build.

---

## 1. Purpose

A simple, self-hostable web application that lets the **principal** and **teachers** of a local Quran teaching center monitor and track student memorization (hifz), attendance, class timetables, and reporting — replacing paper logbooks and scattered notes.

The system is intentionally narrow: it is a tracking and reporting tool, not a full ERP. Keep it lightweight and fast.

---

## 2. Goals & Non-Goals

**Goals**
- Track each student's hifz progress in the way a real halaqa works (new memorization + revision).
- Record daily attendance per class.
- Maintain class timetables.
- Give the principal a center-wide view and give teachers a focused view of their own classes.
- Be easy to deploy and easy to back up.

**Non-Goals (out of scope for v1)**
- Fees, payments, or accounting.
- Parent or student logins (may be added later — design data model so it's not blocked).
- Detailed tajweed evaluation rubrics (only a simple rating + mistake count for now).
- Automated server-side messaging (WhatsApp Business API, SMS, email gateways). Parent messaging in v1 is **link-based**: generate the message text, then copy it (for the group) or open a pre-filled `wa.me` chat (for an individual). See 6.10.
- Multi-branch / multi-center support (single center only).

---

## 3. Users & Roles

| Role | Description | Can do |
|------|-------------|--------|
| **Principal / Admin** | Runs the center | Everything: manage teacher accounts, all students, all classes, all timetables, view & edit all attendance and hifz records, see center-wide reports and dashboards, export/backup data. |
| **Teacher** | Leads one or more classes (halaqat) | View and manage **only their assigned classes and students**; record attendance and hifz sessions for those classes; view reports for their own classes; edit their own profile. **Cannot** create users, see other teachers' classes, or access center-wide settings. |

A teacher is simply a user with role `TEACHER`. There is no separate self-signup — the principal creates teacher accounts.

---

## 4. Tech Stack

- **Framework:** Next.js (App Router, latest stable), TypeScript.
- **Styling:** Tailwind CSS + `shadcn/ui` for prebuilt components (with RTL support).
- **ORM:** Prisma.
- **Database:** **PostgreSQL** (hosted — Neon or Supabase free tier, which pair cleanly with Vercel). Use the Vercel/Neon Postgres integration for connection pooling in serverless.
- **Auth:** Auth.js (NextAuth) with the Credentials provider, `bcrypt` password hashing, JWT sessions, role-based middleware.
- **Validation:** Zod on all inputs (shared between client and server actions / API routes).
- **Charts:** Recharts for the dashboards.
- **File storage (student photos):** **Vercel Blob** (Vercel's filesystem is ephemeral, so uploads must go to a blob store). Store only the returned URL on the `Student` record. Alternative: Supabase Storage if Postgres is on Supabase.
- **AI message generation (optional mode):** **Groq** free API (OpenAI-compatible). Env `GROQ_API_KEY`. Recommended model: a larger model for better Arabic — e.g. `llama-3.3-70b-versatile` or a Qwen3 model — confirm the current model id at build time. Free tier (~30 req/min) is ample for this use case.
- **PDF (report cards):** server-side generation (e.g. `@react-pdf/renderer` or Puppeteer/`playwright-core` on a serverless-compatible setup) with an Arabic/RTL-capable font embedded.
- **Forms/state:** React Server Components + Server Actions where sensible; client components for interactive forms.
- **PWA:** `@ducanh2912/next-pwa` — web app manifest (display: standalone, Arabic name, icons), service worker for app-shell caching.
- **Offline storage:** `Dexie.js` (ergonomic IndexedDB wrapper) — stores pending operations queue and cached teacher data on the device.
- **Background sync:** Background Sync API (supported on Android Chrome) where available; polling fallback on `window` `online` event everywhere else.

---

## 5. Domain Model

### 5.1 The Quran reference (seed data)

Seed a static reference table so the app can display and validate Quran positions:

- **Standard:** 604-page Madani Mushaf, 114 surahs, 30 juz. (Confirmed.)
- Seed a `Surah` list: number (1–114), Arabic name, ayah count, starting page.
- The primary unit for ranges is the **page number (1–604)** because that is how halaqat universally measure portions. Surah + ayah is stored too for human-readable display.

### 5.2 Entities

**User**
| Field | Notes |
|-------|-------|
| id, fullName, username/email, passwordHash | |
| role | `PRINCIPAL` \| `TEACHER` |
| phone, isActive, createdAt | |

**Student**
| Field | Notes |
|-------|-------|
| id, fullName (Arabic), gender, dateOfBirth | |
| photoUrl | student photo (URL from Vercel Blob); nullable |
| nationalId | national ID / identity number; string, nullable |
| schoolGrade | e.g. "السادس الابتدائي", free text, nullable |
| neighborhood | area/district within the city, nullable |
| guardianName, guardianPhone | store phone in international format (e.g. `+9725…`) for `wa.me` links |
| secondaryPhone | second guardian contact (mother/father), nullable, international format |
| enrollmentDate, status | `ACTIVE` \| `INACTIVE` \| `GRADUATED` \| `GUEST` (added offline by teacher, pending principal assignment) |
| classId | assigned halaqa (nullable) |
| previousHifzPages | pages memorized **before** joining the center (integer, nullable) — used as baseline in progress tracking |
| notes | free text |
| **Snapshot fields** (denormalized, updated on each new session): currentTotalPagesMemorized, currentJuz, lastSabaqReference | |

**Class (Halaqa)**
| Field | Notes |
|-------|-------|
| id, name, teacherId | |
| level / track | optional, e.g. "beginner", "juz amma", "full hifz" |
| location / room, capacity, status | |

**ScheduleSlot** (recurring weekly timetable template)
| Field | Notes |
|-------|-------|
| id, classId, dayOfWeek, startTime, endTime | |

**AttendanceRecord**
| Field | Notes |
|-------|-------|
| id, studentId, classId, date | one record per student per session date |
| status | `PRESENT` \| `ABSENT` \| `LATE` \| `EXCUSED` |
| recordedByUserId, notes | |

**HifzSession** — one per student per session date
| Field | Notes |
|-------|-------|
| id, studentId, classId, date, recordedByUserId | |
| generalNotes | |

**RecitationEntry** — children of a HifzSession (a session can have one of each type)
| Field | Notes |
|-------|-------|
| id, hifzSessionId | |
| type | `NEW` (sabaq / new memorization) \| `RECENT_REVISION` (sabqi) \| `OLD_REVISION` (manzil) |
| fromPage, toPage | primary range |
| fromSurah, fromAyah, toSurah, toAyah | optional, for display |
| linesCount | optional |
| rating | integer **1–4** (4 = best). Suggested Arabic labels: 4 = ممتاز, 3 = جيد جداً, 2 = جيد, 1 = يحتاج إعادة |
| mistakeCount | integer |
| notes | |

> This three-type model (`NEW` / `RECENT_REVISION` / `OLD_REVISION`) is the core of the app. It mirrors the standard halaqa flow: a student presents new memorization, recent revision, and older revision in the same session, each graded separately.

**SardRecord** — periodic comprehensive recitation review, logged manually from the student profile (not part of the daily session)
| Field | Notes |
|-------|-------|
| id, studentId, recordedByUserId | |
| type | `INDIVIDUAL` (فردي — student recites alone to teacher) \| `GROUP` (مجتمعي — group recitation session) |
| date | when the سرد took place |
| fromJuz, toJuz | juz range (integers 1–30); for a single-juz سرد both are equal (e.g. fromJuz=27, toJuz=27) |
| rating | integer 1–4 |
| mistakes | integer mistake count |
| notes | free text |

The student profile shows **two separate سرد entries** — one for each type:
- **آخر سرد فردي:** most recent `INDIVIDUAL` record → date + juz + rating
- **آخر سرد مجتمعي:** most recent `GROUP` record → date + juz range + rating

Teacher logs a new سرد by tapping "سرد جديد" on the student profile, picks the type (فردي / مجتمعي), fills in the juz range, rating, mistakes, and notes. No date restriction — can be logged anytime. Full sard history (both types) available as a list below the two summary cards.

**MessageCategory** — parent-message types managed by the principal
| Field | Notes |
|-------|-------|
| id, name | Arabic label, e.g. `تنبيه` (notice), `إنذار` (warning), `تشجيع` (encouragement) |
| tone | optional hint: `NEUTRAL` \| `POSITIVE` \| `WARNING` — used for color coding and (if AI mode) tone |
| template | message text with placeholders (see 6.10); used when generating |
| isActive, sortOrder, createdByUserId | |

Seed three defaults: `تنبيه`, `إنذار`, `تشجيع`. Principal can add/edit/deactivate more.

**MessageLog** (optional but recommended — communication audit)
| Field | Notes |
|-------|-------|
| id, studentId (nullable for group messages), classId | |
| categoryId, channel | `INDIVIDUAL` \| `GROUP` |
| mode | `TEMPLATE` \| `AI` |
| body | the final generated text |
| createdByUserId, createdAt | who generated it and when |

> Note: this logs that a message was *generated*, not delivery confirmation — sending happens in WhatsApp outside the app.

---

## 6. Functional Requirements (by module)

### 6.1 Authentication & user management
- Login page (username/email + password). No public signup.
- Principal can create, edit, deactivate teacher accounts and reset passwords.
- Role-based route protection: teachers cannot reach admin-only pages or other teachers' data, enforced **server-side** (not just hidden in UI).
- "Edit my profile" + "change my password" for all users.

### 6.2 Student management
- Principal: full CRUD on all students; assign/reassign a student to a class.
- Teacher: can **add, edit, and remove** students in their own classes, plus view their profiles.
- **Student photo:** on add/edit, upload a photo (stored in Vercel Blob; only the URL is saved on the student). Show a placeholder avatar when none is set.
- **Guest student (offline-capable):** teacher can add a temporary guest student with minimal info — fullName (required), guardianPhone (optional), notes (optional). Works fully offline, queued as `CREATE_GUEST_STUDENT` in `pendingOps`. On sync, the student is created with `status = GUEST` and `classId` set to the **teacher's current class** — they are immediately part of the class roster, shown with a `ضيف` badge. The teacher can log daily session data for them straight away. The guest stays in the class indefinitely until the principal acts on them.
- **Principal guest assignment page (`/admin/guests`):** shows all `GUEST` students across all classes with their current class shown. Principal opens any guest → completes their full profile → then either **confirms permanent** (keeps them in their current class, status → `ACTIVE`) or **reassigns** to a different class/teacher (status → `ACTIVE`, classId updated). Until the principal acts, the student remains in the class as a guest.
- **Student detail page** shows:
  - Header: photo, full name, status badge (على المسار / يحتاج متابعة / ضيف), class badge, edit button.
  - Metric cards: attendance %, average rating, total sessions.
  - **البيانات الشخصية:** DOB, national ID, school grade, neighborhood, enrollment date.
  - **بيانات ولي الأمر:** guardian name, phone 1 (with direct WhatsApp tap icon), secondary phone (optional, also with WhatsApp tap).
  - **التقدم في الحفظ:** latest surah memorized (auto from hifz snapshot), total pages memorized, pages before enrollment (baseline), then **two سرد summary cards side by side**:
    - **آخر سرد فردي** — most recent individual sard: juz, date, rating
    - **آخر سرد مجتمعي** — most recent group sard: juz range (e.g. جزء 28 ← 30), date, rating
    - Each card has a "سرد جديد" button for its type. Full history (both types) expandable below.
  - Notes field.
  - Link to full attendance + hifz session history.

### 6.3 Class (halaqa) management
- Principal: CRUD classes, assign a teacher, set level/room/capacity.
- Teacher: view their own classes and rosters.
- **Class detail page (browse students + see their states):** opening a class shows its roster as student cards, each with **photo**, name, and an at-a-glance **state**:
  - current memorization total (pages / juz) and last session date,
  - attendance status/rate over a recent window,
  - a status badge: `على المسار` (on-track) / `يحتاج متابعة` (needs-attention) / `ضيف` (guest — temp student pending principal confirmation).
- Guest students appear in the roster like any other student but with the `ضيف` badge. They stay in the class and can have daily sessions logged against them until the principal makes them permanent or moves them.
- From a student card the teacher can open the student detail/history, edit the student, or add/replace the photo.

### 6.4 Timetable
- Principal: define weekly recurring slots per class.
- Everyone: view a weekly timetable grid (filtered to own classes for teachers).

### 6.5 Daily Session (unified daily report — core teacher workflow)

This is the single screen where a teacher records everything for a class on a given day. Attendance and hifz are entered together here, but stored as separate records underneath (`AttendanceRecord` + `HifzSession` + `RecitationEntry`) so reports and history are unaffected.

**Flow:**
1. Teacher opens **"Class X — [date]"** (defaults to today; date can be changed to backfill).
2. The screen shows the class roster, one row/card per student.
3. For each student, the teacher sets **attendance status** (`PRESENT` / `ABSENT` / `LATE` / `EXCUSED`). Default is `PRESENT`; teacher only changes exceptions.
4. For present students, the teacher fills the **hifz entry**: up to three `RecitationEntry` blocks — `NEW` (sabaq), `RECENT_REVISION` (sabqi), `OLD_REVISION` (manzil) — each with page range, rating, and mistake count, plus optional session notes. Absent/excused students collapse their hifz section automatically.
5. Teacher **saves once** for the whole class. This creates/updates all attendance records and hifz sessions for that class+date in one transaction.

**Behavior:**
- Ranges are entered by page number primarily; the surah name(s) covered by the range display automatically from the seed reference.
- Saving a `NEW` entry updates the student's memorization snapshot (total pages / current juz / last position).
- The whole daily report is **editable after the fact** — reopening the same class+date loads existing records for correction. `recordedBy` and timestamps are tracked.
- Mobile-first: large tap targets, one student expanded at a time, fast top-to-bottom flow.

### 6.6 Calendar view (entry point to the daily report)

A monthly calendar is the primary way teachers navigate to a day. It doubles as a coverage overview.

- **One calendar per class.** Header has a class selector and month navigation (prev / next month).
- **Day cell states** (color-coded, with a legend):
  - `COMPLETE` — a class day with records for all students (e.g. green).
  - `PARTIAL` — a class day with some but not all students logged (e.g. amber).
  - `MISSED` — a **past** class day (per the timetable) with no records (e.g. red). This is the "you forgot to log" flag.
  - `TODAY` — highlighted with a ring; tap to record.
  - `UPCOMING` — future class day, shown dimmed/disabled; **cannot log ahead**.
  - `NO CLASS` — a day the class doesn't meet; neutral, no marker.
- "Complete vs partial" is computed from the class roster size vs the number of students with a `HifzSession`/`AttendanceRecord` on that date.
- Whether a past day counts as a class day comes from the class's `ScheduleSlot` (timetable). Manual sessions on non-scheduled days are allowed and show as recorded.
- Tapping any **past or today** cell opens the Daily Session (6.5) for that class + date. Future cells are not tappable.
- Mobile-friendly grid; clear, calm color states (this is the "nice UI" the owner wants — color carries meaning, layout stays simple).

### 6.7 Principal drill-down navigation

The principal reaches any record through a teacher-first hierarchy:

`Teachers → [pick teacher] → that teacher's classes → [pick class] → class calendar (6.6) → [pick day] → daily report (6.5, editable)`

- The principal sees the **same calendar with the same color states** for any class, making it easy to spot which teachers are keeping logs current vs. accumulating `MISSED` days.
- From a class (or its calendar), the principal can open **per-class reports** (see 6.9) directly.

### 6.8 Per-student history
- Student detail page shows a chronological timeline of sessions, filterable by date range and entry type.
- Shows attendance history and hifz progression (with the surah/page reached over time).

### 6.9 Reports & analytics
**Per-class report (reachable by teacher for own classes, by principal for any class):**
- Roster with each student's current total memorized, attendance rate, and last session date.
- Memorization velocity (pages/week) and attendance trend for the class over a selectable period.
- Monthly logging coverage (how many class days were complete / partial / missed).
- Exportable (CSV/PDF).

**Teacher dashboard (own classes):**
- Class roster with each student's current total memorized + last session date.
- Attendance rate per student over a selectable period.
- Memorization velocity (pages per week) per student.
- Students flagged as falling behind (no `NEW` entry in N days, or attendance below a threshold) — **[DECIDE]** the thresholds.

**Principal dashboard (center-wide):**
- Totals: active students, classes, teachers.
- Attendance trend over time (chart).
- Memorization progress overview by class.
- Top performers and at-risk students.
- Teacher activity (sessions logged per teacher) as a light accountability signal.

**Exports:**
- Export student lists, attendance, and hifz history to CSV (and/or PDF) for offline records.

### 6.10 Parent communications (report cards & messages)

A dedicated page for teachers to generate messages for parents. Because WhatsApp has **no API to post into a group via a link**, sending works two ways:

- **Group channel** → the app generates the text and shows a **"Copy"** button; the teacher pastes it into the parents' WhatsApp group.
- **Individual channel** → the app builds a `https://wa.me/<guardianPhone>?text=<url-encoded message>` link (a **"Send via WhatsApp"** button) that opens a chat with that parent, message pre-filled. Also offers Copy.

**Modes on the page:**

1. **Daily class report (group):** pick a class + date → the app composes a summary of that day's session for the whole class (per student: attendance + new memorization + rating, with absentees noted) → Copy → paste into the group.
2. **Individual message:** pick a **message category** (`تنبيه` / `إنذار` / `تشجيع` / any principal-added category) → pick a **student** → the app generates a message for that student → Send via WhatsApp / Copy.
3. **Report card (per student) — required, fully on-demand:** the teacher goes to the report cards page **any time** and generates a card for **any student in their classes** (principal: any student) — there is **no schedule and no fixed period**. The teacher picks the student and a date range (defaults to a sensible window, e.g. the current month, but freely adjustable), and the app composes a formatted progress summary: total memorized, new pages in range, attendance %, average rating, and teacher notes. Output is an **Arabic/RTL PDF** to download and/or a `wa.me` message to the guardian. Multiple cards can be generated for the same student at different times.

**Message generation — both modes available (teacher picks per message):**
- **Template mode:** each `MessageCategory` has a `template` with placeholders the app fills from the student's latest session and profile. Supported placeholders: `{student_name}`, `{guardian_name}`, `{class_name}`, `{teacher_name}`, `{date}`, `{today_sabaq}`, `{today_revision}`, `{rating}`, `{mistakes}`, `{attendance_status}`, `{total_memorized}`. Free, instant, works offline.
- **AI mode (Groq):** the app sends the category (name + tone) and the student's recent data to the **Groq** API and gets back a natural Arabic message. Use a larger model for Arabic quality (e.g. `llama-3.3-70b-versatile` or Qwen3) and keep the request server-side (key never exposed to the client). On any Groq error/timeout/rate-limit, **fall back to template mode** so the teacher is never blocked.
- The screen offers a simple toggle: **قالب (template)** vs **ذكاء اصطناعي (AI)**. Either way, the teacher can edit the result before sending.

**Permissions & behavior:**
- Teachers generate messages only for their own students/classes; principal for anyone.
- **Principal manages `MessageCategory`** records (add/edit/deactivate) — teachers only select from active categories.
- Every generated message is recorded in `MessageLog` (who, when, which student/category, channel, mode, final text) so the principal has a communication history. (Logging generation, not delivery.)
- All message text is **Arabic / RTL**; teacher can lightly edit the generated text before sending.

---

## 7. Non-Functional Requirements

- **Arabic-only & RTL:** the entire UI is Arabic with a right-to-left layout (set `dir="rtl"` and `lang="ar"` at the root). No language toggle. All labels, dates, and generated messages are Arabic. Use an Arabic-friendly font (e.g. a Google Font like Cairo/Tajawal). Numerals: **[DECIDE]** Western (123) or Arabic-Indic (١٢٣).
- **Offline-first for teachers:** the teacher's core workflow (daily session entry, calendar browsing, roster viewing) must work with no internet connection. See Section 8 (Offline Architecture) for full detail.
- **Installable PWA (Android):** show an "Add to Home Screen" prompt to teachers on first visit. Once installed, the app runs full-screen (standalone) with no browser bar, and Background Sync is unlocked — meaning queued offline data syncs automatically when the phone reconnects, even with the app closed. **iOS is explicitly out of scope.**
- **Responsive / mobile-friendly:** teachers will record attendance and hifz on phones or tablets during class — the attendance and hifz entry screens must work well on small screens with large tap targets.
- **Fast & lightweight:** minimal dependencies, fast page loads, works on modest hardware and slow connections.
- **Security:** hashed passwords, server-side RBAC, validated inputs, no sensitive data exposed in client bundles, session expiry.
- **Data integrity:** every attendance and hifz record stores `recordedBy` and timestamps. Synced records include the original offline timestamp, not the sync timestamp.
- **Backup & restore:** a simple admin "export full backup" (JSON/CSV) from within the app. At the infrastructure level, rely on the Postgres provider's automated backups (Neon/Supabase) plus periodic `pg_dump`.
- **Seed script:** creates the Quran reference data and an initial principal account.

---

## 8. Key Pages / Routes

- `/login`
- `/` — dashboard (role-aware: principal center-wide, teacher own-classes)
- `/students`, `/students/[id]`
- `/classes`, `/classes/[id]`
- `/timetable`
- `/calendar` — monthly calendar per class with color-coded day states; entry point to the daily report
- `/daily` — **unified daily report**: pick class + date → mark attendance + record hifz for the whole roster, save once
- `/teachers/[id]` — principal-only: a teacher's classes → drill into a class calendar → day → daily report
- `/classes/[id]/report` — per-class report (teacher: own; principal: any)
- `/students/[id]` — includes per-student attendance + hifz history timeline
- `/messages` — parent communications: daily group report, individual category messages
- `/report-cards` — on-demand: pick any student (own classes) + date range → generate Arabic PDF / send via `wa.me`
- `/admin/message-categories` — principal only: manage message categories/templates
- `/reports` — filtered analytics & exports
- `/admin/users` — principal only (teacher accounts)
- `/admin/guests` — principal only: all GUEST students across all classes, complete profile + assign to class/teacher → becomes ACTIVE
- `/settings` / `/profile`

---

## 9. Deployment

- **Target:** **Vercel** (Next.js) + hosted **PostgreSQL** (Neon or Supabase). Use the Vercel↔Neon/Supabase integration so the connection string and pooling are configured automatically.
- Run `prisma migrate deploy` and the seed (Quran reference + message categories + first principal) as part of the deploy/setup steps.
- Provide a `README` with: environment variables, migration + seed steps, how the first principal account is created, and backup guidance.
- Include a `.env.example` (database URL, auth secret, `BLOB_READ_WRITE_TOKEN` for Vercel Blob, and `GROQ_API_KEY` for AI message mode).

---

## 10. Build Phases (suggested order for Claude Code)

1. **Foundation:** Next.js + TS + Tailwind + shadcn/ui (RTL) + Prisma + Auth.js scaffold on Vercel + Postgres; DB schema & migrations; seed (Quran reference + default message categories + first principal); login + RBAC middleware; root `dir="rtl"` / `lang="ar"`. Add PWA manifest + basic service worker (app-shell caching only — offline sync comes in Phase 9).
2. **People:** user/teacher management (principal); full student CRUD with all profile fields + **photo upload to Vercel Blob**; **guest student flow** (minimal offline form → `GUEST` status → principal `/admin/guests` assignment page); `SardRecord` entity + "سرد جديد" flow; class CRUD; class detail roster with student photos + state badges (including ضيف badge); teacher↔class and student↔class assignment.
3. **Timetable:** recurring schedule slots + weekly grid view.
4. **Daily Session (core):** the unified daily report screen — roster with attendance + per-student hifz entry (`AttendanceRecord` + `HifzSession` + `RecitationEntry`, rating 1–4), single-transaction save, page→surah display from seed, memorization snapshot updates, edit-after-the-fact.
5. **Calendar & navigation:** per-class monthly calendar with color-coded day states (complete/partial/missed/today/upcoming/no-class) wired to the timetable; tap a day → daily session; principal teacher→class→calendar→day drill-down.
6. **History & reports:** per-student timeline; per-class report; teacher and principal dashboards; charts; at-risk flags; CSV/PDF export.
7. **Parent communications:** message categories management (principal); message generator with **both template and Groq AI modes** (AI falls back to template on failure); group daily report via Copy; individual via `wa.me`; **report-card Arabic PDF**; `MessageLog`.
8. **Polish:** Arabic/RTL pass, mobile optimization of entry + calendar screens, backup/export, README + deployment.
9. **Offline / PWA:** Dexie.js setup; `pendingOps` + `cachedData` stores; offline-aware save flow on daily session; sync queue drain (online event + Background Sync API + manual button); sync status indicator in nav; conflict check on sync endpoint; cache teacher's class/roster/calendar data on login; install prompt.

Build each phase fully and confirm it works before moving to the next. Prefer vertical slices.

---

## 11. Open Decisions to Confirm

**Settled:** DB = PostgreSQL · Deploy = Vercel · Language = Arabic-only (RTL) · Teachers add/edit/remove own students · Student photos (Vercel Blob) · Rating = 1–4 · Mushaf = 604 Madani · Messages = template **and** Groq AI · Report cards = v1, on-demand · Offline = Android PWA only (iOS out of scope).

Still to confirm:
1. "At-risk" thresholds for the student state badge (days without new memorization; attendance %).
2. Numerals in the UI: Western (123) or Arabic-Indic (١٢٣)?
3. Default message categories beyond `تنبيه` / `إنذار` / `تشجيع` (e.g. `متابعة الغياب`)?
4. Groq model for Arabic — confirm by testing during the build.

---

## 9-B. Offline Architecture (PWA)

> **Approach:** PWA first. If iOS reliability or offline robustness proves insufficient, the server API is unchanged — migrating to Expo React Native is a clean client-side swap.

### What works offline vs. online-only

| Feature | Offline | Notes |
|---------|---------|-------|
| Daily session entry (attendance + hifz) | ✅ | Core use case — queued and synced |
| **Add guest student** | ✅ | Minimal form (name + phone); queued as `CREATE_GUEST_STUDENT` |
| Calendar view (current month) | ✅ | Cached on last online session |
| Class roster + student list | ✅ | Cached on last online session |
| Timetable | ✅ | Cached |
| Login / first-time setup | ❌ | Requires internet |
| Student add / edit / delete | ❌ | Online only (avoid sync conflicts) |
| Photo upload | ❌ | Online only |
| AI message generation (Groq) | ❌ | Online only; template mode works offline |
| Template message generation | ✅ | Client-side fill, no server needed |
| Report card PDF | ❌ | Server-side render |
| Reports & analytics | ❌ | Online only |

### Offline storage (Dexie / IndexedDB)

Two stores on the device:

**`pendingOps`** — sync queue: `id`, `type` (e.g. `SAVE_DAILY_SESSION` \| `CREATE_GUEST_STUDENT`), `payload` (full JSON), `createdAt` (offline timestamp), `status` (`PENDING` | `SYNCING` | `FAILED`), `retries`.

> **Sync ordering:** `CREATE_GUEST_STUDENT` ops always sync before any `SAVE_DAILY_SESSION` ops that reference the same student. Since the queue drains sequentially in `createdAt` order, this is automatic as long as the guest is created before the session is saved (which the UI enforces).

**`cachedData`** — read-only cache: teacher's own classes, rosters, timetable, current-month calendar state. Refreshed on every successful online session.

### Write flow

```
Teacher taps "Save"
      ↓
Online? → POST to server directly → update cachedData on success
Offline? → write to pendingOps → show "سيتم المزامنة لاحقاً"
```

Each queued op carries the **offline timestamp** so records land in the DB with the correct date, not the sync date.

### Sync triggers

1. `window` `online` event → auto-drain queue.
2. App returns to foreground (`visibilitychange`) → check queue.
3. **Background Sync API** (Android Chrome) — fires when connectivity returns even if the tab is closed.
4. Manual **"مزامنة الآن"** button — visible when queue is non-empty.

Queue drains sequentially. On server error the op is marked `FAILED` and shown to the teacher.

### Conflict resolution

Teachers are the sole editors of their own class data — conflicts are rare. Strategy: **server wins** if a record for the same `classId + date` already exists with a newer timestamp. The sync endpoint checks before writing; if rejected, the teacher is notified.

### Sync status indicator (always visible in teacher nav)

- 🟢 متصل (online, nothing pending)
- 🟡 جاري المزامنة... (syncing)
- 🔴 غير متصل — N في الانتظار (offline, N pending)
- ⚠️ فشلت المزامنة (failed — retry button)

### PWA manifest

`name: "استقامة"`, `short_name: "استقامة"`, Android icons (192 + 512px), `display: standalone`, matching theme colour. Show "Add to Home Screen" nudge to teachers on first visit (dismissible, Android Chrome only). Service worker caches app shell + static assets + cached teacher data. **iOS not supported.**
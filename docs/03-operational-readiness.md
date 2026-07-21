# Istiqama — Operational Readiness Checklist (Telegram Rollout)

Companion to `01-telegram-architecture.md` and `02-implementation-phases.md`. Those two documents cover **building** the Telegram offline system. This document covers everything else needed to actually **launch and run** it with real teachers.

Every actionable item below includes a ready-to-paste prompt — either for Claude Code (code/repo tasks) or for a Claude.ai conversation (writing/planning tasks). Items that are genuinely manual (BotFather steps, deciding a rollout date) are marked as such and have no prompt, since there's nothing for an AI to do.

Nothing here blocks starting Phase 10, except Section 0 (old system removal), which has its own correct timing explained below. Work through the rest in parallel with, or shortly after, Phases 10–12.

---

## 0. Removing the old Dexie / Background Sync system

**Timing:** do this only after Phase 10 is built and tested, and ideally after at least one real teacher has completed one real end-to-end Telegram submission. Not before — the old system is still teachers' only working offline path until the new one is proven.

This is the full delete + partial-edit list, exactly as mapped by the earlier codebase investigation. Nothing here is new — this section just turns that investigation's findings into one executable prompt.

### Files to be fully deleted
- `src/lib/db.ts`
- `src/lib/sync.ts`
- `src/components/sync-manager.tsx`
- `src/components/sync-status.tsx`
- `src/components/cache-warmer.tsx`
- `src/components/offline-readiness.tsx`
- `src/app/api/sync/guest-student/route.ts`
- `src/app/api/sync/daily-session/route.ts` (safe now — its logic already lives in `src/lib/daily-session/save.ts`)
- The `dexie` package from `package.json`

### Files needing partial edits
| File | Remove | Keep |
|---|---|---|
| `src/app/(auth)/layout.tsx` | `SyncManager` and `CacheWarmer` imports + the `{role === "TEACHER" && ...}` block wrapping them | `AuthNav`, `MainNav`, `InstallPrompt`, everything else |
| `src/components/main-nav.tsx` | `SyncStatus` and `OfflineReadiness` imports + their render lines | The rest of the nav component |
| `src/app/(auth)/daily/daily-session-client.tsx` | All `db.cachedData.*` calls (offline read bootstrap) and the `db.pendingOps.add()` call (offline write queue), plus the `isOffline` state and its `online`/`offline` window listeners | The entire daily session UI and its online save logic |
| `src/app/(auth)/classes/[id]/add-guest-dialog.tsx` | The `localId` / offline-queue path inside `handleSubmit` | The dialog itself and the online-path submission |
| `src/app/(auth)/classes/[id]/class-roster.tsx` | `offlineGuests` state, `loadOfflineGuests()`, the `db.pendingOps` query, and merging it into `allStudents` | The roster display component |
| `src/app/~offline/page.tsx` | The line claiming locally-saved data will auto-sync when connectivity returns (no longer true) | The page structure and retry button — this stays for PWA app-shell offline fallback |

### Not affected at all (confirmed by the earlier investigation, do not touch)
- The PWA manifest and the auto-generated service worker (`@ducanh2912/next-pwa` config in `next.config.ts`) — these handle installability and app-shell caching only, fully independent of Dexie
- The Prisma schema — no sync-specific fields exist anywhere, nothing to migrate or clean up in the database

### Prompt — Claude Code

```
We are removing the old Dexie.js / IndexedDB / Background Sync offline
system now that it's been fully replaced by the Telegram-based offline
submission system (Phases 9-11, already built and tested). This is a
cleanup-only task — no new features, and do not touch anything related to
the Telegram system itself.

Delete these files entirely:
- src/lib/db.ts
- src/lib/sync.ts
- src/components/sync-manager.tsx
- src/components/sync-status.tsx
- src/components/cache-warmer.tsx
- src/components/offline-readiness.tsx
- src/app/api/sync/guest-student/route.ts
- src/app/api/sync/daily-session/route.ts
  (confirm first that nothing still imports saveDailySessionCore-equivalent
  logic from this file specifically rather than from
  src/lib/daily-session/save.ts — it should already be redundant)

Then remove the "dexie" package from package.json and run the package
manager's install/prune step to confirm it's fully removed from the lockfile.

Then make these partial edits:

1. src/app/(auth)/layout.tsx — remove the SyncManager and CacheWarmer
   imports and the {role === "TEACHER" && ...} block that renders them.
   Keep everything else (AuthNav, MainNav, InstallPrompt, etc) untouched.

2. src/components/main-nav.tsx — remove the SyncStatus and
   OfflineReadiness imports and their render lines. Keep the rest of the
   navigation component untouched.

3. src/app/(auth)/daily/daily-session-client.tsx — remove all
   db.cachedData.* calls (the offline read bootstrap) and the
   db.pendingOps.add() call (the offline write queue), plus the
   isOffline state and its window online/offline event listeners. Keep
   the rest of the daily session UI and its normal online save logic
   completely intact.

4. src/app/(auth)/classes/[id]/add-guest-dialog.tsx — remove the localId
   / offline-queue code path inside handleSubmit. Keep the dialog and its
   online-path submission working exactly as before.

5. src/app/(auth)/classes/[id]/class-roster.tsx — remove the
   offlineGuests state, loadOfflineGuests(), the db.pendingOps query, and
   the logic merging it into allStudents. Keep the roster display
   component working for server-sourced data.

6. src/app/~offline/page.tsx — remove the line claiming locally saved
   data will automatically sync when connectivity returns (this is no
   longer true under the new system). Keep the rest of the page,
   including its retry button — it still serves as the PWA's offline
   fallback page.

Do NOT touch next.config.ts's PWA configuration, the manifest, or any
service worker setup — these handle installability and app-shell caching
only and are completely independent of the Dexie system being removed.

After all changes, run the project's build/typecheck command and confirm
there are no remaining references to "dexie", "pendingOps", "cachedData",
"SyncManager", "SyncStatus", "CacheWarmer", or "OfflineReadiness" anywhere
in src/. Report back the full diff summary before I deploy.
```

Review the diff it reports before deploying — this touches live, currently-used code paths (the daily session UI and the guest dialog), not just dead files.

---

## 1. Teacher onboarding

Teachers need to learn a new workflow that didn't exist before: download a personalized page, fill it offline, submit through Telegram, and tap send manually.

**Manual, no prompt:** decide the delivery mechanism for the instruction material — printed handout, WhatsApp group message, in-person walkthrough, or a help page inside the web app. Given the team is not deeply technical, an in-person walkthrough for each teacher's first submission is likely to prevent more confusion than written instructions alone, even with the document below as backup reference. Also decide now whether new teachers joining later get this material automatically or whether you repeat it manually each time — either is fine, just pick one.

### Prompt — Claude.ai (writing task)

```
Write a short Arabic instruction sheet for halaqa teachers explaining how
to use a new offline data submission method for the Istiqama app. The
audience is non-technical teachers who are comfortable with WhatsApp/
Telegram as regular phone users but have no software background. Keep
sentences short and concrete. Use a numbered step format.

Cover, in this order:
1. How to get their personalized page (downloaded once from their teacher
   profile page in the app; mention they need to redownload it if the
   principal tells them a student was added or removed from their halaqa)
2. That the page works without internet — they can fill it in during
   class even with no signal
3. How to fill in attendance and memorization data for each student
4. What happens when they tap the submit button on the page (Telegram
   opens automatically with a message already filled in)
5. The single most important step, emphasized clearly: they must tap the
   SEND button inside Telegram itself — the page does not send it
   automatically, it only opens Telegram with the message ready
6. That they should never edit or change the text of that pre-filled
   message before sending it
7. That if they have no internet at that moment, Telegram will hold the
   message and send it automatically once they're back online — they
   don't need to do anything else, just don't delete the message
8. What it means when the bot replies: a success reply means it worked;
   a reply saying today's data was already received means they should
   use the website instead to make any correction, not resend through
   Telegram
9. That they can only submit once per day this way — any changes after
   that need to go through the website

Write this as a clean, friendly, simple document a teacher could read
once and follow without needing to ask questions. Use terms already used
elsewhere in the app (e.g. حاضر / غائب / لم يُسمَع) rather than
introducing new terminology.
```

## 2. Rollout sequencing — old system vs. new system

The old Dexie/Background Sync system is currently still live and used by teachers. The new Telegram system is mid-build. These two should not run side by side for longer than necessary — the longer both exist, the more likely a teacher ends up confused about which offline method to use, or has data split across both paths for the same day.

**Manual, no prompt — this is a judgment call only you can make:**

- **Cutover style:** a hard switch (announce a specific date, old system removed same day, every teacher moves to Telegram at once) vs. a gradual rollout (a few teachers pilot Telegram first while everyone else stays on the old system, then expand). Given the team size implied by this project, a hard switch is likely simpler to manage than running two systems in parallel for multiple teachers — but worth deciding explicitly rather than letting it happen by accident.

- **Timing relative to the build phases:** the recommended order is Phase 10 → Phase 11 → real-world test with at least one teacher → old-system cleanup (Section 0 above) → full rollout to all teachers. Don't remove the old system until at least one real teacher has successfully completed one real end-to-end Telegram submission — not just your own test messages.

- **Communicate the cutover date** to every teacher in advance, not just the ones who'll notice the UI change — anyone currently relying on the old "غير متصل — N في الانتظار" indicator or offline guest creation in the live app will see that disappear. If you want help drafting that announcement message, that's the same kind of writing prompt as Section 1 — just ask in a Claude.ai conversation once you've picked a date.

## 3. Bot identity and branding

Cosmetic, but affects how trustworthy the bot looks to teachers who aren't used to interacting with bots. Entirely manual — these are BotFather chat commands, not code, so there's no Claude Code prompt for this section. Skip entirely if time is tight; revisit later.

**Manual steps, message @BotFather directly with each:**

- `/setdescription` — paste a short Arabic description (e.g. "بوت استقامة لاستلام بيانات الحصة اليومية فقط") shown before a teacher starts a chat with the bot
- `/setuserpic` — upload a profile picture (the app's logo, if one exists)
- `/setabouttext` — short text shown on the bot's profile page
- Confirm the bot's display name (set at creation) reads clearly as legitimate and won't be mistaken for spam by a teacher seeing it for the first time

If you want help wording the Arabic description/about text rather than writing it yourself, that's a one-line ask in any Claude.ai conversation: *"Write a short Arabic description for a Telegram bot used only to receive daily Quran class attendance/memorization submissions from teachers."*

## 4. Personal operations runbook (for you, as the sole admin/operator)

Since you are both the developer and the principal/admin running this day to day, a short personal reference saves you from having to re-derive "how do I check X" every time something goes wrong, weeks or months from now.

**Timing:** write this during or right after Phase 12, while all of this is still fresh — Claude Code will have direct knowledge of the actual final file paths, route names, and commands at that point, which is better than guessing now.

### Prompt — Claude Code

```
Create a RUNBOOK.md file in the project root — this is an internal
reference for me only, not shown to teachers or end users. It documents
how to operate and troubleshoot the Telegram offline submission system
day to day.

Cover the following, using the ACTUAL file paths, route names, table
names, and commands from this codebase as it exists right now (not
placeholders):

1. How to check for stuck or failed submissions — the exact SQL query or
   Prisma command to find RawTelegramMessage rows where parsed = false or
   parseError is not null, and a short explanation of what the common
   parseError messages mean and what each implies I should do.

2. How to safely reprocess a raw message after fixing a parsing bug —
   the correct procedure for re-running the parser against an existing
   RawTelegramMessage.rawText value rather than hand-editing database rows.

3. How to re-register the Telegram webhook after a deployment URL
   change — the exact curl command format for setWebhook, and a note on
   where TELEGRAM_BOT_TOKEN currently lives (env var name, which
   environments it's set in).

4. How to rotate the bot token if it's ever exposed — the BotFather
   steps in order, and the complete list of every place that needs
   updating afterward (env vars, .env, then setWebhook again).

5. How to tell whether the bot is currently receiving messages
   correctly — the getWebhookInfo curl command, and what a healthy
   response looks like (pending_update_count near 0, no recent
   last_error_message) versus a broken one.

6. A dated note confirming the old Dexie/IndexedDB/Background Sync
   offline system was fully removed, so that any future bug report
   mentioning a "غير متصل" indicator or sync queue is immediately
   recognizable as referring to a system that no longer exists.

Keep this file practical and skimmable — short command blocks and short
explanations, not prose. This is a troubleshooting reference I'll return
to under time pressure, not documentation for someone else to read.
```

## 5. Decision log — confirm or revisit before calling the project done

A short list of things explicitly decided during design that are worth a final sanity check once the system is live with real data — "acceptable as a planning-time tradeoff" is worth re-confirming once it's real teachers and real students rather than a hypothetical. Manual, no prompt — this is just a reminder to revisit, not a task to execute right now:

- No link between Telegram identity and teacher identity — still acceptable once live?
- No PIN/confirmation step on the shared-device admin picker — still acceptable once more than one teacher is actually sharing a device in practice?
- One submission per day, edits only via website — has any teacher actually hit this and found it confusing or limiting?
- Note field character cap — once real notes are being written, is the cap (recommended 80–100 characters in the implementation doc) actually enough, or are teachers consistently hitting the limit?

None of these need to change pre-emptively — revisit them once there's real usage data, rather than assuming the planning-time assumptions held up perfectly.

---

## Summary — what "done" actually looks like

The project is fully wrapped up when:

- [x] Phases 10–12 are built, deployed, and tested (`02-implementation-phases.md`)
- [x] Section 0's Claude Code prompt has been run and reviewed — old Dexie/Background Sync system fully removed (2026-07-21)
- [x] At least one real teacher has completed a real end-to-end Telegram submission successfully
- [ ] Section 1's instruction sheet has been generated and delivered to every active teacher
- [ ] Section 2's cutover style and date have been explicitly decided and communicated
- [ ] Section 3's bot branding is set (optional — skip if not worth the time)
- [x] Section 4's `RUNBOOK.md` exists in the repo
- [ ] Section 5's decision log has been glanced at again post-launch, not just at design time

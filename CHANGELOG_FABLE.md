# CHANGELOG — Fable 5

## Baseline (Step 0)
- `src/app/page.js` confirmed at **5,498 lines** before any changes.
- Live schema verified via `information_schema.columns` on Supabase project `wuralwhctnbtkirofuph` (student-crm):
  - `activities`: `id, client_id, user_id, activity_type, description, activity_date, created_at` — **no `outcome` column**.
  - `clients` already has `company_name` / `company_url` (Part F is UI-only).
  - `deals` has no `currency`. `jobs`/`payments` exist, unused.
- Flagged (out of scope, not fixed): live `clients` lacks `source` and `quick_note`; `profiles` lacks streak columns; `tasks` lacks `recurrence`/`recurrence_end_date`; no `webhooks` table; `custom_field_definitions` has `field_options` but code reads/writes `select_options`; `automation_rules` lacks `run_count`/`last_run_at`.

## fable/fix-outcome-column — Part A: remove nonexistent `outcome` column usage
**Line count: 5,498 → 5,480 (−18)**

Removed `outcome` from all 5 (not 4 — see note) `activities` insert sites:
1. `handleSendEmail` — dropped `outcome: 'Neutral'`.
2. `handleBulkSendEmail` — dropped `outcome: 'Neutral'`.
3. `handleAddActivityLog` — dropped `outcome: activityOutcome` and the `setActivityOutcome('Neutral')` reset.
4. **Client Timeline inline log form (Feature 24)** — a 5th insert site not listed in the spec, also wrote `outcome: activityOutcome`; dropped per rule "no outcome column, ever, anywhere".
5. Save-as-template handler — template shape now carries only `type` + `desc` (dropped `lastAct?.outcome` fallback).

Dead-code cleanup:
- `DEFAULT_ACTIVITY_TEMPLATES` — removed `outcome` fields.
- Template quick-log pill — removed `setActivityOutcome(t.outcome)`.
- Activity timeline JSX — removed the Positive/Negative/No-response `act.outcome` badge block.
- Removed the `activityOutcome` state/setter and its `<select>` in the log-activity form.

Verification: `grep -ri outcome src/` → 0 matches; ESLint parses the full file with no syntax errors (remaining findings pre-existing).

**Manual test (run in browser):** log an activity from a client profile, send a single email, send a bulk email — confirm no "Could not find the 'outcome' column of 'activities'" error and that each action inserts an activity row.

## fable/fix-schema-drift — align live DB with code
**Line count: 5,480 → 5,482 (+2, two comments)**

Applied migration `fix_schema_drift` directly to the live Supabase project (verified via a fresh `information_schema` query afterwards); copy kept at `supabase/migrations/20260707_fix_schema_drift.sql`:
- `clients` + `source`, `quick_note` (Add Client insert and Quick Notes were failing exactly like the outcome bug)
- `profiles` + `current_streak`, `longest_streak`, `last_active_date` (streaks)
- `tasks` + `recurrence`, `recurrence_end_date` (recurring tasks)
- `automation_rules`: `action_value` text → jsonb, + `run_count`, `last_run_at`
- `custom_field_definitions`: renamed `field_options` → `select_options` (matches code; data preserved)
- `client_files` + `file_type`, `storage_path`; `file_url` made nullable (code never sends it)
- Created missing `webhooks` table with RLS owner policy

Code fixes (uuid ids were being parseInt'd → NaN):
- `handleDealDrop`: compare `String(d.id) === idStr` (deal drag-and-drop between stages was broken — `deals.id` is uuid)
- Email composer template picker: compare uuid as string (`email_templates.id` is uuid)

**Manual test:** add a client with a Source selected → row saves; drag a deal to another stage → it sticks after reload; pick an email template in the composer → subject/body populate.

## fable/email-new-tab — Part B: compose in a real browser tab
**Line count: 5,482 → 5,514 (+32)**

- `buildGmailUrl` / `buildMailtoUrl` helpers at module scope.
- `handleSendEmail`: opens a Gmail compose tab (`window.open`, noopener) or the default mail app per user preference; mailto fallback when the popup is blocked; still logs a "Drafted — Subject: …" Email activity and keeps merge-tag resolution unchanged.
- `handleBulkSendEmail`: opens one compose tab per recipient, 300ms apart; progress reads "Opening tab X of N…"; logs an activity per opened tab; popup-blocked recipients are counted and reported in the toast.
- "Open with: Gmail / Default Mail App" toggle in the composer footer, persisted to `localStorage('crm_email_provider')`; bulk modal copy updated ("Open N Drafts").
- Removed the now-unused `emailSending` state.
- **Note:** no `/api/*` routes exist in this repo and no `RESEND_API_KEY` is configured — the old fetch-based send ALWAYS failed ("Send failed." toast). Per spec, the "Send automatically instead" opt-in is omitted until Resend is actually set up. Remaining best-effort `/api/send-email` calls (workspace invite, automation send_email action) are silent no-ops — flagged as follow-up, same for `/api/ai-summary`, `/api/client-report`, `/api/webhook-dispatch`.

**Manual test:** open a client → Send Email → "Open Draft in New Tab" opens Gmail compose pre-filled and logs a Drafted activity; toggle to "Default Mail App" (persists after reload); select 2+ clients → Bulk Email → tabs open ~300ms apart with progress text.

## fable/fix-dark-mode — Feature 13 repair
**page.js unchanged (5,514); globals.css 53 → 69; layout.js 32 → 42**

Three compounding bugs made the toggle a no-op:
1. Tailwind **v4** ships `dark:` bound to `prefers-color-scheme`, not the `.dark` class the toggle sets. Added `@custom-variant dark (&:where(.dark, .dark *));` to globals.css — the one-line v4 way to restore class-based dark mode.
2. `layout.js` hardcoded `dark` on `<html>` — removed; replaced with a tiny pre-hydration inline script that applies `.dark` from `localStorage('crm_dark_mode')` before first paint (no flash; `suppressHydrationWarning` added).
3. `body` was forced to a near-black palette (`bg-bg-void text-text-primary` + matching CSS) regardless of theme — body/scrollbar/focus-ring styles are now theme-aware; leftover design tokens kept in `@theme` for reference.

Couldn't run `next build` in this environment (sandbox can't fetch the Linux SWC binary); ESLint parses both files cleanly.

**Manual test:** load the app (defaults to light), click the moon icon → whole UI goes dark instantly; reload → stays dark; toggle back → stays light after reload.

## fable/reports-deep — Part C: deep + custom reports
**Line count: 5,514 → 5,821 (+307)**

- **C1 Custom Report Builder** — panel above the fixed charts: Dimension (Stage/Priority/Source/Tag/Month Added) × Metric (Count/Total Deal Value/Avg Lead Score/Activity Count) × Date grouping (Day/Week/Month, active for "Month Added"). Renders a pure-Tailwind bar chart AND a table; recomputed via `useMemo` (`customReportData`). Activity Count respects the active 7d/30d/90d/1yr range.
- **C2 Period Comparison** — "Compare to previous period" toggle next to the range selector; `comparisonStats` memo computes each tile's prior value (range metrics vs prior window; cumulative metrics vs data existing at the period boundary) and shows ▲/▼ % badges.
- **C3 Drill-down** — every stat tile and chart bar is now a button: funnel bar → Relationships filtered by stage; source bar → Relationships filtered by source (new `filterSource` filter added to the advanced-filter engine, saved views, and More Filters panel); deal-stage row / Win Rate tile → Deals page filtered to that stage (new `dealsStageFilter` + banner with "Show all stages"); custom-report rows drill by their dimension.
- **C4 Saved Custom Reports** — `custom_reports` table (applied live, RLS owner policy; `supabase/migrations/20260707_custom_reports.sql`). "Save this report" stores `{dimension, metric, dateGrouping, range}`; saved reports render as pills at the top of Reports; clicking restores the exact configuration.
- **C5 Export & Scheduled Email** — "Export CSV" dumps the displayed custom table client-side; ✉ toggle on each saved pill cycles off → weekly → monthly (`send_frequency` column). **FOLLOW-UP:** actual email delivery needs a scheduled Supabase Edge Function; this repo currently has NO edge functions and no `supabase/functions/daily-notifications` (page.js references one, but none is deployed) — flagging rather than wiring pg_cron in this session.

**Manual test:** Reports → build "Source × Total Deal Value" → chart+table render; Save as "Deal value by source" → pill appears, reload restores it via click; toggle Compare → delta badges appear on tiles; click a funnel bar → Relationships pre-filtered; click a Deal Stages row → Deals shows only that stage; Export CSV downloads the table.

## fable/relationship-rename — Part D: UI-only "Client" → "Relationship"
**Line count: unchanged (5,821); layout.js description updated**

~75 user-facing strings renamed via exact-literal replacement (script counted every match against an expected count): nav items, page headings/subtitles, buttons, modal titles, table headers, toasts, empty states, confirm dialogs, webhook event labels, automation trigger/action labels, goal-type labels, keyboard-help entries, CSV export filename, Reports tile labels (incl. matching `comparisonStats` keys so C2 badges still line up).

NOT touched (verified by post-pass grep audit — every remaining "Client"/"client" hit is internal): `.from('clients')`, `client_id`, `viewingClient`/`editingClient`/etc., `appStep==='CLIENTS'`, webhook event *values* (`client.created`…), goal-type *values* (`new_clients`), the `relationship` Priority column, localStorage keys, and code comments.

**Manual test:** click through nav, Relationships page, a profile modal, merge tool, bulk bar, Reports, Settings — no visible "Client" anywhere; add/edit/delete still work (only strings changed).

## fable/visual-redesign — Part E: visual polish pass
**Line count: 5,821 → 5,956 (+135). Styling/JSX-structure only — zero handler changes.**

- **Left sidebar (240px)** replaces the top nav on desktop: logo top, nav middle, then search (⌘K), notifications (fly-out panel), dark-mode toggle, and a user block (avatar initials, name, workspace name, logout) at the bottom. Top bar + hamburger drawer kept for mobile; top bar still serves logged-out pages. Main content offset `md:pl-[268px]`; the "?" shortcut hint moved right of the sidebar.
- **Backgrounds**: #FAFAFA light / #0A0A0A dark (root div + body CSS).
- **Cards** (all `rounded-2xl` containers, 50+): borders → gray-100 / dark gray-800, dark surface → gray-900, `hover:shadow-md transition-shadow` added.
- **Typography**: all 8 page `<h1>`s → weight 600 (semibold).
- **Buttons**: 33 primary buttons → `rounded-xl` + `hover:opacity-90`, `font-semibold`; 16 ghost buttons → `rounded-xl`.
- **Badges**: priority/health/probability/settings-message badges → pill + `ring-1 ring-inset` soft rings instead of hard borders (21 conversions).
- **Kanban**: columns fixed at 280px; cards get a colored left border matching their stage (`STAGE_COLORS` map covers both relationship and deal stages) and a stronger shadow while dragging.
- **Empty states**: new `EmptyState` component (abstract inline-SVG illustration + heading + CTA) used for: relationships list (both no-data and no-match), Deals page, Tasks page, sidebar notifications, profile Files/Deals tabs, and the activity timeline.
- **Modals**: the 5 `max-w-lg` modals normalized to `max-w-2xl` (all already rounded-2xl with scrollable body + footer; confirm/goal dialogs intentionally stay `max-w-md`).
- **Skeletons**: new `SkeletonRows` component replaces the bare "Loading records..." text on the relationships list.

**Manual test:** desktop → left sidebar with working nav/search/notifications/dark toggle/logout; resize to mobile → hamburger drawer still works; kanban cards show stage-colored left edges; empty a filter to see the new empty states; reload while data loads to catch skeleton rows; open Deal/Email/Edit modals → consistent width.

## fable/company-section — Part F: Company fields
**Line count: 5,956 → 5,995 (+39)**

- DB columns `clients.company_name` / `company_url` already existed (verified in Step 0) — no migration needed; the spec's `ALTER TABLE ... IF NOT EXISTS` would be a no-op.
- Add form: "Company Name" + "Company Website" inputs; `handleAddClient` writes both (and resets them).
- Edit modal: both fields bound to `editingClient`; `handleUpdateClient` writes both.
- Relationship Profile: new Company row showing the name plus a "Visit ↗" link (`target="_blank"`, `https://` prefixed when the URL lacks a scheme).

**Manual test:** add a relationship with company "Acme" + "acme.com" → profile shows "Acme Visit ↗" opening https://acme.com in a new tab; edit and change the URL → persists after reload.

## fable/g20-multi-currency — G20: Multi-Currency Support
**Line count: 5,995 → 6,017 (+22)**

- Migration `g20_deal_currency` applied live (`deals.currency text DEFAULT 'USD'`); copy at `supabase/migrations/20260707_g20_deal_currency.sql`.
- Deal form: currency select (USD/EUR/GBP/VND/JPY/AUD/CAD) beside Value; edit prefills; create/update persist it.
- Static `FX_TO_USD` table (display-only, per spec — no real-time accounting-grade conversion): pipeline/forecast/won roll-ups and per-stage sums normalize to USD; non-USD deal cards show native value (₫/€/£/¥…) plus "≈ $X USD".

**Manual test:** create a deal in VND → card shows ₫ value + ≈USD; Pipeline Value tile stays sane in USD; edit the deal → currency preserved.

## fable/g3-voice-memo — G3: Voice Memo Quick-Log
**Line count: 6,017 → 6,053 (+36)**

- 🎤 button beside the activity-log description field. Uses the browser-native Web Speech API (`SpeechRecognition`/`webkitSpeechRecognition`, zero packages): continuous recognition, final transcripts append to the description in real time as you talk.
- Listening state: red pulsing mic, highlighted textarea, "Listening…" placeholder; click again (or pause) to stop. Graceful errors for unsupported browsers and denied mic permission.
- Distinct from G2 by design: passive dictation of the user narrating a note, not call recording.

**Manual test:** open a relationship → Activity tab → click 🎤 (grant mic), speak a sentence → text appears in the field; click 🔴 to stop; Log Entry saves it as a normal activity. In Firefox (unsupported) → friendly error toast.

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

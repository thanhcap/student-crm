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

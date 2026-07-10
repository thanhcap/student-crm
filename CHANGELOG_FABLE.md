# Fable Changelog — Email Automation v2

Branch: `fable/email-automation-v2`

## Part 1 — Workspace invite duplicate key fix
- `handleInviteMember` now inserts `user_id: null` for pending invites (was inserting the inviter's id, colliding with `UNIQUE(workspace_id, user_id)`).
- Invited email is lowercased; a pre-insert check shows a toast if an invite for that email is already pending.
- **Manual test:** invite the same email twice → second attempt shows "An invite for this email is already pending." toast, no DB error. Verify the row in `workspace_members` has `user_id = null`.

## Part 2 — Dark mode inputs + autofill
- Every `<input>`, `<textarea>`, `<select>` now carries `dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 dark:border-gray-700` (systematic pattern pass).
- Browser autofill override in `globals.css`: dark inset box-shadow + light `-webkit-text-fill-color` under `.dark`.
- Restored the theme bootstrap lost in the branch switch: `layout.js` no longer hardcodes the `dark` class or the void background; a `beforeInteractive` script applies the saved theme pre-paint (no FOUC).
- **Manual test:** toggle dark mode, open Add Relationship — type in one field, autofill another; all text is light on dark backgrounds, no white flash.

## Part 3 — Migration: cold email + auto-send infrastructure
- New tables: `cold_contacts` (UNIQUE(user_id,email), status lifecycle), `unsubscribes`, `sequence_triggers` — all with RLS + `(select auth.uid())` ownership policies.
- `sequence_enrollments.cold_contact_id` and `sequence_sends.cold_contact_id / bounced_at / unsubscribed_at` added.
- Applied via Supabase MCP; columns + RLS re-verified against `information_schema` / `pg_class` (all `relrowsecurity=true`).
- **Manual test:** `select * from cold_contacts` as an authenticated user returns only own rows; inserting a duplicate (user_id,email) errors.

## Part 4 — Auto-send engine: event triggers + runner v5
- Client: `triggerSequenceEnrollment(event, entityId, entityType, context)` — matches enabled `sequence_triggers`, evaluates `trigger_config` (deal stage / relationship stage / tag), checks the unsubscribe list, enrolls silently via `enrollClientInSequence(seq, id, { silent: true })`, and toasts `1 relationship auto-enrolled in "…"`.
- Wired into: `handleUpdateDealStage` (deal_won / deal_lost / deal_stage_changed), `handleAddClient` (relationship_created), `handleUpdateClient` (relationship_stage_changed), `handleToggleClientTag` (tag_applied), `handleToggleTask` (task_completed).
- Runner v5 (`supabase/functions/sequence-runner`): keeps the v4 graph walker + Gmail OAuth send, adds cold-contact enrollments (client_id null), unsubscribe enforcement (stops enrollment, flips cold contact status), Resend fallback when no Gmail connection (`RESEND_API_KEY` + `email_settings.resend_from_email`; gracefully skips when absent), CAN-SPAM unsubscribe footer, prospect→contacted lifecycle, and a double-send guard (existing send row for a node ⇒ advance without re-sending).
- `track` v4 deployed: new `/track/unsub/:token` — upserts into `unsubscribes`, stamps `sequence_sends.unsubscribed_at`, marks cold contact unsubscribed, stops all active enrollments for that contact.
- pg_cron: existing `sequence-runner` job (*/15) confirmed live — no change needed.
- ⚠️ Runner v5 deploy via MCP was blocked by the permission classifier (embedded cron token). Deploy manually: `supabase functions deploy sequence-runner --project-ref wuralwhctnbtkirofuph`.
- **Manual test:** move a deal to Won with an enabled `deal_won` trigger → toast + `sequence_enrollments` row. Invoke the runner with a due enrollment → send + `sequence_sends` row + activity (`activity_date`, non-null `description`), `next_send_at` advanced.

## Part 5 — Cold email engine: contacts manager
- New "Cold Contacts" tab in Email Automation: CSV import (PapaParse, auto-mapped columns email/first_name/last_name/company/title/linkedin_url/phone) with green/yellow/red validated preview and import summary ("N added, N duplicates skipped, N invalid").
- Manual add form, search + status filter chips (prospect/contacted/replied/converted/unsubscribed/bounced), bulk select → enroll in sequence / unsubscribe / delete.
- `enrollColdContactsInSequence` creates enrollments with `cold_contact_id` set and `client_id` null; skips unsubscribed/bounced/already-active. Runner v5 handles both contact kinds with the same graph logic; first send flips prospect → contacted.
- Unsubscribes tab: global list (with source + date), removable; runner + triggers skip every address on it.
- **Manual test:** upload a 100-row CSV → preview shows valid/duplicate/invalid rows → import reports counts; select 50 contacts → Enroll in sequence → 50 `sequence_enrollments` rows with `cold_contact_id`.

## Part 6 — Multichannel templates
- One-click template gallery: **LinkedIn + Email Outreach** (view → connect → cold email → 2 conditional follow-ups with Yes/No branches and Replied goals), **3-Email Cold Outreach**, **Post-Meeting Nurture** (branches on if_opened), **Deal Won Onboarding** (creates a `deal_won` sequence_triggers row).
- `handleCreateFromTemplate` inserts the sequence + all `sequence_steps` (node_type, config, canvas positions) + `sequence_edges` (default/yes/no branches) in one click, then opens the builder.
- **Manual test:** click "LinkedIn + Email Outreach" → builder opens with 15 positioned nodes and labeled Yes/No branch arrows.

## Part 7 — Visual canvas redesign
- Sequence list is now a card grid (name, Active toggle pill, trigger, enrolled/sent counts, last sent, open/run/duplicate/delete).
- Builder: 3-column layout — node palette · pannable dot-grid canvas · config panel. Header bar has Back, name, Active toggle (sets BOTH `status` and `is_active`), enroll dropdown, and a live stats bar (Sent / Opened % / Clicked / Replied / Unsubscribed from `sequence_sends`).
- Nodes: draggable cards (positions persisted to `pos_x`/`pos_y`), colored left border by type (email blue, wait gray, condition amber, LinkedIn indigo, call green, trigger purple, goal emerald), live "N sent · N here now" footer.
- Arrows: SVG cubic beziers with solid `<marker>` arrowheads, port dots at bottom-center (condition nodes get green Yes / gray No ports), floating Yes/No pill labels mid-arc, click an arrow to remove it. Click a port → click a target node to wire.
- Full dark mode on every canvas element.
- **Manual test:** drag nodes, wire an arrow between two nodes, reload — layout persists; stats bar matches funnel numbers.

## Part 8 — Trigger configuration UI
- Selecting the Trigger node shows a plain-language trigger picker: Manual, Deal Won/Lost, Deal Stage (stage dropdown), New Relationship, Relationship Stage (stage dropdown), Tag Applied (tag picker), Task Completed, No Activity (N days), Birthday (N days).
- Saves one `sequence_triggers` row per sequence (manual = no row); an info box reminds users the sequence auto-enrolls on the event.
- **Manual test:** set trigger to "Deal Won", mark a deal Won → auto-enroll toast; row visible in `sequence_triggers`.

## Part 9 — Git push
- Runner auth token is now read from the `CRON_TOKEN` function secret (never committed). When deploying the runner, set it to the same token the existing pg_cron job sends (visible in `cron.job`): `supabase secrets set CRON_TOKEN=<token>`.
- Branch `fable/email-automation-v2` pushed to origin. Vercel will auto-deploy on PR merge to main.

# ============ v3 — Production Fixes (branch fable/email-automation-fixes-v3) ============

## Step 0 — Live re-verification (discrepancies vs prompt)
- **Deployed `sequence-runner` is v4**, not v5/v6: it only queries `clients`, so cold-contact enrollments (client_id=null) are skipped. My repo already carries the v5 fix; the real gap is deployment (see Part 1).
- **gmail-oauth is already v9 and already captures `email_address`** via the OAuth2 userinfo endpoint — the prompt's "OAuth never captured the address" is stale. The live NULL row is a *pre-fix* connection; fix is reconnect + a runner guard (Part 2).
- **`email_sequences.trigger_type` had a CHECK constraint** allowing only manual/new_relationship/tag_applied — deal triggers were impossible to store. Expanded it (Part 3).
- **Workspace owner audit: 0 mis-assigned rows** — the single `role='owner'` row IS the true `workspaces.owner_id`. Bug A (invite user_id=null) was already fixed in v2.
- Live counts at time of work: 0 active enrollments, 4 cold contacts (all prospect), 0 cold-contact enrollments.

## Part 1 — Cold contacts never send
- Repo runner already resolves `clients` OR `cold_contacts`, skips the `activities` insert for cold contacts (NOT-NULL client_id FK), sets `sequence_sends.cold_contact_id`, and flips `cold_contacts.status` prospect→contacted. **Deploy required** (see Final).
- **Manual test (post-deploy):** enroll a cold contact, invoke the runner → `sequence_sends` row with `cold_contact_id`, status → contacted.

## Part 2 — Gmail From-address
- Runner now **skips + flags needs_reauth** instead of ever sending with `'me'` as From when `email_address` is null.
- Existing NULL connection flagged `needs_reauth=true` via SQL so it forces a reconnect (gmail-oauth v9 then captures the real address). Capture code already live.
- **Manual test:** reconnect Gmail → `email_address` populated; no send ever uses `'me'`.

## Part 3 — Real auto-enrollment (deal won) + trigger fix
- `triggerSequenceEnrollment` now matches sequences from BOTH systems: `sequence_triggers` rows AND `email_sequences.trigger_type/trigger_value` (legacy names aliased: new_relationship→relationship_created), deduped, with unsubscribe check. Removed the redundant legacy inline enroll blocks.
- Expanded the `email_sequences_trigger_type_check` constraint; normalized the "Auto email" sequence (`manual`/`Won` → `deal_won`).
- **Manual test:** mark a deal Won → its relationship auto-enrolls in the "Auto email" sequence (toast), no manual Send.

## Part 4 — OTP / signup verification
- `handleSignUp`: if `signUp()` returns a session (project "Confirm email" OFF), immediately `signOut()` so the Dashboard is unreachable pre-verification.
- `handleVerifyOtp`: after verifying, `signOut()` and route to the **Login** screen (no auto-enter Dashboard).
- ⚠️ **Manual dashboard step:** enable Authentication → Providers → Email → "Confirm email" in the Supabase dashboard (no SQL/API for this via MCP) so the OTP email is actually sent.

## Part 5 — Workspace role security
- Bug A (invite `user_id=null`): already fixed in v2.
- Bug B: `fetchWorkspace` membership query now `.order('created_at')` — deterministic when multi-workspace.
- Bug C: `handleUpdateMemberRole` guards on `myRole`, uses `.select()`, and refuses (toast) when the DB update affects 0 rows (RLS-blocked). Added guards to `handleRemoveMember`.
- Bug D: the owner's row never renders an editable role control for anyone (`m.role !== 'owner'`); `'owner'` is never a select option.
- Data audit: 0 rows corrected.

## Part 3B — Bulk enroll
- Relationships table bulk bar now has an "Enroll in sequence…" dropdown → `handleBulkEnrollInSequence` inserts all selected relationships in ONE batched insert (skips already-active/no-email), then the runner sends them automatically. (Deals are enrolled at the relationship level.)
- **Manual test:** select 10+ relationships → Enroll in sequence → one action creates all enrollments; they send on the next runner tick.

## Part 7 — LinkedIn acceptance features
- `email_settings.linkedin_daily_cap` (default 20) + a "Daily LinkedIn cap" setting in Email Automation settings.
- Runner enforces the cap for `linkedin_connect`/`linkedin_view` tasks (counts today's LinkedIn send rows, defers excess to the next tick), parallel to the email cap.
- `linkedin_connect` node config: personalized note template (`config.note`) with a "Use suggested" default, optional A/B `config.note_b` (variant picked per enrollment, recorded in `sequence_sends.subject_variant`), warm-up help text, and per-variant acceptance stats.
- Mutual context: when a relationship has `company_name`, the runner appends `(re: <company>)` to the connection note if not already merged.
- `sequence_sends.accepted / accepted_at` columns added; the node's acceptance rate reads them.
- ⚠️ Known limitation: the "tick Accepted on the generated task" UI isn't wired yet (tasks and send rows share no FK today) — the column + A/B recording + reporting are in place; setting `accepted` is a follow-up.
- **Manual test:** set Daily LinkedIn cap = 2, enroll 5 in a LinkedIn-connect sequence → runner creates 2 tasks/day.

## Part 6 — Canvas layout (tighter, viewport-fit)
- Canvas fills the viewport: `h-[calc(100vh-230px)]` (min 420px) instead of a fixed 640px slab that left dead space.
- Node palette is now a compact ~60px icon rail (emoji + hover tooltip) instead of a 150px labeled column.
- Config panel is contextual: its 300px column only mounts when a node is selected; otherwise the canvas spans the full width (`grid-cols-[60px_1fr]` → `[60px_1fr_300px]`).
- Kept the existing card design, SVG bezier arrows, Yes/No branches, stats bar, and full dark mode.
- **Manual test:** open a sequence builder with nothing selected → canvas is wide, no empty right panel; select a node → config slides into a reserved column; canvas reaches the bottom of the viewport with no large gap.

## Final — Required manual steps (cannot be done safely from this environment)
These three steps are needed for the fixes to take full effect in production:

1. **Deploy the fixed runner** (fixes cold-contact sending + gmail From-address guard + LinkedIn cap). The runner reads its cron token from a function secret (never committed):
   ```
   supabase secrets set CRON_TOKEN=crn_f6943a7e76c203186c09085f93aa8fd7132fd0ffe2df1c45 --project-ref wuralwhctnbtkirofuph
   supabase functions deploy sequence-runner --project-ref wuralwhctnbtkirofuph
   ```
   (Not deployed from here: doing so would require either committing the token, setting a secret via a tool that isn't available, or exposing the service-role key. The deployed v4 keeps working until you run the above.)

2. **Reconnect Gmail once** — the existing connection predates the address-capture fix (`email_address` was NULL); it's been flagged `needs_reauth=true`, so Settings → Gmail Sync will prompt a reconnect, which captures the real address via gmail-oauth v9 (already live).

3. **Enable "Confirm email"** in the Supabase dashboard: Authentication → Providers → Email → Confirm email. Without it the OTP email is never sent (the project currently activates accounts immediately). The client code already blocks Dashboard access pre-verification regardless.

### Verify cold-contact send after step 1
```
-- create a test enrollment for an existing prospect cold contact
insert into sequence_enrollments (sequence_id, cold_contact_id, user_id, status, current_step, next_send_at)
select 9, cc.id, cc.user_id, 'active', 0, current_date
from cold_contacts cc where cc.status='prospect' limit 1;
-- then: supabase functions invoke sequence-runner  (or wait for the */15 cron)
-- expect: a sequence_sends row with cold_contact_id set, cold_contacts.status -> 'contacted'
```

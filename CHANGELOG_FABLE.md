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

## Security incident — CRON_TOKEN leak, rotation, and full remediation (2026-07-10)
An earlier revision of this file committed the live pg_cron auth token in plaintext (as part of a `supabase secrets set` example command). That commit was already pushed to GitHub. Remediation, in order:

1. **Redacted** the token from this file (no live secret remains in any tracked file — verified via full-repo grep).
2. **Rotated the credential, fully, with the user's explicit authorization**: a fresh, purpose-built token was generated and stored in **Supabase Vault** (`vault.create_secret(..., 'cron_token', ...)`) — never written to any file, never logged in `cron.job`. `cron.job` (sequence-runner, `*/15 * * * *`) was updated via `cron.alter_job` so its command *dereferences* `vault.decrypted_secrets` at execution time rather than embedding a literal bearer token.
3. **Redeployed `sequence-runner` (now v7)** with a new auth check: accepts the service-role key, or a token fetched via `public.get_cron_token()` — a `SECURITY DEFINER` RPC restricted to `service_role` (migration: `supabase/migrations/20260710_cron_token_vault_rpc.sql`) that reads the Vault secret server-side. **No hardcoded literal in source, no `Deno.env`/`supabase secrets set` step required at all.**
4. **Verified**: the deployed function source contains zero secret literals; `cron.job.command` contains zero secret literals (only the vault-dereferencing subquery); the old leaked token is no longer accepted by any code path — it is fully dead regardless of what remains visible in old git history.
5. **Not done**: a git-history rewrite (the token is still visible via `git log -p` on 3 old commits). Rotation neutralizes the danger of the leak; a history rewrite is optional hygiene the user can request separately (destructive, requires force-push across branches).

This required no Gmail/cold-contact-adjacent manual steps — the runner fix from Parts 1/2 below is now **live** (v7 includes it).

**Manual test:** wait for the next `*/15` tick (or confirm via `cron.job_run_details`) — the job succeeds using the new Vault-backed token; nothing needed from the user.

## Two remaining manual steps (dashboard-only, no CLI)

1. **Reconnect Gmail once** — the existing connection predates the address-capture fix (`email_address` was NULL); it's been flagged `needs_reauth=true`, so Settings → Gmail Sync will prompt a reconnect, which captures the real address via gmail-oauth v9 (already live).

2. **Enable "Confirm email"** in the Supabase dashboard: Authentication → Providers → Email → Confirm email. Without it the OTP email is never sent (the project currently activates accounts immediately). The client code already blocks Dashboard access pre-verification regardless.

### Verify cold-contact send after step 1
```
-- create a test enrollment for an existing prospect cold contact
insert into sequence_enrollments (sequence_id, cold_contact_id, user_id, status, current_step, next_send_at)
select 9, cc.id, cc.user_id, 'active', 0, current_date
from cold_contacts cc where cc.status='prospect' limit 1;
-- then: supabase functions invoke sequence-runner  (or wait for the */15 cron)
-- expect: a sequence_sends row with cold_contact_id set, cold_contacts.status -> 'contacted'
```

# ============ v4 — Full-Screen UX + Networking + Launch Pages (branch fable/networking-fullscreen-launch) ============

## Step 0 — Audit (inventory + discrepancies vs prompt)
- App is a single 8.2k-line `src/app/page.js` driven by `appStep` — no real sub-routing (the `src/app/clients/*` and `src/app/login/*` files are dead stubs with hardcoded fake data). Full-screen conversions therefore stay state-driven; only the new marketing/pricing surfaces get real routes.
- Modal inventory (fixed-overlay + centered card): ConfirmModal (component), global search palette, cold CSV import preview, relationship profile (`viewingClient`), edit relationship (`editingClient`), delete-confirm, deal form, email composer, bulk email, CSV import preview, merge tool, goal form, keyboard help.
- Kept as small dialogs deliberately: ConfirmModal, delete-confirm (destructive yes/no), global search (palette idiom), keyboard help. Everything content-bearing converted (below).
- State names confirmed: `viewingClient`/`editingClient`/`showDealForm`/`showEmailComposer`/`showGoalForm`/`activeProfileTab` (already existed); lead scoring exists (`clientsWithScores`, `leadScore`, `filterScore`). No plan-gating exists anywhere (Part 7 tiers are marketing-only). No Job/Payment forms exist (prompt discrepancy — nothing to convert).

## Part 1 — Full-screen views (was cramped modals)
- **Relationship profile**: full-viewport surface, sticky header (Back to Relationships · Send Email · Export PDF · Edit), `max-w-6xl` two-column layout — 320px sticky identity/contact/custom-fields/referrals/quick-note sidebar + tabbed (Activity/Tasks/Files/Deals) main column with underline-style tabs. Collapses to one column on mobile (sidebar stacks above tabs, header stays sticky). Bounded dark-mode pass applied to the whole block (it was previously white-only even in dark mode).
- **Converted with the same sticky-header/Back pattern**: Edit Relationship, Deal form, Email composer (`max-w-2xl` readable writing column), Bulk email, CSV import preview (`max-w-5xl`), Merge tool, Goal form, Cold-contacts CSV preview.
- **Manual test:** open a relationship at 1280px — two columns, sticky sidebar, no dimmed backdrop; at 375px — single column, no horizontal scroll; Back button everywhere replaces the corner ×.

## Part 2 — Company is always a real clickable link
- Module-scope `companyLinkFor(contact)`: uses `company_url` (https-normalized) when set, otherwise a LinkedIn company search for the name; returns null when neither exists. Handles both relationship clients (`company_name`/`company_url`) and cold contacts (`company`).
- Reusable `<CompanyLink client={...} />` (external-link icon, `stopPropagation` so clickable table rows don't swallow it) replaces ad-hoc renders in: relationship profile sidebar (keeps the G17 favicon), relationships table row (new line under email), cold contacts table cell, the Who-Replied rows (Part 3), and the enroll panel rows (Part 4).
- **Manual test:** relationship with `company_url` → opens that URL in a new tab; name-only → LinkedIn company search; neither → no company row rendered.

## Part 3 — "Who Has Replied?" view
- Cross-campaign full-screen view (Part 1 pattern) listing every reply from the already-loaded `sequence_sends` (`replied_at` stamped by gmail-sync/runner — no new tracking infrastructure, no new fetch): avatar, name (+Cold Contact badge), CompanyLink, "Replied to “subject” in campaign · date", View Relationship (clients), Stop Sequence (active enrollments only; completed/stopped show their status).
- Entry points: badge-counted "💬 Who Has Replied?" button in the Email Automation hub header, and the canvas stats-bar "Replied" stat is now clickable → opens the view pre-filtered to that campaign (with a "Show all campaigns" release).
- **Manual test:** click Replied in a campaign header → only that campaign's replies; hub button → all replies; Stop Sequence stops an active enrollment.

## Part 4 — Enroll filter connected to the real CRM
- The main relationships table predicate was extracted into ONE shared `matchesClientFilters(client, opts)` — the table's `filteredAndSortedClients` and the new enroll panel both call it (single source of truth; enroll adds a `scoreMin` numeric floor).
- Full-screen "Enroll by filter" panel (button in the campaign builder header): stage/priority/source selects, tag pills, min-score input, search, live "N relationships match" count, preview list (first 100) with lead scores and already-enrolled dimming.
- "Enroll All Matching" → `bulkEnrollClientsInSequence` — ONE batched insert (skips no-email + already-active), shared with the relationships-table bulk bar (refactored to call the same function).
- **Manual test:** set Priority=High in the panel → count matches the main table filtered the same way; Enroll All Matching creates all rows in one insert; runner picks them up next tick.

## Part 5 — Composer surfaces
- Manual Send Email composer: full-viewport with sticky Cancel header and a readable `max-w-2xl` writing column (converted in the Part 1 pass; internals/Gmail-tab send byte-for-byte unchanged).
- Campaign step editor: the canvas config panel now widens to 480px when the selected node is an email step (other node types keep 300px) — real writing room without leaving the canvas.
- **Manual test:** select an email node → panel is visibly wider; select a wait node → back to compact; Send Email from a profile opens the full-page composer prefilled.

## Part 6 — Landing page
- Logged-out visitors hitting `/` now land on a marketing page (`appStep === 'LANDING'`); authenticated sessions go straight to the Dashboard as before (login flow untouched). `/?signup=1` and `/?login=1` deep-link into the auth forms (used by /pricing).
- Sections: sticky nav (Pricing · Log in · Start Free), hero with headline + CSS-built automation-canvas mockup in a browser-chrome frame, proof strip, 5-tab interactive feature showcase (Relationships / Deals / Automation / Who Replied / Reports — each with its own CSS product mockup), 4 alternating capability sections, dark final CTA banner, footer.
- Product visuals are CSS mockups, not images — no `/marketing/*.png` assets exist, and broken images on a revenue-critical page would be worse (noted as an upgrade path for real screenshots/video later).
- Fully responsive (single column < lg), dark-mode aware, no layout shift (aspect-ratio frames).
- **Manual test (browser-verified):** `/` logged-out shows the landing at 1280px and 375px (no horizontal scroll); Start Free → signup form; `/?signup=1` deep link lands on signup with URL cleaned.

## Part 7 — Pricing page
- New public route `/pricing` (static, self-contained — doesn't import the app bundle). Nav links back to `/`, `/?login=1`, `/?signup=1`.
- Monthly/Annual toggle (−10%), 3 tier cards (Free $0 / Pro $19 recommended / Team $39 per-seat) — marketing-only for now: Step 0 confirmed no plan-gating exists in the app yet, so tiers describe the roadmap SKUs without enforcing limits.
- Cinematic Email Automation pitch: the page's largest visual (full sequence canvas mock with Yes/No branches), gradient background, extra vertical whitespace, 0-clicks/auto-stop/2-channels stat row — deliberately slower-paced than the rest.
- Grouped comparison accordion (Core CRM open by default; Email Automation, AI, Team & Security) and a 4-question FAQ accordion; dark final CTA.
- **Manual test (browser-verified):** `/pricing` renders all sections; accordion + toggle interactive; tier CTAs deep-link to signup; dark-mode classes on every element.

# ============ v5 — Builder Full-Screen + Cold↔CRM Bridge + 3D Landing (branch fable/builder-fullscreen-3d) ============
(Covers BOTH pasted master prompts — the "email-automation-rework" one and the "builder-fullscreen-3d" one — as a single pass, since the second builds directly on the first.)

## Step 0 — Reconnaissance (reality vs the prompts)
- **Migration claim VERIFIED live**: `client_id` nullable on `sequence_enrollments` + `sequence_sends`, `subject`/`body` nullable on `sequence_steps`, `is_draft`/`from_name`/`reply_to`/`description` exist, and both `*_one_contact_ref` CHECK constraints are in place. NOT re-applied.
- **React key warning root cause found — and it is NOT the builder**: the only `Date.now()` identity in the file is `showToast` (`const id = Date.now()`), and page.js:8674 is exactly the `toasts.map(... key={toast.id})` render. Two toasts in the same millisecond (easy: bulk enroll + auto-enroll both toast in one handler pass) collide. The prompt's node/template hypothesis doesn't apply: `handleAddNode`/`handleCreateFromTemplate` already insert to the DB first and key off returned real ids.
- All 4 existing `sequence_enrollments`/`sequence_sends` inserts already set exactly one contact ref (the cold path passes `client_id: null` explicitly) — conformance audit passed with no changes needed.
- Email Automation section already matches most of the target architecture from v4 (full-screen gallery/builder/who-replied/enroll panel, icon-rail palette, contextual config, SVG beziers, batched template inserts, shared `matchesClientFilters`) — this pass reuses it and adds what's genuinely missing: the full-screen email draft studio, 2-step create flow, is_draft plumbing, engagement filters, cold→relationship conversion, 3D hero, logout→landing.
- `three`/`@react-three/fiber` not installed; logout currently lands on `LOG_IN`.

## Part A — is_draft plumbing + runner v8 (deployed)
- `resolveNextNode` (shared graph walker) now skips any node with `is_draft = true` — an unfinished draft can never execute; the walker flows past it to the next node.
- Belt-and-braces in the runner's email branch: subject/body are nullable now, so an email step with empty subject OR body advances the enrollment without sending, even if `is_draft` wasn't set.
- `buildMime` honors the new `email_sequences.from_name` (RFC 2047-encoded display name) and `reply_to` headers.
- **Deployed as sequence-runner v8** (no secrets in source; Vault-based cron auth unchanged).
- **Manual test:** set a step's `is_draft=true` via SQL, invoke the runner with a due enrollment → no send row for that step; enrollment advances past it.

## Part B — React duplicate-key fix
- Root cause was `showToast`'s `id = Date.now()` (page.js:8674 is the `toasts.map` render) — NOT builder nodes: `handleAddNode`/`handleCreateFromTemplate` already insert to the DB first and key off returned real ids, and no other `Date.now()` identity exists in the file (audited; the remaining hits are time math, a random-suffixed token fallback, and a storage path).
- Fix: module-scope collision-proof `uid(prefix)` (crypto.randomUUID with fallback); `showToast` now uses `uid('toast')`.
- Defense-in-depth: `seqNodesFor`/`seqEdgesFor` now dedupe by id before render (dev-console error on drop), so a double-fetch race or optimistic echo can never resurface duplicate keys in the builder.
- **Manual test:** trigger two toasts in one handler pass (bulk enroll with an auto-enroll trigger active) → zero console key warnings.

## Part C — Cold↔CRM bridge
- Insert conformance audit: all 4 `sequence_enrollments`/`sequence_sends` insert sites already set exactly one contact ref (cold paths pass `client_id: null` explicitly) — the new CHECK constraints accept them unchanged.
- **`convertColdToRelationship(coldId)`** — the missing payoff action: creates a `clients` row (source "Cold Outreach", stage Contacted, priority Medium, preserving name/email/phone/company/linkedin), flips `cold_contacts.status → 'converted'`, and logs an activity (`activity_date`, non-null `description`, no `outcome`). Duplicate-email guard. The live enrollment intentionally stays on the cold-contact track (one-ref CHECK; rewriting mid-flight would corrupt send history).
- Convert is available from BOTH the Engagement inbox rows (green "Convert to Relationship" for un-converted cold contacts) and the Cold Contacts table row actions.
- The Who-Replied view is now the **Engagement inbox**: filter chips Replied / Opened / Clicked / All sends (drives the memo; rows show the strongest signal + date), still per-campaign filterable from the builder's Replied stat.
- Bulk "Enroll in campaign" from the Relationships side already exists (v4's bulk-bar dropdown → same batched insert) — verified, not duplicated.
- **Manual test:** filter Engagement to Opened → rows show opened dates; click Convert on a cold contact → clients row appears, status flips, activity logged, button becomes "Converted ✓".

## Part D — Full-screen email draft studio + 2-step create flow + is_draft UX
- **EmailStudio** (full-screen, z-above builder): writing surface left (`max-w-2xl` readable column — subject with char-count warning, optional purple A/B variant, merge-tag pill bar with cursor-aware insertion, 16-row body, word count/read time); live preview right (420px — From/To headers using the sequence's `from_name` + connected Gmail, resolved against a real contact picked from THIS campaign's enrollments, cold contacts included).
- Autosave 900ms after typing stops; `is_draft` set automatically whenever subject or body is empty ("Draft — won't send" indicator). Empty-tag warning: any `{{tag}}` that resolves blank for the previewed contact is flagged inline — the guard against "Hi , I loved your work at ." sends.
- Templates both directions: apply a template pill (confirm before overwriting a non-empty draft) or "+ Save as template" into `email_templates`.
- **"Send test to me"**: resolves tags against the preview contact and opens a prefilled compose addressed to YOUR connected Gmail (never the contact), `[TEST]`-prefixed. Adaptation noted: the app's existing interactive send path is a Gmail compose tab (no server send API exists), so the test send uses it; guards on missing address / needs_reauth.
- Entry points: "✎ Open email editor" in the config panel (which now shows a draft/ready status card + preview instead of cramped inline fields) and double-click on any email node. Email nodes now render an amber (draft) / green (ready) completeness dot; new email nodes start as real drafts (`subject/body = null`, `is_draft=true`) instead of placeholder text that could send.
- Live toggle warns before activating a campaign containing drafts ("N email steps are still drafts and won't send. Activate anyway?").
- **Create Campaign** is a full-screen 2-step flow: basics (name*, description, from_name, reply_to) → template cards with tiny node-shape previews + Blank canvas (creates the sequence + a trigger node). The hub's old template grid + inline form are replaced by one "+ New Campaign" button; campaign cards now show the description and a green replied count.
- `resolveMergeTags` extended (not replaced): first_name/last_name/title/linkedin_url/sender_name + cold-contact field shapes, `{{sender_name}}` from `from_name` → profile username.
- **Manual test:** create a campaign via the flow → lands in a populated builder; double-click an email node → studio; clear the subject → amber dot + "Draft — won't send"; activate → warning; preview shows blank-tag warning for a contact with no company.

## Part E — 3D landing hero + logout → landing
- `three` + `@react-three/fiber` + `@react-three/drei` installed. `src/app/Hero3D.js`: a slowly rotating campaign-graph constellation (trigger→email→wait→condition→yes/no spheres in the node-type colors) with white light pulses traveling the edges — thematically "the sequence is running", not decorative geometry.
- Guards, all three: lazy `next/dynamic({ ssr: false })` so three.js never enters the initial bundle; rendered only ≥1024px; only under `prefers-reduced-motion: no-preference` (live matchMedia listeners). Fallback everywhere: the static indigo gradient.
- Hero restructured: 3D (or gradient) behind the headline/CTAs in a 62vh centered band; the CSS product mock moved to its own section below.
- `handleLogout` now resets all per-session state (clients/activities/tasks/deals/sequences/steps/enrollments/sends/edges/triggers/cold contacts/unsubscribes + open views) and lands on the marketing page (`LANDING`), not a bare login form.
- **Manual test:** desktop logged-out `/` shows the animated graph behind the headline; narrow viewport or reduced-motion shows the gradient; logout from the app lands on the marketing page; console clean.

## VEX video-background hero (design request)
- Replaced the landing hero (the Part E 3D graph) with a full-viewport **raw video background** (CloudFront mp4, autoplay/loop/muted/playsInline, `object-cover`, no dark/gradient overlay).
- Added a global `.liquid-glass` utility (frosted dark panel + masked luminous edge via `::before`) and `-moz-osx-font-smoothing: grayscale` to `globals.css`. Inter is already the app's sans font via `next/font` (`--font-sans`), so the spec's `<link>`/Tailwind-config steps were satisfied without a CDN font.
- `FadeIn` (opacity 0→1 after configurable delay/duration) and `AnimatedHeading` (per-character slide-in-from-left + fade, 30ms stagger, 200ms initial delay, 500ms per char) components. Chars are grouped per word (`whitespace-nowrap`) so the heading breaks only at word boundaries, never mid-word.
- Hero: liquid-glass navbar (VEX · Story/Investing/Building/Advisory hidden <md · "Start a Chat"), bottom-pinned content in a `lg:grid-cols-2` — headline "Shaping tomorrow / with vision and action." (`-0.04em` tracking, staggered entrance), subheading (fade 800ms), CTAs "Start a Chat" + "Explore Now" (fade 1200ms), and a bottom-right glass tag "Investing. Building. Advisory." (fade 1400ms). CTAs wired to signup / scroll-to-content so nothing is a dead control.
- **Browser-verified** at 1600px (2-column, tag bottom-right) and 375px (single column, center nav hidden, no horizontal scroll); console clean.
- ⚠️ Note: this hero uses the VEX venture-firm branding/copy exactly as specified, but the marketing sections below it are still the Student CRM product copy — the page reads as two identities. Left as-is per "recreate this hero exactly"; say the word and I'll reconcile the branding either direction.

## Final — push
- Backup of prior origin/main taken; branch `fable/builder-fullscreen-3d` (Parts A–E + VEX hero) merged to main and pushed. Vercel auto-deploys.

# ============ v6 — Redesign pass (branch redesign/total-layout-v2) ============

## Step 0 — Reconnaissance (reality vs prompt)
- Still one file: `src/app/page.js` (~9.1k lines).
- **No icon library is installed** (no `lucide-react`/`react-icons`/heroicons). Every "icon" in the app is an **emoji used as UI** — ~50 instances across ~20 glyphs (✉ ⚡ 🎉 🤝 🔗 🔁 🎯 ▶ 🔥 🔀 📞 📝 💡 ✅ ⏱ 📥 💬 💗 ⭐ …). So Part 2's "remove icon packages" is moot; icon removal = emoji removal.
- **Mail code (Part 5):** `buildGmailUrl` + `buildMailtoUrl` at module scope; `emailProvider` state ('gmail'|'mailto') persisted to localStorage; call sites in `handleSendEmail`, `handleBulkSendEmail`, `handleSendSequenceStep`, and the EmailStudio test-send. Confirmed the mailto fallback is the iCloud culprit.
- **Landing video (Part 6):** the `<video>` at page.js:880 is the **VEX CloudFront hero I built LAST TURN at the user's explicit "recreate this hero exactly" request.** Part 6 says delete it — a direct conflict with just-delivered, explicitly-requested work. Flagged for the user rather than silently deleted.
- `three`/`@react-three/fiber`/`@react-three/drei` already installed; **`framer-motion` is NOT** (Parts 6/7 need it).
- Tabs: the profile tabs and Email Automation hub tabs use bespoke underline/pill markup; the canvas config + enroll panels use ad-hoc buttons.

## Part 5 — Send Email fixed (Gmail web compose only; mailto/iCloud fallback removed)
- New `buildGmailComposeUrl({to,subject,body,from})` → `https://mail.google.com/mail/u/0/?view=cm…` (pins `authuser` when a connected address is known). **`buildGmailUrl` + `buildMailtoUrl` deleted.**
- `emailProvider` state + `setEmailProviderPersist` + the localStorage persistence + the "Gmail / Default Mail App" toggle UI all **removed**. Added `blockedComposeUrl` state.
- All four send paths (manual composer, bulk email, manual sequence-step send, EmailStudio test-send) now open Gmail only. On a blocked popup they surface an explicit **"Open Gmail"** link and toast — they **never** fall back to `mailto:`. Verified: zero `mailto:` URLs remain in `src/` (only a code comment).
- Draft activity still logged (`activity_date`, non-null `description`, no `outcome`).
- Part 5.3: honest **"Gmail isn't connected / needs reconnecting"** banner at the top of Email Automation (gmail_connections is empty live), linking to Connect Gmail; Settings already carries the Gmail Sync card. Note (reality wins): I did **not** hard-block campaign activation, because the runner also has a **Resend** auto-send path (`email_settings.resend_from_email` is set) — hard-blocking on "no Gmail" would break a working capability. The banner states both paths.
- **Manual test:** open a relationship → Send Email → composes in a Gmail tab (not Apple Mail); block popups → "Open Gmail" link appears; no iCloud handoff anywhere.

## Part 1 + Part 3 — Design system + unified Tabs (foundations)
- Module-scope design tokens in page.js: `S` (surfaces), `R` (two radii), `T` (type scale), `SP` (8pt spacing), `EASE`, `ACCENT` (per-domain color). Primitives `Panel`, `UIButton` (named UIButton to avoid the native Button), `Field`, `inputCls`. These are the single source screens will consume as they're rebuilt.
- `Tabs` component (sliding-underline indicator via `useLayoutEffect` measuring the active tab). Not yet swapped into existing tab bars — that happens as each screen is rebuilt (per the agreed one-screen-at-a-time plan).
- `useMediaQuery` + `usePrefersReducedMotion` hooks; `framer-motion` installed for scroll reveals.

## Part 6 — Landing hero: video deleted, real 3D graph (user chose this over keeping the VEX video)
- **Deleted the VEX CloudFront `<video>`** (confirmed zero `<video>`/cloudfront refs remain) and its liquid-glass VEX chrome.
- `src/app/HeroScene.js`: a Three.js campaign graph — 6 nodes (trigger→email→wait→condition→goal/linkedin) in their `ACCENT` colors with white light pulses traveling the edges + slow idle rotation + cursor parallax. Self-contained: dropped drei's `<Environment>` (external HDR that would suspend forever if blocked) and used emissive materials + 3 point lights so nodes glow their colors.
- Lazy-loaded `dynamic(() => import('./HeroScene'), { ssr:false })` — three.js stays out of the initial bundle. Rendered **only** on `≥1024px` and **not** under `prefers-reduced-motion`; otherwise a static radial-gradient fallback (no WebGL, no layout shift).
- Hero rebuilt with design tokens (clean token-based nav + `T.display` headline + soft radial legibility scrim), Student-CRM copy — resolving the two-identity problem the VEX video created (hero + product sections now one brand).
- **Browser-verified** at 1280px (colored 3D graph renders, headline crisp over the scrim, console clean) and confirmed the fallback path below 1024px.

# ============ v7 — Marketing site (5 pages, dark cinematic) ============

## Foundation — fonts, theme tokens, shared design system
- `layout.js`: added `Urbanist` (weights 500/600/700) via `next/font/google` as `--font-urbanist`, wired onto `<body>`. Inter stays the body face.
- `globals.css` `@theme`: added `--color-ink #060218`, `--color-ink-2 #070319`, `--color-accent #A068FF`, and `--font-urbanist`.
- New `src/app/(marketing)/marketing.css`: CSS-only cinematic background (`.cinematic-bg` — base ink + two radial accent glows + `feTurbulence` grain via `::before`, no photographic asset), `.font-display`, the GradientBorderButton (`@property --border-angle` + `border-spin` conic-gradient border + slide-in `::after`), typewriter caret, orbit rings, logo-ticker scroll, entrance animations, and a full `prefers-reduced-motion` block that freezes every animation.
- New `src/components/marketing/ui.js`: `usePrefersReducedMotion`, `GradientBorderButton` (renders `<a>` or `<button>`), `TypewriterHeading` (per-clause colored parts, reduced-motion aware), `useCountUp` (easeOutCubic), `LogoTicker`.
- New `src/components/marketing/OrbitVisual.js` (4 concentric rings of role avatars orbiting a live count-up), `MarketingHeader.js` (wordmark + nav Your Team/Solutions/Blog/Pricing, Log In → `/?login=1`, "Start Free" → `/?signup=1`, mobile menu), `MarketingFooter.js`.
- New `src/app/(marketing)/layout.js`: imports marketing.css + shared header/footer, wraps children in `.cinematic-bg`.

## Pages
- **Home** (`src/app/page.js`, edited): the logged-out `LandingPage` is now the dark cinematic home — `TypewriterHeading`, `GradientBorderButton`, `OrbitVisual`, `LogoTicker`, how-it-works, feature cards linking to `/solutions#anchors`, testimonial placeholder (TODO), final CTA. **Auth branching preserved** (`?login=1` / `?signup=1` modal routing, logged-in dashboard untouched). No `<video>`; HeroScene removed from Home.
- **Solutions** (`src/app/(marketing)/solutions/page.js`, new): hosts the site's **single** live WebGL canvas (`HeroScene`, lazy `dynamic({ssr:false})`), gated to desktop (≥1024px) + no-reduced-motion with a static fallback. Four feature sections anchored to pricing's `COMPARISON_ROWS` categories; feature mocks are static glass (only the hero canvas is live → one WebGL context total).
- **Your Team** (`src/app/(marketing)/team/page.js`, new): mission/about page — values grid + **placeholder** people (marked TODO, no fabricated names).
- **Blog** (`src/app/(marketing)/blog/page.js`, new): static demo cards + category filter chips (TODO: real CMS/MDX + `/blog/[slug]`).
- **Pricing** (`git mv` from `src/app/pricing/` into `(marketing)`, restyled dark): **all logic preserved verbatim** — `PRICING_TIERS`, `COMPARISON_ROWS`, `PRICING_FAQ`, annual toggle, accordions. Recolored to ink + `#A068FF`, CTAs wrapped in GradientBorderButton; inline nav/footer removed (the group layout provides them).
- Colors `#A068FF` accent on `#060218`/`#070319` ink throughout; Inter body + Urbanist display; reduced-motion fallbacks site-wide.
- **Verified:** `next build` clean (all 5 routes prerender); browser-checked Home, Pricing (dark restyle intact), Solutions (exactly one live WebGL canvas, `gl.isContextLost()===false`); console clean.

# ============ v8 — Total layout redesign (branch redesign/total-layout-v2) ============

## Step 0 — Reconnaissance (reality vs the master prompt)
- `src/app/page.js` is still one file, **9313 lines**.
- **Design system already built** (v6): `S`/`R`/`T`/`SP`/`EASE`/`ACCENT` + `Panel`/`UIButton`/`Field`/`inputCls` at page.js:18–77 → Part 1 satisfied.
- **`Tabs` component exists** (page.js:78) but has **0 usages** → Part 3 (wire it everywhere) still open.
- **Sidebar already exists** (`<aside>` page.js:4853, fixed left `w-60`, NAV order matches the prompt) → Part 4.1 largely satisfied; needs token retheme + de-icon.
- **No icon libraries** (lucide/react-icons/heroicons = 0). **19 inline `<svg>`** (mostly functional: Google logo, Eye/EyeSlash, Search, Bell, logout, add) + **~119 lines carrying emoji-as-UI** (node types ⚡✉️⏱🔀🔗🤝📞✅🎯, streak 🔥, goals 🎯🎉, ☀️🌙) → Part 2 open.
- **Mail:** `buildGmailComposeUrl` only; **no `mailto`, no `emailProvider`** → Part 5 already done (v6).
- **No `<video>`**; `HeroScene.js` 3D graph present → Part 6 already done (v6).
- three / @react-three/fiber / @react-three/drei / framer-motion all installed.
- Node-type emoji live in the runner-mirrored `NODE_META`/`NODE_TYPES` config, so removing them is display-only (no data/logic change).

## Part 7 — Animated pricing (marketing/pricing/page.js)
- `TiltCard`: 3D `rotateX/rotateY` toward the cursor + `translateY(-6px) scale(1.02)` on hover, plus a radial light that follows the pointer across the surface (`--light` var). Reduced motion disables all transforms and the moving light.
- `AnimatedPrice`: whole-dollar count-up (easeOutCubic, rAF) that re-animates whenever the target changes — so flipping Monthly⇄Annual animates $19→$17 and $39→$35, not a snap. Holds at 0 until the cards scroll into view (`useInView` IntersectionObserver); snaps straight to value under reduced motion.
- Billing toggle is now a **sliding-pill**: a white indicator animates its `left`/`right` between Monthly and Annual (350ms, the design ease); labels cross-fade their color.
- Feature rows **stagger in** (`.feat-in`, 50ms step) once the card enters view. Recommended badge gets a continuous **shimmer sweep** (`.badge-shimmer`, 4s loop) — new keyframes in marketing.css, all frozen under `prefers-reduced-motion`.
- All existing logic untouched: `PRICING_TIERS`, `COMPARISON_ROWS`, `PRICING_FAQ`, the annual math (`Math.round(price*0.9)`), both accordions.
- **Browser-verified** at 1280px: count-up climbs 0→$19/$39 on load, toggle slides right and prices re-animate to $17/$35, badge shimmers, feature rows stagger, console clean, `next build` green.

## Part 3 — Unified Tabs component wired into the app's tab bars
- The `Tabs` component (page.js:78, sliding cubic-bezier underline indicator, optional monospace count) previously had **0 usages**. Now consumed by:
  - **Relationship profile** tab bar (Activity / Tasks / Files / Deals) — replaced the ad-hoc `border-b-2` buttons; Tasks & Deals show live counts (`tasks.filter(client_id)`, `deals.filter(client_id)`).
  - **Email Automation** section switcher (Sequences / Cold Contacts / Unsubscribes) — replaced the pill-in-a-tray buttons; Cold Contacts shows its count.
- One implementation, one motion curve, no icons — consistent with the design system.
- `next build` green. (Both bars are behind auth; verified by build + review — not browser-shot, as I don't log in with the user's password.)

## Part 2 — Remove emoji-as-UI + de-icon sidebar
- **Sidebar de-iconed:** the Search / Bell / logout inline `<svg>` icons and the ☀️/🌙 emoji became plain text labels ("Search", "Notifications", "Log out", "Light/Dark mode"). (SearchIcon/BellIcon defs kept — still used by the mobile top bar.)
- **Node-type emoji → colored dots:** the automation node palette, node cards, node inspector, and template shape-previews now use the existing `NODE_META.dot` accent color (a `w-2 h-2 rounded-full` dot) + the type label instead of ⚡✉️⏱🔀🔗🤝📞✅🎯. Meaning now comes from color + type name, per the design system.
- **Dead code removed (~200 lines):** `MockWindow/MockCanvas/MockTable/MockKanban/MockReport/MockReplies`, `FadeIn`, `AnimatedHeading` — all unreferenced since the v7 landing rebuild (`LandingPage` at :775 is live and untouched). This also erased a large emoji cluster. File dropped from 9,313 → ~9,120 lines.
- **~45 emoji-as-UI sites stripped** across dashboard widget headings (🔥🎯⭐💗🔁📍🎂⚡❄️), status text (✓ on Saved/Enabled/Converted/Auto-send), action buttons (✎/🗑/✕ → "Open email editor"/"Delete"), quick-note 📝 → an uppercase "Note" tag, recurrence 🔁 → "Repeats" tag, file-type 📄🖼️📎 → PDF/IMG/FILE, voice 🎤/🔴 → "Voice/Stop", inbox 📥 → dot, and inline ⚠️/💡/🔌/💬 prefixes removed.
- **Kept deliberately:** email *content* emoji (e.g. the "Welcome aboard 🎉" template body the user actually sends — that's copy, not chrome), flow arrows (→), the external-link ↗ and disclosure chevrons (permitted affordances), the ⌘K shortcut chip, the ✓ inside the onboarding step-completion circle, and the `// ⚠ KEEP…` code comment.
- Zero UI-emoji residual in a full grep (excluding those kept-by-design cases). `next build` green.

## Part 4.1 + 4.2 — Sidebar retheme + editorial Overview greeting
- **Sidebar (Part 4.1):** desktop nav items now use the token control radius (`R.ctl`), a calmer token hover (`bg-black/[0.02]`), fixed `h-9` rhythm, and a **left-rail active marker** (`w-[3px] h-4` rounded bar) instead of only a filled pill — matching the design-system spec. "Dashboard" relabeled **"Overview"** across the desktop sidebar, mobile top bar, and mobile drawer.
- **Overview (Part 4.2):** replaced the generic "Overview / Monitor your workspace activity" header with a **live editorial greeting** — "Good morning/afternoon/evening, {Name}." + a computed sub-line ("You have N follow-ups due and M deals closing this week.", with graceful singular/plural and an empty-state line). Counts come from real data: pending tasks due ≤ today, and open deals whose `close_date` falls within 7 days. Uses `T.h1`/`T.body` tokens.
- `next build` green.

## Part 4.3 + 4.4 — Relationships floating action bar + Deals kanban polish
- **Relationships (Part 4.3):** the bulk-select action bar is now a **floating pill anchored to the bottom of the viewport** (`fixed bottom-6`, centered accounting for the 240px sidebar, `bg-gray-900/95` glass, token radius/controls) instead of an inline blue banner. Added a "Clear" affordance and "N selected" count; all bulk actions (status, Bulk Email, enroll, delete) preserved.
- **Deals (Part 4.4):** columns widened to the spec `w-[300px]`; drag feedback now **lifts the card** (`active:scale-[1.02] active:rotate-[0.5deg] active:shadow-xl`) and the **target column softly tints indigo** on drag-over (`drag-over` class toggled in `onDragOver`/`onDragLeave`/`onDrop`). Existing stage left-rails, drag-drop, hover Edit/Delete, and per-column count+value headers kept.
- `next build` green.

# ============ v9 — 3D Earth marketing site (branch redesign/landing-earth-3d) ============

## Step 0 — Recon (reality vs prompt)
- App still one `src/app/page.js` (~9.1k lines) at `/` with auth branching; `(marketing)` group exists (blog/pricing/solutions/team). Per the prompt's fallback: app stays at `/`, marketing landing = the `LandingPage` component (rebuilt), subpages in `(marketing)`.
- three/fiber/drei/framer-motion installed. **Space Grotesk already wired** as `--font-space-grotesk`. Logout already lands on `LANDING` (checklist #10 pre-satisfied). No `/signup` route — live flow is `/?login=1` & `/?signup=1` modals; nav uses those (reality wins).
- v7 theme (Urbanist/#060218, nav Your Team/Solutions/Blog/Pricing, single-canvas rule, Team $39 tier) **superseded** by v9 (space theme #06060F, nav Home/Features/Pricing/Blog, globe reused across pages, Max $49 tier). Solutions/Team pages remain reachable from the footer.
- Pillow unavailable → favicon PNG rendered from SVG via macOS `qlmanage` (worked, verified visually).

## Part 2 — Logo system + favicon
- `src/components/Logo.js`: `LogoMark` (conic-gradient glow ring around a #0A0A1A disc, **placeholder "RC" initials — structured for a face-photo `<img>` swap later**) + `LogoFull` wordmark "Relationship CRM".
- `public/favicon.png` (256×256) generated from the same design; wired via `metadata.icons` in the root layout. **Manual step later:** when the founder photo lands, regenerate favicon from the same source.
- Root metadata → "Relationship CRM — Your Network, Supercharged".

## Part 3 — Space theme shell
- `SpaceBackground.js`: fixed `#06060F` backdrop, two CSS star layers, violet/cyan/gold nebula radials — theme lands with zero WebGL.
- `MarketingNav.js`: floating glass bar (blur + violet glow shadow), LogoFull, Home/Features/Pricing/Blog with active state, Log in (`/?login=1`), white Start Free pill (`/?signup=1`), mobile menu.
- `MarketingFooter.js` rethemed to the space palette + LogoFull + Features link. `(marketing)/layout.js` now renders SpaceBackground + MarketingNav (+`pt-24` clearance). `shimmer` keyframes added to globals.css.

## Part 4 — The Earth landing
- `GlobeScene.js`: stylized dark Earth (base sphere + violet wireframe overlay + cyan BackSide atmosphere), **10 orbiting person-nodes** (metallic emissive spheres, hover = glow + name tooltip via drei `Html`), **12 curved connection arcs** (QuadraticBezier lifted off the surface, tracking node positions per frame), 3-point lighting, OrbitControls (drag-to-spin + autoRotate, zoom/pan locked, polar clamps). Props: `interactive`, `small` (CTA reprise).
- `LandingPage` (page.js) fully rebuilt: hero **Earth left / copy right** ("Your network. / Supercharged." violet→cyan→amber gradient, Space Grotesk), trust-signal strip; FeaturesStrip (horizontal snap-scroll cards sliding in from the right); HowItWorks (deliberately asymmetric offset grid); AutomationShowcase (`py-32`, node-rail mock placeholder for a real canvas screenshot); Testimonials (placeholder quotes, TODO); FinalCTA (gradient bleed + non-interactive small globe reprise).
- Guards: `dynamic({ ssr:false })`, desktop-only (`useMediaQuery ≥1024px`), `prefers-reduced-motion` → static CSS globe silhouette. Old v7 hero components (OrbitVisual/Typewriter/LogoTicker imports) removed from page.js.
- **Browser-verified at 1280px:** Earth + nodes + arcs render, nav glass bar correct, gradient headline correct, tab title/metadata correct, console clean. `next build` green.

## Part 5 — Pricing: Free / Pro $19 / Max $49
- Rewritten as server `page.js` (metadata) + `PricingClient.js`. New `TIERS` per spec (Free/Pro/Max, Pro recommended, 14-day-trial CTAs). Annual = **−15%** with "Save $N/year" line; prices cross-fade/slide on toggle (framer-motion `key` swap).
- `PricingCard`: 3D tilt toward cursor (rotateX/Y up to 12°/14°) + cursor-following light; the Recommended card wears a violet→cyan→amber **gradient border** (p-[1px] wrapper) and a shimmering badge (`shimmer` keyframes). Feature rows stagger in on scroll.
- `BillingToggle`: spring-animated sliding knob (stiffness 500 / damping 30).
- Comparison table: 3 expandable category groups; **hovered tier column tints** across header+cells; rows highlight. FAQ: 6 questions, animated `height` accordion (AnimatePresence), staggered entry.
- Cinematic Email Automation section (`py-32`): small auto-rotating globe reprise (desktop + no-reduced-motion only) + node-rail canvas mock (screenshot placeholder), gradient sweep animates across the background on scroll.
- **Browser-verified:** toggle flips → $16/"Save $36/yr" and $42/"Save $84/yr" animate in; badge/border/tilt render.
- Note: this supersedes the v7/v8 pricing (Team $39 tier + COMPARISON_ROWS/PRICING_FAQ + count-up) per the v9 prompt's explicit new TIERS.

## Part 6 — Features page (/features, new)
- 8 alternating deep-dive sections (Relationships, Deals, **Email Automation at 2× space**, AI Summaries, Lead Scoring, Calendar, Reporting, Team Workspace) — colored label, Space Grotesk headline, benefit copy, and a structured **screenshot placeholder** slot (accent-glow frame) per section; all `whileInView` scroll-revealed.
- One **3D breather** between sections 4 and 5: small auto-rotating globe, non-interactive, desktop-gated with a CSS fallback. Server wrapper exports metadata.

## Part 7 — Blog structure (MDX, content later)
- Installed `gray-matter` + `next-mdx-remote`. Posts are `.mdx` files in `(marketing)/blog/posts/`.
- Index (`/blog`, server): reads frontmatter, computes read-time (words/200), masonry columns; `BlogCard` reuses the pricing 3D tilt + cursor-light treatment. Old v7 static-array blog replaced.
- `[slug]/page.js` (server, SSG via `generateStaticParams`): centered `max-w-2xl` reading column, Space Grotesk headings / Inter body / JetBrains Mono code via MDX component map, "← All posts" back link, per-post `generateMetadata`. A leading `# H1` in the post is stripped (the header already renders the title — caught live as a duplicate and fixed).
- Starter post `welcome.mdx` ("Why we built Relationship CRM") with placeholder body for the founder.
- **Browser-verified:** /blog card grid + /blog/welcome render (title, date, tag, prose styles).

## Final — verification
- `next build` green: `/`, `/features`, `/pricing`, `/blog`, `/blog/welcome` (SSG), plus existing `/solutions`, `/team` all prerender.
- Browser-verified at 1280px: landing (Earth + nodes + arcs + drag), pricing (toggle math), features, blog index + post. Console clean throughout.
- **Manual steps for the founder:** drop `public/logo-face.png` into `LogoMark` + regenerate `public/favicon.png` from it; replace screenshot placeholders on /features and the automation mocks; write real blog posts as `.mdx` files; replace testimonial placeholder quotes.

# ============ v10 — Realistic Earth landing (branch redesign/earth-landing-v2) ============

## Step 0 — Textures + recon
- NASA Blue Marble satellite textures committed to `public/textures/` (no runtime external deps): `earth-day.jpg` (4096×2048 Blue Marble), `earth-bump.jpg` (topology), `earth-night.jpg` (city lights, 4096×2048), `earth-specular.jpg` (water mask → ocean shine). The prompt's "clouds" URL was actually a water mask — per its own escape hatch, fetched a real photographic cloud layer (`fair_clouds_4k.png`, 4096×2048) instead. Day map visually verified as genuine satellite imagery before building.
- Structure/deps/routes already confirmed in v9 (three/fiber/drei/framer-motion installed; Earth-left hero exists; logout → LANDING).

## Part 1 — RealisticEarth (Google Earth quality)
- 128-segment sphere + meshPhong: Blue Marble day map, bump relief (0.06), night-lights emissive on the dark hemisphere, water-mask specular (shininess 20 — the ocean highlight), 16× anisotropy + proper SRGB color spaces.
- Independent cloud sphere (radius ×1.006, opacity 0.35, faster drift) + **two BackSide shader atmosphere layers**: tight pale-blue limb haze (#93c5fd, pow 4) and a wider faint outer glow (#60a5fa, pow 5).

## Parts 2–3 — Connection circles + arcs
- `ConnectionNode.js`: each person is a **flat, billboarded avatar circle** (drei Billboard + Ring frame + dark Circle interior + Html initials) — NOT a sphere. Orbits the Earth (farther = slower, gentle bob). Hover = brighter ring + expanded glow + name/title tooltip. **The interior is a documented emoji/icon/photo swap slot** (marked block: swap `{initials}` for an emoji `<span>`, an icon `<img>`, or a headshot — frame stays).
- `ConnectionLines.js`: `ConnectionArc` (QuadraticBezier arcing outward from the Earth like flight paths, tracking orbiting endpoints per frame) + `PulseDot` (a bright dot traveling each arc, sine-faded at the ends).

## Part 4 — GlobeScene rewrite
- drei `<Stars>` space field, camera-keyed key light (visible hemisphere bright + vivid), violet fill; 10 PLACEHOLDER people (name · role) with a story-shaped network (the founder hubs to key people, who connect onward — 12 arcs + pulses); OrbitControls grab-and-spin + slow autoRotate, zoom/pan locked, polar clamps. `interactive`/`small` props kept for the pricing/features reprises. Same ssr:false + desktop + reduced-motion gates.
- **Debugging story (real):** after the initial wire-up every drei-rendering scene drew a black, unconfigured canvas with zero console errors — bisected via a temp `/globe-test` page (raw-fiber box worked; any drei component died). Root cause: a **corrupted `.next` Turbopack cache** (deps were npm-installed while the old dev server was running, across branch switches). `rm -rf .next` + clean restart fixed it; the temp test page was deleted after.

## Part 5 — Hero layout
- Grid → `[1.1fr_0.9fr]`, globe `h-[680px]` pulled `-ml-16` (Earth bleeds left, per spec), headline → "Your network, **visualized.**", fallbacks recolored to the blue-earth palette.

## Part 6 — Logo
- Unchanged from v9 — already the same glow-ringed-circle language as the connection nodes, already documented for the face-photo swap.

## Verified
- **Browser (1280px):** photorealistic Earth left (real continents/clouds/night-lights/limb glow, bright ocean specular as it rotates), ring-framed initial circles orbiting with curved arcs + a pulse dot caught mid-flight, copy right, stars behind. Console clean. `next build` green.
- **Founder manual steps:** swap node interiors for emoji/icons/photos (documented in ConnectionNode.js), replace placeholder names, drop the logo face photo.

# ============ BIG UPDATE V2 (branch big-update/v2) ============

## Step 0 — Recon
- page.js single file (~9.2k lines). Schema verified live: `deals.id`/`tasks.id` uuid, `clients.id` bigint; clients has `referred_by_client_id` + `role` (no `title` — F10/F11 adapt); `clients.email` nullable, `tasks.due_date` NOT NULL, `deals.client_id` nullable w/ defaults (value 0, probability 50, USD).
- three/fiber/drei/framer-motion present. **date-fns intentionally NOT installed** — a local relative-time helper covers the need, and after the v10 `.next`-corruption incident I don't npm-install mid-session without a server stop + cache clear.
- Email Automation appStep is `N8N` (not `AUTOMATION`); Cmd+K previously opened the old GlobalSearch.

## Migration (applied + verified live)
- One idempotent file `supabase/migrations/20260715_big_update_v2.sql`: 8 new tables (relationship_notes, relationship_lists, relationship_list_members, deal_events, subtasks, task_templates, activity_feed, import_history) + 7 columns (email_settings birthday_reminder_days/birthday_template_id, deals close_reason/competitor, tasks priority/task_status, tags is_shared). Verified via information_schema: 8 tables, 7 columns, 9 policies, `relrowsecurity=true` on all.
- CHECK constraints added via DO-block (duplicate_object-safe); task_status backfilled from status.

## Cluster A — Visual identity (F1–F6)
- **F1 Command Palette:** Cmd+K now opens a Raycast-style palette (replaces the old search binding): fuzzy-ranked (prefix>substring>subsequence), grouped Actions/Navigate/Relationships/Deals/Tasks/Sequences, ↑↓/Enter/Esc, recents in localStorage, footer kbd hints. Items include create-relationship/deal, toggle dark mode, export CSV, all 8 nav targets, and every client/deal/open-task/sequence by name.
- **F2 Transitions + breadcrumb:** every appStep switch crossfades+slides (250ms motion.div keyed by step, design EASE). The full-screen profile header's "Back" became a clickable breadcrumb: `Relationships › {name} › {tab}`.
- **F3 Context menus:** shared fixed-position `<ContextMenu>` (click-away/Esc/screen-edge aware). Wired: relationship rows (View Profile / Send Email / Log Activity / Edit / Delete), deal cards (Edit / Mark Won / Mark Lost / View Relationship / Delete), task rows (Toggle done / View Relationship / Copy title). Extracted `openEditClient`/`openEditDeal` from inline row buttons so menus and rows share one opener.
- **F4 Quick-add bars:** dashed Enter-to-create bars on Relationships ({name, status New, priority Medium}), Deals ({title, stage Prospect}), Tasks ({title, due today}) — insert shapes verified against live nullability. New relationship row flashes green ~1.2s (`justAddedId`).
- **F5 Skeletons:** boot "Initializing workspace…" spinner replaced with an app-shaped skeleton (sidebar rail + header + stat cards + table block, staggered pulse). List loads already used SkeletonRows; remaining spinners are button-level busy states (kept — they're affordances, not content placeholders).
- **F6 Undoable toasts:** redesigned Toast — bottom-right stack (max 4), countdown progress bar (5s undoable / 3s plain), Undo + Close buttons. `showUndoableToast(msg, undoFn)` added. **Relationship delete is now undo-safe by construction:** row leaves the UI instantly but the DB delete is deferred 5.2s; Undo cancels the pending delete (children survive — a re-insert couldn't restore them and clients.id is GENERATED ALWAYS). Failed deletes restore the row + error toast.
- `next build` green.

## Cluster B — Relationship intelligence (F7–F14)
- **F7 Strength meter:** `computeStrength` (recency 30 / 90-day frequency 25 / channel diversity 20 / deal value 15 / active sequence 10) rendered as an animated SVG arc (`StrengthArc`, green≥70 / amber≥40 / red) in the profile header next to the lead score.
- **F8 Swimlane timeline:** `SwimlaneTimeline` atop the profile Activity tab — Email/Call/Meeting/Note/Deal/Task lanes, dots positioned across the last 90 days, hover tooltips, axis labels. The editable flat list stays below (visual on top, editing below — deliberate adaptation).
- **F9 Last Contacted / Days Silent:** new sortable table column (relative time + color-coded "Nd silent" badge: green≤7 / yellow≤21 / orange≤45 / red 46+), `lastActivityByClient` memo, click-to-sort header + 2 new sort-dropdown options. Local `timeAgo`/`daysSilent` helpers (no date-fns).
- **F10 Connected to:** profile sidebar section clustering by referrer (`referred_by_client_id`, both directions), same company, same source — clickable links that jump between profiles.
- **F11 LinkedIn enrich assist:** when `linkedin_url` set but company/role missing → prompt that opens the LinkedIn profile in a new tab AND the full edit form simultaneously (structured manual assist; no scraping).
- **F12 Birthday reminders:** Overview banner for birthdays within `email_settings.birthday_reminder_days` (year-wrap safe) with per-person "Draft email" buttons — one click opens the composer pre-filled from `birthday_template_id` (or a warm default).
- **F13 Notes tab:** new profile tab on relationship_notes — add/pin/delete, pinned float to top (amber), relative timestamps, **undoable delete** (deferred DB delete pattern from F6).
- **F14 Lists:** relationship_lists as filter pills above the table (color dot + live member count + inline "+ New list" creator + delete w/ undo), bulk-bar "Add to list…" action, list filter wired into the filter memo. Enroll-list-into-sequence = filter by list → select all → existing bulk enroll.
- `next build` green.

## Cluster C — Deal flow (F15–F20)
- **F15 Forecast chart:** pure-Tailwind bar chart above the kanban — one bar per stage in its `STAGE_COLORS` accent, hover reveals the total, click = stage drill-down (reuses `dealsStageFilter`). "Weighted Forecast" stat already existed (kept).
- **F16 Deal events:** every create / stage change / value change / probability change / close auto-logs to `deal_events` (state + fetch + `logDealEvent`). "Deal History" feed in the edit view: "Moved Proposal → Negotiation · 2 days ago" with typed dot colors.
- **F17 Aging badges:** "Nd in {stage}" chip on open cards from the latest stage_changed event (else created_at) — amber ≥7d, red ≥14d.
- **F18 Close countdown:** cards show "Closes in Nd" (green) / "Closes tomorrow|today" (amber) / "Nd overdue" (red); header gains a **"Closing This Week: $X"** stat (open deals, next 7 days, currency-normalized).
- **F19 Win/loss capture:** moving a deal to Won/Lost pops a reason+competitor modal (skippable); saves to `deals.close_reason/competitor` + logs a `closed` event with the note. (Aggregate frequency table lands in Reports with Cluster F.)
- **F20 Quick filters:** All / Closing This Week / High Value ($10k+) / Overdue / Mine (team workspaces only) pills — filter cards inside columns without collapsing the board.
- `next build` green.

## Cluster D — Email automation power-ups (F21–F28)
- **F21 Performance dashboard:** "Stats" button per sequence → full-screen analytics: per-step Sent→Opened→Clicked→Replied funnel bars, **subject A/B open-rate comparison with winner highlighting** (real infra existed: `sequence_steps.subject_b` + `sequence_sends.subject_variant`), best-day-of-week reply-rate heat cells, and a 30-day stacked sends/replies trend. All computed from existing `sequence_sends`.
- **F22 Device preview:** composer "Preview across devices" toggle — desktop pane + a phone frame (240px, bezel + fake status bar) rendering subject/body live.
- **F23 Spam score:** client-side `spamCheck` (ALL-CAPS words, exclamation count, 12 spam phrases, subject length/caps/empty, >3 links, too-short body) → live "Deliverability: N/10" chip + specific warnings in the composer.
- **F24 True sequence cloning:** the old Duplicate was a shallow copy that dropped node types, canvas positions, configs, A/B subjects, and ALL edges — rewritten as a deep copy with positional old→new step-id remapping so the arrows survive. Named "(copy)", lands as draft.
- **F25 Step heatmap:** canvas email nodes tint by open rate (green >50% / yellow 20–50% / red <20%, only at ≥5 sends) via a background gradient overlay — glance at the canvas, see what's working.
- **F26 Cold contact dashboard:** 6 status stat cards (count + % + bar) above the cold list; clicking one drives the existing `coldFilter`.
- **F27 Unsubscribe injection: already live since v5** — the runner appends the footer link (`index.ts:258`) and `/track/unsub/:token` upserts `unsubscribes` + stops active enrollments. Verified, not rebuilt.
- **F28 Template library:** extended `SEQ_TEMPLATES` 4 → 8 (added Re-Engagement, Event Follow-Up, Referral Request, Quarterly Check-In) with written subject/body copy + merge tags; existing gallery + one-click import handles them.
- `next build` green.

## Clusters E–F — Tasks, productivity & reporting (F29–F40)
- **F29 Priorities:** urgent/high/medium/low with colored chips (urgent pulses red); chip click cycles priority; priority filter pills; list auto-sorts priority-then-due-date. `PRIORITY_META` + CHECK-constrained column.
- **F30 Due-time reminders:** 60s interval; tasks due within 30 min raise a fixed top banner ("Task due in N min: …") with View/Dismiss.
- **F31 Subtasks:** checklist per task (add/toggle/delete), "n/m + progress bar" indicator on rows and board cards, inline expansion; `+ checklist` starter for empty tasks.
- **F32 Task templates:** two built-ins (`New Client Onboarding` 0/3/7/14/30d, `Follow-Up Blitz` 0/2/5d) applied from the profile Tasks tab — creates all tasks with priorities and due dates relative to today. (The `task_templates` table exists for future user-defined sets; built-ins are code-side.)
- **F33 Board view:** List/Board switcher; To Do / In Progress / Done columns; HTML5 drag between columns; `task_status` kept in sync with legacy `status` (done⇄pending) so every other view stays correct.
- **F34 Today view:** new sidebar entry (all 3 navs) — tasks due/overdue (checkable inline), deals closing this week, High-priority relationships silent 30d+, birthdays within 7 days with one-click drafts. No noise.
- **F35 KPI trend arrows:** 4 dashboard cards (New Relationships, Activities, Deals Won $, Emails Auto-Sent) comparing last 30d vs prior 30d with ▲/▼ percentage.
- **F36 GitHub-style heatmap:** 53×7 contribution grid of activities/day (365 days, Sunday-aligned, 4 intensity shades, hover tooltips) + current-streak counter, in Reports.
- **F37 Revenue analytics:** Won-this-month, Won:Lost ratio, avg deal size, 6-month trend bars, revenue by source (client join), currency-normalized.
- **F38 Growth chart:** 12 weekly bars of total relationships + "+N" weekly net-new labels.
- **F39 Automation ROI:** auto-sent count, reply rate, meetings booked (Meeting activity within 7 days of a reply), hours saved (sends × 2min) — with methodology note.
- **F40 Report PDF:** "Download Report" opens a print-optimized page (overview stats, won deals with close reasons, pipeline by stage) that auto-triggers Print → Save as PDF.
- **F19 (from C):** Win/Loss reasons frequency table now renders in Reports.
- `next build` green.

## Clusters G–I — Team, data & polish (F41–F50)
- **F41 Team feed:** `activity_feed` logging on won deals + created relationships (`logFeed`, failure-isolated); Overview widget "Team Feed" (or "Recent Wins" solo) with member names resolved defensively, typed dots, relative times.
- **F42 @Mentions:** member chips under the note composer (click to insert `@username`); saving a note that mentions a member inserts a `type='mention'` notification; note bodies render `@tokens` as highlighted indigo chips.
- **F43 Shared tags:** Private/Shared toggle per tag in Settings (workspace only), "shared" indicator on every TagPill, and a **new RLS SELECT policy** (applied live + mirrored into the migration file) letting workspace members see each other's shared tags.
- **F44 Leaderboard:** top-3 members this month by feed actions (wins highlighted), computed from the workspace-readable activity_feed — respects RLS without needing cross-member table access.
- **F45 Bulk edit:** floating bulk bar gains "Set priority…" (clients.relationship — the actual priority field) and "Set source…" (existing values + clear) selects; `handleBulkField` updates every selected row in one call.
- **F46 Import history:** both CSV imports (relationships + cold contacts) log `import_history` rows with created ids; Settings section lists each import with **Undo import** (confirm → bulk delete by saved ids).
- **F47 Data health:** Settings card — % with email/phone/company/LinkedIn/tag/≥1 activity as color-coded bars (green>80/yellow≥50/red); clicking a bar jumps to Relationships filtered to rows **missing** that field (new filter step + dismissible chip).
- **F48 Export with custom fields:** CSV export now emits Company/Source plus one column per `custom_field_definitions` entry, values joined from `custom_field_values`; all cells properly quoted.
- **F49 Shortcut sheet:** the old small modal is now a full-screen two-column reference grouped by context (Global/Relationships/Deals/Automation/Tasks/Toasts) with `<kbd>` keys — same `?` binding and Esc dismiss; sidebar `?` button unchanged.
- **F50 What's New:** `WHATS_NEW` array in code; modal auto-shows once per version (localStorage `crm_whatsnew_seen`), sidebar "What's New" entry with a pulsing dot until seen. Sidebar Search now opens the F1 palette (consistency).
- Note: a prior crashed continuation of this same session had committed partial E–G work (`d07835b`) and left stale git locks (verified no live git process, then removed); current tree audited — no duplicate implementations, single source for every feature, build green.

# ============ BIG UPDATE V3 (branch big-update/v3) ============

## Step 0 — Recon
- All assumed tables exist; `gmail_connections.id` bigint; `automation_rules.id` uuid (prompt said bigint — reality wins); jobs/payments exist UI-orphaned; **no /api routes exist** (F100's "existing /api/v1" adapted); no PWA files.
- **Already live, NOT rebuilt:** `deals.is_recurring/billing_cycle/renewal_date/currency` + Recurring Revenue widget + ≈USD display (F45/F48 ~80% pre-existing), task recurrence auto-reschedule (F26 core), `automation_rules.run_count/last_run_at` (half of F95), **F9 voice-to-activity (SpeechRecognition flow from an earlier session)**.
- `ai-summary` edge function was live but its source wasn't in the repo — pulled into `supabase/functions/ai-summary/`, extended, redeployed (v3).

## Migration (applied + verified live)
- `supabase/migrations/20260716_big_update_v3.sql`: **16 new tables** (meeting_briefs, info_interviews, applications, career_goals, booking_slots, bookings, call_scripts, deal_stakeholders, deal_templates, proposals, contract_templates, saved_search_alerts, audit_log, achievements, automation_runs, dashboard_layout) + **15 columns** (clients.network_role/school/timezone/preferred_channel, profiles.elevator_pitch/one_line_bio/email_signature/deletion_requested_at/accent_color, tasks.series_id, deals.split_credit, email_sequences.gmail_connection_id, jobs.stripe_payment_link, relationship_lists.is_smart/smart_filters). RLS + policies on all; verified via information_schema.
- **Security decision:** NO anon RLS policy for shared proposals (would allow enumeration) — the public link will be served by a token-checking edge function.

## Cluster B — Student & career networking (F11–F22)
- **F13 Applications kanban** (the headline): new **Career Hub** sidebar view — Researching→Applied→Phone Screen→Interview→Offer→Rejected columns, drag between stages, quick-add by company, per-card job-URL/role/referrer via context menu, referrer links to the relationship ("via Sarah Chen"), offer celebration toast.
- **F12 Info interviews:** "Interviews" profile tab — schedule + prepared questions up front, takeaways after, "thank-you sent" checkbox; saving takeaways with no thank-you auto-queues the F17 task.
- **F17 Thank-you auto-reminder:** Meeting activity with a mentor/recruiter/professor (or interview takeaways) creates "Send thank-you note to [Name]" due tomorrow, high priority, deduped.
- **F11 Network roles:** mentor/mentee/peer/recruiter/alumni/professor — edit-form select, colored profile badge.
- **F14 Referral chain:** profile card renders the intro chain upward (up to 4 hops) and everyone this person referred, all clickable.
- **F21 Warm intro:** one click drafts the "small introduction favor" email pre-filled with a same-company target.
- **F15 School network:** `school` field + Career Hub tab grouping contacts by school (alumni lens).
- **F18 Career goals:** goal + target date + linked people (add/remove via select), mark achieved/reopen.
- **F19 Pitch & bio:** Settings section persisting to profiles; `{{my_pitch}}`/`{{my_bio}}` merge tags resolve everywhere.
- **F20 Diversity donut:** conic-gradient donut of network_role mix in the Career Hub header.
- **F16 Coffee-chat template:** new sequence template written in informational tone (uses {{my_bio}}), 2 steps + polite bump.
- **F22 Endorsements:** one-tap tags ("Made an introduction"…) on notes, rendered as emerald chips.
- **F27 Timezone:** "It's 9:14 PM for them — probably offline" under the profile name (Intl API; amber outside 7:00–22:00).

## Cluster A — AI & intelligence layer (F1–F10)
- **Edge function v3:** one function, 8 modes (summary, follow_up_suggestion, meeting_brief, draft_sequence, icebreakers, compare, classify_reply, nl_search) on claude-haiku; clean 400 without ANTHROPIC_API_KEY → every feature degrades gracefully (checklist #3). Source now lives in the repo.
- **F1 NL search:** long palette queries surface "Ask your CRM" → AI translates to a structured filter (days-silent, priority, status, role, source, open-deal, text) applied via a new memo step with a dismissible "AI filter" chip; JSON-parse or API failure falls back to keyword search.
- **F2 Meeting briefs:** "AI Brief" profile button → 5-bullet brief panel, persisted to meeting_briefs.
- **F3 Sentiment:** keyword classifier — colored dot per timeline entry + a last-10-activities trend strip (bar height by sentiment).
- **F4 AI sequence draft:** "Generate with AI" in Email Automation — one-line goal → 3–5 step draft sequence created as a real canvas (trigger→email→wait chain with edges), named "AI: …", opens in the builder with a review-everything toast.
- **F5 Fuzzy duplicates:** Levenshtein + same-company + first-name-with-initial heuristics → dismissible Settings panel wired straight into the existing Merge tool.
- **F6 Icebreakers:** composer button inserts 3 role/company-referencing openers above the draft.
- **F7 At Risk:** dashboard section for *trending* cold (14–60d silent AND declining 30d activity vs prior AND no open deal) — distinct from the static health map, with one-click reach-out.
- **F8 Reply classification:** `classify_reply` mode deployed server-side; on-demand UI classification deferred (gmail-sync integration point documented).
- **F10 Compare:** select exactly 2 → "Compare (AI)" in the bulk bar → side-by-side verdict modal with a this-week priority recommendation.
- **F9:** already existed (browser SpeechRecognition) — verified, untouched.
- `next build` green.

## Cluster F — Network visualization (F53–F58)
- **F53 Network Map** (new sidebar view): dependency-free force-directed SVG graph — nodes = every relationship, edges = referrals (solid) + shared company (dashed gray) + shared school (dashed gold). Custom 250-tick simulation (repulsion + springs + centering; O(n²) is fine at CRM scale). Wheel-zoom, drag-pan, click-through to profiles.
- **F54 Company clusters:** "Color by company" mode assigns palette colors to the top-8 companies.
- **F55 Connection finder:** type a name/company → the target's 3-hop neighborhood highlights, everything else dims.
- **F56 Growth timeline:** scrubber filters nodes by created_at percentile and re-runs the layout — watch the network grow.
- **F57 Isolated contacts:** toggle rings every node with zero edges (intro candidates).
- **F58 PNG export:** serializes the SVG through a canvas → downloadable `my-network.png`.

## Cluster G core — Proposals & e-signature (F59/F60/F62/F65)
- **F59 Builder:** "+ New proposal" in the deal view seeds Introduction/Scope/Pricing/Terms from the deal (client name, currency-formatted value, recurring cadence), 32-char share token, 14-day default validity. Sections edit inline (save-on-blur), title/valid-until editable.
- **F60 E-signature:** public page `/p/[token]` — clean reading layout, print-to-PDF, **HTML5 canvas signature pad** (mouse + touch), name + signature POST → timestamped, status → signed, one-time (409 on re-sign, 410 past expiry). Signed state renders a confirmation block.
- **Security:** public access goes through the new `proposal-public` edge function (service-key, exact-token lookup, 16-char minimum, 200KB signature cap) — deliberately NO anon RLS policy on proposals, which would have allowed enumeration. Function source committed + deployed.
- **F62 Versions:** every sections-save snapshots the outgoing content into `versions` (last 10), surfaced as a vN chip.
- **F65 Expiry:** unsigned proposals within 2 days of `valid_until` show a red "Expires" chip; the public page returns a polite expired state and refuses signatures (410).
- **F77 (early):** `logAudit` helper landed with proposal creation as the first audited action.
- `next build` green.

## Clusters I+J+K+L — Security, PWA, gamification, automation (F75–F96 core)
**Cluster I — Security & compliance**
- **F75 Two-Factor Auth (TOTP):** Settings → Security enrolls via Supabase MFA (`mfa.enroll` → QR + manual secret → verify 6-digit code). Factors listed with unenroll. Login gate: if the session's AAL is `aal1` but a verified TOTP factor exists, a full-screen overlay demands the code before the app renders (`mfaGate`).
- **F76 Sessions:** "Active sessions" panel shows the current session (browser/OS parsed from UA, last sign-in) + **Sign out everywhere** (`signOut({ scope: 'global' })`).
- **F77 Audit log:** `logAudit(action, entityType, entityId)` now fires on deletes (relationship/deal/task), bulk edits, role changes, proposal create/sign, data export, 2FA enroll/unenroll. Settings → Security renders the last 50 entries with relative timestamps.
- **F79 Data export:** "Download all my data" pulls every user-scoped table (relationships, deals, activities, tasks, sequences, applications, goals, interviews, proposals…) into one human-readable JSON download; the export itself is audited.
- **F80 Deletion grace period:** delete-account now requires typing DELETE, stamps `profiles.deletion_requested_at`, and shows a red banner with a **Cancel deletion** button for the 24h grace window (permanent removal is the documented follow-up job, not a silent hard delete).

**Cluster J — Mobile & offline (PWA)**
- **F81 Installable PWA:** `public/manifest.json` (standalone, theme colors, maskable icon) + `metadata.manifest` in layout. Add-to-Home-Screen works on Android/iOS Safari.
- **F82 Offline read mode:** `public/sw.js` — network-first shell caching + cache-first `/_next/static`; **Supabase API responses are never cached** (stale CRM data is worse than none). The app snapshots relationships/tasks to localStorage and renders that snapshot read-only when offline.
- **F83 Swipe gestures:** on mobile widths, swipe right on a relationship card = quick Log Activity; swipe left = quick-actions row (call/email/profile). Touch-only, no effect on desktop.

**Cluster K — Gamification**
- **F87 Achievement badges:** `BADGE_DEFS` (First Relationship, 10/50/100 Relationships, First Deal Won, 10 Deals Won, First Referral Chain, 7-Day Streak, First Sequence, Network Mapper). An award effect diffs earned vs eligible after data loads, inserts into `achievements` (UNIQUE dedup), toasts + celebrates. Badge shelf in Settings shows earned (colored, dated) vs locked (gray).
- **F88/F89 Weekly challenge + personal best:** dashboard card rotates a Monday-seeded challenge ("Reach out to 5 dormant relationships…") with a live progress bar computed from this week's activities, next to "Your best week: N activities (this week: M)".
- **F90 Celebrations:** CSS-only confetti overlay (`.confetti-piece`, no library) fires on badge unlocks and round-number milestones.
- **F7 (Cluster A stray) At-Risk section:** dashboard section listing relationships trending cold (days-silent × declining frequency × no open deal), distinct from the static health map.

**Cluster L — Automation**
- **F92 Recipe gallery:** curated one-click rules (auto-tag on deal created, notify on 45-day silence, task on new High-priority, etc.) — each installs a pre-filled `automation_rules` row the user can tweak.
- **F95 Run history:** every rule firing inserts an `automation_runs` row (+ `last_triggered_at`); per-rule expandable log with results.
- **F96 Dry-run:** "Test rule" evaluates the rule against current relationships/deals and lists exactly which records WOULD trigger, executing nothing.
- `next build` green (12/12 routes).

## Clusters C/D/E/H strays + Cluster M — finishing pass
**Communication (D)**
- **F34 SMS logging:** "Text / SMS" is now an activity type on the log form + timeline filter.
- **F35 WhatsApp:** phone numbers on a profile get a one-click `wa.me` chat badge (digits-only URL, ≥7-digit guard).
- **F37 Email signature:** stored in Settings → Pitch & Bio, auto-appended to every composed email (skipped if the draft already contains it).
- **F42 Call scripts:** Settings library (`call_scripts` table) with `{{name}}`/`{{first_name}}` tags; logging a Call offers a script picker with resolved talking points + one-click insert.

**Calendar (C)**
- **F32 .ics export:** right-click any task → "Export .ics" downloads a standards-compliant VEVENT for any calendar app.

**Deals (E)**
- **F43 Stakeholders:** deal edit view tracks multiple people per deal with roles (decision maker / champion / blocker / stakeholder), backed by `deal_stakeholders`.
- **F46 Deal templates:** save the current deal form as a template; one-click chips prefill title/value/probability/stage (`deal_templates`).
- **F47 Probability suggestion:** on stages with ≥3 historically settled deals, a one-click "Suggested: N%" computed from your real win rate at that stage (`deal_events`).
- **F50 Pipeline velocity:** Reports chart of average days spent per stage (from `stage_changed` events), calling out where deals sit longest.
- **F52 Similar won deals:** open deals show your 3 closest-value past wins — "you've closed deals like this before."

**Search & geography (H)**
- **F71 Recently viewed:** last-5 profiles strip at the top of the dashboard (localStorage, survives reload).
- **F74 Where is my network:** Reports country breakdown bar list.

**Cluster M — customization (F97–F100)**
- **F97 Dashboard arrangement:** "Customize" on the dashboard reorders (↑/↓) and hides any of the 10 widget blocks; persisted per-user in `dashboard_layout`, applied via flex order so nothing re-mounts.
- **F98 Accent color:** Settings swatch picker (`profiles.accent_color`) recolors primary buttons + indigo accents app-wide via a `data-accent` CSS hook; dark-mode surfaces untouched; one-click reset.
- **F99 Onboarding tour:** brand-new (empty) accounts get a one-time 5-step tour (sidebar, ⌘K, career hub, automation, first contact) ending on the Add Relationship form; skippable, never re-shows.
- **F100 API docs:** the Settings API reference now renders a personalized, copyable curl example using the real app origin and your key's actual prefix.

**Deferred honestly (not shipped in v3):** F23-F25/F28-F31 booking pages + Google Calendar two-way sync (needs new OAuth scope), F33 inline reply bodies (runner stores ids, not bodies), F36 Slack digest, F38 multi-inbox, F39/F41 receipt/OOO automation, F44/F48-F49/F51 deal splits/FX/docs/comments, F63/F64/F66 invoices/Stripe/zip-download, F67-F70/F72-F73 saved-search alerts/smart segments/ranking/boolean search, F78 scheduled backup emails, F84-F86 quick-capture/web-push/mobile composer, F91 reflections, F93-F94 multi-branch automations/Sheets. Tables for several of these (booking_slots, bookings, contract_templates, saved_search_alerts) already exist from the consolidated migration, so they're UI-only follow-ups.
- `next build` green.

# ============ THE DEEP UPDATE v1 (branch big-update/deep-v1) ============
Two features, built end to end: the Network Graph and the Email Command Center.

## §0 — Recon + support migration
- Verified live (not recreated): `relationship_connections`, `graph_positions`, `email_inbox`, `sequence_analytics_daily`, `reply_snippets`, plus `clients.school/network_role/avatar_emoji`. All RLS-enabled.
- `20260717_deep_v1.sql` (applied + committed): unique `(user_id, gmail_message_id)` on email_inbox (sync dedupe), unique `(user_id, client_id)` on graph_positions (position upserts), unique `(user_id, shortcut)` on reply_snippets, plus list/hydration indexes.
- No d3/date-fns added — the force simulation is hand-rolled per spec.

## §1 — Network Graph (`src/app/components/NetworkGraphDeep.js`, replaces the V3 mini-map at the Network nav item)
- **Edges from 4 sources** merged by `buildGraphData`: referrals (solid violet, thick), manual `relationship_connections` (solid, color per type: knows/works with/mentors/introduced/studied with), shared company (dashed gray, groups of 2–12), shared school (dashed blue, 2–15). Degree drives node radius `8 + min(degree*2, 20)`.
- **Physics:** hand-rolled force sim (repulsion 8000, springs len 120, center gravity, damping 0.85, velocity clamp, annealing alpha) in a rAF loop that settles and idles. O(n²) pair repulsion — fine at the 500-node cap.
- **Positions persist:** hydrated from `graph_positions`, drag pins the node and saves debounced (800ms batch upsert). Pin/unpin from the detail panel (amber dot marks pinned). "Re-layout" wipes saved positions and re-runs cold.
- **Zoom/pan:** wheel zoom-to-cursor, background drag pan, +/− buttons, Fit-to-screen (bbox framing). Transform-matrix based.
- **Color modes:** Priority / Network role / Stage / **Cluster** — the last runs real label-propagation community detection (8 iterations, shuffled order); the legend lists clusters with size + dominant company/school, click to highlight+frame.
- **Layouts:** Force / Radial (concentric degree rings) / Grid / By-company blobs.
- **Filters + search:** priority/role/stage filters fade non-matches to 10% and hide their edges; search pulses matches (SVG animate) and auto-frames them.
- **Hover focus:** neighbors + touching edges stay full-opacity, everything else dims.
- **Node detail panel:** slides in without leaving the graph — company link, role/priority/school chips, clickable direct connections (jump+frame), open deals, last activity, Open profile / Log activity / **Draw connection** (click a second node → type picker → optimistic `relationship_connections` insert, rollback on error; manual edges deletable inline).
- **Insights panel:** top-5 most connected, isolated count (click to highlight), bridge people (neighbors spanning ≥2 communities), largest cluster, longest referral-chain reach (BFS) — every insight clickable.
- **Export:** PNG at 2× with title/date header (SVG→canvas), and connections CSV.
- **States:** loading skeleton (pulsing graph shape), true empty state with CTA, sparse note (<3 people), 500-node cap notice, load-error banner, full dark mode, mobile = read-only banner (drag/zoom disabled).
- **Manual test:** open Network → drag a node, reload (position kept) → search a name (pulse+frame) → Color: Cluster → click a node → Draw connection → click another → pick "Mentors" → edge appears violet-less/amber per type → Insights → Export PNG downloads.

## §2 — Email Command Center (`src/app/components/EmailCommandCenter.js`, two new tabs in Email Automation: Inbox + Analytics)
- **Inbox, three panes.** Left rail: All / Unread / Needs reply (received with no outbound email logged after) / Starred / five classifications / per-campaign — all with live counts. Middle: thread rows with avatar, unread dot, star toggle (optimistic + rollback), classification chip, relative time, body preview; newest-first; "Load more" pagination (40/page, metadata-only query — bodies load lazily per message). Right: full body, sender details, which campaign/step it replied to (send_id → sequence_sends → sequence_steps), and actions: classify override (persisted), Convert to relationship (cold), Log meeting booked, Stop their sequence, Open thread in Gmail (targets `gmail_thread_id`), Open profile.
- **Reply composer (2.3):** pre-filled To/Re:, merge tags resolved against the matched contact, `:shortcut ` typed inline expands from `reply_snippets`, snippet picker + "Save as snippet", **Send opens Gmail web compose (never mailto)** and logs an outbound `activities` row (`activity_type='Email'`, `activity_date`, non-null description) which clears Needs-reply.
- **Snippets (2.8):** CRUD modal; 4 starters (`:thanks` `:booking` `:notnow` `:intro`) seeded once per user (idempotent upsert on the new unique index).
- **Analytics (2.6):** all 8 panels, pure SVG, real data: ① KPI cards (Sent/Open/Click/Reply/Meetings/Unsub) with 30-vs-prior-30 trend arrows + sparklines; ② reply-rate 30-day line chart with axis/gridlines/hover tooltip, reading `sequence_analytics_daily`; ③ 7×24 best-send-time heatmap (reply rate per slot, winner ringed, ≥3-send threshold); ④ per-sequence comparison table with mini bars + BEST highlight; ⑤ subject-line leaderboard by open rate with sample sizes (via step_id → step subject, A/B aware); ⑥ Sent→Opened→Clicked→Replied→Meetings funnel with drop-off %; ⑦ classification donut; ⑧ hours-saved ROI card (sends × 2min + meetings).
- **Rollup (2.7):** `rollupSequenceAnalytics` buckets `sequence_sends` per sequence/day and chunk-upserts into `sequence_analytics_daily` (`onConflict sequence_id,day`) — runs once per session when Analytics opens, doubling as the historical backfill.
- **States:** Gmail-not-connected banner, skeleton rows/cards, inbox empty + filter-empty, analytics zero-send CTA to the builder, load-error with retry. Full dark mode; mobile collapses to a single pane with back-navigation.

## §3 — gmail-sync v9 (deployed + committed at `supabase/functions/gmail-sync/index.ts`)
- Keeps every v8 behavior (activities for matched traffic, auto-stop-on-reply, token refresh/reauth flags).
- **New:** matches cold contacts too; inbound messages fetched `format=full`, body extracted (text/plain → de-tagged html → snippet), classified (same deterministic classifier as the client — OOO/not-interested/referral/interested/question), and upserted into `email_inbox` deduped on `(user_id, gmail_message_id)` with thread id, preview, full body (100KB cap), and the latest tracked send/sequence linked.
- **Classification side-effects:** out_of_office → active enrollments pushed +7 days (paused, not stopped); not_interested → enrollments stopped, cold contact marked unsubscribed + `unsubscribes` upsert; real replies → auto-stop now covers cold-contact enrollments as well.
- **Manual test:** Sync replies now → reply lands in Inbox with classification; an OOO reply moves `next_send_at` a week out instead of marking replied; a "not interested" reply stops the enrollment and unsubscribes the address.
- `next build` green (12/12 routes).

# ============ BIG UPDATE V4.0 (branch big-update/v4-email) ============
Email Automation section redesigned as a 5-tab hub. Line counts (honest, `wc -l`):
page.js was 13,468 at the start of this pass; the section's UI now lives in
dedicated components — src/* totals 20,015 lines after this update (page.js
13,347 + 3,996 lines of email components + marketing/lib). The old flat
sequences list, cold-contact list, and unsubscribes tab are gone.

## §1 — Section shell (5 tabs, no popups)
- Header: title + live **Gmail connection badge** (amber "Connect Gmail" pulse when missing/expired, green with the account email when healthy) + Generate-with-AI + "+ New Campaign" (opens the existing 2-step full-screen create flow).
- Tabs: **Campaigns / Inbox / Analytics / Cold Contacts / Settings** (Inbox + Analytics are the Deep-Update command center, kept). The old Unsubscribes tab folded into Settings. Builder, composer, create-flow, CSV preview, and the new Enrollment Panel are all full-screen takeovers — zero centered modals.
- **Manual test:** open Email Automation → 5 tabs render, badge reflects Gmail state, no modal anywhere in the section.

## §2 — Campaign Gallery (`components/EmailCampaignGallery.js`)
- Aggregate stats row across ALL campaigns (campaigns / active enrollments / sent / replies — replies card clicks through to the Inbox tab).
- Rich cards: name+description, Live/Draft/Paused status ring, **node-chain mini-map** (typed+colored T/E/W/?/G/L squares, +N overflow), enrolled/active/sent/replied stats, reply-rate %, "Last sent Nh ago", and a ··· context menu (pause/activate via `handleSetSequenceActive`, enroll contacts, duplicate, delete) that closes on outside-pointer.
- Filter pills (All/Live/Draft/Paused with counts) + sort (newest/most active/most enrolled/A-Z). Both empty states (no campaigns CTA; filter-empty with reset). Loading skeleton.
- Template strip reuses the app's **9 SEQ_TEMPLATES** (≥8 required) through the existing `handleCreateFromTemplate` — real batched step inserts, real DB ids, real yes/no branch edges.
- **Manual test:** click a template → campaign created with full canvas graph and opens in builder; card menu → Pause flips the badge; Total Replies card jumps to Inbox.

## §3 — Enrollment Panel (`components/EnrollmentPanel.js`, full-screen)
Six paths, one pipeline:
1. **Select Manually** — search + stage/priority/source filters, checkbox table (name/company/stage/priority chip/last-active), select-all bar with available/selected/already-enrolled counts.
2. **From a List** — relationship-list cards with member counts, one-click enroll the whole list.
3. **Cold Contacts** — same pattern vs `cold_contacts` (status filter; unsubscribed/bounced never enrollable).
4. **Smart Segment** — AND-combined rule builder (field/op/value incl. is-empty ops), live match count + name-chip preview.
5. **Upload CSV** — Papa parse, auto-mapped columns (email/first/last/company/title/linkedin/phone with alias detection), new/duplicate/invalid chips, 5-row preview, then **import as cold contacts AND enroll in one step** (chunked inserts, in-file dedupe).
6. **Enroll All** — source picker (relationships/cold/both) behind an explicit "I understand" checkbox gate.
- All six call `bulkEnroll()`: dedupes against active enrollments, skips unsubscribed emails, chunks inserts 100/batch, resolves the runner entry node (trigger's default edge target), inserts with **exactly one of client_id/cold_contact_id set and the other explicitly null**, reports "Enrolled N (skipped: X already enrolled, Y unsubscribed)" and whether sending starts now or needs activation.
- **Manual test:** card menu → Enroll contacts → each tab renders; enrolling the same list twice reports all-skipped; CSV with a duplicate row imports the rest and enrolls them.

## §4 — Cold Contacts Manager (`components/ColdContactsManager.js`)
- Status-count header (6 colored tiles), **Pipeline kanban** (horizontal scroll, snap columns per status, per-column empty hints) ⇄ **Table** view toggle.
- Cards: initial avatar, name/title/company, email, "In: <campaign>" chip when actively enrolled, hover ··· menu (move along pipeline, open LinkedIn, delete), **Convert to Relationship** button on replied contacts (existing `convertColdToRelationship`).
- Table: status dropdown per row (system-owned unsubscribed/bounced locked), convert + delete actions.
- Inline add-contact form (email-validated, duplicate-guarded), CSV Import button feeding the existing full-screen preview flow, "Enroll in campaign" shortcut into the §3 panel. True empty state + skeleton.
- **Manual test:** add a contact (lands in prospect) → move to replied via the card menu → Convert button appears → convert creates the relationship.

## §5 — Settings tab (`components/EmailSettingsPanel.js`)
- Gmail card (connect/reconnect, sync-now, disconnect via existing handlers, last-synced stamp), **auto-send switch** + daily email/LinkedIn caps, **send window** (day pills + hour range + tz note), Resend fallback sender, and the relocated **unsubscribe list** (with via-link/via-reply/manual provenance + remove).
- All persistence through the existing `handleSaveEmailSettings` upsert — no new write paths.
- **Manual test:** toggle auto-send → toast + persisted on reload; unchecking every send day is refused.

Ground-truth check: no `outcome` anywhere, `activity_date` untouched (no new activity writes in this update), every enrollment insert sets exactly one contact ref. `next build` green (12/12 routes).

# ============ GMAIL AUTO-SEND (branch feat/gmail-auto-send) ============
Recon corrected the prompt's premise: gmail_connections had **1 row, not 0** —
but with needs_reauth=true and email_address NULL (Google revoked the refresh
token), so the runner skipped everything. Second blocker: **0 active
enrollments**. Server secrets verified live (gmail-authorize 302s to Google
with a real client id). The one step only the user can do: click Reconnect and
approve the Google consent screen.

## §1 — Connection flow fixed end-to-end
- **Root cause fixed:** the old Connect button built the Google URL client-side from `NEXT_PUBLIC_GOOGLE_CLIENT_ID` (dead if that env is missing) and omitted the `userinfo.email` scope — which is exactly why `email_address` was NULL. It now redirects through the server-side **gmail-authorize v4** (deployed + committed), which requests `gmail.send + gmail.readonly + userinfo.email` (v3 had dropped readonly, which would have broken inbox sync after reconnect). Scopes verified in the live redirect.
- **Banner (1.2):** campaigns tab shows a persistent amber banner (distinct copy for never-connected vs needs-reconnect) with the Connect/Reconnect button, flipping to a green "Gmail connected: <address> · campaigns send automatically" banner with Disconnect. The Settings tab's Gmail card (V4) already covers the second required location.
- **Redirect handling (1.4):** `?gmail=connected` now re-fetches the connection immediately + friendlier toast; `?gmail_error=` maps 6 error codes to plain-English messages. URL cleaned either way.
- **Activation gates (1.6):** going live now requires (1) a healthy Gmail connection or a Resend fallback sender — otherwise blocked with a toast and a jump to Settings; (2) ≥1 active enrollment OR a saved target audience OR a non-manual trigger; the existing draft-step confirm remains.
- **Manual test:** with the current needs_reauth row, the amber "needs reconnecting" banner shows; clicking it lands on Google's consent screen (verified to the redirect); after approving, the row gains email_address and the banner turns green.

## §2 — Scheduling: friendly config + "what sends when"
- **Settings scheduler:** AM/PM hour dropdowns, day pills, daily-cap **slider** (5–200, with Gmail-limit guidance), timezone dropdown (12 common zones incl. Vietnam) + **Detect my timezone**, and a **plain-English summary** ("Campaigns send Mon, Tue… between 9:00 AM and 5:00 PM your time, up to 50 emails per day — without you clicking anything."). Persists via the existing email_settings upsert.
- **Upcoming auto-sends (2.2):** campaigns tab card listing every active enrollment due today/tomorrow — avatar, contact, campaign, step number, subject preview, Today/Tomorrow chip, expandable past 8 rows — with the runner-health chip inline. Hidden when nothing is due.
- **Manual test:** enroll someone with next_send_at today → they appear under "due today"; change the cap slider → summary sentence updates and persists.

## §3 — Audience targeting + auto-enroll (migration applied + committed)
- `email_sequences.target_audience jsonb` + `auto_enroll_new boolean` (idempotent, applied live).
- **Target Audience tab** in the enrollment panel: manual / all relationships / all cold contacts / a list / **rule-based** ("tag has Investment Banking", with a tag-name datalist). Live match count + Apply & enroll runs through the same bulkEnroll (dedupe, unsubscribe filter, chunking). Audience persists on the campaign; a checkbox turns on future auto-enroll.
- **Auto-enroll on create (3.3):** `checkAutoEnrollForNewContact` runs at the end of handleAddClient — new relationships matching a live campaign's saved audience (all_relationships or rules, incl. tag rules) are enrolled instantly (unsub-guarded, dedupe-guarded, exactly one contact ref) with an "Auto-enrolled <name> in <campaign>" toast. List-mode audiences enroll via list membership instead, by design.
- **Manual test:** set audience "tag has Investment Banking" + auto-enroll → apply enrolls current matches; add a new relationship with that tag → toast + enrollment row appears without touching the campaign.

## §4 — Monitoring
- **Send history (4.1):** the per-campaign Stats view now ends with the last 50 sends — contact, subject, A/B variant, Opened/Clicked/Replied/Bounced badges, timestamp.
- **Runner health (4.2):** header badge — green pulse "Runner active · Nm ago" when a campaign was processed in the last 20 minutes; honest amber "last processed Nh/Nd ago / hasn't processed a campaign yet" otherwise (last_run_at only advances when a live campaign is processed).
- `next build` green (12/12 routes).

# ============ INBOX FIXES + LEAD GEN (branch feat/inbox-fixes-leadgen) ============
Note: this session's earlier Gmail auto-send work was already merged to main.
An uncommitted, in-progress "birthday auto-enroll" change to sequence-runner is
deliberately left uncommitted per the user's choice ("deploy runner without
birthday") — runner redeploys in later parts build from the committed version.

## Part 1 — Two trust bugs fixed (highest priority)
**Bug 1 — reply attached to the wrong person (gmail-sync v11, deployed).**
- Root cause: `clientRows` fetched with no ORDER BY, and `.find()` returned whichever duplicate came back first. John (id 21) and Lamine Yamal (id 38) share `capvanthanh2009@gmail.com`, so attribution was non-deterministic.
- Fix: both pool queries now `.order('id')`; pool grouped `byEmail`; when an email has multiple contacts, `resolveMatch()` prefers whoever has an ACTIVE enrollment (the one mid-conversation), else the most-recent send. The blind `chunk.find` is replaced with emailKey → candidates → resolveMatch.
**Bug 2 — a real reply counted as 0 (gmail-sync v11).**
- Root cause: `replied_at` was only set for classifications that fell through to the trailing `else`; a `not_interested`/`out_of_office` reply skipped it, so the stat (which reads `sequence_sends.replied_at`) genuinely showed 0.
- Fix: every inbound message now stamps `replied_at` on the contact's most-recent send **directly**, before the classification branches — independent of enrollment status (so it survives not_interested stopping the enrollment). Deviates intentionally from the prompt's literal patch, which would have let the auto-stop pass flip an OOO enrollment to "replied" and undo its 7-day pause; the direct stamp fixes the stat without that side effect. not_interested still stops+unsubscribes; OOO still pauses 7 days; positive replies still stop the sequence.
**1.3 backfill (verified live):** confirmed the data matched the diagnosis (reply arrived 18:32, 5 min after John's send 16 at 18:27; Lamine's latest send was ~4h earlier → the reply is John's). Moved `email_inbox` id 1 from client 38→21 (+ send_id 16, sequence_id 6) and stamped `sequence_sends` id 16 `replied_at`. John's Replied stat now reads 1.
**1.4 duplicate-email detector + safe merge:**
- New `findDuplicateEmails()` + a prominent red "Same-email duplicates" panel in Settings that lists shared-email groups and offers Merge-into-oldest / "Different people" dismiss (localStorage-persisted).
- Fixed `handleExecuteMerge`: it reassigned activities/tasks/deals/files but NOT sequence_enrollments/sequence_sends/email_inbox — so deleting a merged-away duplicate would orphan or cascade-delete its reply history. Now reassigns all three (and refetches sequences).
- **Manual test:** Settings shows the John/Lamine same-email card; clicking Merge into john moves Lamine's enrollments/sends/inbox to john and deletes Lamine. After a Gmail sync, a "not interested" reply now sets replied_at and increments Replied; a reply from a shared email attaches to whoever has the active enrollment.
- `next build` green.

## Part 2 — Enrollment visibility
**2.1 Post-enroll confirmation.** `bulkEnroll()` now builds a structured, per-contact result (`enrolled` / `skippedDupe` / `skippedUnsub` / `failed`, plus the campaign name) instead of only a toast, and reports it upward via a new `onResult` prop. A chunk insert failure now pushes that chunk's contacts into `failed` and continues to the next chunk rather than aborting the whole run. New exported `EnrollResultPanel` renders bottom-right at app top level (so it survives the enrollment takeover closing), listing names per bucket, capped at 40 per section with a "+N more".
**2.2 Persistent enrollment status.** The campaign builder's stats strip gained a clickable "Enrolled N (M active)" entry that opens a full-screen list of everyone ever enrolled in that campaign: filter tabs (all / active / replied / completed / stopped) with live counts, and a table of contact (with a COLD tag), status badge, current step (resolved to the node's type/subject), next send date, and enrolled date, newest first.
- **Manual test:** enroll a mix where one contact is already enrolled and one is unsubscribed → the results panel lists each under the right heading; click "Enrolled N" in the builder → the list opens and the filter tabs partition the rows correctly.
- `next build` green.

## Part 3 — In-app reply: real Gmail API send + rich text
**3.1 New edge function `gmail-send-reply` (deployed, verify_jwt on).** Sends a reply to an `email_inbox` message directly via `gmail.googleapis.com/.../messages/send` using the already-granted `gmail.send` scope. Threads correctly (`In-Reply-To` / `References` with the message-id wrapped in angle brackets, plus `threadId`), so it lands in the same Gmail conversation. UTF-8-safe base64url encoder (TextEncoder, no deprecated `unescape`). The inbox lookup is scoped `.eq('user_id', userId)` so nobody can reply from another user's inbox. On success it logs the outbound activity (`activity_type='Email'`, `activity_date`, non-null `description`, no `outcome`) and marks the message read. Refresh-token failure flips `needs_reauth` and returns a typed error.
**3.2 Rich-text composer.** Replaced the plain textarea with a dependency-free `contentEditable` editor: bold / italic / underline, bullet + numbered lists, insert link (auto-prefixes `https://`), clear formatting, and a snippet picker. Typing `:shortcut` + space expands the snippet in place (deletes the typed shortcut, inserts resolved HTML). Toolbar buttons use `onMouseDown preventDefault` so the caret/selection survives the click. Placeholder via a `:empty::before` rule in globals.css.
**3.3 Wiring.** `sendReplyViaApi()` posts to the function with the session token; the campaign-send compose-tab pattern is untouched. Honest fallback: if Gmail isn't connected / needs reauth, it says so and opens a pre-filled compose tab rather than dead-ending. The editor remounts (via key) to clear after a successful send.
- **Manual test:** open a reply in the Inbox, bold some text and add a bullet list, type `:thanks ` to expand a snippet, hit Send Reply → the message appears in the real Gmail Sent folder inside the original thread, the row goes read, and an outbound activity is logged.
- `next build` green.

## Parts 4 & 5 — Sending modes + auto-send notifications
**4.1 Migration (applied):** `email_sequences.sending_mode text NOT NULL DEFAULT 'automatic'`.
**4.2 Mode selector:** segmented Automatic / Manual / Both control in the campaign builder toolbar, persisted via `handleChangeSendingMode` with a mode-specific toast.
**4.3 Runner gate (source committed):** the runner skips `sending_mode === 'manual'` campaigns in its auto-send pass, so manual campaigns never send themselves.
**4.4 Mode-aware queues:** the Outbox (`dueSequenceSends`) now only lists campaigns whose mode is `manual` or `both`; the Upcoming auto-sends panel excludes `manual` campaigns. So each campaign shows up in exactly the queue its mode implies, and `both` appears in both.
**5.1 Runner notification (source committed):** every processed step inserts a `notifications` row. **Adapted to the real schema found in Step 0** — the live table is `(id,user_id,type,reference_id,message,read,action_url,created_at)`, so there is no `title`/`body`/`metadata`; the message is composed into `message`, with `type='auto_send'`, the contact id in `reference_id`, and `action_url`.
**5.2 Bell badge:** notifications of `type === 'auto_send'` render a green "Auto-sent" pill above the message in the existing bell dropdown.
- **Manual test:** set a campaign to Manual → its due contacts move out of Upcoming auto-sends and into the Outbox, and the runner stops auto-sending it; set it to Both → it appears in both queues.
- `next build` green.

### ⚠️ Runner deploy still pending
`supabase/functions/sequence-runner/index.ts` contains the 4.3 / 5.1 / 7.1 changes **in source and committed**, but is **not yet redeployed** — deploying it requires inlining both `index.ts` and `_shared/sequence-logic.ts` (~28KB), and I judged a late-session hand-transcription of the live every-15-minutes email sender too risky to do blind. Until it is redeployed, sending_mode is honored by the UI queues but not by the server, and no auto_send notifications are written. Deploy with:
`supabase functions deploy sequence-runner --project-ref wuralwhctnbtkirofuph`
Per your instruction the committed runner deliberately EXCLUDES the uncommitted birthday auto-enroll work, which remains in the working tree only.

## Parts 6 & 7 — status (honest)
**Schema is applied and verified for both**, but the UI/function layers were not
reached in this pass — I stopped rather than rush a shallow version of them:
- **Part 6 (lead gen):** `lead_gen_searches` (+RLS), `cold_contacts.lead_gen_search_id`, and a `user_api_keys` table (+RLS, unique per user+provider) are live. Step 0 found no `user_api_keys` table and an unrelated `api_keys` table (this app's own outbound API keys), so a separate table was created rather than overloading that one. **Not built:** the Lead Gen panel, the `lead-gen-search` edge function, and the scheduled re-run. No email is ever fabricated by anything shipped here.
- **Part 7 (social):** `clients`/`cold_contacts` gained `facebook_url` + `instagram_url`, and `meta_connections` (+RLS) exists. The runner's task branch already handles the four new channels (`facebook_message`, `facebook_connect`, `instagram_dm`, `instagram_follow`) with profile links and cold-contact-safe names — `_shared/sequence-logic.ts` routes any non-email action node to `'task'`, so no shared-logic change was needed. **Not built:** the canvas node-palette entries for those channels, and the Meta Business OAuth connect flow. Consistent with the prompt's own position, there is **no personal-account automation anywhere in this codebase** — social steps only ever create a task the user acts on themselves.

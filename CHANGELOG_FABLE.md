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

# Deployed Edge Functions (source of truth = live deployment via MCP)
Retrieve current source with the Supabase dashboard or MCP `get_edge_function`.

- **sequence-runner** (verify_jwt=false; auth = service-role key OR embedded cron token)
  Auto-sends due sequence steps via Resend every 15 min (pg_cron job `sequence-runner`).
  Contains `_shared/sequence-logic.ts` — ⚠ MUST stay behaviorally identical to the
  client copy in `src/app/page.js` (stepConditionMet / resolveDueStep /
  pickSubjectVariant / computeNextSendAt). Needs secret: RESEND_API_KEY.
- **track** (verify_jwt=false) — GET /track/open/:token → 1×1 GIF + opened_at;
  GET /track/click/:token?u=… → clicked_at + 302 redirect.
- **gmail-sync** (verify_jwt=true) — Gmail poll + auto-stop-on-reply (Upgrade 2).
- **gmail-oauth** (verify_jwt=false) — G1 OAuth callback.

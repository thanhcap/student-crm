-- GMAIL AUTO-SEND — audience targeting per campaign.
-- target_audience: { "mode": "filter", "rules": [{field, op, value}] }
--               |  { "mode": "list", "list_id": <relationship_lists.id> }
--               |  { "mode": "all_relationships" } | { "mode": "all_cold_contacts" }
-- NULL = manual-only enrollment (existing behavior).
ALTER TABLE public.email_sequences ADD COLUMN IF NOT EXISTS target_audience jsonb;

-- When true AND target_audience is set, contacts created later that match the
-- audience are auto-enrolled from the client on creation.
ALTER TABLE public.email_sequences ADD COLUMN IF NOT EXISTS auto_enroll_new boolean DEFAULT false;

-- Security incident remediation (2026-07-10): a previous CRON_TOKEN was hardcoded and
-- accidentally leaked via a committed changelog file. This retires that token entirely
-- and replaces it with a fresh, Vault-stored secret that the sequence-runner Edge
-- Function reads via a restricted RPC call — never hardcoded in source, never plaintext
-- in cron.job, and requires no `supabase secrets set` step.
--
-- Companion steps applied directly against the live project (not idempotent SQL, so not
-- repeated here):
--   1. A fresh random token was generated and stored via `vault.create_secret(value,
--      'cron_token', ...)`.
--   2. `cron.job` (jobname='sequence-runner') was updated via `cron.alter_job` so its
--      command dereferences `vault.decrypted_secrets` at execution time instead of
--      embedding a literal bearer token.
--   3. The sequence-runner function was redeployed (v7) to check incoming requests
--      against `public.get_cron_token()` (below) instead of a hardcoded/env constant.

CREATE OR REPLACE FUNCTION public.get_cron_token()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, vault
AS $$
  SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_token' LIMIT 1;
$$;

-- Only the server-side service role may call this — never anon/authenticated clients.
REVOKE ALL ON FUNCTION public.get_cron_token() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_cron_token() TO service_role;

-- inbox-fixes-leadgen — Parts 4, 6, 7 schema.
-- NOTE: public.notifications already exists (id,user_id,type,reference_id,message,
-- read,action_url,created_at) so Part 5 adapts to that shape instead of adding
-- title/body/metadata columns.

-- Part 4 — per-campaign sending mode
ALTER TABLE public.email_sequences
  ADD COLUMN IF NOT EXISTS sending_mode text NOT NULL DEFAULT 'automatic'; -- automatic|manual|both

-- Part 6 — lead generation searches
CREATE TABLE IF NOT EXISTS public.lead_gen_searches (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category text NOT NULL,
  keywords text,
  location text,
  provider text DEFAULT 'manual',
  status text DEFAULT 'pending',
  result_count int DEFAULT 0,
  auto_rerun boolean DEFAULT false,
  rerun_frequency_days int DEFAULT 7,
  last_run_at timestamptz,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.lead_gen_searches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own lead_gen_searches" ON public.lead_gen_searches;
CREATE POLICY "own lead_gen_searches" ON public.lead_gen_searches
  FOR ALL USING ((select auth.uid()) = user_id);

ALTER TABLE public.cold_contacts
  ADD COLUMN IF NOT EXISTS lead_gen_search_id bigint REFERENCES public.lead_gen_searches(id) ON DELETE SET NULL;

-- Part 6 — the user's OWN third-party provider keys (Hunter/Apollo). Distinct
-- from public.api_keys, which is this app's outbound API-key table.
-- Stored per-user and readable only by that user via RLS.
CREATE TABLE IF NOT EXISTS public.user_api_keys (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider text NOT NULL,
  api_key text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE (user_id, provider)
);
ALTER TABLE public.user_api_keys ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own user_api_keys" ON public.user_api_keys;
CREATE POLICY "own user_api_keys" ON public.user_api_keys
  FOR ALL USING ((select auth.uid()) = user_id);

-- Part 7 — social profile URLs for task-based outreach
ALTER TABLE public.clients       ADD COLUMN IF NOT EXISTS facebook_url text;
ALTER TABLE public.clients       ADD COLUMN IF NOT EXISTS instagram_url text;
ALTER TABLE public.cold_contacts ADD COLUMN IF NOT EXISTS facebook_url text;
ALTER TABLE public.cold_contacts ADD COLUMN IF NOT EXISTS instagram_url text;

-- Part 7.2 — official Meta Business connections ONLY (Page / IG professional).
-- Never used for personal-profile automation.
CREATE TABLE IF NOT EXISTS public.meta_connections (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform text NOT NULL,
  page_id text,
  access_token text,
  token_expiry timestamptz,
  connected_at timestamptz DEFAULT now(),
  revoked_at timestamptz
);
ALTER TABLE public.meta_connections ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own meta_connections" ON public.meta_connections;
CREATE POLICY "own meta_connections" ON public.meta_connections
  FOR ALL USING ((select auth.uid()) = user_id);

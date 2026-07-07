-- Fix drift between app code and live schema (code references verified against src/app/page.js)
-- ALREADY APPLIED to project wuralwhctnbtkirofuph on 2026-07-07 via MCP (migration: fix_schema_drift).
-- Kept in the repo for history / other environments. Idempotent — safe to re-run.

-- clients: Feature 25 (source tracking) + Feature 15 (quick notes)
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS source text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS quick_note text;

-- profiles: Feature 17 (activity streaks)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS current_streak integer DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS longest_streak integer DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_active_date date;

-- tasks: Feature 20 (recurring tasks)
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS recurrence text;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS recurrence_end_date date;

-- automation_rules: code stores action_value as an object and tracks run counts
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='automation_rules' AND column_name='action_value' AND data_type='text')
  THEN
    ALTER TABLE public.automation_rules ALTER COLUMN action_value TYPE jsonb USING nullif(action_value, '')::jsonb;
  END IF;
END $$;
ALTER TABLE public.automation_rules ADD COLUMN IF NOT EXISTS run_count integer DEFAULT 0;
ALTER TABLE public.automation_rules ADD COLUMN IF NOT EXISTS last_run_at timestamptz;

-- custom_field_definitions: code reads/writes select_options; DB had field_options
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='custom_field_definitions' AND column_name='field_options')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='custom_field_definitions' AND column_name='select_options')
  THEN
    ALTER TABLE public.custom_field_definitions RENAME COLUMN field_options TO select_options;
  END IF;
END $$;

-- client_files: Feature 7 stores storage_path + file_type, never file_url
ALTER TABLE public.client_files ADD COLUMN IF NOT EXISTS file_type text;
ALTER TABLE public.client_files ADD COLUMN IF NOT EXISTS storage_path text;
ALTER TABLE public.client_files ALTER COLUMN file_url DROP NOT NULL;

-- webhooks: Feature 11 table was never created
CREATE TABLE IF NOT EXISTS public.webhooks (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  url text NOT NULL,
  events text[] NOT NULL DEFAULT '{}',
  secret text,
  enabled boolean NOT NULL DEFAULT true,
  last_triggered_at timestamptz,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.webhooks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users own webhooks" ON public.webhooks;
CREATE POLICY "Users own webhooks" ON public.webhooks
  FOR ALL USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id);

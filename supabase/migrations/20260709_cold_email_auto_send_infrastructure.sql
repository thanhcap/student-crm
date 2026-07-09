-- Part 3 — Cold Email + Auto-Send Infrastructure
-- Applied to project wuralwhctnbtkirofuph via Supabase MCP on 2026-07-09.

-- Cold email contacts (people NOT yet in clients table — prospects from CSV upload or manual add)
CREATE TABLE IF NOT EXISTS public.cold_contacts (
  id              bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email           text NOT NULL,
  first_name      text,
  last_name       text,
  company         text,
  title           text,
  linkedin_url    text,
  phone           text,
  source          text DEFAULT 'manual',   -- 'manual' | 'csv' | 'api'
  status          text DEFAULT 'prospect', -- 'prospect' | 'contacted' | 'replied' | 'converted' | 'unsubscribed' | 'bounced'
  tags            text[],
  custom_fields   jsonb DEFAULT '{}',
  unsubscribed_at timestamptz,
  bounced_at      timestamptz,
  created_at      timestamptz DEFAULT now(),
  UNIQUE(user_id, email)
);
ALTER TABLE public.cold_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own cold_contacts" ON public.cold_contacts
  FOR ALL USING ((select auth.uid()) = user_id);
CREATE INDEX IF NOT EXISTS cold_contacts_user_email_idx ON public.cold_contacts(user_id, email);
CREATE INDEX IF NOT EXISTS cold_contacts_status_idx ON public.cold_contacts(user_id, status);

-- Unsubscribe list (global per user — checked before every auto-send)
CREATE TABLE IF NOT EXISTS public.unsubscribes (
  id        bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  user_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email     text NOT NULL,
  reason    text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, email)
);
ALTER TABLE public.unsubscribes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own unsubscribes" ON public.unsubscribes
  FOR ALL USING ((select auth.uid()) = user_id);

-- Extend sequence_enrollments to support cold_contacts (either client_id OR cold_contact_id, never both)
ALTER TABLE public.sequence_enrollments
  ADD COLUMN IF NOT EXISTS cold_contact_id bigint REFERENCES public.cold_contacts(id) ON DELETE CASCADE;

-- Auto-send event triggers (what fires auto-enrollment without a button)
CREATE TABLE IF NOT EXISTS public.sequence_triggers (
  id              bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sequence_id     bigint NOT NULL REFERENCES public.email_sequences(id) ON DELETE CASCADE,
  trigger_event   text NOT NULL,
    -- 'manual' | 'deal_won' | 'deal_lost' | 'deal_stage_changed' | 'relationship_created' |
    -- 'relationship_stage_changed' | 'tag_applied' | 'task_completed' |
    -- 'no_activity_days' | 'birthday_approaching'
  trigger_config  jsonb DEFAULT '{}',
  target_audience text DEFAULT 'relationships',  -- 'relationships' | 'cold_contacts' | 'both'
  enabled         boolean DEFAULT true,
  created_at      timestamptz DEFAULT now()
);
ALTER TABLE public.sequence_triggers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own sequence_triggers" ON public.sequence_triggers
  FOR ALL USING ((select auth.uid()) = user_id);

-- Send-log extensions for cold contacts + bounce/unsubscribe tracking
ALTER TABLE public.sequence_sends
  ADD COLUMN IF NOT EXISTS cold_contact_id bigint REFERENCES public.cold_contacts(id) ON DELETE SET NULL;
ALTER TABLE public.sequence_sends
  ADD COLUMN IF NOT EXISTS bounced_at timestamptz;
ALTER TABLE public.sequence_sends
  ADD COLUMN IF NOT EXISTS unsubscribed_at timestamptz;

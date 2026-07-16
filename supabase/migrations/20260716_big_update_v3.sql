-- ============================================================
-- BIG UPDATE V3 — consolidated migration (idempotent)
-- Verified against live schema 2026-07-16:
--   clients.id bigint · deals.id uuid · tasks.id uuid · jobs.id uuid
--   gmail_connections.id bigint · profiles.id uuid
-- ALREADY LIVE (not re-created): deals.is_recurring/billing_cycle/
--   renewal_date/currency · tasks.recurrence · automation_rules.run_count/
--   last_run_at · relationship_lists/notes · deal_events · import_history
-- ============================================================

-- ---------- Cluster A: AI & intelligence ----------
-- F2 — meeting briefs
CREATE TABLE IF NOT EXISTS public.meeting_briefs (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  client_id bigint NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  brief text NOT NULL, generated_for date, created_at timestamptz DEFAULT now()
);
ALTER TABLE public.meeting_briefs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own briefs" ON public.meeting_briefs;
CREATE POLICY "own briefs" ON public.meeting_briefs FOR ALL USING ((select auth.uid()) = user_id);

-- ---------- Cluster B: student & career networking ----------
-- F11 — network role
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS network_role text;
-- F15 — school
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS school text;
-- F27 — timezone
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS timezone text;
-- F40 — preferred channel
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS preferred_channel text;

-- F12 — informational interviews
CREATE TABLE IF NOT EXISTS public.info_interviews (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  client_id bigint NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scheduled_date date, questions_prepared text, key_takeaways text,
  follow_up_sent boolean DEFAULT false, created_at timestamptz DEFAULT now()
);
ALTER TABLE public.info_interviews ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own info_interviews" ON public.info_interviews;
CREATE POLICY "own info_interviews" ON public.info_interviews FOR ALL USING ((select auth.uid()) = user_id);

-- F13 — job/internship applications
CREATE TABLE IF NOT EXISTS public.applications (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_name text NOT NULL, role_title text,
  referral_client_id bigint REFERENCES public.clients(id),
  status text DEFAULT 'applied' CHECK (status IN ('researching','applied','phone_screen','interview','offer','rejected','withdrawn')),
  applied_date date, notes text, job_url text, created_at timestamptz DEFAULT now()
);
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own applications" ON public.applications;
CREATE POLICY "own applications" ON public.applications FOR ALL USING ((select auth.uid()) = user_id);

-- F18 — career goals
CREATE TABLE IF NOT EXISTS public.career_goals (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  goal text NOT NULL, target_date date, status text DEFAULT 'active',
  linked_client_ids bigint[], created_at timestamptz DEFAULT now()
);
ALTER TABLE public.career_goals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own career_goals" ON public.career_goals;
CREATE POLICY "own career_goals" ON public.career_goals FOR ALL USING ((select auth.uid()) = user_id);

-- F19 — elevator pitch / bio (merge tags {{my_pitch}}, {{my_bio}})
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS elevator_pitch text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS one_line_bio text;

-- ---------- Cluster C: meetings & calendar ----------
-- F23 — public booking
CREATE TABLE IF NOT EXISTS public.booking_slots (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day_of_week int, start_time time, end_time time, duration_minutes int DEFAULT 30,
  buffer_minutes int DEFAULT 0
);
CREATE TABLE IF NOT EXISTS public.bookings (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id bigint REFERENCES public.clients(id), booked_at timestamptz,
  guest_name text, guest_email text, status text DEFAULT 'confirmed', created_at timestamptz DEFAULT now()
);
ALTER TABLE public.booking_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own slots" ON public.booking_slots;
CREATE POLICY "own slots" ON public.booking_slots FOR ALL USING ((select auth.uid()) = user_id);
DROP POLICY IF EXISTS "own bookings" ON public.bookings;
CREATE POLICY "own bookings" ON public.bookings FOR ALL USING ((select auth.uid()) = user_id);

-- F26 — recurring task series grouping
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS series_id uuid;

-- ---------- Cluster D: communication ----------
-- F37 — email signature
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email_signature text;
-- F38 — per-sequence sending identity
ALTER TABLE public.email_sequences ADD COLUMN IF NOT EXISTS gmail_connection_id bigint REFERENCES public.gmail_connections(id);
-- F42 — call/voicemail scripts
CREATE TABLE IF NOT EXISTS public.call_scripts (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL, script text NOT NULL, created_at timestamptz DEFAULT now()
);
ALTER TABLE public.call_scripts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own scripts" ON public.call_scripts;
CREATE POLICY "own scripts" ON public.call_scripts FOR ALL USING ((select auth.uid()) = user_id);

-- ---------- Cluster E: deals & revenue ----------
-- F43 — multi-stakeholder deals
CREATE TABLE IF NOT EXISTS public.deal_stakeholders (
  deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  client_id bigint NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  role text DEFAULT 'stakeholder',
  PRIMARY KEY (deal_id, client_id)
);
ALTER TABLE public.deal_stakeholders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own deal_stakeholders" ON public.deal_stakeholders;
CREATE POLICY "own deal_stakeholders" ON public.deal_stakeholders
  FOR ALL USING (deal_id IN (SELECT id FROM public.deals WHERE user_id = (select auth.uid())));

-- F44 — split credit
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS split_credit jsonb DEFAULT '{}';

-- F46 — deal templates
CREATE TABLE IF NOT EXISTS public.deal_templates (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL, default_value numeric, default_probability int, default_stage text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.deal_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own deal_templates" ON public.deal_templates;
CREATE POLICY "own deal_templates" ON public.deal_templates FOR ALL USING ((select auth.uid()) = user_id);

-- F64 — stripe payment link on jobs
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS stripe_payment_link text;

-- ---------- Cluster G: documents ----------
-- F59/F60/F62/F65 — proposals + e-signature + versions + expiry
CREATE TABLE IF NOT EXISTS public.proposals (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  deal_id uuid REFERENCES public.deals(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text, sections jsonb DEFAULT '[]', status text DEFAULT 'draft',
  shared_token text UNIQUE, valid_until date,
  signed_at timestamptz, signer_name text, signature_data text,
  versions jsonb DEFAULT '[]',
  created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.proposals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own proposals" ON public.proposals;
CREATE POLICY "own proposals" ON public.proposals FOR ALL USING ((select auth.uid()) = user_id);

-- F61 — contract templates
CREATE TABLE IF NOT EXISTS public.contract_templates (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL, body text NOT NULL, created_at timestamptz DEFAULT now()
);
ALTER TABLE public.contract_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own contract_templates" ON public.contract_templates;
CREATE POLICY "own contract_templates" ON public.contract_templates FOR ALL USING ((select auth.uid()) = user_id);

-- ---------- Cluster H: search & segmentation ----------
-- F67 — saved search alerts
CREATE TABLE IF NOT EXISTS public.saved_search_alerts (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL, filters jsonb NOT NULL, notify boolean DEFAULT true,
  last_checked_at timestamptz, created_at timestamptz DEFAULT now()
);
ALTER TABLE public.saved_search_alerts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own alerts" ON public.saved_search_alerts;
CREATE POLICY "own alerts" ON public.saved_search_alerts FOR ALL USING ((select auth.uid()) = user_id);

-- F68 — smart segments extend relationship_lists
ALTER TABLE public.relationship_lists ADD COLUMN IF NOT EXISTS is_smart boolean DEFAULT false;
ALTER TABLE public.relationship_lists ADD COLUMN IF NOT EXISTS smart_filters jsonb;

-- ---------- Cluster I: security & compliance ----------
-- F77 — audit log
CREATE TABLE IF NOT EXISTS public.audit_log (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action text NOT NULL, entity_type text, entity_id text, created_at timestamptz DEFAULT now()
);
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own audit_log" ON public.audit_log;
CREATE POLICY "own audit_log" ON public.audit_log FOR ALL USING ((select auth.uid()) = user_id);

-- F80 — deletion grace period
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS deletion_requested_at timestamptz;

-- ---------- Cluster K: gamification ----------
-- F87 — achievements
CREATE TABLE IF NOT EXISTS public.achievements (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  badge_key text NOT NULL, earned_at timestamptz DEFAULT now(),
  UNIQUE(user_id, badge_key)
);
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own achievements" ON public.achievements;
CREATE POLICY "own achievements" ON public.achievements FOR ALL USING ((select auth.uid()) = user_id);

-- ---------- Cluster L: automation ----------
-- F95 — run history (automation_rules.last_run_at/run_count already exist)
CREATE TABLE IF NOT EXISTS public.automation_runs (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  rule_id uuid REFERENCES public.automation_rules(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  result text, created_at timestamptz DEFAULT now()
);
ALTER TABLE public.automation_runs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own automation_runs" ON public.automation_runs;
CREATE POLICY "own automation_runs" ON public.automation_runs FOR ALL USING ((select auth.uid()) = user_id);

-- ---------- Cluster M: customization ----------
-- F97 — dashboard layout
CREATE TABLE IF NOT EXISTS public.dashboard_layout (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  widget_order jsonb DEFAULT '[]'
);
ALTER TABLE public.dashboard_layout ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own dashboard_layout" ON public.dashboard_layout;
CREATE POLICY "own dashboard_layout" ON public.dashboard_layout FOR ALL USING ((select auth.uid()) = user_id);

-- F98 — accent color
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS accent_color text;

-- F59/F60 — NO anon RLS policy for shared proposals: an anon SELECT policy on
-- shared_token IS NOT NULL would let anyone enumerate every shared proposal.
-- The public link is served by the `proposal-public` edge function (service
-- key, exact-token lookup, signature POST) instead.

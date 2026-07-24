-- 50-feature expansion — consolidated migration.
-- FIX vs prompt: automation_recipes.source_rule_id is uuid (automation_rules.id is uuid, not bigint).

-- ===== CLUSTER A — NETWORK EFFECTS =====
ALTER TABLE public.clients  ADD COLUMN IF NOT EXISTS opt_in_alumni_directory boolean DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS opt_in_alumni_directory boolean DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS public_card_slug text UNIQUE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS public_card_bio text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS public_card_enabled boolean DEFAULT false;

CREATE TABLE IF NOT EXISTS public.public_card_visits (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  profile_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  visitor_email text, message text, created_at timestamptz DEFAULT now()
);
ALTER TABLE public.public_card_visits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own card visits" ON public.public_card_visits;
CREATE POLICY "own card visits" ON public.public_card_visits FOR SELECT USING ((select auth.uid()) = profile_user_id);
DROP POLICY IF EXISTS "anyone can submit" ON public.public_card_visits;
CREATE POLICY "anyone can submit" ON public.public_card_visits FOR INSERT WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.shared_templates (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_sequence_id bigint REFERENCES public.email_sequences(id) ON DELETE SET NULL,
  source_proposal_id bigint REFERENCES public.proposals(id) ON DELETE SET NULL,
  name text NOT NULL, description text, kind text NOT NULL,
  clone_count int DEFAULT 0, published_at timestamptz DEFAULT now()
);
ALTER TABLE public.shared_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read all shared templates" ON public.shared_templates;
CREATE POLICY "read all shared templates" ON public.shared_templates FOR SELECT USING (true);
DROP POLICY IF EXISTS "own shared templates write" ON public.shared_templates;
CREATE POLICY "own shared templates write" ON public.shared_templates FOR INSERT WITH CHECK ((select auth.uid()) = user_id);
DROP POLICY IF EXISTS "own shared templates modify" ON public.shared_templates;
CREATE POLICY "own shared templates modify" ON public.shared_templates FOR UPDATE USING ((select auth.uid()) = user_id);
DROP POLICY IF EXISTS "own shared templates delete" ON public.shared_templates;
CREATE POLICY "own shared templates delete" ON public.shared_templates FOR DELETE USING ((select auth.uid()) = user_id);

CREATE TABLE IF NOT EXISTS public.networking_scores (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  opt_in boolean DEFAULT false, display_name text, score int DEFAULT 0, updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.networking_scores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read opted-in scores" ON public.networking_scores;
CREATE POLICY "read opted-in scores" ON public.networking_scores FOR SELECT USING (opt_in = true OR (select auth.uid()) = user_id);
DROP POLICY IF EXISTS "own score write" ON public.networking_scores;
CREATE POLICY "own score write" ON public.networking_scores FOR ALL USING ((select auth.uid()) = user_id);

CREATE OR REPLACE FUNCTION public.search_alumni_directory(p_school text)
RETURNS TABLE(user_id uuid, display_name text, school text)
SECURITY DEFINER SET search_path = public AS $$
  SELECT DISTINCT p.id, p.username, c.school
  FROM public.profiles p
  JOIN public.clients c ON c.user_id = p.id
  WHERE p.opt_in_alumni_directory = true
    AND c.school ILIKE '%' || p_school || '%'
    AND p.id != auth.uid();
$$ LANGUAGE sql STABLE;

-- ===== CLUSTER B — SENDING INFRA / COMPLIANCE / PREP =====
ALTER TABLE public.email_settings ADD COLUMN IF NOT EXISTS warmup_enabled boolean DEFAULT false;
ALTER TABLE public.email_settings ADD COLUMN IF NOT EXISTS warmup_start_cap int DEFAULT 10;
ALTER TABLE public.email_settings ADD COLUMN IF NOT EXISTS warmup_increment int DEFAULT 5;
ALTER TABLE public.email_settings ADD COLUMN IF NOT EXISTS warmup_increment_days int DEFAULT 3;
ALTER TABLE public.email_settings ADD COLUMN IF NOT EXISTS warmup_started_at date;
ALTER TABLE public.email_settings ADD COLUMN IF NOT EXISTS weekly_digest_enabled boolean DEFAULT false;

CREATE TABLE IF NOT EXISTS public.domain_health_checks (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  domain text NOT NULL, spf_status text, dkim_status text, dmarc_status text, checked_at timestamptz DEFAULT now()
);
ALTER TABLE public.domain_health_checks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own domain_health_checks" ON public.domain_health_checks;
CREATE POLICY "own domain_health_checks" ON public.domain_health_checks FOR ALL USING ((select auth.uid()) = user_id);

CREATE TABLE IF NOT EXISTS public.research_notes (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  client_id bigint REFERENCES public.clients(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recent_news text, funding_info text, competitors text, other_notes text, updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.research_notes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own research_notes" ON public.research_notes;
CREATE POLICY "own research_notes" ON public.research_notes FOR ALL USING ((select auth.uid()) = user_id);

CREATE TABLE IF NOT EXISTS public.negotiation_scripts (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scenario text NOT NULL, title text NOT NULL, body text NOT NULL, is_builtin boolean DEFAULT false, created_at timestamptz DEFAULT now()
);
ALTER TABLE public.negotiation_scripts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own negotiation_scripts" ON public.negotiation_scripts;
CREATE POLICY "own negotiation_scripts" ON public.negotiation_scripts FOR ALL USING ((select auth.uid()) = user_id);

-- ===== CLUSTER C — CAREER TOOLS =====
CREATE TABLE IF NOT EXISTS public.offer_comparisons (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  application_id bigint REFERENCES public.applications(id) ON DELETE SET NULL,
  company_name text NOT NULL, base_salary numeric, equity_value numeric, signing_bonus numeric,
  benefits_notes text, location text, cost_of_living_index numeric DEFAULT 100, created_at timestamptz DEFAULT now()
);
ALTER TABLE public.offer_comparisons ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own offer_comparisons" ON public.offer_comparisons;
CREATE POLICY "own offer_comparisons" ON public.offer_comparisons FOR ALL USING ((select auth.uid()) = user_id);

CREATE TABLE IF NOT EXISTS public.interview_questions (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  role_category text NOT NULL, question text NOT NULL, is_builtin boolean DEFAULT true,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE
);
ALTER TABLE public.interview_questions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read builtin or own questions" ON public.interview_questions;
CREATE POLICY "read builtin or own questions" ON public.interview_questions FOR SELECT USING (is_builtin = true OR (select auth.uid()) = user_id);
DROP POLICY IF EXISTS "own questions write" ON public.interview_questions;
CREATE POLICY "own questions write" ON public.interview_questions FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

CREATE TABLE IF NOT EXISTS public.practice_sessions (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question_id bigint REFERENCES public.interview_questions(id) ON DELETE SET NULL,
  my_answer text, duration_seconds int, created_at timestamptz DEFAULT now()
);
ALTER TABLE public.practice_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own practice_sessions" ON public.practice_sessions;
CREATE POLICY "own practice_sessions" ON public.practice_sessions FOR ALL USING ((select auth.uid()) = user_id);

CREATE TABLE IF NOT EXISTS public.job_watch_targets (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_name text NOT NULL, careers_url text NOT NULL, last_checked_at timestamptz, last_hash text, created_at timestamptz DEFAULT now()
);
ALTER TABLE public.job_watch_targets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own job_watch_targets" ON public.job_watch_targets;
CREATE POLICY "own job_watch_targets" ON public.job_watch_targets FOR ALL USING ((select auth.uid()) = user_id);

CREATE TABLE IF NOT EXISTS public.job_watch_results (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  target_id bigint NOT NULL REFERENCES public.job_watch_targets(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text, url text, found_at timestamptz DEFAULT now(), dismissed boolean DEFAULT false
);
ALTER TABLE public.job_watch_results ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own job_watch_results" ON public.job_watch_results;
CREATE POLICY "own job_watch_results" ON public.job_watch_results FOR ALL USING ((select auth.uid()) = user_id);

-- ===== CLUSTER D — MEETINGS, VIDEO & VOICE =====
CREATE TABLE IF NOT EXISTS public.video_messages (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id bigint REFERENCES public.clients(id) ON DELETE CASCADE,
  deal_id uuid REFERENCES public.deals(id) ON DELETE CASCADE,
  storage_path text NOT NULL, duration_seconds int, shared_token text UNIQUE, view_count int DEFAULT 0, created_at timestamptz DEFAULT now()
);
ALTER TABLE public.video_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own video_messages" ON public.video_messages;
CREATE POLICY "own video_messages" ON public.video_messages FOR ALL USING ((select auth.uid()) = user_id);

CREATE TABLE IF NOT EXISTS public.call_sessions (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id bigint REFERENCES public.clients(id) ON DELETE CASCADE,
  room_token text UNIQUE NOT NULL, status text DEFAULT 'pending', started_at timestamptz, ended_at timestamptz, created_at timestamptz DEFAULT now()
);
ALTER TABLE public.call_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own call_sessions" ON public.call_sessions;
CREATE POLICY "own call_sessions" ON public.call_sessions FOR ALL USING ((select auth.uid()) = user_id);

CREATE TABLE IF NOT EXISTS public.call_recordings (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  call_session_id bigint REFERENCES public.call_sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id bigint REFERENCES public.clients(id) ON DELETE CASCADE,
  storage_path text, duration_seconds int, created_at timestamptz DEFAULT now()
);
ALTER TABLE public.call_recordings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own call_recordings" ON public.call_recordings;
CREATE POLICY "own call_recordings" ON public.call_recordings FOR ALL USING ((select auth.uid()) = user_id);

CREATE TABLE IF NOT EXISTS public.call_note_timestamps (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  recording_id bigint NOT NULL REFERENCES public.call_recordings(id) ON DELETE CASCADE,
  offset_seconds int NOT NULL, note text NOT NULL
);
ALTER TABLE public.call_note_timestamps ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own call_note_timestamps" ON public.call_note_timestamps;
CREATE POLICY "own call_note_timestamps" ON public.call_note_timestamps FOR ALL USING (recording_id IN (SELECT id FROM public.call_recordings WHERE user_id = (select auth.uid())));

CREATE TABLE IF NOT EXISTS public.voice_memos (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id bigint REFERENCES public.clients(id) ON DELETE CASCADE,
  deal_id uuid REFERENCES public.deals(id) ON DELETE CASCADE,
  storage_path text NOT NULL, duration_seconds int, created_at timestamptz DEFAULT now()
);
ALTER TABLE public.voice_memos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own voice_memos" ON public.voice_memos;
CREATE POLICY "own voice_memos" ON public.voice_memos FOR ALL USING ((select auth.uid()) = user_id);

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS working_hours jsonb DEFAULT '{"start":9,"end":17,"days":[1,2,3,4,5]}';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS timezone_offset int DEFAULT 0;

-- ===== CLUSTER E — CAPTURE & DATA ENTRY =====
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS captured_via text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS company_logo_url text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS company_industry text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS company_size text;

CREATE TABLE IF NOT EXISTS public.capture_extension_tokens (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token text UNIQUE NOT NULL, created_at timestamptz DEFAULT now(), last_used_at timestamptz
);
ALTER TABLE public.capture_extension_tokens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own capture_extension_tokens" ON public.capture_extension_tokens;
CREATE POLICY "own capture_extension_tokens" ON public.capture_extension_tokens FOR ALL USING ((select auth.uid()) = user_id);

CREATE TABLE IF NOT EXISTS public.card_scans (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  raw_ocr_text text, parsed_name text, parsed_email text, parsed_phone text, parsed_company text, parsed_title text,
  client_id bigint REFERENCES public.clients(id) ON DELETE SET NULL, created_at timestamptz DEFAULT now()
);
ALTER TABLE public.card_scans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own card_scans" ON public.card_scans;
CREATE POLICY "own card_scans" ON public.card_scans FOR ALL USING ((select auth.uid()) = user_id);

CREATE TABLE IF NOT EXISTS public.card_visitor_log (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  profile_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_guess text, referrer text, visited_at timestamptz DEFAULT now()
);
ALTER TABLE public.card_visitor_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own card_visitor_log" ON public.card_visitor_log;
CREATE POLICY "own card_visitor_log" ON public.card_visitor_log FOR SELECT USING ((select auth.uid()) = profile_user_id);
DROP POLICY IF EXISTS "anyone logs a visit" ON public.card_visitor_log;
CREATE POLICY "anyone logs a visit" ON public.card_visitor_log FOR INSERT WITH CHECK (true);

-- ===== CLUSTER F — TEAM, TERRITORY & OPERATIONS =====
CREATE TABLE IF NOT EXISTS public.territories (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL, kind text DEFAULT 'geographic', match_field text NOT NULL, match_values text[] NOT NULL,
  assigned_to_user_id uuid REFERENCES auth.users(id), created_at timestamptz DEFAULT now()
);
ALTER TABLE public.territories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "workspace territories" ON public.territories;
CREATE POLICY "workspace territories" ON public.territories FOR ALL USING (
  workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = (select auth.uid())) OR (select auth.uid()) = user_id);

ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS assigned_to_user_id uuid REFERENCES auth.users(id);

CREATE TABLE IF NOT EXISTS public.deal_rooms (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  shared_token text UNIQUE NOT NULL, welcome_message text, brand_color text DEFAULT '#111827', created_at timestamptz DEFAULT now()
);
ALTER TABLE public.deal_rooms ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own deal_rooms" ON public.deal_rooms;
CREATE POLICY "own deal_rooms" ON public.deal_rooms FOR ALL USING ((select auth.uid()) = user_id);

CREATE TABLE IF NOT EXISTS public.deal_room_messages (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  deal_room_id bigint NOT NULL REFERENCES public.deal_rooms(id) ON DELETE CASCADE,
  sender text NOT NULL, body text NOT NULL, created_at timestamptz DEFAULT now()
);
ALTER TABLE public.deal_room_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read via deal room ownership" ON public.deal_room_messages;
CREATE POLICY "read via deal room ownership" ON public.deal_room_messages FOR SELECT USING (deal_room_id IN (SELECT id FROM public.deal_rooms WHERE user_id = (select auth.uid())));
DROP POLICY IF EXISTS "owner inserts" ON public.deal_room_messages;
CREATE POLICY "owner inserts" ON public.deal_room_messages FOR INSERT WITH CHECK (deal_room_id IN (SELECT id FROM public.deal_rooms WHERE user_id = (select auth.uid())));

CREATE TABLE IF NOT EXISTS public.consent_records (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id bigint REFERENCES public.clients(id) ON DELETE CASCADE,
  cold_contact_id bigint REFERENCES public.cold_contacts(id) ON DELETE CASCADE,
  consent_status text DEFAULT 'unknown', consent_source text, recorded_at timestamptz DEFAULT now()
);
ALTER TABLE public.consent_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own consent_records" ON public.consent_records;
CREATE POLICY "own consent_records" ON public.consent_records FOR ALL USING ((select auth.uid()) = user_id);

ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS currency text DEFAULT 'USD';
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS fx_rate_to_usd numeric DEFAULT 1;

CREATE TABLE IF NOT EXISTS public.fx_rates (currency text PRIMARY KEY, rate_to_usd numeric NOT NULL, updated_at timestamptz DEFAULT now());
ALTER TABLE public.fx_rates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anyone reads fx_rates" ON public.fx_rates;
CREATE POLICY "anyone reads fx_rates" ON public.fx_rates FOR SELECT USING (true);

-- ===== CLUSTER G — FOCUS, HABITS & WELLBEING =====
CREATE TABLE IF NOT EXISTS public.outreach_sessions (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  started_at timestamptz DEFAULT now(), ended_at timestamptz, touches_count int DEFAULT 0, target_minutes int DEFAULT 25
);
ALTER TABLE public.outreach_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own outreach_sessions" ON public.outreach_sessions;
CREATE POLICY "own outreach_sessions" ON public.outreach_sessions FOR ALL USING ((select auth.uid()) = user_id);

CREATE TABLE IF NOT EXISTS public.wrapped_snapshots (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  period text NOT NULL, stats jsonb NOT NULL, generated_at timestamptz DEFAULT now()
);
ALTER TABLE public.wrapped_snapshots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own wrapped_snapshots" ON public.wrapped_snapshots;
CREATE POLICY "own wrapped_snapshots" ON public.wrapped_snapshots FOR ALL USING ((select auth.uid()) = user_id);

ALTER TABLE public.email_settings ADD COLUMN IF NOT EXISTS daily_digest_enabled boolean DEFAULT false;
ALTER TABLE public.email_settings ADD COLUMN IF NOT EXISTS daily_digest_hour int DEFAULT 7;

-- ===== CLUSTER H — DEEPER AUTOMATION =====
CREATE TABLE IF NOT EXISTS public.sequence_ab_tests (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sequence_a_id bigint NOT NULL REFERENCES public.email_sequences(id) ON DELETE CASCADE,
  sequence_b_id bigint NOT NULL REFERENCES public.email_sequences(id) ON DELETE CASCADE,
  split_ratio numeric DEFAULT 0.5, status text DEFAULT 'running', winner text, created_at timestamptz DEFAULT now(), concluded_at timestamptz
);
ALTER TABLE public.sequence_ab_tests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own sequence_ab_tests" ON public.sequence_ab_tests;
CREATE POLICY "own sequence_ab_tests" ON public.sequence_ab_tests FOR ALL USING ((select auth.uid()) = user_id);

ALTER TABLE public.sequence_edges ADD COLUMN IF NOT EXISTS branch_condition text DEFAULT 'default';
ALTER TABLE public.sequence_sends ADD COLUMN IF NOT EXISTS clicked_link_id text;

CREATE TABLE IF NOT EXISTS public.automation_recipes (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_rule_id uuid REFERENCES public.automation_rules(id) ON DELETE SET NULL,
  name text NOT NULL, description text, rule_snapshot jsonb NOT NULL,
  workspace_id uuid REFERENCES public.workspaces(id), created_at timestamptz DEFAULT now()
);
ALTER TABLE public.automation_recipes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "workspace recipes" ON public.automation_recipes;
CREATE POLICY "workspace recipes" ON public.automation_recipes FOR SELECT USING (
  workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = (select auth.uid())) OR (select auth.uid()) = user_id);
DROP POLICY IF EXISTS "own recipes write" ON public.automation_recipes;
CREATE POLICY "own recipes write" ON public.automation_recipes FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

ALTER TABLE public.sequence_sends ADD COLUMN IF NOT EXISTS retry_count int DEFAULT 0;
ALTER TABLE public.sequence_sends ADD COLUMN IF NOT EXISTS last_retry_at timestamptz;

-- ===== CLUSTER I — WHITE-LABEL & MONETIZATION =====
CREATE TABLE IF NOT EXISTS public.workspace_branding (
  workspace_id uuid PRIMARY KEY REFERENCES public.workspaces(id) ON DELETE CASCADE,
  logo_url text, accent_color text DEFAULT '#6366F1', product_name text DEFAULT 'Relationship CRM', updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.workspace_branding ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "workspace branding read" ON public.workspace_branding;
CREATE POLICY "workspace branding read" ON public.workspace_branding FOR SELECT USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = (select auth.uid())));
DROP POLICY IF EXISTS "owner branding write" ON public.workspace_branding;
CREATE POLICY "owner branding write" ON public.workspace_branding FOR ALL USING (workspace_id IN (SELECT id FROM public.workspaces WHERE owner_id = (select auth.uid())));

CREATE TABLE IF NOT EXISTS public.usage_meters (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  plan text DEFAULT 'free', emails_sent_this_period int DEFAULT 0, relationships_count int DEFAULT 0,
  api_calls_this_period int DEFAULT 0, period_start date DEFAULT CURRENT_DATE
);
ALTER TABLE public.usage_meters ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own usage_meters" ON public.usage_meters;
CREATE POLICY "own usage_meters" ON public.usage_meters FOR ALL USING ((select auth.uid()) = user_id);

CREATE OR REPLACE FUNCTION public.increment_usage_meter(p_user_id uuid, p_field text, p_amount int)
RETURNS void SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.usage_meters (user_id) VALUES (p_user_id) ON CONFLICT (user_id) DO NOTHING;
  IF p_field = 'emails_sent_this_period' THEN
    UPDATE public.usage_meters SET emails_sent_this_period = emails_sent_this_period + p_amount WHERE user_id = p_user_id;
  ELSIF p_field = 'api_calls_this_period' THEN
    UPDATE public.usage_meters SET api_calls_this_period = api_calls_this_period + p_amount WHERE user_id = p_user_id;
  END IF;
END; $$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS public.referral_codes (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  code text UNIQUE NOT NULL, signups int DEFAULT 0, rewards_earned int DEFAULT 0
);
ALTER TABLE public.referral_codes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own referral_codes" ON public.referral_codes;
CREATE POLICY "own referral_codes" ON public.referral_codes FOR ALL USING ((select auth.uid()) = user_id);

CREATE TABLE IF NOT EXISTS public.referral_signups (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  referrer_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referred_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL, referred_email text, created_at timestamptz DEFAULT now()
);
ALTER TABLE public.referral_signups ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own referral_signups" ON public.referral_signups;
CREATE POLICY "own referral_signups" ON public.referral_signups FOR SELECT USING ((select auth.uid()) = referrer_user_id);

-- ===== CLUSTER J — POLISH =====
CREATE TABLE IF NOT EXISTS public.saved_query_filters (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label text NOT NULL, query_string text NOT NULL, pinned boolean DEFAULT true, created_at timestamptz DEFAULT now()
);
ALTER TABLE public.saved_query_filters ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own saved_query_filters" ON public.saved_query_filters;
CREATE POLICY "own saved_query_filters" ON public.saved_query_filters FOR ALL USING ((select auth.uid()) = user_id);

CREATE TABLE IF NOT EXISTS public.presence_cursors (
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  viewing_entity_type text, viewing_entity_id text, cursor_x numeric, cursor_y numeric, updated_at timestamptz DEFAULT now(),
  PRIMARY KEY (workspace_id, user_id)
);
ALTER TABLE public.presence_cursors ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "workspace presence" ON public.presence_cursors;
CREATE POLICY "workspace presence" ON public.presence_cursors FOR ALL USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = (select auth.uid())));

CREATE TABLE IF NOT EXISTS public.offline_write_queue (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  operation jsonb NOT NULL, status text DEFAULT 'pending', created_at timestamptz DEFAULT now(), synced_at timestamptz
);
ALTER TABLE public.offline_write_queue ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own offline_write_queue" ON public.offline_write_queue;
CREATE POLICY "own offline_write_queue" ON public.offline_write_queue FOR ALL USING ((select auth.uid()) = user_id);

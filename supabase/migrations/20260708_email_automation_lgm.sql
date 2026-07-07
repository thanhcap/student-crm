-- LGM email automation (APPLIED LIVE 2026-07-08 via MCP: email_automation_lgm).
-- Verified post-apply via information_schema: email_settings (9 cols),
-- sequence_sends (14 cols), sequence_steps +channel/condition/subject_b/task_note,
-- sequence_enrollments +stopped_reason/last_channel_sent. Idempotent.

CREATE TABLE IF NOT EXISTS public.email_settings (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  resend_from_email text, auto_send_enabled boolean DEFAULT false,
  daily_send_cap int DEFAULT 50, send_days int[] DEFAULT '{1,2,3,4,5}',
  send_window_start int DEFAULT 9, send_window_end int DEFAULT 17,
  send_tz_offset int DEFAULT 0, created_at timestamptz DEFAULT now()
);
ALTER TABLE public.email_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own email_settings" ON public.email_settings;
CREATE POLICY "own email_settings" ON public.email_settings
  FOR ALL USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);

CREATE TABLE IF NOT EXISTS public.sequence_sends (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  enrollment_id bigint NOT NULL REFERENCES public.sequence_enrollments(id) ON DELETE CASCADE,
  sequence_id bigint NOT NULL REFERENCES public.email_sequences(id) ON DELETE CASCADE,
  step_id bigint REFERENCES public.sequence_steps(id) ON DELETE SET NULL,
  client_id bigint NOT NULL, track_token text UNIQUE NOT NULL,
  channel text NOT NULL DEFAULT 'email', subject_variant text,
  sent_at timestamptz DEFAULT now(), opened_at timestamptz, clicked_at timestamptz,
  replied_at timestamptz, provider_msg_id text
);
ALTER TABLE public.sequence_sends ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own sequence_sends" ON public.sequence_sends;
CREATE POLICY "own sequence_sends" ON public.sequence_sends
  FOR ALL USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);
CREATE INDEX IF NOT EXISTS sequence_sends_enrollment_idx ON public.sequence_sends(enrollment_id);
CREATE INDEX IF NOT EXISTS sequence_sends_sequence_idx ON public.sequence_sends(sequence_id);
CREATE INDEX IF NOT EXISTS sequence_sends_token_idx ON public.sequence_sends(track_token);

ALTER TABLE public.sequence_steps ADD COLUMN IF NOT EXISTS channel text NOT NULL DEFAULT 'email';
ALTER TABLE public.sequence_steps ADD COLUMN IF NOT EXISTS condition text NOT NULL DEFAULT 'always';
ALTER TABLE public.sequence_steps ADD COLUMN IF NOT EXISTS subject_b text;
ALTER TABLE public.sequence_steps ADD COLUMN IF NOT EXISTS task_note text;
ALTER TABLE public.sequence_enrollments ADD COLUMN IF NOT EXISTS stopped_reason text;
ALTER TABLE public.sequence_enrollments ADD COLUMN IF NOT EXISTS last_channel_sent text;

-- pg_cron (EXECUTED LIVE — extensions confirmed, job 'sequence-runner' active */15):
-- CREATE EXTENSION IF NOT EXISTS pg_cron; CREATE EXTENSION IF NOT EXISTS pg_net;
-- select cron.schedule('sequence-runner', '*/15 * * * *',
--   $$ select net.http_post(
--        url := 'https://wuralwhctnbtkirofuph.supabase.co/functions/v1/sequence-runner',
--        headers := jsonb_build_object('Authorization','Bearer <CRON_TOKEN embedded in function source>')
--      ); $$);

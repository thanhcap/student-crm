-- PART C4 — saved custom reports (+ C5 send_frequency flag)
-- ALREADY APPLIED to project wuralwhctnbtkirofuph on 2026-07-07 via MCP (migration: custom_reports).
-- NOTE: the spec asks for one consolidated migration covering C4 + Part F + Part G;
-- that file will be produced when Parts F/G are built. This is the C4 slice.

CREATE TABLE IF NOT EXISTS public.custom_reports (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  config jsonb NOT NULL,  -- { dimension, metric, dateGrouping, range }
  send_frequency text CHECK (send_frequency IN ('weekly','monthly')),
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.custom_reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users own custom_reports" ON public.custom_reports;
CREATE POLICY "Users own custom_reports" ON public.custom_reports
  FOR ALL USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id);

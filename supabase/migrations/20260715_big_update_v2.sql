-- ============================================================
-- BIG UPDATE V2 — consolidated migration (idempotent)
-- Verified against live schema 2026-07-15:
--   clients.id bigint · deals.id uuid · tasks.id uuid · tags.id uuid
--   email_templates.id uuid · workspaces.id uuid
-- ============================================================

-- F12 — Birthday reminders
ALTER TABLE public.email_settings ADD COLUMN IF NOT EXISTS birthday_reminder_days int DEFAULT 3;
ALTER TABLE public.email_settings ADD COLUMN IF NOT EXISTS birthday_template_id uuid REFERENCES public.email_templates(id);

-- F13 — Relationship notes (pinnable, separate from activities/quick_note)
CREATE TABLE IF NOT EXISTS public.relationship_notes (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  client_id bigint NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL,
  pinned boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.relationship_notes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own notes" ON public.relationship_notes;
CREATE POLICY "own notes" ON public.relationship_notes
  FOR ALL USING ((select auth.uid()) = user_id);

-- F14 — Relationship lists (curated collections, many-to-many)
CREATE TABLE IF NOT EXISTS public.relationship_lists (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  color text DEFAULT '#6366F1',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.relationship_lists ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own lists" ON public.relationship_lists;
CREATE POLICY "own lists" ON public.relationship_lists
  FOR ALL USING ((select auth.uid()) = user_id);

CREATE TABLE IF NOT EXISTS public.relationship_list_members (
  list_id bigint NOT NULL REFERENCES public.relationship_lists(id) ON DELETE CASCADE,
  client_id bigint NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  added_at timestamptz DEFAULT now(),
  PRIMARY KEY (list_id, client_id)
);
ALTER TABLE public.relationship_list_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own list members" ON public.relationship_list_members;
CREATE POLICY "own list members" ON public.relationship_list_members
  FOR ALL USING (list_id IN (SELECT id FROM public.relationship_lists WHERE user_id = (select auth.uid())));

-- F16 — Deal events (auto-logged deal history)
CREATE TABLE IF NOT EXISTS public.deal_events (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  old_value text,
  new_value text,
  note text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.deal_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own deal_events" ON public.deal_events;
CREATE POLICY "own deal_events" ON public.deal_events
  FOR ALL USING ((select auth.uid()) = user_id);
CREATE INDEX IF NOT EXISTS deal_events_deal_idx ON public.deal_events (deal_id, created_at DESC);

-- F19 — Win/loss reasons
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS close_reason text;
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS competitor text;

-- F29 — Task priorities
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS priority text DEFAULT 'medium';
DO $$ BEGIN
  ALTER TABLE public.tasks ADD CONSTRAINT tasks_priority_check CHECK (priority IN ('urgent','high','medium','low'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- F33 — Task board status (kept separate from the existing pending/done `status`)
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS task_status text DEFAULT 'todo';
DO $$ BEGIN
  ALTER TABLE public.tasks ADD CONSTRAINT tasks_task_status_check CHECK (task_status IN ('todo','in_progress','done'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
UPDATE public.tasks SET task_status = CASE WHEN status = 'done' THEN 'done' ELSE 'todo' END WHERE task_status = 'todo';

-- F31 — Subtasks
CREATE TABLE IF NOT EXISTS public.subtasks (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  title text NOT NULL,
  done boolean DEFAULT false,
  display_order int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.subtasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own subtasks" ON public.subtasks;
CREATE POLICY "own subtasks" ON public.subtasks
  FOR ALL USING (task_id IN (SELECT id FROM public.tasks WHERE user_id = (select auth.uid())));

-- F32 — Task templates
CREATE TABLE IF NOT EXISTS public.task_templates (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  tasks jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.task_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own task_templates" ON public.task_templates;
CREATE POLICY "own task_templates" ON public.task_templates
  FOR ALL USING ((select auth.uid()) = user_id);

-- F41 — Team activity feed
CREATE TABLE IF NOT EXISTS public.activity_feed (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  entity_name text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.activity_feed ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "workspace_feed" ON public.activity_feed;
CREATE POLICY "workspace_feed" ON public.activity_feed
  FOR SELECT USING (
    workspace_id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = (select auth.uid()))
    OR (workspace_id IS NULL AND user_id = (select auth.uid()))
  );
DROP POLICY IF EXISTS "own_feed_insert" ON public.activity_feed;
CREATE POLICY "own_feed_insert" ON public.activity_feed
  FOR INSERT WITH CHECK ((select auth.uid()) = user_id);
CREATE INDEX IF NOT EXISTS activity_feed_ws_idx ON public.activity_feed (workspace_id, created_at DESC);

-- F43 — Shared tags
ALTER TABLE public.tags ADD COLUMN IF NOT EXISTS is_shared boolean DEFAULT false;

-- F46 — Import history
CREATE TABLE IF NOT EXISTS public.import_history (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL,
  filename text,
  row_count int,
  imported_ids bigint[],
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.import_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own imports" ON public.import_history;
CREATE POLICY "own imports" ON public.import_history
  FOR ALL USING ((select auth.uid()) = user_id);

-- v3 fixes — applied to project wuralwhctnbtkirofuph via Supabase MCP on 2026-07-10.

-- Part 3: the trigger_type check only allowed manual/new_relationship/tag_applied,
-- so deal-based triggers were impossible to store. Expand it to the full event set.
ALTER TABLE public.email_sequences DROP CONSTRAINT IF EXISTS email_sequences_trigger_type_check;
ALTER TABLE public.email_sequences ADD CONSTRAINT email_sequences_trigger_type_check
  CHECK (trigger_type = ANY (ARRAY[
    'manual','new_relationship','relationship_created','relationship_stage_changed',
    'tag_applied','deal_won','deal_lost','deal_stage_changed','task_completed'
  ]));

-- One-time data fix: normalize the "Auto email" sequence (trigger_value='Won' meant deal-won).
UPDATE public.email_sequences
SET trigger_type = 'deal_won', trigger_value = NULL
WHERE trigger_type = 'manual' AND trigger_value = 'Won';

-- Part 7: daily LinkedIn action cap (parallels email_settings.daily_send_cap).
ALTER TABLE public.email_settings
  ADD COLUMN IF NOT EXISTS linkedin_daily_cap integer DEFAULT 20;

-- Part 7: A/B connection-note acceptance tracking on the generated task's send row.
ALTER TABLE public.sequence_sends ADD COLUMN IF NOT EXISTS accepted boolean;
ALTER TABLE public.sequence_sends ADD COLUMN IF NOT EXISTS accepted_at timestamptz;

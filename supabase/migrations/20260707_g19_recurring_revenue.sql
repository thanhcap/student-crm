-- G19 (APPLIED LIVE 2026-07-07)
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS is_recurring boolean DEFAULT false;
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS billing_cycle text CHECK (billing_cycle IN ('monthly','quarterly','annual'));
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS renewal_date date;

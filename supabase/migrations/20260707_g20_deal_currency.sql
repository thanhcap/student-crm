-- G20: deal currency (APPLIED LIVE 2026-07-07)
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS currency text DEFAULT 'USD';

-- G18 (APPLIED LIVE 2026-07-07)
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS referred_by_client_id bigint REFERENCES public.clients(id) ON DELETE SET NULL;

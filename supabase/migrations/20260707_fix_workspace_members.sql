-- Workspace fix (APPLIED LIVE 2026-07-07): code writes/reads these columns
ALTER TABLE public.workspace_members ADD COLUMN IF NOT EXISTS invited_email text;
ALTER TABLE public.workspace_members ADD COLUMN IF NOT EXISTS accepted boolean DEFAULT false;

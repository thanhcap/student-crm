-- IMAP app-password crypto RPCs (applied to wuralwhctnbtkirofuph via MCP).
-- The encrypted bytea never leaves Postgres: store encrypts+writes,
-- get reads+decrypts and returns only the plaintext. Both SECURITY DEFINER,
-- callable only by the service role. pgcrypto lives in the `extensions` schema.

CREATE OR REPLACE FUNCTION public.store_imap_password(p_user_id uuid, p_password text, p_key text)
RETURNS boolean
SECURITY DEFINER SET search_path = public, extensions
LANGUAGE sql AS $$
  UPDATE public.gmail_connections
     SET imap_app_password_encrypted = extensions.pgp_sym_encrypt(p_password, p_key),
         imap_enabled = true, imap_connect_error = null, imap_last_synced_at = now()
   WHERE user_id = p_user_id AND revoked_at IS NULL;
  SELECT true;
$$;

CREATE OR REPLACE FUNCTION public.get_imap_password(p_user_id uuid, p_key text)
RETURNS text
SECURITY DEFINER SET search_path = public, extensions
LANGUAGE sql AS $$
  SELECT extensions.pgp_sym_decrypt(imap_app_password_encrypted, p_key)
    FROM public.gmail_connections
   WHERE user_id = p_user_id AND revoked_at IS NULL
     AND imap_app_password_encrypted IS NOT NULL
   LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.store_imap_password(uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_imap_password(uuid, text) FROM PUBLIC, anon, authenticated;

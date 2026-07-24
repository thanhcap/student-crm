import { createClient } from '@supabase/supabase-js';

// SERVICE-ROLE CLIENT — server-side only.
//
// This client bypasses RLS entirely. It must never be imported into a
// component that ships to the browser; the only legitimate callers are route
// handlers under src/app/api/. The key is read from a non-NEXT_PUBLIC_ env var
// specifically so that Next.js refuses to inline it into a client bundle.
//
// Every payment table (`subscriptions`, `payment_transactions`) is
// SELECT-only for regular users, so this client is the ONLY thing that can
// grant a plan — and it is only ever reached from a handler that has already
// verified a payment provider's signature.

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Fail loudly at call time rather than silently writing nothing: a missing
// service key in production would otherwise look like "payments succeed but
// nobody gets upgraded".
export function assertAdminConfigured() {
  if (!url || !serviceKey) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY (and NEXT_PUBLIC_SUPABASE_URL) must be set for server-side payment handling.',
    );
  }
}

export const supabaseAdmin = createClient(
  url || 'https://placeholder-url.supabase.co',
  serviceKey || 'placeholder-key',
  { auth: { persistSession: false, autoRefreshToken: false } },
);

// Resolves the caller's user from a `Authorization: Bearer <access_token>`
// header. Returns null rather than throwing so handlers can answer 401 cleanly.
export async function getUserFromRequest(req) {
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user;
}

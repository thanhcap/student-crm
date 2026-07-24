// capture-extension — A-5's endpoint for the Chrome extension.
//
// The extension has no Supabase session; it authenticates with a long-lived
// opaque token the user generated in Settings. That token is looked up with
// the service role and maps to exactly one user_id — the request body never
// says whose CRM to write to, so a stolen token can only ever pollute its own
// owner's data, and a forged body cannot target somebody else.
//
// verify_jwt is disabled for this function because the caller presents an
// extension token, not a Supabase JWT. Auth is enforced below, explicitly.
import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const json = (b: unknown, s = 200) =>
    new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } });

  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const auth = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!auth) return json({ error: 'missing_token' }, 401);

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { data: tokenRow } = await admin.from('capture_extension_tokens')
    .select('user_id, token').eq('token', auth).maybeSingle();
  if (!tokenRow) return json({ error: 'invalid_token' }, 401);

  let body: { name?: string; title?: string; company?: string; linkedin_url?: string };
  try { body = await req.json(); } catch { return json({ error: 'bad_json' }, 400); }
  const name = String(body.name || '').trim();
  if (!name) return json({ error: 'missing_name' }, 400);

  const linkedinUrl = body.linkedin_url ? String(body.linkedin_url).split('?')[0] : null;

  // Capturing the same profile twice should update it, not create a duplicate.
  if (linkedinUrl) {
    const { data: dupe } = await admin.from('clients').select('id, name')
      .eq('user_id', tokenRow.user_id).eq('linkedin_url', linkedinUrl).maybeSingle();
    if (dupe) {
      await admin.from('capture_extension_tokens')
        .update({ last_used_at: new Date().toISOString() }).eq('token', auth);
      return json({ ok: true, duplicate: true, client: dupe });
    }
  }

  const { data: client, error } = await admin.from('clients').insert([{
    user_id: tokenRow.user_id,
    name,
    company_name: body.company ? String(body.company).trim() : null,
    linkedin_url: linkedinUrl,
    source: 'Chrome Extension',
    captured_via: 'chrome_extension',
    status: 'Active',
    relationship: 'Medium',
  }]).select().single();
  if (error) return json({ error: error.message }, 500);

  // Ground truth: activity_date (a DATE), description NOT NULL, no outcome column.
  await admin.from('activities').insert([{
    user_id: tokenRow.user_id, client_id: client.id, activity_type: 'Note',
    activity_date: new Date().toISOString().split('T')[0],
    description: `Captured from LinkedIn via the browser extension${body.title ? ` — ${String(body.title).trim()}` : ''}.`,
  }]);

  await admin.from('capture_extension_tokens')
    .update({ last_used_at: new Date().toISOString() }).eq('token', auth);

  return json({ ok: true, client });
});

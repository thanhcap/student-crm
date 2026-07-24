// A-5 — same-origin capture endpoint for the Chrome extension.
//
// Auth is an opaque capture token, not a Supabase session: the extension has
// no session. The token is resolved to a user_id server-side, so the request
// body never names a user — a forged body cannot write into someone else's
// CRM, and a stolen token can only pollute its own owner's data.
//
// A functionally identical Supabase edge function (`capture-extension`) is
// also deployed, for setups where SUPABASE_SERVICE_ROLE_KEY isn't available to
// the Next.js runtime. Settings shows this route as the primary endpoint.
import { supabaseAdmin, assertAdminConfigured } from '../../../../lib/supabaseAdmin';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body, status = 200) =>
  Response.json(body, { status, headers: cors });

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: cors });
}

export async function POST(req) {
  try {
    assertAdminConfigured();
  } catch (err) {
    return json({ error: err.message }, 500);
  }

  const auth = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!auth) return json({ error: 'missing_token' }, 401);

  const { data: tokenRow } = await supabaseAdmin
    .from('capture_extension_tokens').select('user_id').eq('token', auth).maybeSingle();
  if (!tokenRow) return json({ error: 'invalid_token' }, 401);

  let body;
  try { body = await req.json(); } catch { return json({ error: 'bad_json' }, 400); }

  const name = String(body?.name || '').trim();
  if (!name) return json({ error: 'missing_name' }, 400);

  const linkedinUrl = body.linkedin_url ? String(body.linkedin_url).split('?')[0] : null;

  // Capturing the same profile twice returns the existing row rather than
  // creating a duplicate relationship.
  if (linkedinUrl) {
    const { data: dupe } = await supabaseAdmin.from('clients').select('id, name')
      .eq('user_id', tokenRow.user_id).eq('linkedin_url', linkedinUrl).maybeSingle();
    if (dupe) {
      await supabaseAdmin.from('capture_extension_tokens')
        .update({ last_used_at: new Date().toISOString() }).eq('token', auth);
      return json({ ok: true, duplicate: true, client: dupe });
    }
  }

  const { data: client, error } = await supabaseAdmin.from('clients').insert([{
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
  await supabaseAdmin.from('activities').insert([{
    user_id: tokenRow.user_id, client_id: client.id, activity_type: 'Note',
    activity_date: new Date().toISOString().split('T')[0],
    description: `Captured from LinkedIn via the browser extension${body.title ? ` — ${String(body.title).trim()}` : ''}.`,
  }]);

  await supabaseAdmin.from('capture_extension_tokens')
    .update({ last_used_at: new Date().toISOString() }).eq('token', auth);

  return json({ ok: true, client });
}

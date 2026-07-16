// V3 F59/F60 — public proposal access. NO anon RLS on proposals (enumeration
// risk); this function does exact-token lookup with the service key.
// GET  ?token=X            → proposal (title, sections, status, signer info)
// POST { token, signer_name, signature_data } → marks it signed (once)
import { createClient } from 'jsr:@supabase/supabase-js@2';

Deno.serve(async (req: Request) => {
  const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type' };
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } });

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  if (req.method === 'GET') {
    const token = new URL(req.url).searchParams.get('token') || '';
    if (token.length < 16) return json({ error: 'not found' }, 404);
    const { data } = await admin.from('proposals')
      .select('title, sections, status, valid_until, signed_at, signer_name, created_at')
      .eq('shared_token', token).maybeSingle();
    if (!data) return json({ error: 'not found' }, 404);
    if (data.valid_until && data.valid_until < new Date().toISOString().split('T')[0] && !data.signed_at) {
      return json({ ...data, expired: true });
    }
    return json(data);
  }

  if (req.method === 'POST') {
    let body: any;
    try { body = await req.json(); } catch { return json({ error: 'bad body' }, 400); }
    const { token, signer_name, signature_data } = body || {};
    if (!token || token.length < 16 || !signer_name?.trim() || !signature_data?.startsWith('data:image/')) {
      return json({ error: 'token, signer_name and signature required' }, 400);
    }
    if (signature_data.length > 200_000) return json({ error: 'signature too large' }, 400);
    const { data: prop } = await admin.from('proposals').select('id, signed_at, valid_until').eq('shared_token', token).maybeSingle();
    if (!prop) return json({ error: 'not found' }, 404);
    if (prop.signed_at) return json({ error: 'already signed' }, 409);
    if (prop.valid_until && prop.valid_until < new Date().toISOString().split('T')[0]) return json({ error: 'expired' }, 410);
    const { error } = await admin.from('proposals')
      .update({ signed_at: new Date().toISOString(), signer_name: signer_name.trim().slice(0, 120), signature_data, status: 'signed' })
      .eq('id', prop.id);
    if (error) return json({ error: error.message }, 400);
    return json({ ok: true });
  }

  return json({ error: 'method not allowed' }, 405);
});

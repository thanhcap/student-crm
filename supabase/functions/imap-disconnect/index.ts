// imap-disconnect — clears the stored IMAP app password and disables reply
// tracking. Wipes the encrypted credential and resets the UID watermark.
import { createClient } from 'npm:@supabase/supabase-js@2';

Deno.serve(async (req: Request) => {
  const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type' };
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } });

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data: userData } = await admin.auth.getUser(req.headers.get('Authorization')?.replace('Bearer ', '') || '');
  if (!userData?.user) return json({ error: 'unauthorized' }, 401);

  await admin.from('gmail_connections').update({
    imap_app_password_encrypted: null,
    imap_enabled: false,
    imap_last_uid: 0,
    imap_connect_error: null,
  }).eq('user_id', userData.user.id);

  return json({ ok: true });
});

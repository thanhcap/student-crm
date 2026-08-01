// imap-connect — validates a Gmail App Password over IMAP and stores it
// encrypted. Security posture:
//   · The app password is only accepted over an authenticated request.
//   · It is validated against Gmail IMAP BEFORE anything is stored — an
//     unverified credential is never saved and never reported as success.
//   · It is encrypted with pgcrypto via store_imap_password() — the plaintext
//     never touches a column and the encrypted bytea never leaves Postgres.
//   · It is never logged and never echoed back in any response.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { ImapFlow } from 'npm:imapflow@1';

Deno.serve(async (req: Request) => {
  const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type' };
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } });

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const auth = req.headers.get('Authorization') || '';
  const { data: userData, error: uerr } = await admin.auth.getUser(auth.replace('Bearer ', ''));
  if (uerr || !userData?.user) return json({ error: 'unauthorized' }, 401);
  const userId = userData.user.id;

  let body: { appPassword?: string };
  try { body = await req.json(); } catch { return json({ error: 'bad_json' }, 400); }
  const appPassword = (body.appPassword || '').replace(/\s/g, '');
  if (!appPassword || appPassword.length !== 16) return json({ error: 'invalid_app_password_format' }, 400);

  const { data: conn } = await admin.from('gmail_connections')
    .select('email_address').eq('user_id', userId).is('revoked_at', null).maybeSingle();
  if (!conn?.email_address) return json({ error: 'connect_gmail_first' }, 400);

  const encryptionKey = Deno.env.get('IMAP_ENCRYPTION_KEY');
  if (!encryptionKey) return json({ error: 'server_misconfigured' }, 500);

  // Validate the app password actually works BEFORE storing it.
  const client = new ImapFlow({
    host: 'imap.gmail.com', port: 993, secure: true,
    auth: { user: conn.email_address, pass: appPassword },
    logger: false,
  });
  try {
    await client.connect();
    await client.logout();
  } catch (err) {
    // Do NOT leak the credential; give a generic, actionable message.
    return json({ error: 'Could not connect — check your app password (and that 2-Step Verification is on) and try again.' }, 400);
  }

  // Encrypt + store entirely server-side (bytea never crosses the wire).
  const { error: storeErr } = await admin.rpc('store_imap_password', {
    p_user_id: userId, p_password: appPassword, p_key: encryptionKey,
  });
  if (storeErr) return json({ error: 'storage_failed' }, 500);

  return json({ ok: true });
});

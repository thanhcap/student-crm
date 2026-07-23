// gmail-send-reply — inbox-fixes-leadgen Part 3.1.
// Sends a reply to an email_inbox message DIRECTLY through the Gmail API using
// the already-granted gmail.send scope, threaded onto the original conversation
// (In-Reply-To / References / threadId) so it lands in the same Gmail thread.
// Campaign sends still use the compose-tab pattern — this is only for replies.
import { createClient } from 'npm:@supabase/supabase-js@2';

// UTF-8 safe base64url (Gmail wants RFC 4648 §5 url-safe, unpadded).
function toBase64Url(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// RFC 2822 headers require the message-id in angle brackets.
function angle(id: string): string {
  const t = (id || '').trim();
  if (!t) return '';
  return t.startsWith('<') ? t : `<${t}>`;
}

function buildMime({ to, from, subject, htmlBody, inReplyTo, references }: {
  to: string; from: string; subject: string; htmlBody: string;
  inReplyTo?: string; references?: string;
}): string {
  const headers = [
    `To: ${to}`,
    `From: ${from}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset="UTF-8"',
  ];
  if (inReplyTo) headers.push(`In-Reply-To: ${inReplyTo}`);
  if (references) headers.push(`References: ${references}`);
  return `${headers.join('\r\n')}\r\n\r\n${htmlBody}`;
}

Deno.serve(async (req: Request) => {
  const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type' };
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } });

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const auth = req.headers.get('Authorization') || '';
  const { data: userData, error: uerr } = await admin.auth.getUser(auth.replace('Bearer ', ''));
  if (uerr || !userData?.user) return json({ error: 'unauthorized' }, 401);
  const userId = userData.user.id;

  let body: { inboxId?: number; htmlBody?: string; subjectOverride?: string };
  try { body = await req.json(); } catch { return json({ error: 'bad_json' }, 400); }
  const { inboxId, htmlBody, subjectOverride } = body;
  if (!inboxId || !htmlBody || !String(htmlBody).trim()) return json({ error: 'missing_fields' }, 400);

  // Scope the lookup to this user so one user can't reply from another's inbox.
  const { data: msg } = await admin.from('email_inbox').select('*')
    .eq('id', inboxId).eq('user_id', userId).maybeSingle();
  if (!msg) return json({ error: 'message_not_found' }, 404);
  if (!msg.from_email) return json({ error: 'no_recipient' }, 400);

  const { data: conn } = await admin.from('gmail_connections').select('*')
    .eq('user_id', userId).is('revoked_at', null).maybeSingle();
  if (!conn) return json({ error: 'gmail_not_connected' }, 400);

  const tr = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: Deno.env.get('GOOGLE_CLIENT_ID')!, client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET')!,
      refresh_token: conn.refresh_token, grant_type: 'refresh_token',
    }),
  });
  const tok = await tr.json();
  if (!tr.ok) {
    await admin.from('gmail_connections').update({ needs_reauth: true }).eq('id', conn.id);
    return json({ error: 'token_refresh_failed', detail: tok.error, needs_reauth: true }, 400);
  }
  await admin.from('gmail_connections').update({
    access_token: tok.access_token,
    token_expiry: new Date(Date.now() + (tok.expires_in || 3600) * 1000).toISOString(),
    needs_reauth: false,
  }).eq('id', conn.id);

  const subject = subjectOverride
    || (String(msg.subject || '').startsWith('Re:') ? msg.subject : `Re: ${msg.subject || ''}`);
  const ref = angle(msg.gmail_message_id || '');
  const raw = toBase64Url(buildMime({
    to: msg.from_email,
    from: conn.email_address || undefined as unknown as string,
    subject,
    htmlBody: String(htmlBody),
    inReplyTo: ref || undefined,
    references: ref || undefined,
  }));

  const sendRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: { Authorization: `Bearer ${tok.access_token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ raw, threadId: msg.gmail_thread_id || undefined }),
  });
  const sendData = await sendRes.json();
  if (!sendRes.ok) return json({ error: 'send_failed', detail: sendData }, 500);

  // Log the outbound reply as an activity (ground truth: activity_date, non-null
  // description, no outcome column). Only relationships have activities rows.
  if (msg.client_id) {
    const plain = String(htmlBody).replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    await admin.from('activities').insert({
      user_id: userId, client_id: msg.client_id, activity_type: 'Email',
      activity_date: new Date().toISOString().split('T')[0],
      description: `Replied via app — Subject: ${subject}\n\n${plain.slice(0, 1000)}`,
    });
  }
  await admin.from('email_inbox').update({ is_read: true }).eq('id', inboxId);

  return json({ ok: true, messageId: sendData.id, threadId: sendData.threadId });
});

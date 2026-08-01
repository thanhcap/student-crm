// gmail-sync v12 — IMAP transport instead of Gmail API reads.
//
// Why: gmail.readonly is a Google "restricted" scope (paid CASA assessment to
// publish). Reply detection now reads the mailbox over IMAP with a Gmail App
// Password, which is outside OAuth scopes entirely. Everything else — the
// deterministic contact matching (byEmail map + resolveMatch preferring an
// active enrollment, then the most-recent send), the classification, the
// email_inbox upsert, and stamping replied_at for EVERY inbound classification
// — is preserved from v11. Only the fetch transport changed.
//
// The app password is read via get_imap_password() (SECURITY DEFINER, service
// role only); the encrypted bytea never leaves Postgres.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { ImapFlow } from 'npm:imapflow@1';
import { simpleParser } from 'npm:mailparser@3';

function classifyReply(subject: string, body: string): string {
  const t = `${subject || ''} ${body || ''}`.toLowerCase();
  if (/out of office|on leave|annual leave|vacation|away from|auto.?reply|automatic reply/.test(t)) return 'out_of_office';
  if (/unsubscribe|remove me|stop emailing|opt out/.test(t)) return 'not_interested';
  if (/not interested|no thanks|not a fit|not right now|\bpass\b/.test(t)) return 'not_interested';
  if (/introduce you|reach out to|you should talk to|connect you with|forward(ing)? this/.test(t)) return 'referral';
  if (/\byes\b|interested|love to|happy to|sounds good|let'?s (chat|talk|meet)|\bbook\b|calendar|available/.test(t)) return 'interested';
  if (/\?\s*$|how much|what (is|are)|could you|can you|\bwhen\b|\bwhere\b|\bwhy\b|clarify/.test(t)) return 'question';
  return 'unclassified';
}

Deno.serve(async (req: Request) => {
  const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type' };
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } });

  const auth = req.headers.get('Authorization') || '';
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data: userData, error: uerr } = await admin.auth.getUser(auth.replace('Bearer ', ''));
  if (uerr || !userData?.user) return json({ error: 'unauthorized' }, 401);
  const userId = userData.user.id;

  // Explicit columns only — never SELECT the encrypted credential column.
  const { data: conn } = await admin.from('gmail_connections')
    .select('id, email_address, imap_enabled, imap_last_uid')
    .eq('user_id', userId).is('revoked_at', null).maybeSingle();
  if (!conn) return json({ error: 'gmail_not_connected' }, 400);
  if (!conn.imap_enabled) {
    return json({ error: 'imap_not_enabled', message: 'Enable Reply Tracking in Settings to sync replies.' }, 400);
  }

  const encryptionKey = Deno.env.get('IMAP_ENCRYPTION_KEY');
  if (!encryptionKey) return json({ error: 'server_misconfigured' }, 500);
  const { data: appPassword, error: pwErr } = await admin.rpc('get_imap_password', { p_user_id: userId, p_key: encryptionKey });
  if (pwErr || !appPassword) return json({ error: 'imap_not_enabled', message: 'Re-enable Reply Tracking in Settings.' }, 400);

  // === Contact matching pool — UNCHANGED from v11 ===
  const [{ data: clientRows }, { data: coldRows }] = await Promise.all([
    admin.from('clients').select('id, name, email').eq('user_id', userId).not('email', 'is', null).order('id'),
    admin.from('cold_contacts').select('id, first_name, last_name, email').eq('user_id', userId).not('email', 'is', null).order('id'),
  ]);
  type PoolEntry = { kind: 'client' | 'cold'; id: number; email: string; name: string };
  const pool: PoolEntry[] = [
    ...(clientRows || []).filter((c) => c.email).map((c) => ({ kind: 'client' as const, id: c.id, email: String(c.email).toLowerCase(), name: c.name || c.email })),
    ...(coldRows || []).filter((c) => c.email).map((c) => ({ kind: 'cold' as const, id: c.id, email: String(c.email).toLowerCase(), name: `${c.first_name || ''} ${c.last_name || ''}`.trim() || c.email })),
  ];
  if (pool.length === 0) return json({ synced: 0, inboxUpserts: 0, autoStopped: 0, note: 'no contact emails' });

  const byEmail = new Map<string, PoolEntry[]>();
  for (const p of pool) { if (!byEmail.has(p.email)) byEmail.set(p.email, []); byEmail.get(p.email)!.push(p); }

  async function resolveMatch(candidates: PoolEntry[]): Promise<PoolEntry> {
    if (candidates.length === 1) return candidates[0];
    for (const c of candidates) {
      const col = c.kind === 'client' ? 'client_id' : 'cold_contact_id';
      const { data: activeEnr } = await admin.from('sequence_enrollments').select('id').eq('user_id', userId).eq('status', 'active').eq(col, c.id).limit(1);
      if (activeEnr?.length) return c;
    }
    let best: PoolEntry | null = null; let bestTime = 0;
    for (const c of candidates) {
      const col = c.kind === 'client' ? 'client_id' : 'cold_contact_id';
      const { data: send } = await admin.from('sequence_sends').select('sent_at').eq(col, c.id).order('sent_at', { ascending: false }).limit(1);
      const t = send?.[0]?.sent_at ? new Date(send[0].sent_at).getTime() : 0;
      if (t > bestTime) { bestTime = t; best = c; }
    }
    return best ?? candidates[0];
  }

  // === IMAP CONNECTION ===
  const client = new ImapFlow({
    host: 'imap.gmail.com', port: 993, secure: true,
    auth: { user: conn.email_address, pass: appPassword },
    logger: false,
  });

  let inserted = 0, inboxUpserts = 0, paused = 0, stopped = 0;
  const repliedClientIds = new Set<number>();
  const repliedColdIds = new Set<number>();
  let highestUid = conn.imap_last_uid || 0;

  try {
    await client.connect();
    const lock = await client.getMailboxLock('INBOX');
    try {
      // Only fetch messages with UID above the watermark — never re-scan old mail.
      const searchFrom = highestUid > 0 ? `${highestUid + 1}:*` : '1:*';
      for await (const msg of client.fetch(searchFrom, { envelope: true, source: true, uid: true }, { uid: true })) {
        if (highestUid > 0 && msg.uid <= highestUid) continue; // safety net vs inclusive-range quirks
        highestUid = Math.max(highestUid, msg.uid);

        const parsed = await simpleParser(msg.source);
        const fromH = (parsed.from?.text || '').toLowerCase();
        const toH = (parsed.to?.text || '').toLowerCase();

        const emailKey = [...byEmail.keys()].find((email) => fromH.includes(email) || toH.includes(email));
        if (!emailKey) continue;
        const candidates = byEmail.get(emailKey) || [];
        const match = candidates.length > 1 ? await resolveMatch(candidates) : candidates[0];
        if (!match) continue;

        const inbound = fromH.includes(match.email);
        const subject = parsed.subject || '(no subject)';
        const receivedAt = parsed.date || new Date();
        const bodyFull = (parsed.text || parsed.html?.replace(/<[^>]+>/g, ' ') || '').trim();
        const threadRef = parsed.references?.[0] || parsed.messageId || null;
        const msgId = parsed.messageId || String(msg.uid);

        if (match.kind === 'client') {
          const { error } = await admin.from('activities').insert({
            user_id: userId, client_id: match.id, activity_type: 'Email',
            activity_date: receivedAt.toISOString().split('T')[0],
            description: `Gmail — ${inbound ? 'Received' : 'Sent'}: ${subject}\n\n${bodyFull.slice(0, 300)}`,
            gmail_message_id: msgId,
          });
          if (!error) inserted++;
        }

        if (inbound) {
          const classification = classifyReply(subject, bodyFull);
          const fromNameRaw = parsed.from?.value?.[0]?.name || '';

          let sendId: number | null = null, seqId: number | null = null;
          const { data: lastSend } = await admin.from('sequence_sends')
            .select('id, sequence_id').eq(match.kind === 'client' ? 'client_id' : 'cold_contact_id', match.id)
            .order('sent_at', { ascending: false }).limit(1);
          if (lastSend?.[0]) { sendId = lastSend[0].id; seqId = lastSend[0].sequence_id; }

          const { error: upErr } = await admin.from('email_inbox').upsert([{
            user_id: userId,
            client_id: match.kind === 'client' ? match.id : null,
            cold_contact_id: match.kind === 'cold' ? match.id : null,
            sequence_id: seqId, send_id: sendId,
            gmail_message_id: msgId, gmail_thread_id: threadRef,
            from_email: match.email, from_name: fromNameRaw || match.name,
            subject, body_preview: bodyFull.slice(0, 140), body_full: bodyFull.slice(0, 100000),
            classification, is_read: false, received_at: receivedAt.toISOString(),
          }], { onConflict: 'user_id,gmail_message_id', ignoreDuplicates: true });
          if (!upErr) inboxUpserts++;

          const contactCol = match.kind === 'client' ? 'client_id' : 'cold_contact_id';
          // Stamp replied_at for the latest send regardless of classification.
          {
            const { data: latest } = await admin.from('sequence_sends').select('id, replied_at')
              .eq(contactCol, match.id).order('sent_at', { ascending: false }).limit(1);
            if (latest?.[0] && !latest[0].replied_at) {
              await admin.from('sequence_sends').update({ replied_at: receivedAt.toISOString() }).eq('id', latest[0].id);
            }
          }

          if (classification === 'out_of_office') {
            const { data: activeEnrs } = await admin.from('sequence_enrollments').select('id').eq('user_id', userId).eq('status', 'active').eq(contactCol, match.id);
            for (const en of activeEnrs || []) {
              await admin.from('sequence_enrollments').update({ next_send_at: new Date(Date.now() + 7 * 864e5).toISOString() }).eq('id', en.id);
              paused++;
            }
          } else if (classification === 'not_interested') {
            const { data: activeEnrs } = await admin.from('sequence_enrollments').select('id').eq('user_id', userId).eq('status', 'active').eq(contactCol, match.id);
            for (const en of activeEnrs || []) {
              await admin.from('sequence_enrollments').update({ status: 'stopped', stopped_reason: 'not_interested', next_send_at: null }).eq('id', en.id);
              stopped++;
            }
            if (match.kind === 'cold') {
              await admin.from('cold_contacts').update({ status: 'unsubscribed' }).eq('id', match.id);
              await admin.from('unsubscribes').upsert([{ user_id: userId, email: match.email, reason: 'reply' }], { ignoreDuplicates: true });
            }
          } else {
            if (match.kind === 'client') repliedClientIds.add(match.id); else repliedColdIds.add(match.id);
          }
        }
      }
    } finally {
      lock.release();
    }
    await client.logout();
  } catch (err) {
    await admin.from('gmail_connections').update({ imap_connect_error: `Sync failed: ${(err as Error).message}` }).eq('id', conn.id);
    return json({ error: 'imap_sync_failed', detail: (err as Error).message }, 500);
  }

  let autoStopped = 0;
  async function stopReplied(col: 'client_id' | 'cold_contact_id', ids: Set<number>) {
    if (!ids.size) return;
    const { data: enrs } = await admin.from('sequence_enrollments').select('*').eq('user_id', userId).eq('status', 'active').in(col, [...ids]);
    for (const en of enrs || []) {
      await admin.from('sequence_enrollments').update({ status: 'replied', stopped_reason: 'replied', next_send_at: null }).eq('id', en.id);
      const { data: lastSend } = await admin.from('sequence_sends').select('id').eq('enrollment_id', en.id).is('replied_at', null).order('sent_at', { ascending: false }).limit(1);
      if (lastSend?.[0]) await admin.from('sequence_sends').update({ replied_at: new Date().toISOString() }).eq('id', lastSend[0].id);
      autoStopped++;
    }
  }
  await stopReplied('client_id', repliedClientIds);
  await stopReplied('cold_contact_id', repliedColdIds);

  await admin.from('gmail_connections').update({
    imap_last_uid: highestUid, imap_last_synced_at: new Date().toISOString(), imap_connect_error: null,
    last_synced_at: new Date().toISOString(),
  }).eq('id', conn.id);

  return json({ synced: inserted, inboxUpserts, autoStopped, paused, stopped });
});

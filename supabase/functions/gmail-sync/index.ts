// gmail-sync v11 — inbox-fixes-leadgen Part 1: two trust bugs fixed.
//   BUG 1 (wrong-person attribution): matching no longer trusts a bare .find()
//   over an unordered pool. Queries are ordered by id, and when two contacts
//   share an email the winner is whoever has an ACTIVE enrollment (they're the
//   one mid-conversation), else the most-recent send.
//   BUG 2 (reply counted as 0): replied_at is now stamped for EVERY inbound
//   message regardless of classification — a "not interested" / OOO reply is
//   still a reply. Classification only decides the enrollment side-effect.
// Built on v9/v10: activities rows + email_inbox normalization + auto-stop.
import { createClient } from 'npm:@supabase/supabase-js@2';

// Deterministic reply classifier — mirror of the client-side classifyReply in
// src/app/components/EmailCommandCenter.js (keep the two in sync).
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

function decodeB64Url(s: string): string {
  try {
    return new TextDecoder().decode(Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0)));
  } catch {
    return '';
  }
}

// Prefer text/plain; fall back to de-tagged text/html; else empty.
// deno-lint-ignore no-explicit-any
function extractBody(payload: any): string {
  if (!payload) return '';
  if (payload.mimeType === 'text/plain' && payload.body?.data) return decodeB64Url(payload.body.data);
  if (payload.parts) {
    for (const p of payload.parts) {
      if (p.mimeType === 'text/plain' && p.body?.data) return decodeB64Url(p.body.data);
    }
    for (const p of payload.parts) {
      const t = extractBody(p);
      if (t) return t;
    }
  }
  if (payload.mimeType === 'text/html' && payload.body?.data) {
    return decodeB64Url(payload.body.data)
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
  return '';
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

  const { data: conn } = await admin.from('gmail_connections').select('*').eq('user_id', userId).is('revoked_at', null).maybeSingle();
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
  await admin.from('gmail_connections').update({ access_token: tok.access_token, token_expiry: new Date(Date.now() + (tok.expires_in || 3600) * 1000).toISOString(), needs_reauth: false }).eq('id', conn.id);
  const g = (path: string) => fetch(`https://gmail.googleapis.com/gmail/v1/users/me/${path}`, { headers: { Authorization: `Bearer ${tok.access_token}` } });

  // v9 — matching pool = relationships AND cold contacts.
  // BUG 1 FIX: order by id so the pool is deterministic (an unordered result
  // let .find() silently pick whichever duplicate came back first).
  const [{ data: clientRows }, { data: coldRows }] = await Promise.all([
    admin.from('clients').select('id, name, email').eq('user_id', userId).not('email', 'is', null).order('id'),
    admin.from('cold_contacts').select('id, first_name, last_name, email').eq('user_id', userId).not('email', 'is', null).order('id'),
  ]);
  type PoolEntry = { kind: 'client' | 'cold'; id: number; email: string; name: string };
  const pool: PoolEntry[] = [
    ...(clientRows || []).filter(c => c.email).map(c => ({ kind: 'client' as const, id: c.id, email: c.email.toLowerCase(), name: c.name || c.email })),
    ...(coldRows || []).filter(c => c.email).map(c => ({ kind: 'cold' as const, id: c.id, email: c.email.toLowerCase(), name: `${c.first_name || ''} ${c.last_name || ''}`.trim() || c.email })),
  ];
  if (pool.length === 0) return json({ synced: 0, inboxUpserts: 0, autoStopped: 0, note: 'no contact emails' });

  // BUG 1 FIX: group by email so duplicates are visible instead of colliding.
  // When multiple contacts share an email, resolveMatch prefers whoever has an
  // active enrollment (the one actually mid-conversation), then most-recent send.
  const byEmail = new Map<string, PoolEntry[]>();
  for (const p of pool) {
    if (!byEmail.has(p.email)) byEmail.set(p.email, []);
    byEmail.get(p.email)!.push(p);
  }
  async function resolveMatch(candidates: PoolEntry[]): Promise<PoolEntry> {
    if (candidates.length === 1) return candidates[0];
    for (const c of candidates) {
      const col = c.kind === 'client' ? 'client_id' : 'cold_contact_id';
      const { data: activeEnr } = await admin.from('sequence_enrollments')
        .select('id').eq('user_id', userId).eq('status', 'active').eq(col, c.id).limit(1);
      if (activeEnr?.length) return c;
    }
    let best: PoolEntry | null = null;
    let bestTime = 0;
    for (const c of candidates) {
      const col = c.kind === 'client' ? 'client_id' : 'cold_contact_id';
      const { data: send } = await admin.from('sequence_sends')
        .select('sent_at').eq(col, c.id).order('sent_at', { ascending: false }).limit(1);
      const t = send?.[0]?.sent_at ? new Date(send[0].sent_at).getTime() : 0;
      if (t > bestTime) { bestTime = t; best = c; }
    }
    return best ?? candidates[0];
  }

  let inserted = 0;
  let inboxUpserts = 0;
  let paused = 0;
  let stopped = 0;
  const repliedClientIds = new Set<number>();
  const repliedColdIds = new Set<number>();

  for (let i = 0; i < pool.length; i += 15) {
    const chunk = pool.slice(i, i + 15);
    const q = encodeURIComponent(`newer_than:7d {${chunk.map((c) => `from:${c.email} to:${c.email}`).join(' ')}}`);
    const list = await g(`messages?q=${q}&maxResults=25`);
    if (!list.ok) continue;
    const { messages } = await list.json();
    for (const m of messages || []) {
      // format=full so the inbox gets the real body (v8 used metadata only)
      const det = await g(`messages/${m.id}?format=full`);
      if (!det.ok) continue;
      const msg = await det.json();
      const h = (n: string) => msg.payload?.headers?.find((x: { name: string }) => x.name.toLowerCase() === n.toLowerCase())?.value || '';
      const fromH = h('From').toLowerCase(); const toH = h('To').toLowerCase();
      // BUG 1 FIX: find which email this message is about, then resolve to the
      // right contact among any duplicates (active-enrollment/most-recent-send).
      const emailKey = chunk.find((c) => fromH.includes(c.email) || toH.includes(c.email))?.email;
      if (!emailKey) continue;
      const candidates = byEmail.get(emailKey) || [];
      const match = candidates.length > 1 ? await resolveMatch(candidates) : candidates[0];
      if (!match) continue;
      const inbound = fromH.includes(match.email);
      const subject = h('Subject') || '(no subject)';
      const d = new Date(h('Date') || Date.now());
      const receivedAt = isNaN(d.getTime()) ? new Date() : d;

      // v8 behavior kept: relationship traffic (both directions) becomes an activity
      if (match.kind === 'client') {
        const { error } = await admin.from('activities').insert({
          user_id: userId, client_id: match.id, activity_type: 'Email',
          activity_date: receivedAt.toISOString().split('T')[0],
          description: `Gmail — ${inbound ? 'Received' : 'Sent'}: ${subject}\n\n${msg.snippet || ''}`,
          gmail_message_id: m.id,
        });
        if (!error) inserted++;
      }

      // v9 — inbound messages also become normalized email_inbox rows
      if (inbound) {
        const bodyFull = extractBody(msg.payload) || msg.snippet || '';
        const classification = classifyReply(subject, bodyFull);
        const fromNameRaw = h('From').replace(/<[^>]*>/g, '').replace(/"/g, '').trim();

        // link the reply to the latest tracked send for this contact
        let sendId: number | null = null;
        let seqId: number | null = null;
        const { data: lastSend } = await admin.from('sequence_sends')
          .select('id, sequence_id')
          .eq(match.kind === 'client' ? 'client_id' : 'cold_contact_id', match.id)
          .order('sent_at', { ascending: false })
          .limit(1);
        if (lastSend?.[0]) { sendId = lastSend[0].id; seqId = lastSend[0].sequence_id; }

        const { error: upErr } = await admin.from('email_inbox').upsert([{
          user_id: userId,
          client_id: match.kind === 'client' ? match.id : null,
          cold_contact_id: match.kind === 'cold' ? match.id : null,
          sequence_id: seqId, send_id: sendId,
          gmail_message_id: m.id, gmail_thread_id: msg.threadId || null,
          from_email: match.email, from_name: fromNameRaw || match.name,
          subject, body_preview: bodyFull.slice(0, 140), body_full: bodyFull.slice(0, 100000),
          classification, is_read: false,
          received_at: receivedAt.toISOString(),
        }], { onConflict: 'user_id,gmail_message_id', ignoreDuplicates: true });
        if (!upErr) inboxUpserts++;

        const contactCol = match.kind === 'client' ? 'client_id' : 'cold_contact_id';

        // BUG 2 FIX: every inbound message counts as a reply. Stamp replied_at on
        // this contact's most recent send directly — independent of enrollment
        // status — so it still counts after not_interested stops the enrollment or
        // OOO pauses it. (Previously replied_at was only set in the positive-reply
        // branch below, so "not interested"/OOO replies showed as 0 in stats.)
        {
          const { data: latest } = await admin.from('sequence_sends')
            .select('id, replied_at').eq(contactCol, match.id)
            .order('sent_at', { ascending: false }).limit(1);
          if (latest?.[0] && !latest[0].replied_at) {
            await admin.from('sequence_sends').update({ replied_at: receivedAt.toISOString() }).eq('id', latest[0].id);
          }
        }

        // classification side-effects (these no longer gate whether it's a reply)
        if (classification === 'out_of_office') {
          // pause, don't stop — push the next send a week out; keep it active
          const { data: activeEnrs } = await admin.from('sequence_enrollments').select('id')
            .eq('user_id', userId).eq('status', 'active').eq(contactCol, match.id);
          for (const en of activeEnrs || []) {
            await admin.from('sequence_enrollments')
              .update({ next_send_at: new Date(Date.now() + 7 * 864e5).toISOString() })
              .eq('id', en.id);
            paused++;
          }
        } else if (classification === 'not_interested') {
          const { data: activeEnrs } = await admin.from('sequence_enrollments').select('id')
            .eq('user_id', userId).eq('status', 'active').eq(contactCol, match.id);
          for (const en of activeEnrs || []) {
            await admin.from('sequence_enrollments')
              .update({ status: 'stopped', stopped_reason: 'not_interested', next_send_at: null })
              .eq('id', en.id);
            stopped++;
          }
          if (match.kind === 'cold') {
            await admin.from('cold_contacts').update({ status: 'unsubscribed' }).eq('id', match.id);
            await admin.from('unsubscribes').upsert([{ user_id: userId, email: match.email, reason: 'reply' }], { ignoreDuplicates: true });
          }
        } else {
          // interested / referral / question / unclassified: a genuine, non-rejecting
          // reply — stop the sequence (v8/v9 behavior) via the stopReplied pass below.
          if (match.kind === 'client') repliedClientIds.add(match.id);
          else repliedColdIds.add(match.id);
        }
      }
    }
  }

  // v8 auto-stop-on-reply, extended to cold-contact enrollments
  let autoStopped = 0;
  async function stopReplied(col: 'client_id' | 'cold_contact_id', ids: Set<number>) {
    if (!ids.size) return;
    const { data: enrs } = await admin.from('sequence_enrollments').select('*')
      .eq('user_id', userId).eq('status', 'active').in(col, [...ids]);
    for (const en of enrs || []) {
      await admin.from('sequence_enrollments').update({ status: 'replied', stopped_reason: 'replied', next_send_at: null }).eq('id', en.id);
      const { data: lastSend } = await admin.from('sequence_sends').select('id').eq('enrollment_id', en.id)
        .is('replied_at', null).order('sent_at', { ascending: false }).limit(1);
      if (lastSend?.[0]) await admin.from('sequence_sends').update({ replied_at: new Date().toISOString() }).eq('id', lastSend[0].id);
      autoStopped++;
    }
  }
  await stopReplied('client_id', repliedClientIds);
  await stopReplied('cold_contact_id', repliedColdIds);

  await admin.from('gmail_connections').update({ last_synced_at: new Date().toISOString() }).eq('id', conn.id);
  return json({ synced: inserted, inboxUpserts, autoStopped, paused, stopped });
});

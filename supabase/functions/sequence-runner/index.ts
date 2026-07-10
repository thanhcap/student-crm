// Sequence runner v5 — graph-aware (Email Automation canvas) + cold email engine.
// Walks sequence_steps nodes via sequence_edges using the SAME resolveNextNode as the
// client. Sends via each user's OWN Gmail (OAuth) when connected, falling back to
// Resend (RESEND_API_KEY + email_settings.resend_from_email) for cold outreach.
// v5 additions: cold_contacts enrollments, unsubscribe list enforcement, unsubscribe
// footer link, prospect→contacted lifecycle.
// Auth: service-role key, OR a cron token looked up from Supabase Vault at request time
// (name='cron_token' — see `vault.create_secret`). This intentionally avoids both (a)
// hardcoding any literal secret in this committed source file, and (b) requiring a
// `supabase secrets set` step, since the function already has DB access via its own
// service-role client and can dereference Vault directly. Cron: */15.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { resolveNextNode, advanceAfterNode, syntheticChainEdges, pickSubjectVariant, addDaysStr } from './_shared/sequence-logic.ts';

function mergeTags(str: string, c: any) {
  return (str || '')
    .replace(/{{name}}/g, c?.name || '').replace(/{{email}}/g, c?.email || '')
    .replace(/{{first_name}}/g, (c?.name || '').split(' ')[0] || '')
    .replace(/{{phone}}/g, c?.phone_number || '').replace(/{{stage}}/g, c?.status || '')
    .replace(/{{company}}/g, c?.company_name || '')
    .replace(/{{linkedin_url}}/g, c?.linkedin_url || '');
}
function b64url(bytes: Uint8Array) {
  let bin = '';
  bytes.forEach((b) => { bin += String.fromCharCode(b); });
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
// RFC 2822 MIME message, base64url-encoded (Gmail API requirement)
function buildMime(from: string, to: string, subject: string, html: string) {
  const encSubject = `=?UTF-8?B?${btoa(String.fromCharCode(...new TextEncoder().encode(subject)))}?=`;
  const msg = [`From: ${from}`, `To: ${to}`, `Subject: ${encSubject}`, 'MIME-Version: 1.0', 'Content-Type: text/html; charset=UTF-8', '', html].join('\r\n');
  return b64url(new TextEncoder().encode(msg));
}
// 3.4 — silent refresh with needs_reauth marking
async function getAccessToken(admin: any, conn: any): Promise<string | null> {
  if (conn.access_token && conn.token_expiry && new Date(conn.token_expiry).getTime() - Date.now() > 5 * 60 * 1000) {
    return conn.access_token;
  }
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: Deno.env.get('GOOGLE_CLIENT_ID')!, client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET')!,
      refresh_token: conn.refresh_token, grant_type: 'refresh_token',
    }),
  });
  const t = await r.json().catch(() => ({}));
  if (!r.ok) {
    await admin.from('gmail_connections').update({ needs_reauth: true }).eq('id', conn.id);
    return null;
  }
  await admin.from('gmail_connections').update({
    access_token: t.access_token,
    token_expiry: new Date(Date.now() + (t.expires_in || 3600) * 1000).toISOString(),
    needs_reauth: false,
  }).eq('id', conn.id);
  conn.access_token = t.access_token;
  return t.access_token;
}

// v5 — Resend fallback for users without a Gmail connection (cold email engine).
// Gracefully unavailable when RESEND_API_KEY or resend_from_email is missing.
async function sendViaResend(from: string, to: string, subject: string, html: string): Promise<{ ok: boolean; id?: string; status?: number; error?: string }> {
  const key = Deno.env.get('RESEND_API_KEY');
  if (!key) return { ok: false, error: 'no_resend_key' };
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: [to], subject, html }),
  });
  const rj = await r.json().catch(() => ({}));
  if (!r.ok) return { ok: false, status: r.status, error: rj?.message || `resend ${r.status}` };
  return { ok: true, id: rj?.id || null };
}

Deno.serve(async (req: Request) => {
  const svcKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, svcKey);
  const auth = req.headers.get('Authorization') || '';
  let cronOk = false;
  if (auth !== `Bearer ${svcKey}`) {
    // Not the service-role key — check whether it matches the Vault-stored cron token,
    // fetched via a SECURITY DEFINER RPC (public.get_cron_token) restricted to service_role.
    // Looked up fresh on every request; never cached, never logged, never hardcoded.
    const { data: cronToken } = await admin.rpc('get_cron_token');
    cronOk = Boolean(cronToken) && auth === `Bearer ${cronToken}`;
  }
  if (auth !== `Bearer ${svcKey}` && !cronOk) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 });
  }
  const projectUrl = Deno.env.get('SUPABASE_URL')!;
  const today = new Date().toISOString().split('T')[0];
  const out = { sent: 0, tasks: 0, skipped: 0, completed: 0, waited: 0, unsubscribed: 0, quota_deferred: 0, needs_reauth: 0, errors: [] as string[] };

  const { data: due } = await admin.from('sequence_enrollments')
    .select('*').eq('status', 'active').not('next_send_at', 'is', null).lte('next_send_at', today).limit(200);
  if (!due?.length) return new Response(JSON.stringify({ ...out, note: 'nothing due' }), { headers: { 'Content-Type': 'application/json' } });

  const userIds = [...new Set(due.map((d) => d.user_id))];
  const [{ data: settingsRows }, { data: connRows }] = await Promise.all([
    admin.from('email_settings').select('*').in('user_id', userIds),
    admin.from('gmail_connections').select('*').in('user_id', userIds).is('revoked_at', null),
  ]);
  const settings = Object.fromEntries((settingsRows || []).map((s) => [s.user_id, s]));
  const conns = Object.fromEntries((connRows || []).map((c) => [c.user_id, c]));
  const sentTodayByUser: Record<string, number> = {};
  const linkedinTodayByUser: Record<string, number> = {}; // Part 7 — daily LinkedIn action cap
  for (const uid of userIds) {
    const { count } = await admin.from('sequence_sends').select('id', { count: 'exact', head: true })
      .eq('user_id', uid).gte('sent_at', `${today}T00:00:00Z`);
    sentTodayByUser[uid] = count || 0;
    const { count: liCount } = await admin.from('sequence_sends').select('id', { count: 'exact', head: true })
      .eq('user_id', uid).in('channel', ['linkedin_connect', 'linkedin_view']).gte('sent_at', `${today}T00:00:00Z`);
    linkedinTodayByUser[uid] = liCount || 0;
  }

  for (const enr of due) {
    const cfg = settings[enr.user_id];
    const conn = conns[enr.user_id];
    // gate: auto-send on + at least one live send channel (Gmail OAuth or Resend)
    if (!cfg || !cfg.auto_send_enabled) { out.skipped++; continue; }
    const gmailLive = conn && !conn.needs_reauth;
    const resendLive = Boolean(Deno.env.get('RESEND_API_KEY') && cfg.resend_from_email);
    if (!gmailLive && !resendLive) { out.needs_reauth += conn ? 1 : 0; out.skipped++; continue; }
    // send window / days / cap (user-local via tz offset minutes)
    const local = new Date(Date.now() + (cfg.send_tz_offset || 0) * 60000);
    if (!(cfg.send_days || [1, 2, 3, 4, 5]).includes(local.getUTCDay())) { out.skipped++; continue; }
    const hr = local.getUTCHours();
    if (hr < (cfg.send_window_start ?? 9) || hr >= (cfg.send_window_end ?? 17)) { out.skipped++; continue; }
    if (sentTodayByUser[enr.user_id] >= (cfg.daily_send_cap ?? 50)) { out.skipped++; continue; }

    const [{ data: seq }, { data: steps }, { data: edgeRows }, { data: sends }] = await Promise.all([
      admin.from('email_sequences').select('*').eq('id', enr.sequence_id).single(),
      admin.from('sequence_steps').select('*').eq('sequence_id', enr.sequence_id).order('step_order').order('id'),
      admin.from('sequence_edges').select('*').eq('sequence_id', enr.sequence_id).order('id'),
      admin.from('sequence_sends').select('*').eq('enrollment_id', enr.id),
    ]);
    // v4: the Active toggle (is_active) is the runner gate — paused campaigns are skipped
    if (!seq || !seq.is_active || !steps) { out.skipped++; continue; }

    // v5 — resolve the contact: a relationship client OR a cold contact
    let client: any = null;
    let coldContact: any = null;
    if (enr.client_id != null) {
      const { data } = await admin.from('clients').select('*').eq('id', enr.client_id).single();
      client = data;
    } else if (enr.cold_contact_id != null) {
      const { data } = await admin.from('cold_contacts').select('*').eq('id', enr.cold_contact_id).single();
      coldContact = data;
      if (coldContact) {
        client = {
          id: null,
          name: `${coldContact.first_name || ''} ${coldContact.last_name || ''}`.trim() || coldContact.email,
          email: coldContact.email,
          company_name: coldContact.company || '',
          phone_number: coldContact.phone || '',
          linkedin_url: coldContact.linkedin_url || '',
          status: coldContact.status || '',
        };
      }
    }
    if (!client) { out.skipped++; continue; }

    // v5 — honor the unsubscribe list before anything else
    if (client.email) {
      const { data: unsub } = await admin.from('unsubscribes')
        .select('id').eq('user_id', enr.user_id).eq('email', String(client.email).toLowerCase()).maybeSingle();
      if (unsub) {
        await admin.from('sequence_enrollments').update({ status: 'stopped', stopped_reason: 'unsubscribed', next_send_at: null }).eq('id', enr.id);
        if (coldContact) await admin.from('cold_contacts').update({ status: 'unsubscribed', unsubscribed_at: new Date().toISOString() }).eq('id', coldContact.id);
        out.unsubscribed++; continue;
      }
    }

    // real edges, or an implicit straight chain for pre-canvas linear sequences
    const edges = (edgeRows && edgeRows.length) ? edgeRows : syntheticChainEdges(steps);
    const res = resolveNextNode(enr, steps, edges, sends || []);

    if (res.action === 'complete' || res.action === 'goal') {
      await admin.from('sequence_enrollments').update({
        status: 'completed', stopped_reason: res.action === 'goal' ? 'goal_reached' : 'completed',
        next_send_at: null, ...(res.node ? { current_node_id: res.node.id } : {}),
      }).eq('id', enr.id);
      out.completed++; continue;
    }
    if (res.action === 'wait') {
      await admin.from('sequence_enrollments').update({
        current_node_id: res.node.id, next_send_at: addDaysStr(res.waitDays),
      }).eq('id', enr.id);
      out.waited++; continue;
    }

    const node = res.node;
    // double-send guard: if this node already has a send row for this enrollment, only advance
    if ((sends || []).some((s: any) => s.step_id === node.id)) {
      const advDup = advanceAfterNode(node, steps, edges);
      const dupPatch = advDup.done
        ? { current_step: (enr.current_step || 0) + 1, current_node_id: node.id, status: 'completed', stopped_reason: 'completed', next_send_at: null }
        : { current_step: (enr.current_step || 0) + 1, current_node_id: advDup.nodeId, next_send_at: addDaysStr(advDup.waitDays) };
      await admin.from('sequence_enrollments').update(dupPatch).eq('id', enr.id);
      out.skipped++; continue;
    }
    const channel = (node.node_type || 'email') === 'email' ? 'email' : node.node_type;
    const token = crypto.randomUUID();
    let channelDesc = '';
    let variant: string | null = null;
    let providerMsgId: string | null = null;

    if (res.action === 'task') {
      // Part 7 — respect the daily LinkedIn action cap, deferring excess to the next tick/day
      // (leave next_send_at unchanged so the enrollment is retried).
      if ((channel === 'linkedin_connect' || channel === 'linkedin_view') &&
          linkedinTodayByUser[enr.user_id] >= (cfg.linkedin_daily_cap ?? 20)) {
        out.skipped++; continue;
      }
      const label: Record<string, string> = { linkedin_view: 'LinkedIn: view profile of', linkedin_connect: 'LinkedIn: connect with', call: 'Call', manual_task: 'Task for' };
      // Part 7 — A/B connection-note variants (note_b) picked deterministically per enrollment,
      // and mutual-context surfacing (company) baked into the note when available.
      let note = (node.config && node.config.note) || node.task_note || '';
      let noteVariant: string | null = null;
      if (channel === 'linkedin_connect' && node.config && node.config.note_b && String(node.config.note_b).trim()) {
        noteVariant = enr.id % 2 === 0 ? 'A' : 'B';
        note = noteVariant === 'B' ? node.config.note_b : (node.config.note || note);
      }
      if (channel === 'linkedin_connect' && client.company_name && note && !/\{\{company\}\}/.test(note)) {
        note = `${note} (re: ${client.company_name})`;
      }
      const title = `${label[channel] || 'Task for'} ${client.name}${note ? ' — ' + mergeTags(note, client) : ''}`.slice(0, 250);
      await admin.from('tasks').insert({ user_id: enr.user_id, client_id: enr.client_id ?? null, title, due_date: today, status: 'pending' });
      channelDesc = `Campaign "${seq.name}" — ${channel} task created: ${title}`;
      variant = noteVariant; // record A/B connection-note variant on the send row
      if (channel === 'linkedin_connect' || channel === 'linkedin_view') linkedinTodayByUser[enr.user_id]++;
      out.tasks++;
    } else {
      if (!client.email) { out.skipped++; continue; }
      const pick = pickSubjectVariant(node, enr);
      variant = pick.variant;
      const subject = mergeTags(pick.subject, client);
      let html = mergeTags(node.body, client).replace(/\n/g, '<br/>');
      html = html.replace(/href="(https?:[^"]+)"/gi, (_m, u) => `href="${projectUrl}/functions/v1/track/click/${token}?u=${encodeURIComponent(u)}"`);
      html += `<img src="${projectUrl}/functions/v1/track/open/${token}" width="1" height="1" alt=""/>`;
      // v5 — CAN-SPAM/GDPR opt-out footer on every auto-send
      html += `<br/><br/><p style="font-size:11px;color:#9ca3af">Don't want these emails? <a href="${projectUrl}/functions/v1/track/unsub/${token}">Unsubscribe</a>.</p>`;

      if (gmailLive) {
        const accessToken = await getAccessToken(admin, conn);
        if (!accessToken) { out.needs_reauth++; out.skipped++; continue; }
        // Part 2 — never send with a bogus 'me' From header. If the connection row
        // never captured the Gmail address, flag it for reconnect instead of sending
        // a malformed message.
        if (!conn.email_address) {
          await admin.from('gmail_connections').update({ needs_reauth: true }).eq('id', conn.id);
          out.needs_reauth++; out.skipped++; continue;
        }
        const raw = buildMime(conn.email_address, client.email, subject, html);
        const r = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
          method: 'POST', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ raw }),
        });
        const rj = await r.json().catch(() => ({}));
        if (r.status === 401) {
          await admin.from('gmail_connections').update({ needs_reauth: true }).eq('id', conn.id);
          out.needs_reauth++; out.skipped++; continue;
        }
        if (r.status === 403 || r.status === 429) {
          // Gmail quota/rate limit — leave next_send_at unchanged, retry next tick/day
          out.quota_deferred++; continue;
        }
        if (!r.ok) { out.errors.push(`gmail ${r.status}: ${rj?.error?.message || ''}`); out.skipped++; continue; }
        providerMsgId = rj?.id || null;
        channelDesc = `Campaign "${seq.name}" — email auto-sent from ${conn.email_address || 'Gmail'}${variant ? ` (variant ${variant})` : ''}: ${subject}`;
      } else {
        // v5 — Resend path (cold email engine / no Gmail connection)
        const sent = await sendViaResend(cfg.resend_from_email, client.email, subject, html);
        if (!sent.ok) {
          if (sent.status === 429) { out.quota_deferred++; continue; }
          out.errors.push(`resend: ${sent.error}`); out.skipped++; continue;
        }
        providerMsgId = sent.id || null;
        channelDesc = `Campaign "${seq.name}" — email auto-sent via Resend${variant ? ` (variant ${variant})` : ''}: ${subject}`;
      }
      out.sent++; sentTodayByUser[enr.user_id]++;
      // v5 — cold contact lifecycle: first outbound email flips prospect → contacted
      if (coldContact && (coldContact.status === 'prospect' || !coldContact.status)) {
        await admin.from('cold_contacts').update({ status: 'contacted' }).eq('id', coldContact.id);
      }
    }

    await admin.from('sequence_sends').insert({
      user_id: enr.user_id, enrollment_id: enr.id, sequence_id: enr.sequence_id, step_id: node.id,
      client_id: enr.client_id ?? null, cold_contact_id: enr.cold_contact_id ?? null,
      track_token: token, channel, subject_variant: variant, provider_msg_id: providerMsgId,
    });
    // activities only exist for relationship clients — cold contacts live in their own table
    if (enr.client_id != null) {
      await admin.from('activities').insert({
        user_id: enr.user_id, client_id: enr.client_id, activity_type: res.action === 'email' ? 'Email' : 'Note',
        activity_date: today, description: channelDesc || 'Campaign step processed',
      });
    }
    const adv = advanceAfterNode(node, steps, edges);
    const patch = adv.done
      ? { current_step: (enr.current_step || 0) + 1, current_node_id: node.id, status: 'completed', stopped_reason: 'completed', next_send_at: null, last_channel_sent: channel }
      : { current_step: (enr.current_step || 0) + 1, current_node_id: adv.nodeId, next_send_at: addDaysStr(adv.waitDays), last_channel_sent: channel };
    await admin.from('sequence_enrollments').update(patch).eq('id', enr.id);
    await admin.from('email_sequences').update({ last_run_at: new Date().toISOString() }).eq('id', seq.id);
  }
  return new Response(JSON.stringify(out), { headers: { 'Content-Type': 'application/json' } });
});

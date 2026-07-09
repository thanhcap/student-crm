// UPGRADE 3 — open/click tracking. Public by necessity (email clients fetch it);
// tokens are unguessable UUIDs and the only mutation is stamping timestamps.
// v5 adds /track/unsub/:token — one-click opt-out honored by the runner.
import { createClient } from 'npm:@supabase/supabase-js@2';

const GIF = Uint8Array.from(atob('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'), (c) => c.charCodeAt(0));

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  // path: /track/open/:token, /track/click/:token, /track/unsub/:token
  const parts = url.pathname.split('/').filter(Boolean); // ['track','open',token]
  const kind = parts[1];
  const token = parts[2];
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  if (kind === 'open' && token) {
    await admin.from('sequence_sends').update({ opened_at: new Date().toISOString() })
      .eq('track_token', token).is('opened_at', null);
    return new Response(GIF, { headers: { 'Content-Type': 'image/gif', 'Cache-Control': 'no-store' } });
  }
  if (kind === 'click' && token) {
    const dest = url.searchParams.get('u');
    await admin.from('sequence_sends').update({ clicked_at: new Date().toISOString() })
      .eq('track_token', token).is('clicked_at', null);
    // also count a click as an open
    await admin.from('sequence_sends').update({ opened_at: new Date().toISOString() })
      .eq('track_token', token).is('opened_at', null);
    let target = 'about:blank';
    try { const d = decodeURIComponent(dest || ''); if (/^https?:\/\//i.test(d)) target = d; } catch { /* ignore */ }
    return Response.redirect(target, 302);
  }
  if (kind === 'unsub' && token) {
    // Resolve the send → contact email + owner, then opt them out everywhere.
    const { data: send } = await admin.from('sequence_sends')
      .select('id, user_id, client_id, cold_contact_id').eq('track_token', token).maybeSingle();
    if (send) {
      const now = new Date().toISOString();
      let email: string | null = null;
      if (send.client_id != null) {
        const { data: c } = await admin.from('clients').select('email').eq('id', send.client_id).single();
        email = c?.email || null;
      } else if (send.cold_contact_id != null) {
        const { data: cc } = await admin.from('cold_contacts').select('email').eq('id', send.cold_contact_id).single();
        email = cc?.email || null;
        await admin.from('cold_contacts').update({ status: 'unsubscribed', unsubscribed_at: now }).eq('id', send.cold_contact_id);
      }
      if (email) {
        await admin.from('unsubscribes').upsert(
          { user_id: send.user_id, email: email.toLowerCase(), reason: 'link_click' },
          { onConflict: 'user_id,email', ignoreDuplicates: true },
        );
      }
      await admin.from('sequence_sends').update({ unsubscribed_at: now }).eq('id', send.id).is('unsubscribed_at', null);
      // stop every active enrollment for this contact under this owner
      let stopQ = admin.from('sequence_enrollments')
        .update({ status: 'stopped', stopped_reason: 'unsubscribed', next_send_at: null })
        .eq('user_id', send.user_id).eq('status', 'active');
      stopQ = send.client_id != null ? stopQ.eq('client_id', send.client_id) : stopQ.eq('cold_contact_id', send.cold_contact_id);
      await stopQ;
    }
    return new Response(
      '<!doctype html><html><body style="font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#fafafa"><div style="text-align:center"><h2 style="color:#111">You\'ve been unsubscribed.</h2><p style="color:#6b7280">You won\'t receive any more emails from this sender.</p></div></body></html>',
      { headers: { 'Content-Type': 'text/html; charset=utf-8' } },
    );
  }
  return new Response('not found', { status: 404 });
});

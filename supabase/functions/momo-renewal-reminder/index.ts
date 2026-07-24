// B-6 — daily MoMo renewal reminder + expiry sweep.
//
// Stripe auto-renews; MoMo's standard merchant API does not. Each MoMo period
// is a fresh payment, so without this job a paid plan would either lapse
// silently or — worse — keep working forever because nothing ever expired it.
// This handles both halves honestly:
//   1. Anything expiring within 3 days gets a reminder email.
//   2. Anything already past current_period_end is downgraded to free
//      immediately. No silent free extension of a paid plan.
import { createClient } from 'npm:@supabase/supabase-js@2';

const DAY_MS = 864e5;

function esc(s: string): string {
  return String(s).replace(/[&<>"]/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] || c));
}

Deno.serve(async (req: Request) => {
  const json = (b: unknown, s = 200) =>
    new Response(JSON.stringify(b), { status: s, headers: { 'Content-Type': 'application/json' } });

  const svcKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, svcKey);

  // Auth gate, matching sequence-runner: accept the service-role key, or the
  // Vault-stored cron token fetched through the SECURITY DEFINER RPC
  // `public.get_cron_token`. Looked up fresh each call, never hardcoded.
  // FAIL CLOSED — anything else is rejected, so an unconfigured deployment
  // leaves no public endpoint that can spam reminder emails.
  const auth = req.headers.get('Authorization') || '';
  let allowed = auth === `Bearer ${svcKey}`;
  if (!allowed) {
    const { data: cronToken } = await admin.rpc('get_cron_token');
    allowed = Boolean(cronToken) && auth === `Bearer ${cronToken}`;
  }
  if (!allowed) return json({ error: 'unauthorized' }, 401);

  const appUrl = Deno.env.get('APP_URL') || '';
  const resendKey = Deno.env.get('RESEND_API_KEY');
  const fromAddress = Deno.env.get('BILLING_FROM_EMAIL') || 'billing@example.com';

  const now = new Date();
  const nowIso = now.toISOString();
  const in3Days = new Date(now.getTime() + 3 * DAY_MS).toISOString();

  // --- 1. Expire anything already past its period end (do this FIRST, so an
  // already-expired row can't also receive a "renews soon" reminder). ---
  const { data: expired } = await admin.from('subscriptions').select('id, user_id')
    .eq('provider', 'momo').eq('status', 'active').lt('current_period_end', nowIso);

  let downgraded = 0;
  for (const sub of expired || []) {
    await admin.from('subscriptions')
      .update({ status: 'expired', plan: 'free', updated_at: nowIso }).eq('id', sub.id);
    await admin.from('usage_meters').update({ plan: 'free' }).eq('user_id', sub.user_id);
    downgraded += 1;
  }

  // --- 2. Remind anything expiring within the next 3 days. ---
  const { data: expiring } = await admin.from('subscriptions').select('*')
    .eq('provider', 'momo').eq('status', 'active')
    .gte('current_period_end', nowIso).lte('current_period_end', in3Days);

  let reminded = 0;
  const skipped: string[] = [];

  for (const sub of expiring || []) {
    const { data: userRec } = await admin.auth.admin.getUserById(sub.user_id);
    const email = userRec?.user?.email;
    if (!email) { skipped.push(`${sub.user_id}: no email`); continue; }
    if (!resendKey) { skipped.push(`${sub.user_id}: RESEND_API_KEY not set`); continue; }

    const renewsOn = new Date(sub.current_period_end).toLocaleDateString('en-GB');
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: fromAddress,
        to: email,
        subject: 'Your plan renews in 3 days',
        html:
          `<p>Your <strong>${esc(sub.plan)}</strong> plan runs until ${esc(renewsOn)}.</p>` +
          `<p>MoMo doesn't charge automatically, so it needs a fresh payment to continue. ` +
          `<a href="${esc(appUrl)}/pricing">Renew now via MoMo</a> to avoid interruption.</p>` +
          `<p style="color:#888;font-size:12px">If you do nothing, your account moves to the free plan on ${esc(renewsOn)}. Your data stays.</p>`,
      }),
    });
    if (res.ok) reminded += 1;
    else skipped.push(`${sub.user_id}: send failed ${res.status}`);
  }

  return json({ ok: true, reminded, downgraded, skipped });
});

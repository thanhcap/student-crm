// B-5 — MoMo IPN. THE ONLY PLACE A MOMO-DRIVEN UPGRADE HAPPENS.
//
// Same rule as Stripe: the `redirectUrl` the user lands on after paying proves
// nothing and grants nothing. This handler, and only this handler, upgrades a
// plan — and only after MoMo's HMAC signature verifies.
//
// MoMo may call this more than once for the same order, so it is idempotent:
// a transaction already marked 'succeeded' short-circuits.
import crypto from 'node:crypto';
import { supabaseAdmin, assertAdminConfigured } from '../../../../lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// The IPN signature covers a different (longer) field list than the create
// request, again in strict alphabetical order.
export function verifyMomoIpnSignature(body, accessKey, secretKey) {
  const raw =
    `accessKey=${accessKey}` +
    `&amount=${body.amount}` +
    `&extraData=${body.extraData}` +
    `&message=${body.message}` +
    `&orderId=${body.orderId}` +
    `&orderInfo=${body.orderInfo}` +
    `&orderType=${body.orderType}` +
    `&partnerCode=${body.partnerCode}` +
    `&payType=${body.payType}` +
    `&requestId=${body.requestId}` +
    `&responseTime=${body.responseTime}` +
    `&resultCode=${body.resultCode}` +
    `&transId=${body.transId}`;
  const expected = crypto.createHmac('sha256', secretKey).update(raw).digest('hex');
  const given = String(body.signature || '');
  // Constant-time compare so the check can't be probed byte-by-byte.
  if (expected.length !== given.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(given));
}

export async function POST(req) {
  const { MOMO_ACCESS_KEY, MOMO_SECRET_KEY } = process.env;
  if (!MOMO_ACCESS_KEY || !MOMO_SECRET_KEY) {
    return Response.json({ error: 'momo_not_configured' }, { status: 503 });
  }
  try {
    assertAdminConfigured();
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }

  let body;
  try { body = await req.json(); } catch { return Response.json({ error: 'bad_json' }, { status: 400 }); }

  if (!verifyMomoIpnSignature(body, MOMO_ACCESS_KEY, MOMO_SECRET_KEY)) {
    return Response.json({ error: 'invalid_signature' }, { status: 400 });
  }

  const { data: existing } = await supabaseAdmin.from('payment_transactions')
    .select('*').eq('provider_transaction_id', body.orderId).eq('provider', 'momo').maybeSingle();
  if (!existing) return Response.json({ error: 'unknown_order' }, { status: 404 });
  // Idempotent — MoMo may call this more than once.
  if (existing.status === 'succeeded') return Response.json({ ok: true, already: true });

  if (Number(body.resultCode) !== 0) {
    await supabaseAdmin.from('payment_transactions')
      .update({ status: 'failed', raw_payload: body }).eq('id', existing.id);
    return Response.json({ ok: true });
  }

  let extra;
  try {
    extra = JSON.parse(Buffer.from(body.extraData, 'base64').toString());
  } catch {
    return Response.json({ error: 'bad_extra_data' }, { status: 400 });
  }

  // extraData is signature-covered, but cross-check it against the pending row
  // we wrote ourselves before redirecting — the row is the authority on who
  // and what this payment was for.
  if (extra.user_id !== existing.user_id || extra.plan !== existing.plan) {
    return Response.json({ error: 'order_mismatch' }, { status: 400 });
  }
  if (Number(body.amount) !== Number(existing.amount)) {
    return Response.json({ error: 'amount_mismatch' }, { status: 400 });
  }

  await supabaseAdmin.from('payment_transactions')
    .update({ status: 'succeeded', raw_payload: body }).eq('id', existing.id);

  // MoMo has no native recurring charge — each period is a fresh payment, so
  // the new period is measured from now, not extended from a prior end date.
  const periodDays = existing.billing_cycle === 'annual' ? 365 : 30;
  await supabaseAdmin.from('subscriptions').upsert({
    user_id: existing.user_id, plan: existing.plan, billing_cycle: existing.billing_cycle,
    provider: 'momo', status: 'active',
    current_period_end: new Date(Date.now() + periodDays * 864e5).toISOString(),
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' });

  await supabaseAdmin.from('usage_meters')
    .upsert({ user_id: existing.user_id, plan: existing.plan }, { onConflict: 'user_id' });

  return Response.json({ ok: true });
}

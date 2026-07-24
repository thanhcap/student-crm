// B-4 — MoMo payment request creation.
//
// MoMo signs with HMAC-SHA256 over a raw string whose keys must appear in an
// exact alphabetical order. Get the order wrong (or include a key MoMo doesn't
// expect) and the gateway rejects the request with a signature error, not a
// helpful one — so the string below is written out literally rather than built
// from an object, to make the order reviewable at a glance.
//
// Like the Stripe route, this grants nothing. It records a *pending*
// transaction and hands back a redirect URL. The upgrade happens only in the
// IPN handler, after MoMo's own signature has been verified.
import crypto from 'node:crypto';
import { supabaseAdmin, getUserFromRequest, assertAdminConfigured } from '../../../../lib/supabaseAdmin';

// MoMo's sandbox. Switch to https://payment.momo.vn/v2/gateway/api/create only
// once the merchant account is verified for production and MOMO_PARTNER_CODE is
// a live merchant code.
const MOMO_ENDPOINT = process.env.MOMO_ENDPOINT
  || 'https://test-payment.momo.vn/v2/gateway/api/create';

const PLANS = ['pro', 'max'];
const CYCLES = ['monthly', 'annual'];

export function momoSignature(params, secretKey) {
  const raw =
    `accessKey=${params.accessKey}` +
    `&amount=${params.amount}` +
    `&extraData=${params.extraData}` +
    `&ipnUrl=${params.ipnUrl}` +
    `&orderId=${params.orderId}` +
    `&orderInfo=${params.orderInfo}` +
    `&partnerCode=${params.partnerCode}` +
    `&redirectUrl=${params.redirectUrl}` +
    `&requestId=${params.requestId}` +
    `&requestType=${params.requestType}`;
  return crypto.createHmac('sha256', secretKey).update(raw).digest('hex');
}

export async function POST(req) {
  const { MOMO_PARTNER_CODE, MOMO_ACCESS_KEY, MOMO_SECRET_KEY } = process.env;
  if (!MOMO_PARTNER_CODE || !MOMO_ACCESS_KEY || !MOMO_SECRET_KEY) {
    return Response.json({ error: 'MoMo payments are not configured yet.' }, { status: 503 });
  }
  try {
    assertAdminConfigured();
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }

  const user = await getUserFromRequest(req);
  if (!user) return Response.json({ error: 'unauthorized' }, { status: 401 });

  let body;
  try { body = await req.json(); } catch { return Response.json({ error: 'bad_json' }, { status: 400 }); }
  const { plan, billingCycle } = body || {};
  if (!PLANS.includes(plan) || !CYCLES.includes(billingCycle)) {
    return Response.json({ error: 'invalid_plan' }, { status: 400 });
  }

  // The amount comes from the database, never from the request — a client
  // cannot name its own price.
  const { data: pricing } = await supabaseAdmin.from('momo_pricing')
    .select('amount_vnd').eq('plan', plan).eq('billing_cycle', billingCycle).maybeSingle();
  if (!pricing) return Response.json({ error: 'invalid_plan' }, { status: 400 });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin;
  const orderId = `${user.id.slice(0, 8)}-${Date.now()}`;
  const requestId = orderId;

  const params = {
    partnerCode: MOMO_PARTNER_CODE,
    accessKey: MOMO_ACCESS_KEY,
    requestId,
    amount: String(pricing.amount_vnd),
    orderId,
    orderInfo: `${plan} plan - ${billingCycle}`,
    redirectUrl: `${appUrl}/settings/billing?checkout=momo_return`,
    ipnUrl: `${appUrl}/api/webhooks/momo`,
    requestType: 'captureWallet',
    extraData: Buffer.from(JSON.stringify({
      user_id: user.id, plan, billing_cycle: billingCycle,
    })).toString('base64'),
  };
  const signature = momoSignature(params, MOMO_SECRET_KEY);

  // Record the pending transaction BEFORE redirecting, so the IPN always has a
  // row to reconcile against even if the user abandons the payment.
  const { error: txErr } = await supabaseAdmin.from('payment_transactions').insert({
    user_id: user.id, provider: 'momo', provider_transaction_id: orderId,
    plan, billing_cycle: billingCycle, amount: pricing.amount_vnd,
    currency: 'VND', status: 'pending',
  });
  if (txErr) return Response.json({ error: txErr.message }, { status: 500 });

  let momoData;
  try {
    const momoRes = await fetch(MOMO_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...params, lang: 'en', signature }),
    });
    momoData = await momoRes.json();
  } catch (err) {
    await supabaseAdmin.from('payment_transactions')
      .update({ status: 'failed', raw_payload: { error: err.message } })
      .eq('provider_transaction_id', orderId);
    return Response.json({ error: 'momo_unreachable' }, { status: 502 });
  }

  if (momoData.resultCode !== 0 || !momoData.payUrl) {
    await supabaseAdmin.from('payment_transactions')
      .update({ status: 'failed', raw_payload: momoData })
      .eq('provider_transaction_id', orderId);
    return Response.json({ error: momoData.message || 'momo_request_failed' }, { status: 400 });
  }

  return Response.json({ payUrl: momoData.payUrl });
}

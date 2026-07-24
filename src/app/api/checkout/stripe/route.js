// B-2 — Stripe Checkout Session creation.
//
// This route NEVER grants a plan. All it does is hand back a Stripe-hosted
// checkout URL. The upgrade happens later, in the webhook, after Stripe has
// signed a "payment succeeded" event. The plan is carried through in metadata
// precisely so the webhook never has to trust anything the browser says on the
// way back.
import Stripe from 'stripe';
import { supabaseAdmin, getUserFromRequest, assertAdminConfigured } from '../../../../lib/supabaseAdmin';

const PLANS = ['pro', 'max'];
const CYCLES = ['monthly', 'annual'];

function priceIdFor(plan, cycle) {
  const ids = {
    'pro:monthly': process.env.STRIPE_PRICE_PRO_MONTHLY,
    'pro:annual': process.env.STRIPE_PRICE_PRO_ANNUAL,
    'max:monthly': process.env.STRIPE_PRICE_MAX_MONTHLY,
    'max:annual': process.env.STRIPE_PRICE_MAX_ANNUAL,
  };
  return ids[`${plan}:${cycle}`];
}

export async function POST(req) {
  if (!process.env.STRIPE_SECRET_KEY) {
    return Response.json({ error: 'Card payments are not configured yet.' }, { status: 503 });
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

  // Validate against a fixed allow-list — the price is chosen server-side from
  // env, so a client cannot ask to be charged an arbitrary amount.
  if (!PLANS.includes(plan) || !CYCLES.includes(billingCycle)) {
    return Response.json({ error: 'invalid_plan' }, { status: 400 });
  }
  const priceId = priceIdFor(plan, billingCycle);
  if (!priceId) return Response.json({ error: 'invalid_plan' }, { status: 400 });

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin;

  // Reuse an existing Stripe customer so a returning subscriber doesn't end up
  // with two customer records (and two payment methods on file).
  const { data: sub } = await supabaseAdmin
    .from('subscriptions').select('stripe_customer_id').eq('user_id', user.id).maybeSingle();

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: sub?.stripe_customer_id || undefined,
      customer_email: sub?.stripe_customer_id ? undefined : user.email,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl}/settings/billing?checkout=success`,
      cancel_url: `${appUrl}/pricing?checkout=canceled`,
      // Carries the plan to the webhook without trusting the client on return.
      metadata: { user_id: user.id, plan, billing_cycle: billingCycle },
      subscription_data: { metadata: { user_id: user.id, plan, billing_cycle: billingCycle } },
    });
    return Response.json({ url: session.url });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 400 });
  }
}

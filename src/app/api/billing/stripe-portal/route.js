// B-7 — Stripe Billing Portal session, so the user can update their card or
// cancel without us building any of that UI. Cancellation comes back to us as
// a `customer.subscription.deleted` webhook.
import Stripe from 'stripe';
import { supabaseAdmin, getUserFromRequest, assertAdminConfigured } from '../../../../lib/supabaseAdmin';

export async function GET(req) {
  if (!process.env.STRIPE_SECRET_KEY) {
    return Response.json({ error: 'Card billing is not configured yet.' }, { status: 503 });
  }
  try {
    assertAdminConfigured();
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }

  const user = await getUserFromRequest(req);
  if (!user) return Response.json({ error: 'unauthorized' }, { status: 401 });

  // Scoped to this user's own row, so nobody can open somebody else's portal.
  const { data: sub } = await supabaseAdmin
    .from('subscriptions').select('stripe_customer_id').eq('user_id', user.id).maybeSingle();
  if (!sub?.stripe_customer_id) {
    return Response.json({ error: 'no_stripe_customer' }, { status: 400 });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin;

  try {
    const portal = await stripe.billingPortal.sessions.create({
      customer: sub.stripe_customer_id,
      return_url: `${appUrl}/settings/billing`,
    });
    return Response.json({ url: portal.url });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 400 });
  }
}

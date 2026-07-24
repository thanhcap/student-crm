// B-3 — Stripe webhook. THE ONLY PLACE A STRIPE-DRIVEN UPGRADE HAPPENS.
//
// Why this and not the success_url redirect:
//   · A user who pays and then closes the tab before the redirect fires still
//     gets upgraded, because Stripe calls this independently.
//   · A user who types `?checkout=success` into the address bar does NOT get
//     upgraded, because nothing here ran.
//
// The signature check below is what makes any of that trustworthy. Without it,
// anyone who discovered this URL could POST a fake "payment succeeded" event
// and grant themselves a plan.
import Stripe from 'stripe';
import { supabaseAdmin, assertAdminConfigured } from '../../../../lib/supabaseAdmin';

// The raw body is required byte-for-byte for signature verification, so this
// route must never let a framework parse it first.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function periodEndFrom(cycle) {
  return new Date(Date.now() + (cycle === 'annual' ? 365 : 30) * 864e5).toISOString();
}

export async function POST(req) {
  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
    return Response.json({ error: 'stripe_not_configured' }, { status: 503 });
  }
  try {
    assertAdminConfigured();
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const sig = req.headers.get('stripe-signature');
  const rawBody = await req.text();

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return Response.json({ error: `signature verification failed: ${err.message}` }, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const { user_id, plan, billing_cycle } = session.metadata || {};
        if (!user_id || !plan) break; // not one of ours

        // Idempotency: Stripe retries. The unique constraint on
        // provider_transaction_id means a replay can't double-record, and the
        // upsert makes the subscription write safe to repeat.
        const { data: seen } = await supabaseAdmin.from('payment_transactions')
          .select('id').eq('provider_transaction_id', session.id).maybeSingle();
        if (seen) break;

        await supabaseAdmin.from('subscriptions').upsert({
          user_id, plan, billing_cycle, provider: 'stripe', status: 'active',
          stripe_customer_id: typeof session.customer === 'string' ? session.customer : null,
          stripe_subscription_id: typeof session.subscription === 'string' ? session.subscription : null,
          current_period_end: periodEndFrom(billing_cycle),
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });

        await supabaseAdmin.from('usage_meters').upsert({ user_id, plan }, { onConflict: 'user_id' });

        await supabaseAdmin.from('payment_transactions').insert({
          user_id, provider: 'stripe', provider_transaction_id: session.id,
          plan, billing_cycle,
          amount: (session.amount_total ?? 0) / 100,
          currency: (session.currency || 'usd').toUpperCase(),
          status: 'succeeded', raw_payload: session,
        });
        break;
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object;
        const userId = sub.metadata?.user_id;
        const status = sub.status === 'active' ? 'active'
          : sub.status === 'past_due' ? 'past_due'
          : 'canceled';
        const patch = {
          status,
          current_period_end: sub.current_period_end
            ? new Date(sub.current_period_end * 1000).toISOString()
            : null,
          updated_at: new Date().toISOString(),
        };
        // Prefer the subscription id: metadata can be missing on subscriptions
        // created or edited outside our checkout flow.
        if (sub.id) await supabaseAdmin.from('subscriptions').update(patch).eq('stripe_subscription_id', sub.id);
        else if (userId) await supabaseAdmin.from('subscriptions').update(patch).eq('user_id', userId);
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        const userId = sub.metadata?.user_id;
        const { data: rows } = await supabaseAdmin.from('subscriptions')
          .update({ status: 'canceled', plan: 'free', updated_at: new Date().toISOString() })
          .eq('stripe_subscription_id', sub.id).select('user_id');
        const affected = rows?.length ? rows.map(r => r.user_id) : (userId ? [userId] : []);
        for (const id of affected) {
          if (!rows?.length) {
            await supabaseAdmin.from('subscriptions')
              .update({ status: 'canceled', plan: 'free', updated_at: new Date().toISOString() })
              .eq('user_id', id);
          }
          await supabaseAdmin.from('usage_meters').update({ plan: 'free' }).eq('user_id', id);
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        const subId = typeof invoice.subscription === 'string' ? invoice.subscription : null;
        if (subId) {
          await supabaseAdmin.from('subscriptions')
            .update({ status: 'past_due', updated_at: new Date().toISOString() })
            .eq('stripe_subscription_id', subId);
        }
        break;
      }

      default:
        break; // Unhandled event types are acknowledged, not errored.
    }
  } catch (err) {
    // Return 500 so Stripe retries — swallowing this would silently lose an
    // upgrade the customer already paid for.
    return Response.json({ error: err.message }, { status: 500 });
  }

  return Response.json({ received: true });
}

'use client';
// ============================================================================
// REAL PAYMENTS — client surfaces.
//   B-1 PricingCheckoutFlow — payment-method selector (Stripe card / MoMo)
//   B-7 BillingSettings     — current plan, renewal date, payment history,
//                             Stripe Billing Portal link
//
// Nothing in this file can grant a plan. It reads `subscriptions` (SELECT-only
// under RLS) and asks server routes to create checkout sessions. Every upgrade
// is written by a signature-verified webhook using the service role, which the
// browser has no access to. A `?checkout=success` in the URL is treated as a
// hint to re-fetch — never as proof of payment.
// ============================================================================
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

const btnBase = 'px-4 py-2 text-[13px] font-semibold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed';

export function formatVND(amount) {
  if (amount === null || amount === undefined) return '—';
  return `${Number(amount).toLocaleString('vi-VN')} ₫`;
}

export function formatMoney(tx) {
  return tx.currency === 'VND' ? formatVND(tx.amount) : `$${Number(tx.amount).toFixed(2)}`;
}

const STATUS_PILL = {
  succeeded: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400',
  active: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400',
  pending: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400',
  past_due: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400',
  failed: 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400',
  canceled: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  expired: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
};

export function StatusPill({ status }) {
  return (
    <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold capitalize ${STATUS_PILL[status] || STATUS_PILL.canceled}`}>
      {String(status).replace('_', ' ')}
    </span>
  );
}

// Shared by both surfaces: hand the caller's access token to our own routes so
// they can identify the user server-side. Never send the token anywhere else.
async function authedFetch(url, options = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Please sign in first.');
  const res = await fetch(url, {
    ...options,
    headers: {
      ...(options.headers || {}),
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `Request failed (${res.status})`);
  return body;
}

// ============================================================================
// B-1 — payment method selection
// ============================================================================
export function PricingCheckoutFlow({ tier, billingCycle, showToast, onCancel }) {
  const [loading, setLoading] = useState(null); // null | 'stripe' | 'momo'
  const [momoPrice, setMomoPrice] = useState(null);

  useEffect(() => {
    let alive = true;
    supabase.from('momo_pricing').select('amount_vnd')
      .eq('plan', tier.key).eq('billing_cycle', billingCycle).maybeSingle()
      .then(({ data }) => { if (alive) setMomoPrice(data?.amount_vnd ?? null); });
    return () => { alive = false; };
  }, [tier.key, billingCycle]);

  async function go(provider) {
    setLoading(provider);
    try {
      const body = await authedFetch(`/api/checkout/${provider}`, {
        method: 'POST',
        body: JSON.stringify({ plan: tier.key, billingCycle }),
      });
      const url = provider === 'stripe' ? body.url : body.payUrl;
      if (!url) throw new Error('No checkout URL returned.');
      window.location.href = url;
    } catch (err) {
      showToast?.(err.message, 'error');
      setLoading(null);
    }
  }

  return (
    <div className="p-5 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
      <p className="text-[14px] font-bold mb-1 text-gray-900 dark:text-white">Choose a payment method</p>
      <p className="text-[12px] text-gray-400 mb-3 capitalize">{tier.name} · {billingCycle}</p>

      <button type="button" onClick={() => go('stripe')} disabled={!!loading}
        className="w-full flex items-center justify-between px-4 py-3 mb-2 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-gray-400 transition-colors disabled:opacity-50">
        <span className="text-[13px] font-semibold text-gray-900 dark:text-white">Visa / Mastercard / International Card</span>
        <span className="text-[11px] text-gray-400">via Stripe</span>
      </button>

      <button type="button" onClick={() => go('momo')} disabled={!!loading}
        className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-gray-400 transition-colors disabled:opacity-50">
        <span className="text-[13px] font-semibold text-gray-900 dark:text-white">MoMo Wallet</span>
        <span className="text-[11px] text-gray-400">{momoPrice ? formatVND(momoPrice) : '—'}</span>
      </button>

      {loading && <p className="text-[12px] text-gray-400 mt-3 text-center">Redirecting to {loading === 'stripe' ? 'Stripe' : 'MoMo'}…</p>}

      <p className="text-[11px] text-gray-400 mt-3 leading-relaxed">
        MoMo does not charge automatically — each period is a fresh payment, and we email you
        3 days before it ends.
      </p>

      {onCancel && (
        <button type="button" onClick={onCancel} disabled={!!loading}
          className="mt-3 text-[12px] font-semibold text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">
          Back
        </button>
      )}
    </div>
  );
}

// ============================================================================
// B-7 — Settings → Billing
// ============================================================================
export function BillingSettings({ user, showToast }) {
  const [subscription, setSubscription] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [portalBusy, setPortalBusy] = useState(false);

  const load = useCallback(async () => {
    const [{ data: sub }, { data: txs }] = await Promise.all([
      supabase.from('subscriptions').select('*').eq('user_id', user.id).maybeSingle(),
      supabase.from('payment_transactions').select('*').eq('user_id', user.id)
        .order('created_at', { ascending: false }).limit(50),
    ]);
    setSubscription(sub || null);
    setTransactions(txs || []);
    setLoading(false);
  }, [user.id]);

  useEffect(() => { load(); }, [load]);

  // Coming back from a provider means "check again", not "you're upgraded".
  // The row only changes once the webhook has written it, so poll briefly
  // rather than assuming anything from the URL.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const flag = params.get('checkout');
    if (!flag) return undefined;
    if (flag === 'success' || flag === 'momo_return') {
      showToast?.('Payment received — confirming with the provider…', 'success');
      let tries = 0;
      const iv = setInterval(() => {
        tries += 1;
        load();
        if (tries >= 6) clearInterval(iv);
      }, 2500);
      return () => clearInterval(iv);
    }
    return undefined;
  }, [load, showToast]);

  async function openPortal() {
    setPortalBusy(true);
    try {
      const { url } = await authedFetch('/api/billing/stripe-portal');
      window.location.href = url;
    } catch (err) {
      showToast?.(err.message, 'error');
      setPortalBusy(false);
    }
  }

  if (loading) return <p className="text-[13px] text-gray-400">Loading billing…</p>;

  const isPaid = subscription && subscription.plan !== 'free' && ['active', 'past_due'].includes(subscription.status);

  return (
    <div>
      {isPaid ? (
        <div className="p-5 rounded-2xl border border-gray-100 dark:border-gray-800 mb-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[15px] font-bold capitalize text-gray-900 dark:text-white">
                {subscription.plan} plan
              </p>
              <p className="text-[12px] text-gray-400 mt-0.5">
                {subscription.status === 'active' && subscription.current_period_end
                  ? `${subscription.provider === 'momo' ? 'Runs until' : 'Renews'} ${new Date(subscription.current_period_end).toLocaleDateString()}`
                  : subscription.status.replace('_', ' ')}
                {' · '}via {subscription.provider === 'stripe' ? 'Card' : 'MoMo'}
              </p>
              {subscription.provider === 'momo' && (
                <p className="text-[11px] text-gray-400 mt-1.5 max-w-sm">
                  MoMo doesn’t renew automatically. We’ll email you 3 days before this period ends;
                  if it isn’t renewed, the account moves to the free plan and your data stays.
                </p>
              )}
            </div>
            <StatusPill status={subscription.status} />
          </div>
          {subscription.provider === 'stripe' && subscription.stripe_customer_id && (
            <button type="button" onClick={openPortal} disabled={portalBusy}
              className={`${btnBase} mt-4 text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800`}>
              {portalBusy ? 'Opening…' : 'Manage subscription'}
            </button>
          )}
          {subscription.provider === 'momo' && (
            <a href="/pricing"
              className={`${btnBase} inline-block mt-4 text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800`}>
              Renew via MoMo
            </a>
          )}
        </div>
      ) : (
        <div className="p-5 rounded-2xl border border-gray-100 dark:border-gray-800 mb-4">
          <p className="text-[15px] font-bold text-gray-900 dark:text-white">Free plan</p>
          <p className="text-[12px] text-gray-400 mt-0.5">
            {subscription?.status === 'expired'
              ? 'Your previous plan ended and wasn’t renewed. Your data is all still here.'
              : 'You’re on the free plan.'}
          </p>
          <a href="/pricing"
            className={`${btnBase} inline-block mt-4 text-white dark:text-gray-900 bg-gray-900 dark:bg-white hover:bg-gray-700 dark:hover:bg-gray-200`}>
            See plans
          </a>
        </div>
      )}

      <h3 className="text-[13px] font-bold uppercase tracking-wider text-gray-400 mt-6 mb-2">Payment History</h3>
      {transactions.length === 0 ? (
        <p className="text-[13px] text-gray-400">No payments yet.</p>
      ) : (
        <div className="space-y-1">
          {transactions.map(t => (
            <div key={t.id}
              className="flex items-center justify-between gap-3 p-2.5 rounded-lg bg-gray-50 dark:bg-gray-800/50 text-[13px]">
              <span className="capitalize text-gray-900 dark:text-gray-100 min-w-0 truncate">
                {t.plan} · {t.billing_cycle}
              </span>
              <span className="text-gray-500 dark:text-gray-400 text-[11px] shrink-0">
                {new Date(t.created_at).toLocaleDateString()}
              </span>
              <span className="tabular-nums text-gray-900 dark:text-gray-100 shrink-0">{formatMoney(t)}</span>
              <StatusPill status={t.status} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

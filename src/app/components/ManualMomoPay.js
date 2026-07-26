'use client';
// ============================================================================
// MANUAL MOMO QR PAYMENTS — UI only.
//
// All money logic lives server-side in already-deployed RPCs. This file never
// computes or trusts an amount, a price, or an activation: it calls the RPCs
// and reflects what they return.
//
//   create_manual_payment(p_plan, p_cycle)   -> { code, amount, currency, plan,
//        billing_cycle, qr_image_url, receiver_name, receiver_handle, instructions }
//        (server sets the amount; creating a code cancels the caller's previous one)
//   list_pending_manual_payments()           -> admin-only pending rows
//   approve_manual_payment(p_code)           -> activates the plan (idempotent)
//   reject_manual_payment(p_code, p_reason)  -> dismisses a pending code
//
// The payer polls their own payment_transactions row (RLS allows own rows):
// the code is stored in provider_transaction_id with provider='manual_qr'.
// ============================================================================
import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';

// ============================================================================
// MOMO QR (Part 3, corrected) — MoMo's scanner only reads MoMo's own napas /
// VietQR payload, which is issued by MoMo itself; a `momo://…` deep link or a
// plain-text QR scans as "invalid". A personal MoMo QR also can't have an
// arbitrary amount baked in from just a phone number. So the scannable code is
// the admin's real uploaded MoMo QR image (qr_image_url), and the amount + code
// are shown as prominent copyable text — the payer scans, enters the amount,
// and pastes the code into the transfer note.
// ============================================================================
function PayRow({ label, value, copyable, accent, showToast }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[11px] text-gray-400 shrink-0">{label}</span>
      <div className="flex items-center gap-1.5 min-w-0">
        <span className={`text-[13px] font-semibold truncate ${accent ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-900 dark:text-white'}`}>
          {value}
        </span>
        {copyable && (
          <button type="button" onClick={() => { navigator.clipboard?.writeText(String(value)); showToast?.('Copied!', 'success'); }}
            className="shrink-0 text-[9px] px-1.5 py-0.5 rounded bg-gray-200 dark:bg-gray-700 text-gray-500 hover:bg-gray-300 transition-colors">
            Copy
          </button>
        )}
      </div>
    </div>
  );
}

function MomoQR({ amount, paymentCode, config, showToast }) {
  const qrUrl = config?.qr_image_url;
  const hasPhone = Boolean(config?.receiver_handle);

  return (
    <div className="flex flex-col items-center gap-4">
      {qrUrl ? (
        <>
          <div className="p-4 bg-white rounded-2xl shadow-sm border border-gray-100">
            <img src={qrUrl} alt="MoMo payment QR" width={200} height={200}
              className="w-[200px] h-[200px] object-contain" />
          </div>
          <p className="text-[12px] text-gray-500 text-center max-w-[240px]">
            Open MoMo → Scan this QR → enter the amount below → paste the code into the note → Pay
          </p>
        </>
      ) : (
        <p className="text-[11px] text-amber-600 text-center max-w-[240px]">
          No MoMo QR is set up yet. Ask the admin to upload their MoMo QR image in
          Settings, then transfer manually using the details below.
        </p>
      )}

      <div className="w-full rounded-xl bg-gray-50 dark:bg-gray-800/50 p-4 space-y-2">
        <PayRow label="Transfer to" value={config?.receiver_name || 'Thanh Cap'} showToast={showToast} />
        {hasPhone && <PayRow label="MoMo number" value={config.receiver_handle} copyable showToast={showToast} />}
        <PayRow label="Amount" value={formatVND(amount)} accent showToast={showToast} />
        <PayRow label="Note / code" value={paymentCode} copyable accent showToast={showToast} />
        <p className="text-[10px] text-amber-600 dark:text-amber-400 pt-1">
          The note/code must match exactly, or your payment can’t be confirmed.
        </p>
      </div>
    </div>
  );
}

// Local copy (not imported from Billing) to avoid a circular import: Billing
// imports ManualMomoQrPanel from here.
function formatVND(amount) {
  if (amount === null || amount === undefined) return '—';
  return `${Number(amount).toLocaleString('vi-VN')} VND`;
}

const btnBase = 'px-4 py-2 text-[13px] font-semibold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed';
const BTN = {
  primary: `${btnBase} text-white dark:text-gray-900 bg-gray-900 dark:bg-white hover:bg-gray-700 dark:hover:bg-gray-200`,
  ghost: `${btnBase} text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800`,
  danger: `${btnBase} text-white bg-red-600 hover:bg-red-700`,
};

const PLAN_LABEL = { pro: 'Pro', max: 'Max' };

function planLabel(plan) {
  return PLAN_LABEL[plan] || (plan ? plan[0].toUpperCase() + plan.slice(1) : '');
}

function rpcErrorMessage(err) {
  // Postgres RAISE messages come through on err.message; keep them readable.
  const m = err?.message || 'Something went wrong.';
  if (/not authorized/i.test(m)) return 'You’re not allowed to do that.';
  if (/price not configured/i.test(m)) return 'This plan isn’t priced yet — ask the owner to set prices first.';
  if (/not authenticated/i.test(m)) return 'Please sign in first.';
  return m;
}

// ============================================================================
// SCREEN 1 — MoMo QR checkout panel
// Rendered in place of the payment-method selector once the user picks
// "Pay with MoMo QR" for a tier + cycle.
// ============================================================================
export function ManualMomoQrPanel({ tier, billingCycle, showToast, onBack, onActivated }) {
  const [phase, setPhase] = useState('creating'); // creating | waiting | success | cancelled | error
  const [payment, setPayment] = useState(null);
  const [copied, setCopied] = useState(false);
  const pollRef = useRef(null);
  const startedRef = useRef(false);

  const stopPolling = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }, []);

  const create = useCallback(async () => {
    setPhase('creating');
    const { data, error } = await supabase.rpc('create_manual_payment', {
      p_plan: tier.key, p_cycle: billingCycle,
    });
    if (error) {
      setPhase('error');
      showToast?.(rpcErrorMessage(error), 'error');
      return;
    }
    setPayment(data);
    setPhase('waiting');
  }, [tier.key, billingCycle, showToast]);

  // Create exactly one code per mount (React 18 double-invokes effects in dev;
  // the ref guard stops a second RPC — which would cancel the first code).
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    create();
  }, [create]);

  // Poll the payer's own transaction row until the admin acts on it.
  useEffect(() => {
    if (phase !== 'waiting' || !payment?.code) return undefined;

    async function check() {
      const { data, error } = await supabase
        .from('payment_transactions')
        .select('status')
        .eq('provider', 'manual_qr')
        .eq('provider_transaction_id', payment.code)
        .maybeSingle();
      if (error || !data) return;
      if (data.status === 'succeeded') {
        stopPolling();
        setPhase('success');
        onActivated?.();
      } else if (data.status === 'rejected' || data.status === 'cancelled') {
        stopPolling();
        setPhase('cancelled');
      }
    }

    check(); // immediate first check, then interval
    pollRef.current = setInterval(check, 10000);
    return stopPolling;
  }, [phase, payment?.code, stopPolling, onActivated]);

  useEffect(() => stopPolling, [stopPolling]);

  function copyCode() {
    if (!payment?.code) return;
    navigator.clipboard?.writeText(payment.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  const shell = 'p-5 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900';

  if (phase === 'creating') {
    return <div className={shell}><p className="text-[13px] text-gray-400 text-center py-6">Generating your payment code…</p></div>;
  }

  if (phase === 'error') {
    return (
      <div className={shell}>
        <p className="text-[13px] text-gray-600 dark:text-gray-300 mb-3">Couldn’t start this payment.</p>
        <div className="flex gap-2">
          <button type="button" className={BTN.primary} onClick={create}>Try again</button>
          {onBack && <button type="button" className={BTN.ghost} onClick={onBack}>Back</button>}
        </div>
      </div>
    );
  }

  if (phase === 'success') {
    return (
      <div className={shell}>
        <p className="text-[18px] font-bold text-gray-900 dark:text-white mb-1">You’re on {planLabel(tier.key)}! 🎉</p>
        <p className="text-[13px] text-gray-500 dark:text-gray-400 mb-4">
          Your payment was confirmed and your plan is active.
        </p>
        {onBack && <button type="button" className={BTN.primary} onClick={onBack}>Done</button>}
      </div>
    );
  }

  if (phase === 'cancelled') {
    return (
      <div className={shell}>
        <p className="text-[15px] font-bold text-gray-900 dark:text-white mb-1">This request was cancelled.</p>
        <p className="text-[13px] text-gray-500 dark:text-gray-400 mb-4">No charge was made. You can start a new one.</p>
        <div className="flex gap-2">
          <button type="button" className={BTN.primary} onClick={create}>Start again</button>
          {onBack && <button type="button" className={BTN.ghost} onClick={onBack}>Back</button>}
        </div>
      </div>
    );
  }

  // phase === 'waiting'
  return (
    <div className={shell}>
      <p className="text-[14px] font-bold text-gray-900 dark:text-white">Pay with MoMo QR</p>
      <p className="text-[12px] text-gray-400 mb-4 capitalize">{planLabel(payment.plan)} · {payment.billing_cycle}</p>

      {/* Part 3 — dynamic QR encodes phone + amount + code (no static PNG) */}
      <div className="mb-4">
        <MomoQR amount={payment.amount} paymentCode={payment.code} config={payment} showToast={showToast} />
      </div>

      {payment.instructions && (
        <p className="text-[12px] text-gray-500 dark:text-gray-400 mb-4 leading-relaxed whitespace-pre-line">
          {payment.instructions}
        </p>
      )}

      <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 mb-3">
        <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse shrink-0" />
        <p className="text-[13px] font-medium text-amber-800 dark:text-amber-300">
          Waiting for confirmation… we check every few seconds.
        </p>
      </div>
      <p className="text-[11px] text-gray-400 mb-3 leading-relaxed">
        After you transfer, an admin verifies it and your plan activates automatically —
        keep this open, or come back to it later.
      </p>

      {onBack && <button type="button" className={BTN.ghost} onClick={onBack}>Back</button>}
    </div>
  );
}

// ============================================================================
// SCREEN 2 — Admin approval panel (self-gating on profiles.is_admin)
// ============================================================================
export function AdminManualPayments({ user, showToast }) {
  const [isAdmin, setIsAdmin] = useState(null); // null = still checking
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyCode, setBusyCode] = useState(null);

  useEffect(() => {
    let alive = true;
    supabase.from('profiles').select('is_admin').eq('id', user.id).maybeSingle()
      .then(({ data }) => { if (alive) setIsAdmin(Boolean(data?.is_admin)); });
    return () => { alive = false; };
  }, [user.id]);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc('list_pending_manual_payments');
    if (error) { showToast?.(rpcErrorMessage(error), 'error'); setLoading(false); return; }
    setRows(data || []);
    setLoading(false);
  }, [showToast]);

  useEffect(() => { if (isAdmin) refresh(); }, [isAdmin, refresh]);

  async function confirm(row) {
    setBusyCode(row.code);
    const { error } = await supabase.rpc('approve_manual_payment', { p_code: row.code });
    setBusyCode(null);
    if (error) { showToast?.(rpcErrorMessage(error), 'error'); return; }
    setRows(prev => prev.filter(r => r.code !== row.code));
    showToast?.(`Activated ${planLabel(row.plan)} for ${row.user_email || row.username || 'user'}.`, 'success');
  }

  async function reject(row) {
    const reason = window.prompt('Reason for rejecting (optional):', '');
    if (reason === null) return; // cancelled the prompt
    setBusyCode(row.code);
    const { error } = await supabase.rpc('reject_manual_payment', { p_code: row.code, p_reason: reason || null });
    setBusyCode(null);
    if (error) { showToast?.(rpcErrorMessage(error), 'error'); return; }
    setRows(prev => prev.filter(r => r.code !== row.code));
    showToast?.('Payment request rejected.', 'success');
  }

  if (isAdmin === null || !isAdmin) return null; // hidden entirely for non-admins

  return (
    <div className="bg-white dark:bg-gray-900 p-6 sm:p-8 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-[15px] font-bold text-gray-900 dark:text-white">Pending MoMo Payments</h3>
          <p className="text-[12px] text-gray-400">Verify each transfer in your MoMo app before confirming.</p>
        </div>
        <button type="button" className={BTN.ghost} onClick={refresh} disabled={loading}>
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {loading && rows.length === 0 ? (
        <p className="text-[13px] text-gray-400">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-[13px] text-gray-400">No payments waiting for approval.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-gray-400 border-b border-gray-100 dark:border-gray-800">
                <th className="py-2 pr-3 font-semibold">User</th>
                <th className="py-2 pr-3 font-semibold">Plan</th>
                <th className="py-2 pr-3 font-semibold">Cycle</th>
                <th className="py-2 pr-3 font-semibold">Amount</th>
                <th className="py-2 pr-3 font-semibold">Code</th>
                <th className="py-2 pr-3 font-semibold">Requested</th>
                <th className="py-2 font-semibold" />
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr key={row.id ?? row.code} className="border-b border-gray-50 dark:border-gray-800/50">
                  <td className="py-2.5 pr-3">
                    <div className="text-gray-900 dark:text-gray-100 font-medium truncate max-w-[180px]">{row.user_email || '—'}</div>
                    {row.username && <div className="text-[11px] text-gray-400 truncate max-w-[180px]">{row.username}</div>}
                  </td>
                  <td className="py-2.5 pr-3 text-gray-700 dark:text-gray-300">{planLabel(row.plan)}</td>
                  <td className="py-2.5 pr-3 text-gray-700 dark:text-gray-300 capitalize">{row.billing_cycle}</td>
                  <td className="py-2.5 pr-3 tabular-nums text-gray-900 dark:text-gray-100">{formatVND(row.amount)}</td>
                  <td className="py-2.5 pr-3"><code className="font-mono text-[12px] text-gray-900 dark:text-gray-100">{row.code}</code></td>
                  <td className="py-2.5 pr-3 text-[11px] text-gray-400 whitespace-nowrap">{new Date(row.created_at).toLocaleString()}</td>
                  <td className="py-2.5">
                    <div className="flex items-center gap-1.5 justify-end">
                      <button type="button" className={BTN.primary} disabled={busyCode === row.code} onClick={() => confirm(row)}>
                        {busyCode === row.code ? '…' : 'Confirm'}
                      </button>
                      <button type="button" className={BTN.danger} disabled={busyCode === row.code} onClick={() => reject(row)}>
                        Reject
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// SCREEN 3 (optional but needed here — plan_prices is empty) — owner settings
// for prices and QR/receiver config. Self-gating on profiles.is_admin.
// Writes go through RLS-permitted admin policies; no privileged client logic.
// ============================================================================
const PRICE_ROWS = [
  ['pro', 'monthly'], ['pro', 'annual'],
  ['max', 'monthly'], ['max', 'annual'],
];

const inputCls = 'w-full px-3 py-2 text-[13px] border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-lg focus:outline-none focus:border-gray-400';

// A8 — QR uploader. Stores in the public `qr-images` bucket and persists the
// public URL immediately, so the QR is never lost if the admin forgets to hit
// Save. Path is prefixed with the uid to keep uploads tidy per-owner.
function QrImageUploader({ user, currentUrl, onUploaded, showToast }) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef(null);

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { showToast?.('QR image must be under 5MB.', 'error'); return; }
    setUploading(true);
    const ext = (file.name.split('.').pop() || 'png').toLowerCase();
    const path = `${user.id}/qr-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('qr-images').upload(path, file, { upsert: true, contentType: file.type });
    if (error) { showToast?.(`Upload failed: ${error.message}`, 'error'); setUploading(false); return; }
    const { data: { publicUrl } } = supabase.storage.from('qr-images').getPublicUrl(path);
    // Persist straight away so it survives even without a separate Save click.
    await supabase.from('manual_pay_config').update({ qr_image_url: publicUrl }).eq('id', 1);
    onUploaded(publicUrl);
    setUploading(false);
    showToast?.('QR image uploaded.', 'success');
  }

  return (
    <div>
      {currentUrl && (
        <img src={currentUrl} alt="Current QR code"
          className="w-40 h-40 object-contain rounded-xl border border-gray-200 dark:border-gray-700 bg-white mb-2" />
      )}
      <input ref={inputRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
      <button type="button" onClick={() => inputRef.current?.click()} disabled={uploading}
        className="px-4 py-2 text-[13px] font-semibold rounded-xl text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50">
        {uploading ? 'Uploading…' : currentUrl ? 'Replace QR image' : 'Upload QR image'}
      </button>
    </div>
  );
}

export function ManualPayConfigForm({ user, showToast }) {
  const [isAdmin, setIsAdmin] = useState(null);
  const [prices, setPrices] = useState({}); // "pro:monthly" -> amount_vnd string
  const [config, setConfig] = useState(null);
  const [savingPrices, setSavingPrices] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);

  useEffect(() => {
    let alive = true;
    supabase.from('profiles').select('is_admin').eq('id', user.id).maybeSingle()
      .then(({ data }) => { if (alive) setIsAdmin(Boolean(data?.is_admin)); });
    return () => { alive = false; };
  }, [user.id]);

  useEffect(() => {
    if (!isAdmin) return;
    let alive = true;
    (async () => {
      const [{ data: priceRows }, { data: cfg }] = await Promise.all([
        supabase.from('plan_prices').select('plan, billing_cycle, amount_vnd'),
        supabase.from('manual_pay_config').select('*').eq('id', 1).maybeSingle(),
      ]);
      if (!alive) return;
      const map = {};
      for (const r of priceRows || []) map[`${r.plan}:${r.billing_cycle}`] = String(r.amount_vnd ?? '');
      setPrices(map);
      setConfig(cfg || { id: 1, qr_image_url: '', receiver_name: '', receiver_handle: '', code_prefix: 'SUB', instructions: '' });
    })();
    return () => { alive = false; };
  }, [isAdmin]);

  async function savePrices() {
    setSavingPrices(true);
    const upserts = PRICE_ROWS.map(([plan, cycle]) => ({
      plan, billing_cycle: cycle,
      amount_vnd: Math.round(Number(prices[`${plan}:${cycle}`] || 0)),
    })).filter(r => r.amount_vnd > 0);
    if (!upserts.length) { setSavingPrices(false); showToast?.('Enter at least one price.', 'error'); return; }
    const { error } = await supabase.from('plan_prices').upsert(upserts, { onConflict: 'plan,billing_cycle' });
    setSavingPrices(false);
    if (error) { showToast?.(rpcErrorMessage(error), 'error'); return; }
    showToast?.('Prices saved.', 'success');
  }

  async function saveConfig() {
    setSavingConfig(true);
    const { error } = await supabase.from('manual_pay_config').update({
      qr_image_url: config.qr_image_url || null,
      receiver_name: config.receiver_name || null,
      receiver_handle: config.receiver_handle || null,
      code_prefix: config.code_prefix || 'SUB',
      instructions: config.instructions || null,
    }).eq('id', 1);
    setSavingConfig(false);
    if (error) { showToast?.(rpcErrorMessage(error), 'error'); return; }
    showToast?.('Payment config saved.', 'success');
  }

  if (isAdmin === null || !isAdmin || !config) return null;

  const setCfg = (k) => (e) => setConfig(c => ({ ...c, [k]: e.target.value }));

  return (
    <div className="bg-white dark:bg-gray-900 p-6 sm:p-8 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm space-y-5">
      <h2 className="text-[15px] font-bold text-gray-900 dark:text-white">Manual Payment Settings</h2>
      <div>
        <h3 className="text-[15px] font-bold text-gray-900 dark:text-white mb-1">Plan Prices (VND)</h3>
        <p className="text-[12px] text-gray-400 mb-3">The amount charged for each manual-QR payment. The server reads these — never the browser.</p>
        <div className="grid grid-cols-2 gap-3 max-w-md">
          {PRICE_ROWS.map(([plan, cycle]) => (
            <label key={`${plan}:${cycle}`} className="block">
              <span className="block text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-1">{planLabel(plan)} · {cycle}</span>
              <input type="number" min="0" step="1000" inputMode="numeric"
                value={prices[`${plan}:${cycle}`] || ''}
                onChange={e => setPrices(p => ({ ...p, [`${plan}:${cycle}`]: e.target.value }))}
                placeholder="e.g. 50000" className={inputCls} />
            </label>
          ))}
        </div>
        <button type="button" className={`${BTN.primary} mt-3`} onClick={savePrices} disabled={savingPrices}>
          {savingPrices ? 'Saving…' : 'Save prices'}
        </button>
      </div>

      <div className="pt-5 border-t border-gray-100 dark:border-gray-800">
        <h3 className="text-[15px] font-bold text-gray-900 dark:text-white mb-1">QR &amp; Receiver</h3>
        <p className="text-[12px] text-gray-400 mb-3">Shown on the payer’s checkout screen.</p>
        <div className="space-y-3 max-w-lg">
          {/* A8 — real file upload to the public qr-images bucket (the old
              text field held an unusable local file path). */}
          <div>
            <span className="block text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-1">QR image</span>
            <QrImageUploader
              user={user}
              currentUrl={config.qr_image_url}
              showToast={showToast}
              onUploaded={url => setConfig(c => ({ ...c, qr_image_url: url }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="block text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-1">Receiver name</span>
              <input value={config.receiver_name || ''} onChange={setCfg('receiver_name')} className={inputCls} />
            </label>
            <label className="block">
              <span className="block text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-1">MoMo phone number</span>
              <input value={config.receiver_handle || ''} onChange={setCfg('receiver_handle')} placeholder="0901234567" className={inputCls} />
              <span className="block text-[10px] text-gray-400 mt-1">Required for the dynamic QR — the number users transfer to.</span>
            </label>
          </div>
          <label className="block max-w-[160px]">
            <span className="block text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-1">Code prefix</span>
            <input value={config.code_prefix || ''} onChange={setCfg('code_prefix')} placeholder="SUB" className={inputCls} />
          </label>
          <label className="block">
            <span className="block text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-1">Instructions</span>
            <textarea rows={2} value={config.instructions || ''} onChange={setCfg('instructions')}
              placeholder="Any extra guidance shown under the QR…" className={inputCls} />
          </label>
        </div>
        <button type="button" className={`${BTN.primary} mt-3`} onClick={saveConfig} disabled={savingConfig}>
          {savingConfig ? 'Saving…' : 'Save config'}
        </button>
      </div>
    </div>
  );
}

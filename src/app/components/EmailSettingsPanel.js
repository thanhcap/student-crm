'use client';
// ============================================================================
// BIG UPDATE V4 §1/§5 — EMAIL SETTINGS TAB
// Everything about *how* the automation sends, in one full-screen tab:
// Gmail connection (connect / sync / disconnect), auto-send master switch,
// daily caps, send window + days, sender identity fallback (Resend), and the
// unsubscribe list (moved here from its old standalone tab).
// All persistence goes through the app's existing handleSaveEmailSettings
// upsert — this component is pure interface.
// ============================================================================
import { useState } from 'react';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// AUTO-SEND 2.1 — friendly hour labels + common timezones
function hourLabel(h) {
  return h === 0 ? '12:00 AM' : h < 12 ? `${h}:00 AM` : h === 12 ? '12:00 PM' : `${h - 12}:00 PM`;
}
const TIMEZONES = [
  { label: 'Pacific Time (UTC-8)', offset: -480 },
  { label: 'Mountain Time (UTC-7)', offset: -420 },
  { label: 'Central Time (UTC-6)', offset: -360 },
  { label: 'Eastern Time (UTC-5)', offset: -300 },
  { label: 'UTC', offset: 0 },
  { label: 'Central European (UTC+1)', offset: 60 },
  { label: 'Eastern European (UTC+2)', offset: 120 },
  { label: 'India (UTC+5:30)', offset: 330 },
  { label: 'Vietnam/Indochina (UTC+7)', offset: 420 },
  { label: 'China/Singapore (UTC+8)', offset: 480 },
  { label: 'Japan/Korea (UTC+9)', offset: 540 },
  { label: 'Australia Eastern (UTC+10)', offset: 600 },
];

function Card({ title, desc, children }) {
  return (
    <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-100 dark:border-gray-800">
      <h3 className="text-[14px] font-bold text-gray-900 dark:text-white mb-0.5">{title}</h3>
      {desc && <p className="text-[12px] text-gray-400 mb-4">{desc}</p>}
      {children}
    </div>
  );
}

function SettingsSkeleton() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5" aria-label="Loading settings">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="h-44 rounded-2xl bg-gray-100 dark:bg-gray-800/60 animate-pulse" style={{ animationDelay: `${i * 0.08}s` }} />
      ))}
    </div>
  );
}

export default function EmailSettingsPanel({
  emailSettings, settingsLoaded, onSave,
  gmailConn, gmailSyncing, onConnectGmail, onSyncNow, onDisconnectGmail,
  unsubscribes, onRemoveUnsubscribe,
  showToast,
}) {
  const s = emailSettings || {};
  const [resendFrom, setResendFrom] = useState(s.resend_from_email || '');
  const days = s.send_days || [1, 2, 3, 4, 5];

  if (!settingsLoaded) return <SettingsSkeleton />;

  const toggleDay = (d) => {
    const next = days.includes(d) ? days.filter(x => x !== d) : [...days, d].sort();
    if (!next.length) { showToast('Keep at least one send day.', 'error'); return; }
    onSave({ send_days: next });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 animate-in fade-in duration-200">
      {/* Gmail connection */}
      <Card title="Gmail connection" desc="Campaigns send from your own Gmail — replies land in your real inbox and in the app.">
        {gmailConn && !gmailConn.needs_reauth && !gmailConn.revoked_at ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-[13px]">
              <span className="w-2 h-2 rounded-full bg-green-500" />
              <span className="font-semibold text-gray-900 dark:text-white">{gmailConn.email_address || 'Connected'}</span>
              {gmailConn.last_synced_at && (
                <span className="text-[11px] text-gray-400">synced {new Date(gmailConn.last_synced_at).toLocaleString()}</span>
              )}
            </div>
            <div className="flex gap-2">
              <button onClick={onSyncNow} disabled={gmailSyncing}
                className="px-3 py-1.5 text-[12px] font-semibold text-white bg-gray-900 rounded-lg hover:opacity-90 disabled:opacity-50">
                {gmailSyncing ? 'Syncing…' : 'Sync replies now'}
              </button>
              <button onClick={onDisconnectGmail}
                className="px-3 py-1.5 text-[12px] font-semibold text-red-600 border border-red-200 dark:border-red-900 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30">
                Disconnect
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-[13px] text-amber-700 dark:text-amber-400 font-medium">
              {gmailConn ? 'Connection expired — reconnect to resume auto-sending and reply sync.' : 'Not connected — campaigns can’t auto-send from Gmail yet.'}
            </p>
            <button onClick={onConnectGmail}
              className="px-4 py-2 text-[13px] font-semibold text-white bg-gray-900 rounded-xl hover:opacity-90">
              {gmailConn ? 'Reconnect Gmail' : 'Connect Gmail'}
            </button>
          </div>
        )}
      </Card>

      {/* Auto-send master switch + caps */}
      <Card title="Auto-send" desc="The runner only sends when this is on, inside your window, under your caps.">
        <label className="flex items-center justify-between mb-4 cursor-pointer">
          <span className="text-[13px] font-semibold text-gray-800 dark:text-gray-200">Automatic sending</span>
          <button role="switch" aria-checked={!!s.auto_send_enabled}
            onClick={() => onSave({ auto_send_enabled: !s.auto_send_enabled })}
            className={`w-11 h-6 rounded-full relative transition-colors ${s.auto_send_enabled ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-700'}`}>
            <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${s.auto_send_enabled ? 'left-[22px]' : 'left-0.5'}`} />
          </button>
        </label>
        <div>
          <label className="block text-[11px] font-medium text-gray-500 mb-1">Maximum emails per day</label>
          <div className="flex items-center gap-4">
            <input type="range" min="5" max="200" step="5" value={s.daily_send_cap ?? 50}
              onChange={e => onSave({ daily_send_cap: Number(e.target.value) })}
              className="flex-1" />
            <span className="text-[16px] font-bold text-gray-900 dark:text-white w-12 text-right tabular-nums">{s.daily_send_cap ?? 50}</span>
          </div>
          <p className="text-[11px] text-gray-400 mt-1">Gmail allows ~500/day (regular) or ~2,000/day (Workspace) — stay well under to protect your sender reputation.</p>
        </div>
        <div className="mt-3">
          <label className="block text-[11px] font-medium text-gray-500 mb-1">Daily LinkedIn-task cap</label>
          <input type="number" min={1} max={100} defaultValue={s.linkedin_daily_cap ?? 20}
            onBlur={e => { const v = parseInt(e.target.value, 10); if (v >= 1 && v <= 100 && v !== s.linkedin_daily_cap) onSave({ linkedin_daily_cap: v }); }}
            className="w-28 px-3 py-2 text-[13px] border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-lg focus:outline-none focus:border-gray-400" />
        </div>
      </Card>

      {/* Send window */}
      <Card title="Send window" desc="Emails only go out on these days, between these hours — no 3am cold emails.">
        <div className="flex gap-1.5 mb-4 flex-wrap">
          {DAY_LABELS.map((label, d) => (
            <button key={d} onClick={() => toggleDay(d)}
              className={`w-10 py-1.5 text-[11.5px] font-bold rounded-lg transition-colors ${days.includes(d)
                ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-400'}`}>
              {label}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-medium text-gray-500 mb-1">Start sending at</label>
            <select value={s.send_window_start ?? 9} onChange={e => onSave({ send_window_start: parseInt(e.target.value, 10) })}
              className="w-full px-3 py-2 text-[13px] font-semibold border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-lg focus:outline-none">
              {[...Array(24)].map((_, h) => <option key={h} value={h}>{hourLabel(h)}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-medium text-gray-500 mb-1">Stop sending at</label>
            <select value={s.send_window_end ?? 17} onChange={e => onSave({ send_window_end: parseInt(e.target.value, 10) })}
              className="w-full px-3 py-2 text-[13px] font-semibold border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-lg focus:outline-none">
              {[...Array(24)].map((_, h) => <option key={h} value={h}>{hourLabel(h)}</option>)}
            </select>
          </div>
        </div>
        {/* timezone dropdown + auto-detect */}
        <div className="mt-3">
          <label className="block text-[11px] font-medium text-gray-500 mb-1">Your timezone</label>
          <select value={s.send_tz_offset ?? 0} onChange={e => onSave({ send_tz_offset: Number(e.target.value) })}
            className="w-full px-3 py-2 text-[13px] border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-lg focus:outline-none">
            {!TIMEZONES.some(tz => tz.offset === (s.send_tz_offset ?? 0)) && (
              <option value={s.send_tz_offset ?? 0}>Custom (UTC{(s.send_tz_offset ?? 0) >= 0 ? '+' : ''}{((s.send_tz_offset ?? 0) / 60).toFixed(1).replace('.0', '')})</option>
            )}
            {TIMEZONES.map(tz => <option key={tz.offset} value={tz.offset}>{tz.label}</option>)}
          </select>
          <button onClick={() => onSave({ send_tz_offset: new Date().getTimezoneOffset() * -1 })}
            className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline mt-1">Detect my timezone</button>
        </div>
        {/* plain-English summary of what this schedule means */}
        <div className="mt-4 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-700">
          <p className="text-[12.5px] text-gray-600 dark:text-gray-300">
            {s.auto_send_enabled
              ? `Campaigns send ${(days.length === 7 ? 'every day' : days.map(d => DAY_LABELS[d]).join(', '))}, between ${hourLabel(s.send_window_start ?? 9)} and ${hourLabel(s.send_window_end ?? 17)} your time, up to ${s.daily_send_cap ?? 50} emails per day — without you clicking anything.`
              : 'Automatic sending is off. Campaigns won’t send on their own; due emails wait in the Outbox for manual sending.'}
          </p>
        </div>
      </Card>

      {/* Fallback sender */}
      <Card title="Fallback sender (Resend)" desc="If Gmail isn’t connected, the runner can send via Resend from this address instead.">
        <div className="flex gap-2">
          <input type="email" value={resendFrom} onChange={e => setResendFrom(e.target.value)} placeholder="you@yourdomain.com"
            className="flex-1 px-3 py-2 text-[13px] border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:placeholder-gray-500 rounded-lg focus:outline-none focus:border-gray-400" />
          <button onClick={() => onSave({ resend_from_email: resendFrom.trim() || null })}
            className="px-3.5 py-2 text-[12.5px] font-semibold text-white bg-gray-900 rounded-xl hover:opacity-90">Save</button>
        </div>
        <p className="text-[11px] text-gray-400 mt-2">Requires RESEND_API_KEY configured on the server; otherwise the runner skips gracefully.</p>
      </Card>

      {/* Unsubscribe list — moved from its own tab */}
      <div className="lg:col-span-2">
        <Card title="Unsubscribe list" desc="Every address here is silently skipped by the runner and by every enrollment path — across all campaigns.">
          {(unsubscribes || []).length === 0 ? (
            <p className="text-[13px] text-gray-400 py-2">Nobody has unsubscribed.</p>
          ) : (
            <div className="space-y-1.5 max-h-72 overflow-y-auto">
              {unsubscribes.map(u => (
                <div key={u.id} className="flex items-center gap-3 px-3 py-2 border border-gray-100 dark:border-gray-800 rounded-xl text-[13px]">
                  <span className="font-medium text-gray-900 dark:text-gray-100 truncate">{u.email}</span>
                  <span className="text-[11px] text-gray-400 shrink-0">
                    {u.reason === 'link_click' ? 'via unsubscribe link' : u.reason === 'reply' ? 'via reply' : 'manual'} · {new Date(u.created_at).toLocaleDateString()}
                  </span>
                  <button onClick={() => onRemoveUnsubscribe(u)} className="ml-auto text-[11px] font-semibold text-gray-400 hover:text-red-600 shrink-0">Remove</button>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

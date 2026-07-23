'use client';
// ============================================================================
// DEEP UPDATE v1 — FEATURE 2: EMAIL COMMAND CENTER
// Two sub-views inside Email Automation:
//   INBOX     — three-pane reply inbox (filter rail → thread list → reading
//               pane) fed by email_inbox, with an in-app reply composer,
//               :shortcut snippets, classification overrides, and per-reply
//               actions (convert, stop sequence, log meeting).
//   ANALYTICS — cross-campaign dashboard: KPI trends, reply-rate line chart,
//               send-time heatmap, per-sequence table, subject leaderboard,
//               funnel, classification donut, hours saved. All pure SVG.
// ============================================================================
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';

// ---------------------------------------------------------------------------
// 2.5 — Deterministic reply classifier (an AI upgrade can slot in on top:
// anything returning 'unclassified' is a candidate for the ai-summary route)
// ---------------------------------------------------------------------------
export function classifyReply(subject, body) {
  const t = `${subject || ''} ${body || ''}`.toLowerCase();
  if (/out of office|on leave|annual leave|vacation|away from|auto.?reply|automatic reply/.test(t)) return 'out_of_office';
  if (/unsubscribe|remove me|stop emailing|opt out/.test(t)) return 'not_interested';
  if (/not interested|no thanks|not a fit|not right now|\bpass\b/.test(t)) return 'not_interested';
  if (/introduce you|reach out to|you should talk to|connect you with|forward(ing)? this/.test(t)) return 'referral';
  if (/\byes\b|interested|love to|happy to|sounds good|let'?s (chat|talk|meet)|\bbook\b|calendar|available/.test(t)) return 'interested';
  if (/\?\s*$|how much|what (is|are)|could you|can you|\bwhen\b|\bwhere\b|\bwhy\b|clarify/.test(t)) return 'question';
  return 'unclassified';
}

const CLASSIFICATIONS = {
  interested:     { label: 'Interested',     chip: 'bg-green-100 text-green-800 dark:bg-green-950/50 dark:text-green-300', dot: '#10B981' },
  question:       { label: 'Question',       chip: 'bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300', dot: '#3B82F6' },
  referral:       { label: 'Referral',       chip: 'bg-violet-100 text-violet-800 dark:bg-violet-950/50 dark:text-violet-300', dot: '#8B5CF6' },
  out_of_office:  { label: 'Out of office',  chip: 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300', dot: '#F59E0B' },
  not_interested: { label: 'Not interested', chip: 'bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300', dot: '#EF4444' },
  unclassified:   { label: 'Unclassified',   chip: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300', dot: '#9CA3AF' },
};

const STARTER_SNIPPETS = [
  { shortcut: ':thanks', body: 'Thanks so much for getting back to me, {{first_name}} — really appreciate you taking the time.' },
  { shortcut: ':booking', body: 'Great! Here are a few times that work on my end this week — happy to work around your schedule too. Looking forward to it, {{first_name}}!' },
  { shortcut: ':notnow', body: 'Completely understand — timing is everything. I\'ll check back in a few months. In the meantime, wishing you all the best with everything on your plate.' },
  { shortcut: ':intro', body: 'Thank you for offering to make an introduction! Here\'s a short blurb you can forward: {{my_bio}}' },
];

const PAGE_SIZE = 40;

function relTime(ts) {
  if (!ts) return '';
  const mins = Math.floor((Date.now() - new Date(ts).getTime()) / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d`;
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function initialsOf(name) {
  return (name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('') || '?';
}

const AVATAR_BG = ['#6366F1', '#10B981', '#F59E0B', '#EF4444', '#06B6D4', '#8B5CF6', '#EC4899', '#14B8A6'];
function avatarColor(seed) {
  let h = 0;
  const s = String(seed || '');
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return AVATAR_BG[h % AVATAR_BG.length];
}

function pct(num, den) { return den > 0 ? (num / den) * 100 : 0; }
function fmtPct(v) { return `${v.toFixed(v >= 10 ? 0 : 1)}%`; }
function dayKey(ts) { return ts ? new Date(ts).toISOString().split('T')[0] : null; }

// ---------------------------------------------------------------------------
// 2.7 — Daily analytics rollup (client-side; also safe to run repeatedly).
// Computes per-sequence per-day counts from sequence_sends and upserts them
// into sequence_analytics_daily so trend charts read a small table.
// ---------------------------------------------------------------------------
export async function rollupSequenceAnalytics(userId, sends) {
  const buckets = new Map(); // `${seqId}|${day}` -> counts
  for (const s of sends) {
    if (!s.sequence_id || !s.sent_at) continue;
    const day = dayKey(s.sent_at);
    const key = `${s.sequence_id}|${day}`;
    const b = buckets.get(key) || { sequence_id: s.sequence_id, day, sent: 0, opened: 0, clicked: 0, replied: 0, bounced: 0, unsubscribed: 0 };
    b.sent++;
    if (s.opened_at) b.opened++;
    if (s.clicked_at) b.clicked++;
    if (s.replied_at) b.replied++;
    if (s.bounced_at) b.bounced++;
    if (s.unsubscribed_at) b.unsubscribed++;
    buckets.set(key, b);
  }
  const rows = [...buckets.values()].map(b => ({ ...b, user_id: userId }));
  if (!rows.length) return { rows: [], error: null };
  // chunk the upsert so a big history doesn't hit payload limits
  for (let i = 0; i < rows.length; i += 200) {
    const { error } = await supabase.from('sequence_analytics_daily')
      .upsert(rows.slice(i, i + 200), { onConflict: 'sequence_id,day' });
    if (error) return { rows, error };
  }
  return { rows, error: null };
}

// ===========================================================================
// Pure-SVG chart primitives (no library)
// ===========================================================================
function Sparkline({ values, color = '#6366F1', width = 96, height = 28 }) {
  if (!values.length) return <svg width={width} height={height} aria-hidden />;
  const max = Math.max(...values, 1);
  const pts = values.map((v, i) => `${(i / Math.max(values.length - 1, 1)) * width},${height - 2 - (v / max) * (height - 6)}`);
  return (
    <svg width={width} height={height} aria-hidden className="overflow-visible">
      <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" opacity="0.9" />
    </svg>
  );
}

function TrendArrow({ change }) {
  if (change === null) return <span className="text-[11px] text-gray-400">—</span>;
  const up = change >= 0;
  return (
    <span className={`text-[11px] font-bold ${up ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
      {up ? '▲' : '▼'} {Math.abs(change).toFixed(0)}%
    </span>
  );
}

// 30-day line chart with axis, gridlines, and hover tooltips
function LineChart({ series, height = 220, yLabel = '%' }) {
  const [hover, setHover] = useState(null);
  const width = 640;
  const padL = 42, padR = 12, padT = 14, padB = 26;
  const innerW = width - padL - padR, innerH = height - padT - padB;
  const maxY = Math.max(...series.map(p => p.value), 5);
  const x = i => padL + (i / Math.max(series.length - 1, 1)) * innerW;
  const y = v => padT + innerH - (v / maxY) * innerH;
  if (!series.length) return null;
  const path = series.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(p.value)}`).join('');
  const area = `${path}L${x(series.length - 1)},${padT + innerH}L${x(0)},${padT + innerH}Z`;
  const gridVals = [0, 0.25, 0.5, 0.75, 1].map(f => maxY * f);
  return (
    <div className="relative overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full min-w-[480px]" role="img" aria-label="Reply rate over time"
        onMouseLeave={() => setHover(null)}
        onMouseMove={e => {
          const rect = e.currentTarget.getBoundingClientRect();
          const px = ((e.clientX - rect.left) / rect.width) * width;
          const i = Math.round(((px - padL) / innerW) * (series.length - 1));
          setHover(i >= 0 && i < series.length ? i : null);
        }}>
        {gridVals.map((v, i) => (
          <g key={i}>
            <line x1={padL} y1={y(v)} x2={width - padR} y2={y(v)} className="stroke-gray-100 dark:stroke-gray-800" strokeWidth="1" />
            <text x={padL - 6} y={y(v) + 3.5} textAnchor="end" fontSize="10" className="fill-gray-400">{v.toFixed(0)}{yLabel}</text>
          </g>
        ))}
        <path d={area} fill="url(#lc-grad)" opacity="0.5" />
        <defs>
          <linearGradient id="lc-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6366F1" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#6366F1" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={path} fill="none" stroke="#6366F1" strokeWidth="2" strokeLinejoin="round" />
        {series.map((p, i) => (i % Math.ceil(series.length / 6) === 0 || i === series.length - 1) && (
          <text key={i} x={x(i)} y={height - 8} textAnchor="middle" fontSize="10" className="fill-gray-400">
            {new Date(p.day).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
          </text>
        ))}
        {hover != null && (
          <g>
            <line x1={x(hover)} y1={padT} x2={x(hover)} y2={padT + innerH} stroke="#6366F1" strokeWidth="1" strokeDasharray="3 3" opacity="0.6" />
            <circle cx={x(hover)} cy={y(series[hover].value)} r="4" fill="#6366F1" />
          </g>
        )}
      </svg>
      {hover != null && (
        <div className="absolute top-1 left-1/2 -translate-x-1/2 px-2.5 py-1 rounded-lg bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-[11px] font-semibold pointer-events-none whitespace-nowrap">
          {new Date(series[hover].day).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })} — {series[hover].value.toFixed(1)}{yLabel}
          {series[hover].detail ? ` (${series[hover].detail})` : ''}
        </div>
      )}
    </div>
  );
}

// 7×24 best-send-time heatmap
function SendTimeHeatmap({ cells, best }) {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const maxRate = Math.max(...cells.flat().map(c => c.rate), 0.01);
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[560px]">
        <div className="grid" style={{ gridTemplateColumns: '36px repeat(24, 1fr)', gap: 2 }}>
          <span />
          {[...Array(24)].map((_, h) => (
            <span key={h} className="text-[8.5px] text-gray-400 text-center">{h % 4 === 0 ? `${h}h` : ''}</span>
          ))}
          {cells.map((row, d) => (
            <div key={d} className="contents">
              <span className="text-[10px] text-gray-500 font-medium leading-[14px]">{days[d]}</span>
              {row.map((c, h) => {
                const intensity = c.sent > 0 ? c.rate / maxRate : 0;
                const isBest = best && best.day === d && best.hour === h;
                return (
                  <div key={h}
                    title={c.sent > 0 ? `${days[d]} ${h}:00 — ${c.replied}/${c.sent} replied (${fmtPct(c.rate * 100)})` : `${days[d]} ${h}:00 — no sends`}
                    className={`h-3.5 rounded-[3px] ${isBest ? 'ring-2 ring-amber-500' : ''}`}
                    style={{ background: c.sent === 0 ? 'rgba(156,163,175,0.12)' : `rgba(99,102,241,${0.15 + intensity * 0.85})` }} />
                );
              })}
            </div>
          ))}
        </div>
        {best && (
          <p className="text-[12px] text-gray-500 mt-2">
            Best send time so far: <span className="font-bold text-gray-800 dark:text-gray-200">{days[best.day]} {best.hour}:00</span> — {fmtPct(best.rate * 100)} reply rate ({best.sent} sends).
          </p>
        )}
      </div>
    </div>
  );
}

function Funnel({ stages }) {
  const max = Math.max(stages[0]?.value || 0, 1);
  return (
    <div className="space-y-1.5">
      {stages.map((s, i) => {
        const w = Math.max((s.value / max) * 100, s.value > 0 ? 4 : 0);
        const prev = i > 0 ? stages[i - 1].value : null;
        const dropoff = prev > 0 ? (1 - s.value / prev) * 100 : null;
        return (
          <div key={s.label}>
            {i > 0 && dropoff != null && (
              <p className="text-[10px] text-gray-400 pl-1 pb-0.5">↓ {dropoff.toFixed(0)}% drop-off</p>
            )}
            <div className="flex items-center gap-3">
              <span className="w-20 shrink-0 text-[12px] font-medium text-gray-600 dark:text-gray-300">{s.label}</span>
              <div className="flex-1 h-7 bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden">
                <div className="h-full rounded-lg flex items-center px-2 transition-all duration-500"
                  style={{ width: `${w}%`, background: s.color }}>
                  {w > 12 && <span className="text-[11px] font-bold text-white">{s.value.toLocaleString()}</span>}
                </div>
              </div>
              {w <= 12 && <span className="text-[11px] font-bold text-gray-600 dark:text-gray-300 w-10">{s.value.toLocaleString()}</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Donut({ slices, size = 150 }) {
  const total = slices.reduce((s, x) => s + x.value, 0);
  if (!total) return null;
  const r = size / 2 - 10, cx = size / 2, cy = size / 2;
  let acc = 0;
  const arcs = slices.filter(s => s.value > 0).map(s => {
    const a0 = (acc / total) * Math.PI * 2 - Math.PI / 2;
    acc += s.value;
    const a1 = (acc / total) * Math.PI * 2 - Math.PI / 2;
    const large = a1 - a0 > Math.PI ? 1 : 0;
    const x0 = cx + Math.cos(a0) * r, y0 = cy + Math.sin(a0) * r;
    const x1 = cx + Math.cos(a1) * r, y1 = cy + Math.sin(a1) * r;
    // full circle edge case
    const d = s.value === total
      ? `M${cx},${cy - r}A${r},${r} 0 1 1 ${cx - 0.01},${cy - r}`
      : `M${x0},${y0}A${r},${r} 0 ${large} 1 ${x1},${y1}`;
    return { ...s, d };
  });
  return (
    <div className="flex items-center gap-5 flex-wrap">
      <svg width={size} height={size} role="img" aria-label="Reply classification breakdown">
        {arcs.map(a => (
          <path key={a.label} d={a.d} fill="none" stroke={a.color} strokeWidth="17" strokeLinecap="butt">
            <title>{a.label}: {a.value}</title>
          </path>
        ))}
        <text x={cx} y={cy - 3} textAnchor="middle" fontSize="20" fontWeight="800" className="fill-gray-900 dark:fill-gray-100">{total}</text>
        <text x={cx} y={cy + 14} textAnchor="middle" fontSize="9.5" className="fill-gray-400">replies</text>
      </svg>
      <div className="space-y-1">
        {slices.filter(s => s.value > 0).map(s => (
          <div key={s.label} className="flex items-center gap-2 text-[12px] text-gray-600 dark:text-gray-300">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: s.color }} />
            {s.label} — <span className="font-bold">{s.value}</span> ({fmtPct(pct(s.value, total))})
          </div>
        ))}
      </div>
    </div>
  );
}

function MiniBar({ value, max, color = '#6366F1' }) {
  return (
    <div className="w-16 h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden inline-block align-middle">
      <div className="h-full rounded-full" style={{ width: `${Math.min(pct(value, max || 1), 100)}%`, background: color }} />
    </div>
  );
}

function SkeletonRows({ n = 6 }) {
  return (
    <div className="space-y-2 p-3" aria-label="Loading">
      {[...Array(n)].map((_, i) => (
        <div key={i} className="flex items-center gap-3 animate-pulse" style={{ animationDelay: `${i * 0.08}s` }}>
          <span className="w-9 h-9 rounded-full bg-gray-200 dark:bg-gray-800 shrink-0" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3 bg-gray-200 dark:bg-gray-800 rounded w-2/5" />
            <div className="h-2.5 bg-gray-100 dark:bg-gray-800/70 rounded w-4/5" />
          </div>
        </div>
      ))}
    </div>
  );
}

function SkeletonCards({ n = 6 }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {[...Array(n)].map((_, i) => (
        <div key={i} className="h-24 rounded-2xl bg-gray-100 dark:bg-gray-800/60 animate-pulse" style={{ animationDelay: `${i * 0.08}s` }} />
      ))}
    </div>
  );
}

// ===========================================================================
// MAIN COMPONENT
// ===========================================================================
export default function EmailCommandCenter({
  tab, // 'inbox' | 'analytics'
  user, clients, coldContacts, activities,
  sequences, sequenceSteps, sequenceSends, sequenceEnrollments,
  gmailConn, gmailSyncing, onSyncNow,
  profile, resolveMergeTags, buildComposeUrl,
  showToast, onOpenClient, onConvertCold, onLogOutbound, onStopEnrollment,
  onGoToBuilder,
}) {
  // ---- inbox data -----------------------------------------------------------
  const [inboxMeta, setInboxMeta] = useState(null); // all rows, light columns (no body_full)
  const [inboxError, setInboxError] = useState(null);
  const [bodies, setBodies] = useState({}); // id -> body_full
  const [selectedId, setSelectedId] = useState(null);
  const [filter, setFilter] = useState('all'); // all|unread|starred|needs_reply|<classification>|seq:<id>
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [snippets, setSnippets] = useState(null);
  const [showSnippetManager, setShowSnippetManager] = useState(false);

  // reply composer
  const [replyBody, setReplyBody] = useState('');
  const [replySubject, setReplySubject] = useState('');
  const [snippetPickerOpen, setSnippetPickerOpen] = useState(false);
  const replyRef = useRef(null);
  const [sendingReply, setSendingReply] = useState(false); // Part 3.3
  const [replyResetKey, setReplyResetKey] = useState(0);   // remounts the rich editor after send

  const seededRef = useRef(false);

  const loadInbox = useCallback(async () => {
    setInboxError(null);
    const { data, error } = await supabase.from('email_inbox')
      .select('id, client_id, cold_contact_id, sequence_id, send_id, gmail_message_id, gmail_thread_id, from_email, from_name, subject, body_preview, classification, is_read, is_starred, received_at')
      .order('received_at', { ascending: false, nullsFirst: false })
      .limit(2000);
    if (error) { setInboxError(error.message); setInboxMeta([]); return; }
    setInboxMeta(data || []);
  }, []);

  useEffect(() => { if (user?.id) loadInbox(); }, [user?.id, loadInbox]);

  // 2.8 — snippets, seeded with 4 starters on first use
  useEffect(() => {
    if (!user?.id) return;
    let live = true;
    (async () => {
      const { data, error } = await supabase.from('reply_snippets').select('*').order('shortcut');
      if (!live) return;
      if (error) { setSnippets([]); return; }
      if ((data || []).length === 0 && !seededRef.current) {
        seededRef.current = true;
        const seed = STARTER_SNIPPETS.map(s => ({ ...s, user_id: user.id }));
        const { data: inserted } = await supabase.from('reply_snippets')
          .upsert(seed, { onConflict: 'user_id,shortcut', ignoreDuplicates: true }).select();
        if (live) setSnippets(inserted || seed);
      } else {
        setSnippets(data || []);
      }
    })();
    return () => { live = false; };
  }, [user?.id]);

  // ---- lookups ---------------------------------------------------------------
  const clientById = useMemo(() => new Map(clients.map(c => [c.id, c])), [clients]);
  const coldById = useMemo(() => new Map((coldContacts || []).map(c => [c.id, c])), [coldContacts]);
  const seqById = useMemo(() => new Map(sequences.map(s => [s.id, s])), [sequences]);
  const stepById = useMemo(() => new Map(sequenceSteps.map(s => [s.id, s])), [sequenceSteps]);
  const sendById = useMemo(() => new Map(sequenceSends.map(s => [s.id, s])), [sequenceSends]);

  function contactOf(row) {
    if (row.client_id) return { kind: 'client', contact: clientById.get(row.client_id) };
    if (row.cold_contact_id) return { kind: 'cold', contact: coldById.get(row.cold_contact_id) };
    return { kind: 'unknown', contact: null };
  }

  function displayName(row) {
    const { contact, kind } = contactOf(row);
    if (kind === 'client' && contact) return contact.name;
    if (kind === 'cold' && contact) return `${contact.first_name || ''} ${contact.last_name || ''}`.trim() || contact.email;
    return row.from_name || row.from_email || 'Unknown sender';
  }

  // "Needs reply": inbound with no outbound Email activity logged after it
  const needsReply = useCallback((row) => {
    const cls = row.classification;
    if (cls === 'out_of_office' || cls === 'not_interested') return false;
    if (!row.client_id) return !row.is_read; // cold contacts: unread ≈ needs attention
    const after = (activities || []).some(a =>
      a.client_id === row.client_id && a.activity_type === 'Email' &&
      a.created_at && row.received_at && new Date(a.created_at) > new Date(row.received_at) &&
      /^(Drafted|Replied|Gmail — Sent)/.test(a.description || ''));
    return !after;
  }, [activities]);

  // ---- filters + counts --------------------------------------------------------
  const filterDefs = useMemo(() => {
    const rows = inboxMeta || [];
    const defs = [
      { key: 'all', label: 'All', count: rows.length },
      { key: 'unread', label: 'Unread', count: rows.filter(r => !r.is_read).length },
      { key: 'needs_reply', label: 'Needs reply', count: rows.filter(needsReply).length },
      { key: 'starred', label: 'Starred', count: rows.filter(r => r.is_starred).length },
      ...Object.entries(CLASSIFICATIONS).filter(([k]) => k !== 'unclassified').map(([k, v]) => ({
        key: k, label: v.label, count: rows.filter(r => r.classification === k).length, dot: v.dot,
      })),
    ];
    const seqIds = [...new Set(rows.map(r => r.sequence_id).filter(Boolean))];
    const bySeq = seqIds.map(id => ({
      key: `seq:${id}`, label: seqById.get(id)?.name || 'Unknown campaign',
      count: rows.filter(r => r.sequence_id === id).length, isCampaign: true,
    }));
    return { defs, bySeq };
  }, [inboxMeta, needsReply, seqById]);

  const filteredRows = useMemo(() => {
    const rows = inboxMeta || [];
    if (filter === 'all') return rows;
    if (filter === 'unread') return rows.filter(r => !r.is_read);
    if (filter === 'starred') return rows.filter(r => r.is_starred);
    if (filter === 'needs_reply') return rows.filter(needsReply);
    if (filter.startsWith('seq:')) return rows.filter(r => String(r.sequence_id) === filter.slice(4));
    return rows.filter(r => r.classification === filter);
  }, [inboxMeta, filter, needsReply]);

  const visibleRows = filteredRows.slice(0, visibleCount);
  const selected = (inboxMeta || []).find(r => r.id === selectedId) || null;

  // ---- row actions ----------------------------------------------------------------
  async function openMessage(row) {
    setSelectedId(row.id);
    setReplyBody('');
    setReplySubject(row.subject?.startsWith('Re:') ? row.subject : `Re: ${row.subject || ''}`);
    if (!row.is_read) {
      setInboxMeta(prev => prev.map(r => r.id === row.id ? { ...r, is_read: true } : r));
      const { error } = await supabase.from('email_inbox').update({ is_read: true }).eq('id', row.id);
      if (error) setInboxMeta(prev => prev.map(r => r.id === row.id ? { ...r, is_read: false } : r));
    }
    if (!(row.id in bodies)) {
      const { data } = await supabase.from('email_inbox').select('body_full').eq('id', row.id).maybeSingle();
      setBodies(prev => ({ ...prev, [row.id]: data?.body_full || '' }));
    }
  }

  async function toggleStar(row, e) {
    e?.stopPropagation();
    const next = !row.is_starred;
    setInboxMeta(prev => prev.map(r => r.id === row.id ? { ...r, is_starred: next } : r));
    const { error } = await supabase.from('email_inbox').update({ is_starred: next }).eq('id', row.id);
    if (error) {
      setInboxMeta(prev => prev.map(r => r.id === row.id ? { ...r, is_starred: !next } : r));
      showToast(error.message, 'error');
    }
  }

  async function overrideClassification(row, cls) {
    const old = row.classification;
    setInboxMeta(prev => prev.map(r => r.id === row.id ? { ...r, classification: cls } : r));
    const { error } = await supabase.from('email_inbox').update({ classification: cls }).eq('id', row.id);
    if (error) {
      setInboxMeta(prev => prev.map(r => r.id === row.id ? { ...r, classification: old } : r));
      showToast(error.message, 'error');
    } else {
      showToast(`Classified as ${CLASSIFICATIONS[cls]?.label || cls}.`);
    }
  }

  function activeEnrollmentFor(row) {
    return sequenceEnrollments.find(en => en.status === 'active' &&
      ((row.client_id && en.client_id === row.client_id) || (row.cold_contact_id && en.cold_contact_id === row.cold_contact_id)));
  }

  async function stopSequenceFor(row) {
    const en = activeEnrollmentFor(row);
    if (!en) { showToast('No active sequence for this contact.'); return; }
    await onStopEnrollment(en);
    showToast(`Stopped "${seqById.get(en.sequence_id)?.name || 'sequence'}" for ${displayName(row)}.`, 'success');
  }

  async function logMeetingBooked(row) {
    if (!row.client_id) { showToast('Convert them to a relationship first, then log the meeting.', 'error'); return; }
    await onLogOutbound(row.client_id, `Meeting booked — from reply: ${row.subject || '(no subject)'}`, 'Meeting');
    showToast('Meeting logged.', 'success');
  }

  // ---- 2.3 reply composer -----------------------------------------------------------
  const mergeContact = selected ? contactOf(selected).contact : null;

  function expandSnippets(text) {
    // typing ":shortcut" then space/enter expands it in place
    if (!snippets?.length) return text;
    return text.replace(/(^|\s)(:[a-z0-9_-]+)([\s]$)/i, (m, pre, code, post) => {
      const sn = snippets.find(s => s.shortcut.toLowerCase() === code.toLowerCase());
      if (!sn) return m;
      return `${pre}${resolveMergeTags(sn.body, mergeContact)}${post}`;
    });
  }

  function onReplyChange(e) {
    const v = e.target.value;
    const expanded = expandSnippets(v);
    if (expanded !== v) showToast('Snippet expanded.');
    setReplyBody(expanded);
  }

  function insertSnippet(sn) {
    setReplyBody(prev => `${prev}${prev && !prev.endsWith('\n') ? '\n' : ''}${resolveMergeTags(sn.body, mergeContact)}`);
    setSnippetPickerOpen(false);
    replyRef.current?.focus();
  }

  async function saveDraftAsSnippet() {
    if (!replyBody.trim()) { showToast('Write the reply first, then save it as a snippet.', 'error'); return; }
    const shortcut = window.prompt('Shortcut for this snippet (e.g. :followup):', ':');
    if (!shortcut || shortcut === ':') return;
    const clean = shortcut.startsWith(':') ? shortcut : `:${shortcut}`;
    const { data, error } = await supabase.from('reply_snippets')
      .upsert([{ user_id: user.id, shortcut: clean.toLowerCase(), body: replyBody }], { onConflict: 'user_id,shortcut' }).select();
    if (error) showToast(error.message, 'error');
    else {
      setSnippets(prev => [...(prev || []).filter(s => s.shortcut !== clean.toLowerCase()), data[0]].sort((a, b) => a.shortcut.localeCompare(b.shortcut)));
      showToast(`Snippet ${clean} saved.`, 'success');
    }
  }

  // Part 3.3 — send the reply through the real Gmail API (gmail-send-reply),
  // threaded onto the original conversation. Campaign sends keep the compose-tab
  // pattern; only replies send directly. Falls back to a compose tab if Gmail
  // isn't connected, so the user is never dead-ended.
  async function sendReplyViaApi(htmlBody) {
    if (!selected) return;
    const plain = String(htmlBody || '').replace(/<[^>]+>/g, ' ').trim();
    if (!plain) return;
    const to = selected.from_email || contactOf(selected).contact?.email;
    if (!to) { showToast('No email address for this sender.', 'error'); return; }
    const resolvedHtml = resolveMergeTags(String(htmlBody), mergeContact);
    const subject = resolveMergeTags(replySubject, mergeContact);
    setSendingReply(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/gmail-send-reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token || ''}` },
        body: JSON.stringify({ inboxId: selected.id, htmlBody: resolvedHtml, subjectOverride: subject }),
      }).catch(() => null);
      const result = res ? await res.json().catch(() => ({})) : {};
      if (!res || !res.ok) {
        if (result.error === 'gmail_not_connected' || result.needs_reauth) {
          showToast('Gmail isn’t connected — opening a compose tab instead.', 'error');
          const url = buildComposeUrl({ to, subject, body: resolveMergeTags(plain, mergeContact), from: gmailConn?.email_address });
          window.open(url, '_blank', 'noopener,noreferrer');
          return;
        }
        showToast(`Send failed: ${result.error || res?.status || 'network error'}`, 'error');
        return;
      }
      // the edge function already logged the outbound activity + marked read
      setInboxMeta(prev => prev.map(m => m.id === selected.id ? { ...m, is_read: true } : m));
      setReplyBody('');
      setReplyResetKey(k => k + 1);
      showToast('Reply sent from your Gmail.', 'success');
    } finally {
      setSendingReply(false);
    }
  }

  // which campaign/step was this a reply to?
  function replyContext(row) {
    if (!row) return null;
    const send = row.send_id ? sendById.get(row.send_id) : null;
    const step = send?.step_id ? stepById.get(send.step_id) : null;
    const seq = row.sequence_id ? seqById.get(row.sequence_id) : (send ? seqById.get(send.sequence_id) : null);
    if (!seq && !step) return null;
    return { seq, step, send };
  }

  // ===========================================================================
  // ANALYTICS — derived data
  // ===========================================================================
  const [dailyRows, setDailyRows] = useState(null);
  const rollupDone = useRef(false);

  useEffect(() => {
    if (tab !== 'analytics' || !user?.id) return;
    let live = true;
    (async () => {
      // 2.7 — rollup (idempotent upsert) once per session, then read the table
      if (!rollupDone.current && sequenceSends.length) {
        rollupDone.current = true;
        const { error } = await rollupSequenceAnalytics(user.id, sequenceSends);
        if (error) showToast(`Analytics rollup failed: ${error.message}`, 'error');
      }
      const since = new Date(Date.now() - 35 * 864e5).toISOString().split('T')[0];
      const { data, error } = await supabase.from('sequence_analytics_daily')
        .select('*').gte('day', since).order('day');
      if (!live) return;
      if (error) { setDailyRows([]); showToast(error.message, 'error'); return; }
      setDailyRows(data || []);
    })();
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, user?.id, sequenceSends.length]);

  const analytics = useMemo(() => {
    const sends = sequenceSends.filter(s => s.sent_at);
    const now = Date.now();
    const d30 = now - 30 * 864e5, d60 = now - 60 * 864e5;
    const inWindow = (s, from, to) => { const t = new Date(s.sent_at).getTime(); return t >= from && t < to; };
    const cur = sends.filter(s => inWindow(s, d30, now));
    const prev = sends.filter(s => inWindow(s, d60, d30));

    const rate = (arr, field) => pct(arr.filter(s => s[field]).length, arr.length);
    const change = (a, b) => (b === 0 ? (a > 0 ? 100 : null) : ((a - b) / b) * 100);

    const meetingsCur = (activities || []).filter(a => a.activity_type === 'Meeting' && a.created_at && new Date(a.created_at).getTime() >= d30).length;
    const meetingsPrev = (activities || []).filter(a => a.activity_type === 'Meeting' && a.created_at && inWindow({ sent_at: a.created_at }, d60, d30)).length;

    // daily spark data (last 30 days) per metric
    const days = [...Array(30)].map((_, i) => dayKey(new Date(d30 + (i + 1) * 864e5)));
    const spark = (fn) => days.map(day => cur.filter(s => dayKey(s.sent_at) === day && fn(s)).length);

    const kpis = [
      { label: 'Sent', value: cur.length, prev: prev.length, fmt: v => v.toLocaleString(), spark: spark(() => true), color: '#6366F1' },
      { label: 'Open rate', value: rate(cur, 'opened_at'), prev: rate(prev, 'opened_at'), fmt: fmtPct, spark: spark(s => s.opened_at), color: '#10B981' },
      { label: 'Click rate', value: rate(cur, 'clicked_at'), prev: rate(prev, 'clicked_at'), fmt: fmtPct, spark: spark(s => s.clicked_at), color: '#06B6D4' },
      { label: 'Reply rate', value: rate(cur, 'replied_at'), prev: rate(prev, 'replied_at'), fmt: fmtPct, spark: spark(s => s.replied_at), color: '#8B5CF6' },
      { label: 'Meetings booked', value: meetingsCur, prev: meetingsPrev, fmt: v => String(v), spark: [], color: '#F59E0B' },
      { label: 'Unsub rate', value: rate(cur, 'unsubscribed_at'), prev: rate(prev, 'unsubscribed_at'), fmt: fmtPct, spark: spark(s => s.unsubscribed_at), color: '#EF4444', invert: true },
    ].map(k => ({ ...k, change: change(k.value, k.prev) }));

    // reply-rate-over-time from the rollup table
    const byDay = {};
    for (const r of dailyRows || []) {
      const b = byDay[r.day] || { sent: 0, replied: 0 };
      b.sent += r.sent || 0; b.replied += r.replied || 0;
      byDay[r.day] = b;
    }
    const line = Object.entries(byDay).sort((a, b) => a[0].localeCompare(b[0]))
      .map(([day, b]) => ({ day, value: pct(b.replied, b.sent), detail: `${b.replied}/${b.sent}` }));

    // 7×24 heatmap
    const cells = [...Array(7)].map(() => [...Array(24)].map(() => ({ sent: 0, replied: 0, rate: 0 })));
    for (const s of sends) {
      const d = new Date(s.sent_at);
      const cell = cells[d.getDay()][d.getHours()];
      cell.sent++;
      if (s.replied_at) cell.replied++;
    }
    let best = null;
    cells.forEach((row, d) => row.forEach((c, h) => {
      c.rate = c.sent ? c.replied / c.sent : 0;
      if (c.sent >= 3 && (!best || c.rate > best.rate)) best = { day: d, hour: h, rate: c.rate, sent: c.sent };
    }));

    // per-sequence table
    const seqRows = sequences.map(seq => {
      const ss = sends.filter(s => s.sequence_id === seq.id);
      const enrolled = sequenceEnrollments.filter(en => en.sequence_id === seq.id).length;
      return {
        id: seq.id, name: seq.name, enrolled, sent: ss.length,
        open: rate(ss, 'opened_at'), click: rate(ss, 'clicked_at'), reply: rate(ss, 'replied_at'),
      };
    }).filter(r => r.sent > 0 || r.enrolled > 0).sort((a, b) => b.reply - a.reply);

    // subject leaderboard (resolved through step_id → sequence_steps.subject)
    const bySubject = {};
    for (const s of sends) {
      const step = stepById.get(s.step_id);
      const subject = (s.subject_variant === 'b' && step?.subject_b) ? step.subject_b : step?.subject;
      if (!subject) continue;
      const b = bySubject[subject] || { sent: 0, opened: 0 };
      b.sent++;
      if (s.opened_at) b.opened++;
      bySubject[subject] = b;
    }
    const subjects = Object.entries(bySubject)
      .map(([subject, b]) => ({ subject, ...b, openRate: pct(b.opened, b.sent) }))
      .filter(s => s.sent >= 2)
      .sort((a, b) => b.openRate - a.openRate)
      .slice(0, 10);

    // funnel
    const funnel = [
      { label: 'Sent', value: sends.length, color: '#6366F1' },
      { label: 'Opened', value: sends.filter(s => s.opened_at).length, color: '#10B981' },
      { label: 'Clicked', value: sends.filter(s => s.clicked_at).length, color: '#06B6D4' },
      { label: 'Replied', value: sends.filter(s => s.replied_at).length, color: '#8B5CF6' },
      { label: 'Meetings', value: (activities || []).filter(a => a.activity_type === 'Meeting' && /Meeting booked/.test(a.description || '')).length, color: '#F59E0B' },
    ];

    // classification donut
    const clsCounts = {};
    for (const r of inboxMeta || []) clsCounts[r.classification || 'unclassified'] = (clsCounts[r.classification || 'unclassified'] || 0) + 1;
    const donut = Object.entries(CLASSIFICATIONS).map(([k, v]) => ({ label: v.label, color: v.dot, value: clsCounts[k] || 0 }));

    // hours saved
    const hoursSaved = (sends.length * 2) / 60;

    return { kpis, line, cells, best, seqRows, subjects, funnel, donut, hoursSaved, totalSends: sends.length };
  }, [sequenceSends, sequences, sequenceEnrollments, stepById, activities, inboxMeta, dailyRows]);

  // ===========================================================================
  // RENDER
  // ===========================================================================
  const gmailMissing = !gmailConn || gmailConn.needs_reauth;

  // ---------------------------------------------------------------------------
  // INBOX VIEW
  // ---------------------------------------------------------------------------
  if (tab === 'inbox') {
    const ctx = replyContext(selected);
    return (
      <div className="animate-in fade-in duration-200">
        {gmailMissing && (
          <div className="mb-3 p-3 rounded-xl border border-amber-500/30 bg-amber-500/[0.06] text-[12.5px] text-gray-700 dark:text-gray-200">
            <span className="font-semibold">Gmail {gmailConn ? 'needs reconnecting' : 'isn’t connected'}</span> — the inbox can’t pull replies without it. Connect it from the banner above, then hit Sync.
          </div>
        )}

        <div className="flex items-center gap-2 mb-3">
          <button onClick={onSyncNow} disabled={gmailSyncing || gmailMissing}
            className="px-3 py-1.5 text-[12px] font-semibold text-white bg-gray-900 rounded-lg hover:opacity-90 disabled:opacity-40 flex items-center gap-1.5">
            {gmailSyncing && <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />}
            {gmailSyncing ? 'Syncing…' : 'Sync replies now'}
          </button>
          <button onClick={loadInbox} className="px-3 py-1.5 text-[12px] font-semibold text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800">Refresh</button>
          <button onClick={() => setShowSnippetManager(true)} className="ml-auto px-3 py-1.5 text-[12px] font-semibold text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800">Snippets ({snippets?.length ?? '…'})</button>
        </div>

        <div className="flex rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden min-h-[560px] max-h-[calc(100vh-260px)]">
          {/* ============ LEFT: FILTER RAIL ============ */}
          <div className={`w-44 shrink-0 border-r border-gray-100 dark:border-gray-800 p-2.5 overflow-y-auto ${selected ? 'hidden lg:block' : 'hidden sm:block'}`}>
            {filterDefs.defs.map(f => (
              <button key={f.key} onClick={() => { setFilter(f.key); setVisibleCount(PAGE_SIZE); }}
                className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[12.5px] font-medium text-left transition-colors ${filter === f.key
                  ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
                {f.dot && <span className="w-2 h-2 rounded-full shrink-0" style={{ background: f.dot }} />}
                <span className="truncate">{f.label}</span>
                <span className={`ml-auto text-[10.5px] font-bold ${filter === f.key ? 'opacity-70' : 'text-gray-400'}`}>{f.count}</span>
              </button>
            ))}
            {filterDefs.bySeq.length > 0 && (
              <>
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 px-2.5 pt-3 pb-1">By campaign</p>
                {filterDefs.bySeq.map(f => (
                  <button key={f.key} onClick={() => { setFilter(f.key); setVisibleCount(PAGE_SIZE); }}
                    className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[12px] text-left transition-colors ${filter === f.key
                      ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-semibold'
                      : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
                    <span className="truncate">{f.label}</span>
                    <span className="ml-auto text-[10.5px] font-bold opacity-70">{f.count}</span>
                  </button>
                ))}
              </>
            )}
          </div>

          {/* ============ MIDDLE: THREAD LIST ============ */}
          <div className={`w-full sm:w-80 lg:w-[340px] shrink-0 border-r border-gray-100 dark:border-gray-800 overflow-y-auto ${selected ? 'hidden md:block' : ''}`}>
            {/* mobile filter chips */}
            <div className="sm:hidden flex gap-1.5 p-2 overflow-x-auto border-b border-gray-100 dark:border-gray-800">
              {filterDefs.defs.slice(0, 6).map(f => (
                <button key={f.key} onClick={() => setFilter(f.key)}
                  className={`shrink-0 px-2.5 py-1 rounded-full text-[11px] font-semibold ${filter === f.key ? 'bg-gray-900 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-500'}`}>
                  {f.label} {f.count > 0 && `(${f.count})`}
                </button>
              ))}
            </div>

            {inboxMeta === null ? (
              <SkeletonRows n={8} />
            ) : inboxError ? (
              <div className="p-6 text-center">
                <p className="text-[13px] text-red-600 font-medium mb-2">Couldn’t load the inbox: {inboxError}</p>
                <button onClick={loadInbox} className="text-[12px] font-semibold text-indigo-600 hover:underline">Try again</button>
              </div>
            ) : filteredRows.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-[24px] mb-2" aria-hidden>📭</p>
                {(inboxMeta || []).length === 0 ? (
                  <>
                    <p className="text-[13.5px] font-semibold text-gray-700 dark:text-gray-200">No replies yet</p>
                    <p className="text-[12px] text-gray-400 mt-1">Once your campaigns get responses, they’ll land here. {gmailMissing ? 'Connect Gmail first.' : 'Hit "Sync replies now" to pull the latest.'}</p>
                  </>
                ) : (
                  <p className="text-[13px] text-gray-400">Nothing matches this filter.</p>
                )}
              </div>
            ) : (
              <>
                {visibleRows.map(row => {
                  const cls = CLASSIFICATIONS[row.classification] || CLASSIFICATIONS.unclassified;
                  const name = displayName(row);
                  return (
                    <button key={row.id} onClick={() => openMessage(row)}
                      className={`w-full text-left px-3 py-2.5 border-b border-gray-50 dark:border-gray-800/60 transition-colors ${selectedId === row.id ? 'bg-indigo-50/60 dark:bg-indigo-950/30' : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'}`}>
                      <div className="flex items-center gap-2.5">
                        <span className="w-9 h-9 rounded-full grid place-items-center text-white text-[12px] font-bold shrink-0" style={{ background: avatarColor(row.from_email || name) }}>
                          {initialsOf(name)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            {!row.is_read && <span className="w-2 h-2 rounded-full bg-indigo-500 shrink-0" aria-label="Unread" />}
                            <span className={`text-[13px] truncate ${row.is_read ? 'font-medium text-gray-700 dark:text-gray-300' : 'font-bold text-gray-900 dark:text-white'}`}>{name}</span>
                            <span className="ml-auto text-[10.5px] text-gray-400 shrink-0">{relTime(row.received_at)}</span>
                            <button onClick={e => toggleStar(row, e)} className={`shrink-0 text-[13px] leading-none ${row.is_starred ? 'text-amber-500' : 'text-gray-200 dark:text-gray-700 hover:text-amber-400'}`} title={row.is_starred ? 'Unstar' : 'Star'}>★</button>
                          </div>
                          <p className={`text-[12px] truncate ${row.is_read ? 'text-gray-500' : 'text-gray-800 dark:text-gray-200 font-semibold'}`}>{row.subject || '(no subject)'}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <p className="text-[11.5px] text-gray-400 truncate flex-1">{row.body_preview}</p>
                            {row.classification && row.classification !== 'unclassified' && (
                              <span className={`shrink-0 px-1.5 py-px rounded text-[9.5px] font-bold ${cls.chip}`}>{cls.label}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
                {filteredRows.length > visibleCount && (
                  <button onClick={() => setVisibleCount(c => c + PAGE_SIZE)}
                    className="w-full py-3 text-[12px] font-semibold text-indigo-600 dark:text-indigo-400 hover:bg-gray-50 dark:hover:bg-gray-800">
                    Load {Math.min(PAGE_SIZE, filteredRows.length - visibleCount)} more ({filteredRows.length - visibleCount} left)
                  </button>
                )}
              </>
            )}
          </div>

          {/* ============ RIGHT: READING PANE ============ */}
          <div className="flex-1 min-w-0 overflow-y-auto">
            {!selected ? (
              <div className="h-full grid place-items-center p-8">
                <div className="text-center">
                  <p className="text-[26px] mb-2" aria-hidden>✉️</p>
                  <p className="text-[13px] text-gray-400">Select a reply to read it here — no more tab-switching to Gmail.</p>
                </div>
              </div>
            ) : (
              <div className="p-5">
                <button onClick={() => setSelectedId(null)} className="md:hidden mb-3 text-[12px] font-semibold text-gray-500 flex items-center gap-1"><span aria-hidden>←</span> Back to list</button>

                {/* header */}
                <div className="flex items-start gap-3 pb-4 border-b border-gray-100 dark:border-gray-800">
                  <span className="w-11 h-11 rounded-full grid place-items-center text-white text-[14px] font-bold shrink-0" style={{ background: avatarColor(selected.from_email || displayName(selected)) }}>
                    {initialsOf(displayName(selected))}
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-[15px] font-bold text-gray-900 dark:text-white leading-tight truncate">{selected.subject || '(no subject)'}</h3>
                    <p className="text-[12px] text-gray-500 truncate">
                      <span className="font-semibold text-gray-700 dark:text-gray-300">{displayName(selected)}</span>
                      {' '}&lt;{selected.from_email}&gt; · {selected.received_at ? new Date(selected.received_at).toLocaleString() : ''}
                    </p>
                    {ctx && (
                      <p className="text-[11px] text-gray-400 mt-0.5">
                        Reply to <span className="font-semibold text-indigo-600 dark:text-indigo-400">{ctx.seq?.name || 'a campaign'}</span>
                        {ctx.step?.subject ? <> — step “{ctx.step.subject.slice(0, 44)}”</> : null}
                      </p>
                    )}
                  </div>
                  <button onClick={e => toggleStar(selected, e)} className={`text-[18px] leading-none ${selected.is_starred ? 'text-amber-500' : 'text-gray-200 dark:text-gray-700 hover:text-amber-400'}`}>★</button>
                </div>

                {/* quick actions */}
                <div className="flex flex-wrap items-center gap-1.5 py-3">
                  <select value={selected.classification || 'unclassified'} onChange={e => overrideClassification(selected, e.target.value)}
                    className="dark:bg-gray-800 dark:text-gray-100 px-2 py-1 text-[11.5px] font-semibold border border-gray-200 dark:border-gray-700 rounded-lg bg-white text-gray-700 focus:outline-none" title="Override classification">
                    {Object.entries(CLASSIFICATIONS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                  {selected.client_id && clientById.get(selected.client_id) && (
                    <button onClick={() => onOpenClient(clientById.get(selected.client_id))} className="px-2.5 py-1 text-[11.5px] font-semibold text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800">Open profile</button>
                  )}
                  {selected.cold_contact_id && (
                    <button onClick={() => onConvertCold(selected.cold_contact_id)} className="px-2.5 py-1 text-[11.5px] font-semibold text-white bg-green-600 rounded-lg hover:opacity-90">Convert to relationship</button>
                  )}
                  {selected.client_id && (
                    <button onClick={() => logMeetingBooked(selected)} className="px-2.5 py-1 text-[11.5px] font-semibold text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 rounded-lg hover:bg-amber-100">Log meeting booked</button>
                  )}
                  {activeEnrollmentFor(selected) && (
                    <button onClick={() => stopSequenceFor(selected)} className="px-2.5 py-1 text-[11.5px] font-semibold text-red-600 border border-red-200 dark:border-red-900 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30">Stop their sequence</button>
                  )}
                  {selected.gmail_thread_id && gmailConn?.email_address && (
                    <a href={`https://mail.google.com/mail/u/${encodeURIComponent(gmailConn.email_address)}/#all/${selected.gmail_thread_id}`} target="_blank" rel="noopener noreferrer"
                      className="px-2.5 py-1 text-[11.5px] font-semibold text-gray-500 hover:text-gray-800 dark:hover:text-gray-200">Open thread ↗</a>
                  )}
                </div>

                {/* classification-driven suggestions */}
                {selected.classification === 'interested' && (
                  <div className="mb-3 p-2.5 rounded-xl bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900 text-[12px] text-green-800 dark:text-green-300">
                    They sound interested — log the meeting when it’s booked, or reply with <code className="font-mono">:booking</code> to propose times.
                  </div>
                )}
                {selected.classification === 'referral' && (
                  <div className="mb-3 p-2.5 rounded-xl bg-violet-50 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-900 text-[12px] text-violet-800 dark:text-violet-300">
                    Sounds like a referral — add the person they mentioned as a new relationship so the chain is tracked.
                  </div>
                )}

                {/* body */}
                <div className="text-[13.5px] leading-relaxed text-gray-800 dark:text-gray-200 whitespace-pre-wrap py-2 min-h-[80px]">
                  {selected.id in bodies ? (bodies[selected.id] || selected.body_preview || <span className="text-gray-400">No body captured for this message.</span>)
                    : <span className="inline-block w-2/3 h-4 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />}
                </div>

                {/* ============ 2.3 REPLY COMPOSER ============ */}
                <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
                  <div className="flex items-center gap-2 mb-2">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Reply</p>
                    <span className="text-[11px] text-gray-400 truncate">to {selected.from_email}</span>
                    <div className="ml-auto flex items-center gap-1.5 relative">
                      <button onClick={() => setSnippetPickerOpen(v => !v)} className="px-2 py-1 text-[11px] font-semibold text-gray-500 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800">Snippets ▾</button>
                      <button onClick={saveDraftAsSnippet} className="px-2 py-1 text-[11px] font-semibold text-gray-500 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800">Save as snippet</button>
                      {snippetPickerOpen && (
                        <div className="absolute right-0 top-8 z-10 w-72 max-h-64 overflow-y-auto bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl p-1.5">
                          {(snippets || []).map(sn => (
                            <button key={sn.id || sn.shortcut} onClick={() => insertSnippet(sn)} className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800">
                              <p className="text-[11.5px] font-bold text-indigo-600 dark:text-indigo-400 font-mono">{sn.shortcut}</p>
                              <p className="text-[11.5px] text-gray-500 line-clamp-2">{sn.body}</p>
                            </button>
                          ))}
                          {(snippets || []).length === 0 && <p className="text-[12px] text-gray-400 p-2">No snippets yet.</p>}
                        </div>
                      )}
                    </div>
                  </div>
                  <input value={replySubject} onChange={e => setReplySubject(e.target.value)}
                    className="dark:bg-gray-800 dark:text-gray-100 w-full px-3 py-1.5 mb-1.5 text-[12.5px] border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:border-gray-400" />
                  {/* Part 3.2 — rich-text reply, sent straight through the Gmail API */}
                  <RichTextReplyBox
                    key={`${selected.id}-${replyResetKey}`}
                    sending={sendingReply}
                    snippets={snippets || []}
                    resolveSnippet={sn => resolveMergeTags(sn.body, mergeContact)}
                    placeholder={`Write your reply… type ${snippets?.[0]?.shortcut || ':thanks'} then space to expand a snippet. Merge tags like {{first_name}} work too.`}
                    fromLabel={gmailConn?.email_address}
                    onSend={sendReplyViaApi}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ============ 2.8 SNIPPET MANAGER ============ */}
        {showSnippetManager && (
          <SnippetManager
            snippets={snippets || []}
            userId={user.id}
            showToast={showToast}
            onClose={() => setShowSnippetManager(false)}
            onChange={setSnippets}
          />
        )}
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // ANALYTICS VIEW
  // ---------------------------------------------------------------------------
  if (tab === 'analytics') {
    const loading = dailyRows === null && sequenceSends.length > 0;
    if (analytics.totalSends === 0) {
      return (
        <div className="rounded-2xl border border-dashed border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 py-16 text-center animate-in fade-in duration-200">
          <p className="text-[26px] mb-2" aria-hidden>📈</p>
          <h3 className="text-[15px] font-bold text-gray-900 dark:text-gray-100">Send your first campaign to see analytics</h3>
          <p className="text-[13px] text-gray-500 mt-1 max-w-md mx-auto">Once sequences start sending, this dashboard tracks opens, clicks, replies, best send times, and which subject lines actually work.</p>
          <button onClick={onGoToBuilder} className="mt-5 px-4 py-2 text-[13px] font-semibold text-white bg-gray-900 rounded-xl hover:opacity-90">Go to the builder</button>
        </div>
      );
    }
    return (
      <div className="space-y-5 animate-in fade-in duration-200">
        {/* 1 — headline KPIs */}
        {loading ? <SkeletonCards n={6} /> : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {analytics.kpis.map(k => (
              <div key={k.label} className="bg-white dark:bg-gray-900 p-3.5 rounded-2xl border border-gray-100 dark:border-gray-800">
                <p className="text-[10.5px] font-bold uppercase tracking-wider text-gray-400">{k.label}</p>
                <p className="text-[20px] font-bold text-gray-900 dark:text-gray-100 mt-0.5 tabular-nums">{k.fmt(k.value)}</p>
                <div className="flex items-center justify-between mt-1">
                  <TrendArrow change={k.invert && k.change != null ? -k.change : k.change} />
                  {k.spark.length > 0 && <Sparkline values={k.spark} color={k.color} width={56} height={20} />}
                </div>
                <p className="text-[9.5px] text-gray-400 mt-0.5">vs prior 30 days</p>
              </div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* 2 — reply rate over time */}
          <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-100 dark:border-gray-800">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-3">Reply rate — last 30 days</h3>
            {dailyRows === null ? (
              <div className="h-52 rounded-xl bg-gray-100 dark:bg-gray-800/60 animate-pulse" />
            ) : analytics.line.length < 2 ? (
              <p className="text-[12.5px] text-gray-400 py-14 text-center">Not enough daily data yet — this fills in as campaigns send over multiple days.</p>
            ) : (
              <LineChart series={analytics.line} />
            )}
          </div>

          {/* 3 — best send time heatmap */}
          <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-100 dark:border-gray-800">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-3">Best send times <span className="normal-case font-medium text-gray-400">(reply rate by day × hour)</span></h3>
            <SendTimeHeatmap cells={analytics.cells} best={analytics.best} />
            {!analytics.best && <p className="text-[12px] text-gray-400 mt-2">Needs at least 3 sends in one time slot to call a winner.</p>}
          </div>
        </div>

        {/* 4 — per-sequence comparison */}
        <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-x-auto">
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-3">Sequence comparison</h3>
          {analytics.seqRows.length === 0 ? (
            <p className="text-[12.5px] text-gray-400 py-6 text-center">No sequences with activity yet.</p>
          ) : (
            <table className="w-full text-[12.5px] min-w-[560px]">
              <thead>
                <tr className="text-left text-[10.5px] font-bold uppercase tracking-wider text-gray-400 border-b border-gray-100 dark:border-gray-800">
                  <th className="py-2 pr-3">Sequence</th>
                  <th className="py-2 pr-3">Enrolled</th>
                  <th className="py-2 pr-3">Sent</th>
                  <th className="py-2 pr-3">Open</th>
                  <th className="py-2 pr-3">Click</th>
                  <th className="py-2">Reply</th>
                </tr>
              </thead>
              <tbody>
                {analytics.seqRows.map((r, i) => (
                  <tr key={r.id} className={`border-b border-gray-50 dark:border-gray-800/50 ${i === 0 && r.reply > 0 ? 'bg-green-50/50 dark:bg-green-950/20' : ''}`}>
                    <td className="py-2 pr-3 font-semibold text-gray-800 dark:text-gray-200">
                      {r.name} {i === 0 && r.reply > 0 && <span className="ml-1 text-[9.5px] font-bold text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-950/50 px-1.5 py-0.5 rounded">BEST</span>}
                    </td>
                    <td className="py-2 pr-3 text-gray-500 tabular-nums">{r.enrolled}</td>
                    <td className="py-2 pr-3 text-gray-500 tabular-nums">{r.sent}</td>
                    <td className="py-2 pr-3 tabular-nums text-gray-700 dark:text-gray-300">{fmtPct(r.open)} <MiniBar value={r.open} max={100} color="#10B981" /></td>
                    <td className="py-2 pr-3 tabular-nums text-gray-700 dark:text-gray-300">{fmtPct(r.click)} <MiniBar value={r.click} max={100} color="#06B6D4" /></td>
                    <td className="py-2 tabular-nums text-gray-700 dark:text-gray-300">{fmtPct(r.reply)} <MiniBar value={r.reply} max={100} color="#8B5CF6" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* 5 — subject line leaderboard */}
          <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-100 dark:border-gray-800">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-3">Subject line leaderboard <span className="normal-case font-medium">(by open rate)</span></h3>
            {analytics.subjects.length === 0 ? (
              <p className="text-[12.5px] text-gray-400 py-6 text-center">Needs at least 2 sends per subject to rank — keep sending.</p>
            ) : (
              <div className="space-y-2">
                {analytics.subjects.map((s, i) => (
                  <div key={s.subject} className="flex items-center gap-2.5 text-[12.5px]">
                    <span className={`w-5 shrink-0 text-center font-bold ${i === 0 ? 'text-amber-500' : 'text-gray-300 dark:text-gray-600'}`}>{i + 1}</span>
                    <span className="flex-1 truncate text-gray-700 dark:text-gray-300" title={s.subject}>{s.subject}</span>
                    <MiniBar value={s.openRate} max={100} color={i === 0 ? '#F59E0B' : '#6366F1'} />
                    <span className="w-12 text-right font-bold tabular-nums text-gray-800 dark:text-gray-200">{fmtPct(s.openRate)}</span>
                    <span className="w-14 text-right text-[10.5px] text-gray-400">n={s.sent}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 7 — classification donut */}
          <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-100 dark:border-gray-800">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-3">Reply quality</h3>
            {(inboxMeta || []).length === 0 ? (
              <p className="text-[12.5px] text-gray-400 py-6 text-center">No classified replies yet — the inbox fills this in.</p>
            ) : (
              <Donut slices={analytics.donut} />
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* 6 — funnel */}
          <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-100 dark:border-gray-800">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-3">Outreach funnel — all time</h3>
            <Funnel stages={analytics.funnel} />
          </div>

          {/* 8 — hours saved / ROI */}
          <div className="bg-gray-900 dark:bg-white p-6 rounded-2xl text-white dark:text-gray-900 flex flex-col justify-center">
            <p className="text-[11px] font-bold uppercase tracking-wider opacity-60">What automation did for you</p>
            <p className="text-[34px] font-bold leading-tight mt-2">{analytics.hoursSaved.toFixed(1)} hours saved</p>
            <p className="text-[13px] opacity-70 mt-1">{analytics.totalSends.toLocaleString()} automated sends × ~2 minutes each you didn’t type by hand.</p>
            <p className="text-[13px] opacity-70">{analytics.funnel[4].value} meeting{analytics.funnel[4].value === 1 ? '' : 's'} booked from replies so far.</p>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

// ---------------------------------------------------------------------------
// 2.8 — Snippet manager (CRUD modal)
// ---------------------------------------------------------------------------
function SnippetManager({ snippets, userId, showToast, onClose, onChange }) {
  const [shortcut, setShortcut] = useState(':');
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);

  async function add(e) {
    e.preventDefault();
    const clean = (shortcut.startsWith(':') ? shortcut : `:${shortcut}`).toLowerCase().trim();
    if (clean.length < 2 || !body.trim()) return;
    setSaving(true);
    const { data, error } = await supabase.from('reply_snippets')
      .upsert([{ user_id: userId, shortcut: clean, body: body.trim() }], { onConflict: 'user_id,shortcut' }).select();
    setSaving(false);
    if (error) { showToast(error.message, 'error'); return; }
    onChange([...snippets.filter(s => s.shortcut !== clean), data[0]].sort((a, b) => a.shortcut.localeCompare(b.shortcut)));
    setShortcut(':'); setBody('');
    showToast(`Snippet ${clean} saved.`, 'success');
  }

  async function remove(sn) {
    onChange(snippets.filter(s => s.shortcut !== sn.shortcut));
    const { error } = await supabase.from('reply_snippets').delete().eq('id', sn.id);
    if (error) { onChange(snippets); showToast(error.message, 'error'); }
  }

  return (
    <div className="fixed inset-0 z-[120] bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-lg max-h-[80vh] overflow-y-auto bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-2xl p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-[15px] font-bold text-gray-900 dark:text-white">Reply snippets</h3>
          <button onClick={onClose} className="text-gray-300 hover:text-gray-600 dark:hover:text-gray-300 text-[16px]">×</button>
        </div>
        <p className="text-[12px] text-gray-500 mb-4">Type a shortcut like <code className="font-mono">:thanks</code> in the reply box (followed by a space) and it expands. Merge tags like <code className="font-mono">{'{{first_name}}'}</code> resolve at send time.</p>

        <form onSubmit={add} className="space-y-2 mb-5">
          <div className="flex gap-2">
            <input value={shortcut} onChange={e => setShortcut(e.target.value)} placeholder=":shortcut"
              className="dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 w-32 px-3 py-2 text-[13px] font-mono border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:border-gray-400" />
            <button type="submit" disabled={saving || shortcut.length < 2 || !body.trim()}
              className="ml-auto px-3.5 py-2 text-[12.5px] font-semibold text-white bg-gray-900 rounded-xl hover:opacity-90 disabled:opacity-40">{saving ? 'Saving…' : 'Save snippet'}</button>
          </div>
          <textarea value={body} onChange={e => setBody(e.target.value)} rows={3} placeholder="Snippet text — merge tags welcome."
            className="dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 w-full px-3 py-2 text-[13px] border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:border-gray-400 resize-none" />
        </form>

        <div className="space-y-2">
          {snippets.map(sn => (
            <div key={sn.id || sn.shortcut} className="p-3 border border-gray-100 dark:border-gray-800 rounded-xl">
              <div className="flex items-center justify-between">
                <p className="text-[12px] font-bold font-mono text-indigo-600 dark:text-indigo-400">{sn.shortcut}</p>
                <button onClick={() => remove(sn)} className="text-[11.5px] text-gray-300 hover:text-red-500">Delete</button>
              </div>
              <p className="text-[12.5px] text-gray-600 dark:text-gray-300 mt-1 whitespace-pre-wrap">{sn.body}</p>
            </div>
          ))}
          {snippets.length === 0 && <p className="text-[12.5px] text-gray-400 text-center py-4">No snippets yet — add your first above.</p>}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Part 3.2 — lightweight rich-text reply editor. contentEditable + execCommand
// keeps this dependency-free; the output HTML is sent as the email body.
// ---------------------------------------------------------------------------
function ToolbarBtn({ onClick, label, title, extra = '' }) {
  return (
    <button type="button" title={title}
      onMouseDown={e => e.preventDefault()} /* keep the caret/selection */
      onClick={onClick}
      className={`w-7 h-7 flex items-center justify-center rounded-md text-[12px] text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors ${extra}`}>
      {label}
    </button>
  );
}

function RichTextReplyBox({ onSend, sending, snippets, resolveSnippet, placeholder, fromLabel }) {
  const editorRef = useRef(null);
  const [hasContent, setHasContent] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  const sync = () => setHasContent((editorRef.current?.textContent || '').trim().length > 0);

  function exec(command, value = null) {
    editorRef.current?.focus();
    document.execCommand(command, false, value);
    sync();
  }

  function insertHtml(html) {
    editorRef.current?.focus();
    document.execCommand('insertHTML', false, html);
    sync();
  }

  function handleInsertLink() {
    const url = window.prompt('Link URL:');
    if (!url) return;
    exec('createLink', /^https?:\/\//i.test(url) ? url : `https://${url}`);
  }

  function pickSnippet(sn) {
    insertHtml(resolveSnippet(sn).replace(/\n/g, '<br>'));
    setPickerOpen(false);
  }

  // ":shortcut " typed inline expands in place
  function handleKeyUp(e) {
    sync();
    if (e.key !== ' ') return;
    const text = editorRef.current?.textContent || '';
    const m = text.match(/(:[a-z0-9_-]+)\s$/i);
    if (!m) return;
    const sn = (snippets || []).find(s => (s.shortcut || '').toLowerCase() === m[1].toLowerCase());
    if (!sn) return;
    for (let i = 0; i < m[1].length + 1; i++) document.execCommand('delete'); // remove ":shortcut "
    insertHtml(resolveSnippet(sn).replace(/\n/g, '<br>'));
  }

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="flex items-center gap-1 px-2 py-1.5 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50">
        <ToolbarBtn onClick={() => exec('bold')} label="B" title="Bold" extra="font-bold" />
        <ToolbarBtn onClick={() => exec('italic')} label="I" title="Italic" extra="italic" />
        <ToolbarBtn onClick={() => exec('underline')} label="U" title="Underline" extra="underline" />
        <div className="w-px h-4 bg-gray-200 dark:bg-gray-700 mx-1" />
        <ToolbarBtn onClick={() => exec('insertUnorderedList')} label="•" title="Bullet list" />
        <ToolbarBtn onClick={() => exec('insertOrderedList')} label="1." title="Numbered list" />
        <div className="w-px h-4 bg-gray-200 dark:bg-gray-700 mx-1" />
        <ToolbarBtn onClick={handleInsertLink} label="Link" title="Insert link" />
        <ToolbarBtn onClick={() => exec('removeFormat')} label="Tx" title="Clear formatting" />
        <div className="ml-auto relative">
          <button type="button" onClick={() => setPickerOpen(v => !v)}
            className="px-2 py-1 text-[11px] font-semibold text-gray-500 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
            Snippets ▾
          </button>
          {pickerOpen && (
            <div className="absolute right-0 top-8 z-20 w-72 max-h-64 overflow-y-auto bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl p-1.5">
              {(snippets || []).map(sn => (
                <button key={sn.id || sn.shortcut} type="button" onClick={() => pickSnippet(sn)}
                  className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800">
                  <p className="text-[11.5px] font-bold text-indigo-600 dark:text-indigo-400 font-mono">{sn.shortcut}</p>
                  <p className="text-[11.5px] text-gray-500 line-clamp-2">{sn.body}</p>
                </button>
              ))}
              {(snippets || []).length === 0 && <p className="text-[12px] text-gray-400 p-2">No snippets yet.</p>}
            </div>
          )}
        </div>
      </div>

      <div ref={editorRef} contentEditable suppressContentEditableWarning
        onKeyUp={handleKeyUp} onInput={sync} onBlur={sync}
        data-placeholder={placeholder}
        className="min-h-[120px] max-h-[300px] overflow-y-auto px-4 py-3 text-[13px] leading-relaxed text-gray-900 dark:text-white outline-none [&_a]:text-blue-600 [&_a]:underline" />

      <div className="flex items-center justify-between gap-3 px-3 py-2 border-t border-gray-100 dark:border-gray-800">
        <p className="text-[10px] text-gray-400">
          Sends directly from{fromLabel ? ` ${fromLabel}` : ' your Gmail'} — no tab switch, and it stays in the same thread.
        </p>
        <button type="button" onClick={() => onSend(editorRef.current?.innerHTML || '')} disabled={!hasContent || sending}
          className="shrink-0 px-4 py-2 text-[13px] font-semibold text-white bg-gray-900 rounded-xl hover:opacity-90 disabled:opacity-40">
          {sending ? 'Sending…' : 'Send Reply'}
        </button>
      </div>
    </div>
  );
}

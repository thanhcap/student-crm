'use client';
// ============================================================================
// BIG UPDATE V4 §2 — CAMPAIGN GALLERY & DASHBOARD
// Rich, scannable campaign cards (visual node mini-map, live stats, reply
// rate, last-sent, context menu), aggregate stats across every campaign,
// filter pills + sort, empty states, and the starter-template strip (reuses
// the app's existing SEQ_TEMPLATES + handleCreateFromTemplate — real batched
// inserts with real DB IDs and edges).
// ============================================================================
import { useEffect, useMemo, useRef, useState } from 'react';

function relTime(ts) {
  if (!ts) return '';
  const mins = Math.floor((Date.now() - new Date(ts).getTime()) / 60000);
  if (mins < 60) return `${Math.max(mins, 1)}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

const NODE_MINI = {
  trigger: ['bg-violet-500', 'T'],
  email: ['bg-blue-500', 'E'],
  wait: ['bg-gray-400', 'W'],
  condition: ['bg-amber-500', '?'],
  goal: ['bg-emerald-500', 'G'],
  linkedin_view: ['bg-indigo-500', 'L'],
  linkedin_connect: ['bg-indigo-500', 'L'],
  linkedin_message: ['bg-indigo-500', 'L'],
  call: ['bg-teal-500', 'C'],
  task: ['bg-gray-500', 'K'],
};

export function GmailConnectionBadge({ gmailConn, onConnect }) {
  if (!gmailConn || gmailConn.needs_reauth || gmailConn.revoked_at) {
    return (
      <button onClick={onConnect}
        className="flex items-center gap-2 px-3 py-1.5 text-[12px] font-semibold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg hover:bg-amber-100 dark:hover:bg-amber-950/50 transition-colors">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
        {gmailConn ? 'Reconnect Gmail' : 'Connect Gmail'}
      </button>
    );
  }
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 text-[12px] font-medium text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg">
      <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
      <span className="truncate max-w-[160px]">{gmailConn.email_address || 'Gmail connected'}</span>
    </div>
  );
}

function MenuBtn({ children, onClick, danger }) {
  return (
    <button onClick={onClick}
      className={`w-full text-left px-4 py-2 text-[13px] font-medium transition-colors ${danger
        ? 'text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30'
        : 'text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
      {children}
    </button>
  );
}

function MiniStat({ label, value, accent }) {
  return (
    <div>
      <p className={`text-[15px] font-bold ${accent ? 'text-green-600 dark:text-green-400' : 'text-gray-900 dark:text-white'}`}>{value}</p>
      <p className="text-[10px] uppercase tracking-wider text-gray-400">{label}</p>
    </div>
  );
}

function AggStat({ label, value, accent, onClick }) {
  return (
    <div onClick={onClick}
      className={`p-4 rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 ${onClick ? 'cursor-pointer hover:border-gray-300 dark:hover:border-gray-600 transition-all' : ''}`}>
      <p className={`text-[24px] font-bold tabular-nums ${accent ? 'text-green-600 dark:text-green-400' : 'text-gray-900 dark:text-white'}`}>{value}</p>
      <p className="text-[11px] uppercase tracking-wider text-gray-400 mt-1">{label}</p>
    </div>
  );
}

function CampaignCard({ seq, seqSteps, onOpen, onDuplicate, onToggle, onDelete, onQuickEnroll }) {
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!showMenu) return;
    const close = (e) => { if (!menuRef.current?.contains(e.target)) setShowMenu(false); };
    window.addEventListener('pointerdown', close);
    return () => window.removeEventListener('pointerdown', close);
  }, [showMenu]);

  const live = seq.is_active || seq.status === 'active';
  const miniSteps = seqSteps.slice(0, 8);

  return (
    <div onClick={onOpen}
      className="group relative p-5 rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-lg transition-all cursor-pointer">
      <div className="flex items-start justify-between mb-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-[15px] font-bold text-gray-900 dark:text-white truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
            {seq.name}
          </h3>
          {seq.description && <p className="text-[12px] text-gray-400 mt-0.5 line-clamp-1">{seq.description}</p>}
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-3">
          <span className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full ring-1 ring-inset ${live
            ? 'bg-green-50 text-green-700 ring-green-200 dark:bg-green-950/40 dark:text-green-400 dark:ring-green-900'
            : 'bg-gray-50 text-gray-500 ring-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:ring-gray-700'}`}>
            {live ? 'Live' : seq.status === 'draft' ? 'Draft' : 'Paused'}
          </span>
          <div className="relative" ref={menuRef}>
            <button onClick={e => { e.stopPropagation(); setShowMenu(v => !v); }}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
              aria-label="Campaign menu">···</button>
            {showMenu && (
              <div className="absolute right-0 top-8 z-20 w-44 py-1 bg-white dark:bg-gray-900 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700"
                onClick={e => e.stopPropagation()}>
                <MenuBtn onClick={() => { onToggle(); setShowMenu(false); }}>{live ? 'Pause campaign' : 'Activate campaign'}</MenuBtn>
                <MenuBtn onClick={() => { onQuickEnroll(); setShowMenu(false); }}>Enroll contacts</MenuBtn>
                <MenuBtn onClick={() => { onDuplicate(); setShowMenu(false); }}>Duplicate</MenuBtn>
                <div className="my-1 border-t border-gray-100 dark:border-gray-800" />
                <MenuBtn onClick={() => { onDelete(); setShowMenu(false); }} danger>Delete campaign</MenuBtn>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* visual mini-map of the node chain */}
      <div className="flex items-center gap-1 mb-4 py-2 overflow-hidden">
        {miniSteps.length === 0 ? (
          <span className="text-[11px] text-gray-400">Empty — open to add steps</span>
        ) : miniSteps.map((st, i) => {
          const [bg, letter] = NODE_MINI[st.node_type] || NODE_MINI.task;
          return (
            <div key={st.id} className="flex items-center gap-1 shrink-0">
              {i > 0 && <div className="w-3 h-px bg-gray-200 dark:bg-gray-700" />}
              <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-[9px] font-bold text-white ${bg}`}
                title={st.node_type}>{letter}</div>
            </div>
          );
        })}
        {seq.stepCount > 8 && <span className="text-[10px] text-gray-400 ml-1 shrink-0">+{seq.stepCount - 8}</span>}
      </div>

      <div className="flex items-center justify-between pt-3 border-t border-gray-50 dark:border-gray-800">
        <div className="flex items-center gap-4">
          <MiniStat label="Enrolled" value={seq.totalEnrolled} />
          <MiniStat label="Active" value={seq.activeCount} />
          <MiniStat label="Sent" value={seq.sentCount} />
          <MiniStat label="Replied" value={seq.repliedCount} accent={seq.repliedCount > 0} />
        </div>
        {seq.replyRate > 0 && (
          <span className="text-[11px] font-bold text-green-600 dark:text-green-400">{seq.replyRate}% reply</span>
        )}
      </div>

      {seq.lastSend && <p className="text-[10px] text-gray-400 mt-2">Last sent {relTime(seq.lastSend)}</p>}
    </div>
  );
}

function GallerySkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4" aria-label="Loading campaigns">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="p-5 rounded-2xl border border-gray-100 dark:border-gray-800 animate-pulse" style={{ animationDelay: `${i * 0.08}s` }}>
          <div className="h-4 w-2/3 bg-gray-200 dark:bg-gray-800 rounded mb-3" />
          <div className="flex gap-1.5 mb-4">{[...Array(5)].map((_, j) => <span key={j} className="w-6 h-6 rounded-lg bg-gray-100 dark:bg-gray-800" />)}</div>
          <div className="h-3 w-full bg-gray-100 dark:bg-gray-800 rounded" />
        </div>
      ))}
    </div>
  );
}

export default function EmailCampaignGallery({
  sequences, steps, enrollments, sends, loading,
  templates, onApplyTemplate,
  onOpen, onDuplicate, onToggle, onDelete, onQuickEnroll, onCreateNew, onOpenInbox,
}) {
  const [sortBy, setSortBy] = useState('recent');
  const [filterStatus, setFilterStatus] = useState('all');
  const [showAllTemplates, setShowAllTemplates] = useState(false);
  const [applyingKey, setApplyingKey] = useState(null);

  const isLive = s => s.is_active || s.status === 'active';
  const isDraft = s => !isLive(s) && s.status === 'draft';

  const sortedSequences = useMemo(() => {
    let filtered = [...(sequences || [])];
    if (filterStatus === 'live') filtered = filtered.filter(isLive);
    if (filterStatus === 'draft') filtered = filtered.filter(isDraft);
    if (filterStatus === 'paused') filtered = filtered.filter(s => !isLive(s) && !isDraft(s));

    const enriched = filtered.map(s => {
      const seqEnr = (enrollments || []).filter(e => e.sequence_id === s.id);
      const seqSends = (sends || []).filter(x => x.sequence_id === s.id);
      const lastSendRow = seqSends.reduce((best, x) => (!best || new Date(x.sent_at) > new Date(best.sent_at)) ? x : best, null);
      return {
        ...s,
        activeCount: seqEnr.filter(e => e.status === 'active').length,
        totalEnrolled: seqEnr.length,
        sentCount: seqSends.length,
        repliedCount: seqSends.filter(x => x.replied_at).length,
        replyRate: seqSends.length ? Math.round(seqSends.filter(x => x.replied_at).length / seqSends.length * 100) : 0,
        stepCount: (steps || []).filter(st => st.sequence_id === s.id).length,
        lastSend: lastSendRow?.sent_at || null,
      };
    });

    if (sortBy === 'recent') enriched.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    if (sortBy === 'active') enriched.sort((a, b) => b.activeCount - a.activeCount);
    if (sortBy === 'name') enriched.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    if (sortBy === 'enrolled') enriched.sort((a, b) => b.totalEnrolled - a.totalEnrolled);
    return enriched;
  }, [sequences, enrollments, sends, steps, sortBy, filterStatus]);

  const counts = {
    all: (sequences || []).length,
    live: (sequences || []).filter(isLive).length,
    draft: (sequences || []).filter(isDraft).length,
    paused: (sequences || []).filter(s => !isLive(s) && !isDraft(s)).length,
  };

  const stepsFor = seqId => (steps || []).filter(st => st.sequence_id === seqId).sort((a, b) => (a.step_order ?? 0) - (b.step_order ?? 0));

  const visibleTemplates = showAllTemplates ? templates : templates.slice(0, 4);

  if (loading) return <GallerySkeleton />;

  return (
    <div>
      {/* aggregate stats across ALL campaigns */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <AggStat label="Total Campaigns" value={(sequences || []).length} />
        <AggStat label="Active Enrollments" value={(enrollments || []).filter(e => e.status === 'active').length} />
        <AggStat label="Emails Sent" value={(sends || []).length} />
        <AggStat label="Total Replies" value={(sends || []).filter(s => s.replied_at).length} accent onClick={onOpenInbox} />
      </div>

      {/* filter + sort bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div className="flex gap-1.5">
          {['all', 'live', 'draft', 'paused'].map(f => (
            <button key={f} onClick={() => setFilterStatus(f)}
              className={`px-3 py-1.5 text-[12px] font-semibold rounded-lg transition-colors ${filterStatus === f
                ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900'
                : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'}`}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
              <span className="ml-1 text-[10px] opacity-60">{counts[f]}</span>
            </button>
          ))}
        </div>
        <select value={sortBy} onChange={e => setSortBy(e.target.value)}
          className="px-3 py-1.5 text-[12px] rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 dark:text-white focus:outline-none">
          <option value="recent">Newest first</option>
          <option value="active">Most active</option>
          <option value="enrolled">Most enrolled</option>
          <option value="name">Alphabetical</option>
        </select>
      </div>

      {/* campaign grid */}
      {sortedSequences.length === 0 ? (
        filterStatus !== 'all' ? (
          <div className="text-center py-16">
            <p className="text-[14px] text-gray-400 mb-2">No campaigns match this filter.</p>
            <button onClick={() => setFilterStatus('all')}
              className="text-[13px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline">Show all campaigns</button>
          </div>
        ) : (
          <div className="text-center py-20">
            <p className="text-[22px] font-bold text-gray-900 dark:text-white mb-2">No campaigns yet</p>
            <p className="text-[14px] text-gray-400 mb-6 max-w-sm mx-auto">
              Build a sequence that sends itself — emails, LinkedIn touches, follow-ups — all on autopilot.
            </p>
            <button onClick={onCreateNew}
              className="px-4 py-2.5 text-[13px] font-semibold text-white bg-gray-900 rounded-xl hover:opacity-90">Create your first campaign</button>
          </div>
        )
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {sortedSequences.map(seq => (
            <CampaignCard key={seq.id} seq={seq} seqSteps={stepsFor(seq.id)}
              onOpen={() => onOpen(seq)}
              onDuplicate={() => onDuplicate(seq)}
              onToggle={() => onToggle(seq)}
              onDelete={() => onDelete(seq)}
              onQuickEnroll={() => onQuickEnroll(seq)}
            />
          ))}
        </div>
      )}

      {/* starter templates — reuses the app's real template engine */}
      <div className="mt-12 pt-8 border-t border-gray-100 dark:border-gray-800">
        <div className="flex items-end justify-between mb-5">
          <div>
            <h2 className="text-[17px] font-bold text-gray-900 dark:text-white">Start from a template</h2>
            <p className="text-[13px] text-gray-400 mt-0.5">Pre-written sequences with proven copy. One click to start.</p>
          </div>
          {templates.length > 4 && (
            <button onClick={() => setShowAllTemplates(v => !v)}
              className="text-[12px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline">
              {showAllTemplates ? 'Show less' : `Show all ${templates.length}`}
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          {visibleTemplates.map(t => (
            <button key={t.key} disabled={applyingKey !== null}
              onClick={async () => { setApplyingKey(t.key); try { await onApplyTemplate(t); } finally { setApplyingKey(null); } }}
              className="text-left p-4 rounded-xl border border-dashed border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-700 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20 transition-all group disabled:opacity-50">
              <p className="text-[13px] font-bold text-gray-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors mb-1">
                {applyingKey === t.key ? 'Creating…' : t.name}
              </p>
              <p className="text-[11px] text-gray-400 mb-3 line-clamp-2">{t.desc}</p>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded bg-gray-100 dark:bg-gray-800 text-gray-500">
                  {t.nodes.length > 10 ? 'Advanced' : 'Beginner'}
                </span>
                <span className="text-[10px] text-gray-400">{t.nodes.length} steps</span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

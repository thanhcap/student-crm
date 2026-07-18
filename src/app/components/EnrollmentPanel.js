'use client';
// ============================================================================
// BIG UPDATE V4 §3 — ENROLLMENT PANEL: six distinct enrollment paths, one
// shared bulk-enroll pipeline. Full-screen takeover (never a centered modal).
//   1. Select Manually — CRM filters + checkbox table
//   2. From a List     — one-click enroll a Relationship List
//   3. Cold Contacts   — same pattern against cold_contacts
//   4. Smart Segment   — rule builder (field / op / value, AND-combined)
//   5. Upload CSV      — import as cold contacts AND enroll in one step
//   6. Enroll All      — with an explicit confirmation gate
// Every path routes through bulkEnroll(): dedupes against active enrollments,
// honors the unsubscribe list, chunks inserts (100/batch), reports skips.
// ============================================================================
import { useMemo, useRef, useState } from 'react';
import Papa from 'papaparse';
import { supabase } from '../../lib/supabase';

const PRIORITY_CHIP = {
  High: 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400',
  Medium: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400',
  Low: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
};

function relTimeShort(dateStr) {
  if (!dateStr) return 'never';
  const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / 864e5);
  if (days <= 0) return 'today';
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

// The runner's entry point: the node the trigger's default edge points at,
// falling back to the lowest step_order non-trigger node.
function nodeAfterTrigger(seqSteps, seqEdges) {
  const trigger = seqSteps.find(s => s.node_type === 'trigger');
  if (trigger) {
    const edge = seqEdges.find(e => e.from_step_id === trigger.id && (e.branch === 'default' || !e.branch));
    const target = edge && seqSteps.find(s => s.id === edge.to_step_id);
    if (target) return target;
  }
  return [...seqSteps].filter(s => s.node_type !== 'trigger').sort((a, b) => (a.step_order ?? 0) - (b.step_order ?? 0))[0] || null;
}

function EnrollBar({ available, selectedCount, note, onEnroll, disabled, label }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-indigo-50 dark:bg-indigo-950/30 rounded-xl">
      <span className="text-[13px] font-semibold text-indigo-700 dark:text-indigo-300">
        {available}
        {note && <span className="text-gray-400 font-normal"> {note}</span>}
      </span>
      <button onClick={onEnroll} disabled={disabled}
        className="px-4 py-2 text-[13px] font-semibold text-white bg-gray-900 rounded-xl hover:opacity-90 disabled:opacity-40">
        {label || `Enroll${selectedCount ? ` ${selectedCount}` : ''}`}
      </button>
    </div>
  );
}

export default function EnrollmentPanel({
  sequence, seqSteps, seqEdges,
  clients, coldContacts, relationshipLists, relationshipListMembers,
  enrollments, unsubscribes, activities,
  user, showToast,
  onEnrolled,       // (newEnrollmentRows) => merge into App state
  onColdImported,   // (newColdRows) => merge into App state
  onClose,
}) {
  const [enrollTab, setEnrollTab] = useState('select');
  const [busy, setBusy] = useState(false);

  const tabs = [
    { key: 'select', label: 'Select Manually' },
    { key: 'list', label: 'From a List' },
    { key: 'cold', label: 'Cold Contacts' },
    { key: 'segment', label: 'Smart Segment' },
    { key: 'csv', label: 'Upload CSV' },
    { key: 'all', label: 'Enroll All' },
  ];

  const activeKeys = useMemo(() => new Set(
    (enrollments || [])
      .filter(e => e.sequence_id === sequence?.id && e.status === 'active')
      .map(e => (e.client_id ? `r${e.client_id}` : `c${e.cold_contact_id}`))
  ), [enrollments, sequence?.id]);

  const unsubEmails = useMemo(() => new Set((unsubscribes || []).map(u => (u.email || '').toLowerCase()).filter(Boolean)), [unsubscribes]);

  const lastActivityByClient = useMemo(() => {
    const m = new Map();
    for (const a of activities || []) {
      if (!a.client_id || !a.activity_date) continue;
      const cur = m.get(a.client_id);
      if (!cur || a.activity_date > cur) m.set(a.client_id, a.activity_date);
    }
    return m;
  }, [activities]);

  // ---- §3.8 the shared bulk-enroll pipeline --------------------------------
  async function bulkEnroll(ids, kind) {
    if (busy) return;
    if (!seqSteps.length) { showToast('This campaign has no steps yet — build it first.', 'error'); return; }
    setBusy(true);
    try {
      const firstNode = nodeAfterTrigger(seqSteps, seqEdges);
      const emailFor = id => kind === 'client'
        ? clients.find(c => c.id === id)?.email
        : coldContacts.find(c => c.id === id)?.email;

      let skippedDupe = 0, skippedUnsub = 0;
      const todayStr = new Date().toISOString().split('T')[0];
      const rows = [];
      for (const id of ids) {
        const key = kind === 'client' ? `r${id}` : `c${id}`;
        if (activeKeys.has(key)) { skippedDupe++; continue; }
        const email = (emailFor(id) || '').toLowerCase();
        if (email && unsubEmails.has(email)) { skippedUnsub++; continue; }
        rows.push({
          sequence_id: sequence.id, user_id: user.id,
          client_id: kind === 'client' ? id : null,
          cold_contact_id: kind === 'cold' ? id : null,
          status: 'active', current_step: 0,
          current_node_id: firstNode?.id ?? null,
          next_send_at: todayStr,
        });
      }

      if (!rows.length) {
        const reasons = [];
        if (skippedDupe) reasons.push(`${skippedDupe} already enrolled`);
        if (skippedUnsub) reasons.push(`${skippedUnsub} unsubscribed`);
        showToast(`Nobody new to enroll${reasons.length ? ` (${reasons.join(', ')})` : ''}.`, 'error');
        return { inserted: 0 };
      }

      const CHUNK = 100;
      let totalInserted = 0;
      const allInserted = [];
      for (let i = 0; i < rows.length; i += CHUNK) {
        const { data, error } = await supabase.from('sequence_enrollments').insert(rows.slice(i, i + CHUNK)).select();
        if (error) { showToast(`Enroll error at batch ${Math.floor(i / CHUNK) + 1}: ${error.message}`, 'error'); break; }
        allInserted.push(...(data || []));
        totalInserted += data?.length ?? 0;
      }
      if (allInserted.length) onEnrolled(allInserted);

      const live = sequence.is_active || sequence.status === 'active';
      const notes = [];
      if (skippedDupe) notes.push(`${skippedDupe} already enrolled`);
      if (skippedUnsub) notes.push(`${skippedUnsub} unsubscribed`);
      showToast(
        `Enrolled ${totalInserted} contact${totalInserted === 1 ? '' : 's'}${notes.length ? ` (skipped: ${notes.join(', ')})` : ''}. ${live ? 'First emails send on the next runner tick.' : 'Activate the campaign to start sending.'}`,
        'success'
      );
      if (totalInserted > 0) onClose();
      return { inserted: totalInserted };
    } finally {
      setBusy(false);
    }
  }

  if (!sequence) return null;

  return (
    <div className="fixed inset-0 z-[80] bg-white dark:bg-gray-950 overflow-y-auto animate-in fade-in duration-200">
      <header className="sticky top-0 z-20 flex items-center justify-between px-4 sm:px-6 h-14 bg-white/90 dark:bg-gray-950/90 backdrop-blur border-b border-gray-100 dark:border-gray-800">
        <button onClick={onClose} className="flex items-center gap-1.5 text-[13px] font-semibold text-gray-500 hover:text-gray-900 dark:hover:text-white"><span aria-hidden>←</span> Back</button>
        <h1 className="text-[14px] font-bold text-gray-900 dark:text-white truncate px-3">Enroll in “{sequence.name}”</h1>
        <div className="w-16" />
      </header>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex gap-1.5 flex-wrap mb-8">
          {tabs.map(t => (
            <button key={t.key} onClick={() => setEnrollTab(t.key)}
              className={`px-3 py-1.5 text-[12.5px] font-semibold rounded-lg transition-colors ${enrollTab === t.key
                ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900'
                : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'}`}>
              {t.label}
            </button>
          ))}
        </div>

        {enrollTab === 'select' && (
          <ManualSelectEnroll clients={clients} activeKeys={activeKeys} lastActivityByClient={lastActivityByClient}
            busy={busy} onEnroll={ids => bulkEnroll(ids, 'client')} />
        )}
        {enrollTab === 'list' && (
          <ListBasedEnroll relationshipLists={relationshipLists} relationshipListMembers={relationshipListMembers}
            busy={busy} onEnroll={ids => bulkEnroll(ids, 'client')} />
        )}
        {enrollTab === 'cold' && (
          <ColdContactEnroll coldContacts={coldContacts} activeKeys={activeKeys}
            busy={busy} onEnroll={ids => bulkEnroll(ids, 'cold')} />
        )}
        {enrollTab === 'segment' && (
          <SmartSegmentEnroll clients={clients} busy={busy} onEnroll={ids => bulkEnroll(ids, 'client')} />
        )}
        {enrollTab === 'csv' && (
          <CsvDirectEnroll coldContacts={coldContacts} user={user} showToast={showToast} busy={busy}
            onImportedAndEnroll={async (created) => { onColdImported(created); await bulkEnroll(created.map(c => c.id), 'cold'); }} />
        )}
        {enrollTab === 'all' && (
          <EnrollAllPanel clients={clients} coldContacts={coldContacts} busy={busy}
            onEnrollAll={async (source) => {
              if (source === 'relationships' || source === 'both') await bulkEnroll(clients.map(c => c.id), 'client');
              if (source === 'cold' || source === 'both') await bulkEnroll(coldContacts.map(c => c.id), 'cold');
            }} />
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PATH 1 — manual multi-select with CRM filters
// ---------------------------------------------------------------------------
function ManualSelectEnroll({ clients, activeKeys, lastActivityByClient, busy, onEnroll }) {
  const [selected, setSelected] = useState(new Set());
  const [search, setSearch] = useState('');
  const [fStatus, setFStatus] = useState('All');
  const [fPriority, setFPriority] = useState('All');
  const [fSource, setFSource] = useState('All');

  const statusOptions = useMemo(() => ['All', ...new Set(clients.map(c => c.status).filter(Boolean))], [clients]);
  const sourceOptions = useMemo(() => ['All', ...new Set(clients.map(c => c.source).filter(Boolean))], [clients]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return clients.filter(c => {
      if (fStatus !== 'All' && c.status !== fStatus) return false;
      if (fPriority !== 'All' && c.relationship !== fPriority) return false;
      if (fSource !== 'All' && c.source !== fSource) return false;
      if (q && ![c.name, c.email, c.company_name].some(v => (v || '').toLowerCase().includes(q))) return false;
      return true;
    });
  }, [clients, search, fStatus, fPriority, fSource]);

  const alreadyCount = filtered.filter(c => activeKeys.has(`r${c.id}`)).length;
  const enrollable = filtered.filter(c => !activeKeys.has(`r${c.id}`));

  const toggle = (id) => setSelected(prev => {
    const s = new Set(prev);
    s.has(id) ? s.delete(id) : s.add(id);
    return s;
  });

  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <input type="text" placeholder="Search name, email, company…" value={search} onChange={e => setSearch(e.target.value)}
          className="col-span-2 sm:col-span-4 px-3 py-2 text-[13px] border border-gray-200 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:placeholder-gray-500 rounded-lg focus:outline-none focus:border-gray-400" />
        {[['Stage', fStatus, setFStatus, statusOptions], ['Priority', fPriority, setFPriority, ['All', 'High', 'Medium', 'Low']], ['Source', fSource, setFSource, sourceOptions]].map(([label, val, set, opts]) => (
          <div key={label}>
            <label className="block text-[10px] uppercase tracking-wider text-gray-400 mb-1">{label}</label>
            <select value={val} onChange={e => set(e.target.value)}
              className="w-full px-2 py-1.5 text-[12px] border border-gray-200 dark:border-gray-700 dark:bg-gray-900 dark:text-white rounded-lg focus:outline-none">
              {opts.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between p-3 bg-indigo-50 dark:bg-indigo-950/30 rounded-xl mb-4">
        <div className="flex items-center gap-3">
          <input type="checkbox" checked={selected.size === enrollable.length && enrollable.length > 0}
            onChange={e => setSelected(e.target.checked ? new Set(enrollable.map(c => c.id)) : new Set())}
            className="rounded border-gray-300 dark:border-gray-600 dark:bg-gray-800" />
          <span className="text-[13px] font-semibold text-indigo-700 dark:text-indigo-300">
            {enrollable.length} available · {selected.size} selected
            {alreadyCount > 0 && <span className="text-gray-400 font-normal"> ({alreadyCount} already enrolled)</span>}
          </span>
        </div>
        <button onClick={() => onEnroll([...selected])} disabled={selected.size === 0 || busy}
          className="px-4 py-2 text-[13px] font-semibold text-white bg-gray-900 rounded-xl hover:opacity-90 disabled:opacity-40">
          {busy ? 'Enrolling…' : `Enroll${selected.size ? ` ${selected.size}` : ''}`}
        </button>
      </div>

      {enrollable.length === 0 ? (
        <p className="text-[13px] text-gray-400 text-center py-10">
          {filtered.length === 0 ? 'No relationships match these filters.' : 'Everyone matching is already enrolled.'}
        </p>
      ) : (
        <div className="rounded-xl border border-gray-100 dark:border-gray-800 overflow-x-auto">
          <table className="w-full text-[13px] min-w-[560px]">
            <thead className="bg-gray-50 dark:bg-gray-900/50">
              <tr>
                <th className="w-10 px-3 py-2.5"><span className="sr-only">Select</span></th>
                <th className="text-left px-3 py-2.5 font-semibold text-gray-500">Name</th>
                <th className="text-left px-3 py-2.5 font-semibold text-gray-500">Company</th>
                <th className="text-left px-3 py-2.5 font-semibold text-gray-500">Stage</th>
                <th className="text-left px-3 py-2.5 font-semibold text-gray-500">Priority</th>
                <th className="text-right px-3 py-2.5 font-semibold text-gray-500">Last Active</th>
              </tr>
            </thead>
            <tbody>
              {enrollable.map(c => {
                const checked = selected.has(c.id);
                return (
                  <tr key={c.id} onClick={() => toggle(c.id)}
                    className={`cursor-pointer border-t border-gray-50 dark:border-gray-800 transition-colors ${checked ? 'bg-indigo-50/50 dark:bg-indigo-950/20' : 'hover:bg-gray-50 dark:hover:bg-gray-900/50'}`}>
                    <td className="px-3 py-2.5"><input type="checkbox" checked={checked} readOnly className="rounded border-gray-300 dark:border-gray-600 pointer-events-none" /></td>
                    <td className="px-3 py-2.5 font-medium text-gray-900 dark:text-white">{c.name}</td>
                    <td className="px-3 py-2.5 text-gray-500">{c.company_name || '—'}</td>
                    <td className="px-3 py-2.5 text-gray-500">{c.status || '—'}</td>
                    <td className="px-3 py-2.5">
                      {c.relationship
                        ? <span className={`px-2 py-0.5 text-[10.5px] font-bold rounded-full ${PRIORITY_CHIP[c.relationship] || PRIORITY_CHIP.Low}`}>{c.relationship}</span>
                        : <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-3 py-2.5 text-right text-gray-400">{relTimeShort(lastActivityByClient.get(c.id))}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// PATH 2 — one-click enroll a Relationship List
// ---------------------------------------------------------------------------
function ListBasedEnroll({ relationshipLists, relationshipListMembers, busy, onEnroll }) {
  const [selectedListId, setSelectedListId] = useState(null);
  const selectedList = (relationshipLists || []).find(l => l.id === selectedListId);
  const memberIds = useMemo(() =>
    (relationshipListMembers || []).filter(m => String(m.list_id) === String(selectedListId)).map(m => m.client_id),
    [relationshipListMembers, selectedListId]);

  if (!(relationshipLists || []).length) {
    return (
      <p className="text-[13px] text-gray-400 text-center py-12">
        No relationship lists yet — create one from the Relationships view, then enroll it here in one click.
      </p>
    );
  }

  return (
    <div>
      <p className="text-[13px] text-gray-500 mb-4">Pick a list → enroll everyone in it with one click.</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 mb-6">
        {relationshipLists.map(l => {
          const count = (relationshipListMembers || []).filter(m => String(m.list_id) === String(l.id)).length;
          return (
            <button key={l.id} onClick={() => setSelectedListId(l.id)}
              className={`text-left p-4 rounded-xl border transition-all ${selectedListId === l.id
                ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30'
                : 'border-gray-100 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-600'}`}>
              <div className="flex items-center gap-2 mb-1">
                <span className="w-3 h-3 rounded-full shrink-0" style={{ background: l.color || '#6366F1' }} />
                <span className="text-[13px] font-bold text-gray-900 dark:text-white truncate">{l.name}</span>
              </div>
              <p className="text-[11px] text-gray-400">{count} relationship{count === 1 ? '' : 's'}</p>
            </button>
          );
        })}
      </div>
      {selectedList && (
        <EnrollBar
          available={`Enroll all ${memberIds.length} members of “${selectedList.name}”`}
          onEnroll={() => onEnroll(memberIds)}
          disabled={memberIds.length === 0 || busy}
          label={busy ? 'Enrolling…' : `Enroll ${memberIds.length}`}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// PATH 3 — cold contacts (same pattern as PATH 1, cold fields/filters)
// ---------------------------------------------------------------------------
function ColdContactEnroll({ coldContacts, activeKeys, busy, onEnroll }) {
  const [selected, setSelected] = useState(new Set());
  const [search, setSearch] = useState('');
  const [fStatus, setFStatus] = useState('All');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (coldContacts || []).filter(cc => {
      if (['unsubscribed', 'bounced'].includes(cc.status)) return false; // never enrollable
      if (fStatus !== 'All' && cc.status !== fStatus) return false;
      if (q && ![cc.email, cc.first_name, cc.last_name, cc.company, cc.title].some(v => (v || '').toLowerCase().includes(q))) return false;
      return true;
    });
  }, [coldContacts, search, fStatus]);

  const enrollable = filtered.filter(cc => !activeKeys.has(`c${cc.id}`));
  const alreadyCount = filtered.length - enrollable.length;

  const toggle = id => setSelected(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-4">
        <input type="text" placeholder="Search cold contacts…" value={search} onChange={e => setSearch(e.target.value)}
          className="flex-1 min-w-[200px] px-3 py-2 text-[13px] border border-gray-200 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:placeholder-gray-500 rounded-lg focus:outline-none focus:border-gray-400" />
        <select value={fStatus} onChange={e => setFStatus(e.target.value)}
          className="px-2 py-1.5 text-[12px] border border-gray-200 dark:border-gray-700 dark:bg-gray-900 dark:text-white rounded-lg focus:outline-none">
          {['All', 'prospect', 'contacted', 'replied', 'converted'].map(s => <option key={s} value={s}>{s === 'All' ? 'Any status' : s}</option>)}
        </select>
      </div>

      <div className="flex items-center justify-between p-3 bg-indigo-50 dark:bg-indigo-950/30 rounded-xl mb-4">
        <div className="flex items-center gap-3">
          <input type="checkbox" checked={selected.size === enrollable.length && enrollable.length > 0}
            onChange={e => setSelected(e.target.checked ? new Set(enrollable.map(c => c.id)) : new Set())}
            className="rounded border-gray-300 dark:border-gray-600 dark:bg-gray-800" />
          <span className="text-[13px] font-semibold text-indigo-700 dark:text-indigo-300">
            {enrollable.length} available · {selected.size} selected
            {alreadyCount > 0 && <span className="text-gray-400 font-normal"> ({alreadyCount} already enrolled)</span>}
          </span>
        </div>
        <button onClick={() => onEnroll([...selected])} disabled={selected.size === 0 || busy}
          className="px-4 py-2 text-[13px] font-semibold text-white bg-gray-900 rounded-xl hover:opacity-90 disabled:opacity-40">
          {busy ? 'Enrolling…' : `Enroll${selected.size ? ` ${selected.size}` : ''}`}
        </button>
      </div>

      {enrollable.length === 0 ? (
        <p className="text-[13px] text-gray-400 text-center py-10">
          {(coldContacts || []).length === 0 ? 'No cold contacts yet — import a CSV in the next tab.' : 'Nobody left to enroll with these filters.'}
        </p>
      ) : (
        <div className="rounded-xl border border-gray-100 dark:border-gray-800 overflow-x-auto">
          <table className="w-full text-[13px] min-w-[520px]">
            <thead className="bg-gray-50 dark:bg-gray-900/50">
              <tr>
                <th className="w-10 px-3 py-2.5" />
                <th className="text-left px-3 py-2.5 font-semibold text-gray-500">Email</th>
                <th className="text-left px-3 py-2.5 font-semibold text-gray-500">Name</th>
                <th className="text-left px-3 py-2.5 font-semibold text-gray-500">Company</th>
                <th className="text-left px-3 py-2.5 font-semibold text-gray-500">Status</th>
              </tr>
            </thead>
            <tbody>
              {enrollable.map(cc => {
                const checked = selected.has(cc.id);
                return (
                  <tr key={cc.id} onClick={() => toggle(cc.id)}
                    className={`cursor-pointer border-t border-gray-50 dark:border-gray-800 transition-colors ${checked ? 'bg-indigo-50/50 dark:bg-indigo-950/20' : 'hover:bg-gray-50 dark:hover:bg-gray-900/50'}`}>
                    <td className="px-3 py-2.5"><input type="checkbox" checked={checked} readOnly className="rounded border-gray-300 dark:border-gray-600 pointer-events-none" /></td>
                    <td className="px-3 py-2.5 font-medium text-gray-900 dark:text-white">{cc.email}</td>
                    <td className="px-3 py-2.5 text-gray-500">{`${cc.first_name || ''} ${cc.last_name || ''}`.trim() || '—'}</td>
                    <td className="px-3 py-2.5 text-gray-500">{cc.company || '—'}</td>
                    <td className="px-3 py-2.5 text-gray-500">{cc.status}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// PATH 4 — smart segment: rule builder, AND-combined
// ---------------------------------------------------------------------------
const SEGMENT_FIELDS = [
  ['status', 'Stage'], ['relationship', 'Priority'], ['source', 'Source'],
  ['company_name', 'Company'], ['country', 'Country'], ['network_role', 'Network Role'], ['school', 'School'],
];
const SEGMENT_OPS = [
  ['is', 'is'], ['is_not', 'is not'], ['contains', 'contains'], ['is_empty', 'is empty'], ['is_not_empty', 'is not empty'],
];

function matchesRule(client, rule) {
  const val = client[rule.field] ?? '';
  if (rule.op === 'is') return String(val).toLowerCase() === String(rule.value).toLowerCase();
  if (rule.op === 'is_not') return String(val).toLowerCase() !== String(rule.value).toLowerCase();
  if (rule.op === 'contains') return String(val).toLowerCase().includes(String(rule.value).toLowerCase());
  if (rule.op === 'is_empty') return !val;
  if (rule.op === 'is_not_empty') return !!val;
  return true;
}

function SmartSegmentEnroll({ clients, busy, onEnroll }) {
  const [rules, setRules] = useState([{ field: 'status', op: 'is', value: '' }]);

  const matching = useMemo(() =>
    clients.filter(c => rules.every(r => (['is_empty', 'is_not_empty'].includes(r.op) || r.value !== '') ? matchesRule(c, r) : true)),
    [clients, rules]);

  const patch = (i, key, value) => setRules(prev => prev.map((r, j) => j === i ? { ...r, [key]: value } : r));

  return (
    <div>
      <p className="text-[13px] text-gray-500 mb-4">Define rules — anyone matching all of them gets enrolled. Empty rule values are ignored.</p>
      {rules.map((r, i) => (
        <div key={i} className="flex items-center gap-2 mb-2 flex-wrap">
          {i > 0 && <span className="text-[11px] font-bold text-gray-400 w-8">AND</span>}
          <select value={r.field} onChange={e => patch(i, 'field', e.target.value)}
            className="px-2 py-1.5 text-[12px] border border-gray-200 dark:border-gray-700 dark:bg-gray-900 dark:text-white rounded-lg focus:outline-none">
            {SEGMENT_FIELDS.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
          </select>
          <select value={r.op} onChange={e => patch(i, 'op', e.target.value)}
            className="px-2 py-1.5 text-[12px] border border-gray-200 dark:border-gray-700 dark:bg-gray-900 dark:text-white rounded-lg focus:outline-none">
            {SEGMENT_OPS.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
          </select>
          {!['is_empty', 'is_not_empty'].includes(r.op) && (
            <input value={r.value} onChange={e => patch(i, 'value', e.target.value)} placeholder="value…"
              className="px-2 py-1.5 text-[12px] border border-gray-200 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:placeholder-gray-500 rounded-lg flex-1 min-w-[120px] focus:outline-none" />
          )}
          {rules.length > 1 && (
            <button onClick={() => setRules(rules.filter((_, j) => j !== i))} className="text-red-500 text-[12px] font-semibold hover:underline">Remove</button>
          )}
        </div>
      ))}
      <button onClick={() => setRules([...rules, { field: 'status', op: 'is', value: '' }])}
        className="text-[12px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline mb-6">+ Add condition</button>

      {/* live preview of who matches */}
      {matching.length > 0 && matching.length <= 12 && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          {matching.map(c => (
            <span key={c.id} className="px-2 py-0.5 text-[11px] font-medium bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-full">{c.name}</span>
          ))}
        </div>
      )}

      <EnrollBar
        available={`${matching.length} relationship${matching.length === 1 ? '' : 's'} match`}
        onEnroll={() => onEnroll(matching.map(c => c.id))}
        disabled={matching.length === 0 || busy}
        label={busy ? 'Enrolling…' : `Enroll ${matching.length}`}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// PATH 5 — CSV upload → cold contacts + enroll, one step
// ---------------------------------------------------------------------------
const CSV_FIELDS = ['email', 'first_name', 'last_name', 'company', 'title', 'linkedin_url', 'phone'];

function CsvDirectEnroll({ coldContacts, user, showToast, busy, onImportedAndEnroll }) {
  const [parsed, setParsed] = useState(null);
  const [mapping, setMapping] = useState({});
  const [importing, setImporting] = useState(false);
  const inputRef = useRef(null);

  function handleFileChange(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    Papa.parse(f, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        setParsed(result);
        const headers = result.meta.fields || [];
        const findCol = candidates => headers.find(h => candidates.includes(h.toLowerCase().trim())) || '';
        setMapping({
          email: findCol(['email', 'e-mail', 'email address', 'emailaddress']),
          first_name: findCol(['first_name', 'firstname', 'first name', 'fname', 'given name']),
          last_name: findCol(['last_name', 'lastname', 'last name', 'lname', 'surname', 'family name']),
          company: findCol(['company', 'company_name', 'companyname', 'organization', 'org']),
          title: findCol(['title', 'job_title', 'jobtitle', 'position', 'role']),
          linkedin_url: findCol(['linkedin', 'linkedin_url', 'linkedinurl', 'linkedin url', 'profile']),
          phone: findCol(['phone', 'phone_number', 'phonenumber', 'mobile', 'tel']),
        });
      },
    });
  }

  const rows = parsed?.data || [];
  const valid = rows.filter(r => (r[mapping.email] || '').includes('@'));
  const invalid = rows.length - valid.length;
  const existingEmails = useMemo(() => new Set((coldContacts || []).map(cc => (cc.email || '').toLowerCase())), [coldContacts]);
  const dupes = valid.filter(r => existingEmails.has((r[mapping.email] || '').toLowerCase().trim()));
  const fresh = valid.length - dupes.length;

  async function handleImportAndEnroll() {
    setImporting(true);
    try {
      const seen = new Set();
      const newContacts = [];
      for (const r of valid) {
        const email = (r[mapping.email] || '').toLowerCase().trim();
        if (!email || existingEmails.has(email) || seen.has(email)) continue;
        seen.add(email);
        newContacts.push({
          user_id: user.id, email,
          first_name: r[mapping.first_name]?.trim() || null,
          last_name: r[mapping.last_name]?.trim() || null,
          company: r[mapping.company]?.trim() || null,
          title: r[mapping.title]?.trim() || null,
          linkedin_url: r[mapping.linkedin_url]?.trim() || null,
          phone: r[mapping.phone]?.trim() || null,
          source: 'csv', status: 'prospect',
        });
      }
      if (!newContacts.length) { showToast('No new contacts to import.', 'error'); return; }

      const created = [];
      for (let i = 0; i < newContacts.length; i += 100) {
        const { data, error } = await supabase.from('cold_contacts').insert(newContacts.slice(i, i + 100)).select();
        if (error) { showToast(`Import failed: ${error.message}`, 'error'); break; }
        created.push(...(data || []));
      }
      if (!created.length) return;
      await onImportedAndEnroll(created); // parent merges state, then bulk-enrolls
      setParsed(null); setMapping({});
    } finally {
      setImporting(false);
    }
  }

  return (
    <div>
      <p className="text-[13px] text-gray-500 mb-4">Upload a CSV → preview → import as cold contacts AND enroll in this campaign, all in one step.</p>

      {!parsed ? (
        <div className="border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-2xl p-12 text-center hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors">
          <input ref={inputRef} type="file" accept=".csv" onChange={handleFileChange} className="hidden" id="v4-csv-upload" />
          <label htmlFor="v4-csv-upload" className="cursor-pointer block">
            <p className="text-[14px] font-semibold text-gray-900 dark:text-white mb-1">Click to upload a CSV</p>
            <p className="text-[12px] text-gray-400">Required: an email column. Optional: first_name, last_name, company, title, linkedin_url, phone.</p>
          </label>
        </div>
      ) : (
        <div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl">
            {CSV_FIELDS.map(field => (
              <div key={field}>
                <label className="block text-[10px] uppercase tracking-wider text-gray-400 mb-1">{field.replace('_', ' ')}</label>
                <select value={mapping[field] || ''} onChange={e => setMapping(prev => ({ ...prev, [field]: e.target.value }))}
                  className="w-full px-2 py-1.5 text-[12px] border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-lg focus:outline-none">
                  <option value="">— Skip —</option>
                  {parsed.meta.fields?.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-2 flex-wrap mb-4">
            <span className="px-3 py-1 text-[12px] font-semibold bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400 rounded-lg">{fresh} new</span>
            {dupes.length > 0 && <span className="px-3 py-1 text-[12px] font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400 rounded-lg">{dupes.length} duplicates (skipped)</span>}
            {invalid > 0 && <span className="px-3 py-1 text-[12px] font-semibold bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400 rounded-lg">{invalid} invalid (no email)</span>}
          </div>

          {valid.length > 0 && (
            <div className="rounded-xl border border-gray-100 dark:border-gray-800 overflow-x-auto mb-6">
              <table className="w-full text-[12px] min-w-[480px]">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-900/50">
                    {['email', 'first_name', 'last_name', 'company'].filter(f => mapping[f]).map(f => (
                      <th key={f} className="text-left px-3 py-2 font-semibold text-gray-500">{f}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {valid.slice(0, 5).map((r, i) => (
                    <tr key={i} className="border-t border-gray-50 dark:border-gray-800">
                      {['email', 'first_name', 'last_name', 'company'].filter(f => mapping[f]).map(f => (
                        <td key={f} className="px-3 py-2 text-gray-700 dark:text-gray-300">{r[mapping[f]] || '—'}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex items-center justify-between">
            <button onClick={() => { setParsed(null); setMapping({}); }}
              className="text-[12px] font-semibold text-gray-500 hover:underline">Cancel</button>
            <button onClick={handleImportAndEnroll} disabled={importing || busy || fresh === 0}
              className="px-4 py-2 text-[13px] font-semibold text-white bg-gray-900 rounded-xl hover:opacity-90 disabled:opacity-40">
              {importing || busy ? 'Importing…' : `Import ${fresh} & enroll`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// PATH 6 — enroll all, gated
// ---------------------------------------------------------------------------
function EnrollAllPanel({ clients, coldContacts, busy, onEnrollAll }) {
  const [confirmed, setConfirmed] = useState(false);
  const [source, setSource] = useState('relationships');

  const count = source === 'relationships' ? clients.length
    : source === 'cold' ? coldContacts.length
    : clients.length + coldContacts.length;

  return (
    <div className="max-w-lg mx-auto text-center py-12">
      <p className="text-[18px] font-bold text-gray-900 dark:text-white mb-2">Enroll everyone</p>
      <p className="text-[13px] text-gray-500 mb-6">Duplicates and unsubscribed addresses are skipped automatically — but this is still a big red button. Choose your source:</p>
      <div className="flex justify-center gap-2 flex-wrap mb-6">
        {[['relationships', `Relationships (${clients.length})`], ['cold', `Cold Contacts (${coldContacts.length})`], ['both', `All (${clients.length + coldContacts.length})`]].map(([s, label]) => (
          <button key={s} onClick={() => setSource(s)}
            className={`px-4 py-2 text-[12px] font-semibold rounded-lg transition-colors ${source === s
              ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-500'}`}>
            {label}
          </button>
        ))}
      </div>
      <label className="flex items-center justify-center gap-2 mb-6 text-[13px] text-gray-500 cursor-pointer">
        <input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)}
          className="rounded border-gray-300 dark:border-gray-600 dark:bg-gray-800" />
        I understand this enrolls up to {count} contacts and sending begins automatically.
      </label>
      <button onClick={() => onEnrollAll(source)} disabled={!confirmed || busy || count === 0}
        className="px-5 py-2.5 text-[13px] font-semibold text-white bg-gray-900 rounded-xl hover:opacity-90 disabled:opacity-40">
        {busy ? 'Enrolling…' : `Enroll ${count} contacts`}
      </button>
    </div>
  );
}

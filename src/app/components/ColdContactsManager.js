'use client';
// ============================================================================
// BIG UPDATE V4 §4 — COLD CONTACTS MANAGER: a real pipeline view.
// Kanban board (per-status columns, horizontal scroll) AND a table view,
// switchable; status-count header; move-along-pipeline controls; convert
// replied contacts to relationships; inline add form; CSV import entry point
// (reuses the app's existing full-screen import preview flow).
// ============================================================================
import { useMemo, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';

const STATUSES = ['prospect', 'contacted', 'replied', 'converted', 'unsubscribed', 'bounced'];
const STATUS_COLORS = {
  prospect: 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300',
  contacted: 'bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400',
  replied: 'bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400',
  converted: 'bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-400',
  unsubscribed: 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400',
  bounced: 'bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400',
};
// statuses the user may set by hand (unsubscribed/bounced are system-owned)
const MANUAL_STATUSES = ['prospect', 'contacted', 'replied', 'converted'];

function nameOf(cc) {
  return cc.first_name ? `${cc.first_name} ${cc.last_name || ''}`.trim() : cc.email;
}

function ColdContactCard({ cc, onConvert, onStatusChange, onDelete, enrolledSeqName }) {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <div className="p-3.5 rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 hover:shadow-md transition-all group relative">
      <div className="flex items-center gap-2 mb-1.5">
        <div className="w-7 h-7 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-[10px] font-bold text-gray-500 shrink-0">
          {((cc.first_name || cc.email)?.[0] || '?').toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-gray-900 dark:text-white truncate">{nameOf(cc)}</p>
          {(cc.company || cc.title) && <p className="text-[10px] text-gray-400 truncate">{[cc.title, cc.company].filter(Boolean).join(' · ')}</p>}
        </div>
        <button onClick={() => setMenuOpen(v => !v)} aria-label="Contact actions"
          className="opacity-0 group-hover:opacity-100 w-6 h-6 grid place-items-center rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 shrink-0">···</button>
      </div>
      <p className="text-[11px] text-gray-400 truncate mb-1">{cc.email}</p>
      {enrolledSeqName && (
        <p className="text-[10px] text-indigo-500 dark:text-indigo-400 font-medium truncate mb-1">In: {enrolledSeqName}</p>
      )}
      {cc.status === 'replied' && (
        <button onClick={onConvert}
          className="w-full mt-1 py-1.5 text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-950/30 transition-colors">
          Convert to Relationship
        </button>
      )}
      {menuOpen && (
        <div className="absolute right-2 top-9 z-20 w-40 py-1 bg-white dark:bg-gray-900 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700"
          onPointerLeave={() => setMenuOpen(false)}>
          {MANUAL_STATUSES.filter(s => s !== cc.status).map(s => (
            <button key={s} onClick={() => { onStatusChange(s); setMenuOpen(false); }}
              className="w-full text-left px-3 py-1.5 text-[12px] font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800">
              Move to {s}
            </button>
          ))}
          {cc.linkedin_url && (
            <a href={cc.linkedin_url} target="_blank" rel="noopener noreferrer"
              className="block px-3 py-1.5 text-[12px] font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800">
              Open LinkedIn ↗
            </a>
          )}
          <div className="my-1 border-t border-gray-100 dark:border-gray-800" />
          <button onClick={() => { onDelete(); setMenuOpen(false); }}
            className="w-full text-left px-3 py-1.5 text-[12px] font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30">Delete</button>
        </div>
      )}
    </div>
  );
}

function ManagerSkeleton() {
  return (
    <div className="flex gap-3 overflow-hidden" aria-label="Loading contacts">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="min-w-[260px] w-[260px]">
          <div className="h-3 w-20 bg-gray-200 dark:bg-gray-800 rounded mb-3 animate-pulse" />
          {[...Array(3)].map((_, j) => (
            <div key={j} className="h-20 rounded-xl bg-gray-100 dark:bg-gray-800/60 mb-2 animate-pulse" style={{ animationDelay: `${(i + j) * 0.08}s` }} />
          ))}
        </div>
      ))}
    </div>
  );
}

export default function ColdContactsManager({
  coldContacts, loading, user, showToast,
  sequences, enrollments,
  onConvert,          // (coldId) => convertColdToRelationship
  onImportFile,       // (File) => existing CSV import preview flow
  onEnrollAll,        // () => open enrollment panel picker
  onAdded, onUpdated, onDeleted, // state-sync callbacks into page.js
}) {
  const [view, setView] = useState('pipeline');
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ email: '', first_name: '', last_name: '', company: '', title: '', linkedin_url: '' });
  const [adding, setAdding] = useState(false);
  const fileRef = useRef(null);

  const seqNameByContact = useMemo(() => {
    const m = new Map();
    for (const en of enrollments || []) {
      if (en.status === 'active' && en.cold_contact_id) {
        m.set(en.cold_contact_id, (sequences || []).find(s => s.id === en.sequence_id)?.name || 'a campaign');
      }
    }
    return m;
  }, [enrollments, sequences]);

  const byStatus = useMemo(() => {
    const groups = {};
    for (const s of STATUSES) groups[s] = [];
    const q = search.trim().toLowerCase();
    for (const cc of coldContacts || []) {
      if (q && !`${cc.first_name || ''} ${cc.last_name || ''} ${cc.email} ${cc.company || ''} ${cc.title || ''}`.toLowerCase().includes(q)) continue;
      (groups[cc.status] || groups.prospect).push(cc);
    }
    return groups;
  }, [coldContacts, search]);

  async function changeStatus(cc, status) {
    const { error } = await supabase.from('cold_contacts').update({ status }).eq('id', cc.id);
    if (error) { showToast(error.message, 'error'); return; }
    onUpdated({ ...cc, status });
  }

  async function deleteContact(cc) {
    const { error } = await supabase.from('cold_contacts').delete().eq('id', cc.id);
    if (error) { showToast(error.message, 'error'); return; }
    onDeleted(cc.id);
    showToast(`${nameOf(cc)} deleted.`);
  }

  async function handleAdd(e) {
    e.preventDefault();
    const email = addForm.email.trim().toLowerCase();
    if (!email.includes('@')) { showToast('A valid email is required.', 'error'); return; }
    if ((coldContacts || []).some(cc => (cc.email || '').toLowerCase() === email)) {
      showToast('That email is already in your cold contacts.', 'error'); return;
    }
    setAdding(true);
    const { data, error } = await supabase.from('cold_contacts').insert([{
      user_id: user.id, email,
      first_name: addForm.first_name.trim() || null,
      last_name: addForm.last_name.trim() || null,
      company: addForm.company.trim() || null,
      title: addForm.title.trim() || null,
      linkedin_url: addForm.linkedin_url.trim() || null,
      source: 'manual', status: 'prospect',
    }]).select();
    setAdding(false);
    if (error) { showToast(error.message, 'error'); return; }
    onAdded(data[0]);
    setAddForm({ email: '', first_name: '', last_name: '', company: '', title: '', linkedin_url: '' });
    setShowAdd(false);
    showToast('Cold contact added.', 'success');
  }

  if (loading) return <ManagerSkeleton />;

  const total = (coldContacts || []).length;

  return (
    <div>
      {/* status-count header */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-6">
        {STATUSES.map(s => (
          <div key={s} className={`p-3 rounded-xl ${STATUS_COLORS[s]}`}>
            <p className="text-[18px] font-bold tabular-nums">{byStatus[s]?.length ?? 0}</p>
            <p className="text-[10px] uppercase tracking-wider opacity-60">{s}</p>
          </div>
        ))}
      </div>

      {/* controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div className="flex gap-1.5">
          {[['pipeline', 'Pipeline'], ['table', 'Table']].map(([k, label]) => (
            <button key={k} onClick={() => setView(k)}
              className={`px-3 py-1.5 text-[12px] font-semibold rounded-lg transition-colors ${view === k
                ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900'
                : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'}`}>
              {label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <input type="text" placeholder="Search contacts…" value={search} onChange={e => setSearch(e.target.value)}
            className="px-3 py-1.5 text-[12px] border border-gray-200 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:placeholder-gray-500 rounded-lg w-52 focus:outline-none focus:border-gray-400" />
          <input ref={fileRef} type="file" accept=".csv" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) onImportFile(f); e.target.value = ''; }} />
          <button onClick={() => fileRef.current?.click()}
            className="px-3 py-1.5 text-[12px] font-semibold text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800">Import CSV</button>
          <button onClick={onEnrollAll}
            className="px-3 py-1.5 text-[12px] font-semibold text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-900 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-950/30">Enroll in campaign</button>
          <button onClick={() => setShowAdd(v => !v)}
            className="px-3 py-1.5 text-[12px] font-semibold text-white bg-gray-900 rounded-lg hover:opacity-90">{showAdd ? 'Close' : 'Add Contact'}</button>
        </div>
      </div>

      {/* inline add form */}
      {showAdd && (
        <form onSubmit={handleAdd} className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-6 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl text-[13px]">
          {[['email', 'Email *'], ['first_name', 'First name'], ['last_name', 'Last name'], ['company', 'Company'], ['title', 'Title'], ['linkedin_url', 'LinkedIn URL']].map(([k, label]) => (
            <input key={k} value={addForm[k]} onChange={e => setAddForm(prev => ({ ...prev, [k]: e.target.value }))} placeholder={label}
              required={k === 'email'} type={k === 'email' ? 'email' : 'text'}
              className="px-3 py-2 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:placeholder-gray-500 rounded-lg focus:outline-none focus:border-gray-400" />
          ))}
          <button type="submit" disabled={adding}
            className="col-span-2 sm:col-span-3 justify-self-end px-4 py-2 text-[12.5px] font-semibold text-white bg-gray-900 rounded-xl hover:opacity-90 disabled:opacity-50">
            {adding ? 'Adding…' : 'Add contact'}
          </button>
        </form>
      )}

      {total === 0 ? (
        <div className="text-center py-16 border border-dashed border-gray-200 dark:border-gray-700 rounded-2xl">
          <p className="text-[15px] font-bold text-gray-900 dark:text-white mb-1">No cold contacts yet</p>
          <p className="text-[13px] text-gray-400 mb-4 max-w-sm mx-auto">Import a CSV of prospects or add one by hand — then enroll them in a campaign and let it run.</p>
          <button onClick={() => fileRef.current?.click()}
            className="px-4 py-2 text-[13px] font-semibold text-white bg-gray-900 rounded-xl hover:opacity-90">Import a CSV</button>
        </div>
      ) : view === 'pipeline' ? (
        <div className="flex gap-3 overflow-x-auto pb-4 snap-x">
          {STATUSES.map(status => (
            <div key={status} className="min-w-[260px] w-[260px] snap-start">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">{status}</span>
                <span className="text-[11px] font-mono text-gray-400">{byStatus[status].length}</span>
              </div>
              <div className="space-y-2">
                {byStatus[status].map(cc => (
                  <ColdContactCard key={cc.id} cc={cc}
                    enrolledSeqName={seqNameByContact.get(cc.id)}
                    onConvert={() => onConvert(cc.id)}
                    onStatusChange={s => changeStatus(cc, s)}
                    onDelete={() => deleteContact(cc)} />
                ))}
                {byStatus[status].length === 0 && (
                  <div className="p-4 rounded-xl border border-dashed border-gray-200 dark:border-gray-700 text-center">
                    <p className="text-[11px] text-gray-400">No contacts in {status}</p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-gray-100 dark:border-gray-800 overflow-x-auto">
          <table className="w-full text-[13px] min-w-[680px]">
            <thead className="bg-gray-50 dark:bg-gray-900/50">
              <tr>
                <th className="text-left px-3 py-2.5 font-semibold text-gray-500">Email</th>
                <th className="text-left px-3 py-2.5 font-semibold text-gray-500">Name</th>
                <th className="text-left px-3 py-2.5 font-semibold text-gray-500">Company</th>
                <th className="text-left px-3 py-2.5 font-semibold text-gray-500">Title</th>
                <th className="text-left px-3 py-2.5 font-semibold text-gray-500">Status</th>
                <th className="text-right px-3 py-2.5 font-semibold text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {STATUSES.flatMap(s => byStatus[s]).map(cc => (
                <tr key={cc.id} className="border-t border-gray-50 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900/50">
                  <td className="px-3 py-2.5 font-medium text-gray-900 dark:text-white">{cc.email}</td>
                  <td className="px-3 py-2.5 text-gray-500">{`${cc.first_name || ''} ${cc.last_name || ''}`.trim() || '—'}</td>
                  <td className="px-3 py-2.5 text-gray-500">{cc.company || '—'}</td>
                  <td className="px-3 py-2.5 text-gray-500">{cc.title || '—'}</td>
                  <td className="px-3 py-2.5">
                    {['unsubscribed', 'bounced'].includes(cc.status) ? (
                      <span className={`px-2 py-0.5 text-[10.5px] font-bold rounded-full ${STATUS_COLORS[cc.status]}`}>{cc.status}</span>
                    ) : (
                      <select value={cc.status} onChange={e => changeStatus(cc, e.target.value)}
                        className="px-1.5 py-0.5 text-[11.5px] border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-lg focus:outline-none">
                        {MANUAL_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right space-x-2 whitespace-nowrap">
                    {cc.status === 'replied' && (
                      <button onClick={() => onConvert(cc.id)} className="text-[11.5px] font-semibold text-green-600 hover:underline">Convert →</button>
                    )}
                    <button onClick={() => deleteContact(cc)} className="text-[11.5px] font-semibold text-gray-300 hover:text-red-500">Delete</button>
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

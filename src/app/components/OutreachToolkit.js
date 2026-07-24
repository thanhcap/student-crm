'use client';
// ============================================================================
// 50-FEATURE EXPANSION — deterministic utilities (no AI, no external calls).
// A tabbed "Toolkit" plus pure helper functions imported elsewhere:
//   C12 Offer comparator · C13 Interview practice · B10 Negotiation scripts ·
//   A5 Networking score · B8 Reputation dashboard · D20 Multi-person scheduling.
// Pure exports (used by page.js): parseQuerySyntax/applyQueryFilters (J45),
//   findWarmIntroPaths (A2), computeSkillGaps (C16), checkBurnoutSignal (G33),
//   parseSignatureBlock (E23), findOverlappingAvailability (D20),
//   effectiveWarmupCap (B6), fireConfetti (J48).
// ============================================================================
import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';

const inputCls = 'w-full px-3 py-2 text-[13px] border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:placeholder-gray-500 rounded-lg focus:outline-none focus:border-gray-400';
function TBtn({ children, onClick, disabled, variant = 'primary', className = '' }) {
  const base = variant === 'primary' ? 'text-white bg-gray-900 dark:bg-white dark:text-gray-900 hover:opacity-90'
    : variant === 'danger' ? 'text-white bg-red-600 hover:opacity-90'
    : 'text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800';
  return <button onClick={onClick} disabled={disabled} className={`px-4 py-2 text-[13px] font-semibold rounded-xl disabled:opacity-40 ${base} ${className}`}>{children}</button>;
}
function Field({ label, children }) {
  return <label className="block"><span className="block text-[11px] font-medium text-gray-500 mb-1">{label}</span>{children}</label>;
}
function fmtTime(s) { const m = Math.floor(s / 60); const r = s % 60; return `${m}:${String(r).padStart(2, '0')}`; }

// ===========================================================================
// PURE HELPERS (exported)
// ===========================================================================

// J45 — power-user query syntax: priority:high status:active nomail:14d tag:"warm lead" company:acme
export function parseQuerySyntax(query) {
  const tokens = (query || '').match(/(\w+):("[^"]+"|\S+)/g) || [];
  const filters = {};
  for (const t of tokens) {
    const idx = t.indexOf(':');
    filters[t.slice(0, idx)] = t.slice(idx + 1).replace(/"/g, '');
  }
  const freeText = (query || '').replace(/(\w+):("[^"]+"|\S+)/g, '').trim();
  return { filters, freeText };
}

export function applyQueryFilters(clients, { filters, freeText }, ctx = {}) {
  const { clientTagMap = {}, tags = [], lastActivityDate = () => null } = ctx;
  const daysBetween = (a, b) => Math.floor((b - a) / 864e5);
  return (clients || []).filter(c => {
    if (filters.priority && (c.relationship || '').toLowerCase() !== filters.priority.toLowerCase()) return false;
    if (filters.status && (c.status || '').toLowerCase() !== filters.status.toLowerCase()) return false;
    if (filters.company && !(c.company_name || '').toLowerCase().includes(filters.company.toLowerCase())) return false;
    if (filters.source && (c.source || '').toLowerCase() !== filters.source.toLowerCase()) return false;
    if (filters.country && (c.country || '').toLowerCase() !== filters.country.toLowerCase()) return false;
    if (filters.nomail) {
      const days = parseInt(filters.nomail, 10);
      const last = lastActivityDate(c.id);
      if (!last || daysBetween(new Date(last), new Date()) < days) return false;
    }
    if (filters.tag) {
      const tagNames = (clientTagMap[c.id] || []).map(id => tags.find(t => t.id === id)?.name?.toLowerCase());
      if (!tagNames.includes(filters.tag.toLowerCase())) return false;
    }
    if (freeText && !`${c.name || ''} ${c.email || ''} ${c.company_name || ''}`.toLowerCase().includes(freeText.toLowerCase())) return false;
    return true;
  });
}

// A2 — warm intro paths through the network graph (relationship_connections)
export function findWarmIntroPaths(targetCompany, connections, clients) {
  const q = (targetCompany || '').toLowerCase().trim();
  if (!q) return [];
  const myIds = new Set(clients.map(c => c.id));
  const byId = new Map(clients.map(c => [c.id, c]));
  const paths = [];
  const seen = new Set();
  for (const conn of connections || []) {
    for (const [bridgeId, targetId] of [[conn.from_client_id, conn.to_client_id], [conn.to_client_id, conn.from_client_id]]) {
      if (!myIds.has(bridgeId)) continue;
      const target = byId.get(targetId);
      if (!target?.company_name || !target.company_name.toLowerCase().includes(q)) continue;
      const key = `${bridgeId}-${targetId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      paths.push({ bridge: byId.get(bridgeId), target, connectionType: conn.relationship_type });
    }
  }
  return paths;
}

// C16 — skill gaps: which common skills recur in saved job postings but not in the goal
export function computeSkillGaps(careerGoal, jobPostings) {
  const SKILLS = ['python', 'sql', 'excel', 'react', 'javascript', 'leadership', 'communication', 'financial modeling', 'powerpoint', 'stakeholder management', 'data analysis', 'project management'];
  const postingText = (jobPostings || []).map(p => `${p.title || ''} ${p.description || ''}`).join(' ').toLowerCase();
  const goalText = (careerGoal?.goal || '').toLowerCase();
  return SKILLS
    .map(skill => ({ skill, mentions: (postingText.match(new RegExp(skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length, inGoal: goalText.includes(skill) }))
    .filter(s => s.mentions > 0 && !s.inGoal)
    .sort((a, b) => b.mentions - a.mentions);
}

// G33 — burnout signal (gentle, threshold-based, never alarming)
export function checkBurnoutSignal(activities, sends) {
  const now = Date.now();
  const day = 864e5;
  const inWin = (d, from, to) => { const t = new Date(d).getTime(); return t >= from && t < to; };
  const thisWeek = (activities || []).filter(a => a.activity_date && inWin(a.activity_date, now - 7 * day, now)).length;
  const prior12wk = (activities || []).filter(a => a.activity_date && inWin(a.activity_date, now - 91 * day, now - 7 * day)).length;
  const weeklyAvg = prior12wk / 12;
  if (weeklyAvg < 3) return { flagged: false }; // not enough history to judge
  const spike = thisWeek / Math.max(weeklyAvg, 1);
  const recentSends = (sends || []).filter(s => s.sent_at && inWin(s.sent_at, now - 7 * day, now));
  const olderSends = (sends || []).filter(s => s.sent_at && inWin(s.sent_at, now - 91 * day, now - 7 * day));
  const rate = arr => arr.length ? arr.filter(s => s.replied_at).length / arr.length : 0;
  const recentRate = rate(recentSends), olderRate = rate(olderSends);
  if (spike > 1.5 && recentSends.length >= 10 && recentRate < olderRate * 0.7) {
    return { flagged: true, message: `You've been ${Math.round((spike - 1) * 100)}% busier than usual this week and replies are softer than your baseline. No rush — it's fine to ease off and protect your energy.` };
  }
  return { flagged: false };
}

// E23 — email signature parser (regex, deterministic)
export function parseSignatureBlock(emailBody) {
  const lines = (emailBody || '').split('\n').slice(-8).map(l => l.trim()).filter(Boolean);
  const phone = (emailBody || '').match(/(\+?\d[\d\s().-]{7,}\d)/);
  const email = (emailBody || '').match(/[\w.+-]+@[\w-]+\.[\w.-]+/);
  const titleLine = lines.find(l => /\b(manager|director|engineer|analyst|president|founder|ceo|cto|coo|cfo|vp|head of|lead|associate|partner)\b/i.test(l));
  const nameLine = lines[0];
  return {
    name: nameLine && nameLine.length < 40 && !/@/.test(nameLine) ? nameLine : null,
    title: titleLine || null,
    phone: phone ? phone[1].trim() : null,
    email: email ? email[0] : null,
  };
}

// D20 — multi-person scheduling: UTC hours where everyone is inside working hours
export function findOverlappingAvailability(participants) {
  const overlaps = [];
  for (let utcHour = 0; utcHour < 24; utcHour++) {
    const all = (participants || []).every(p => {
      const wh = p.workingHours || { start: 9, end: 17 };
      const localHour = (((utcHour + (p.tzOffset || 0) / 60) % 24) + 24) % 24;
      return localHour >= wh.start && localHour < wh.end;
    });
    if (all) overlaps.push(utcHour);
  }
  return overlaps;
}

// B6 — warm-up ramp: today's effective daily cap
export function effectiveWarmupCap(settings) {
  if (!settings?.warmup_enabled || !settings.warmup_started_at) return settings?.daily_send_cap ?? 50;
  const days = Math.floor((Date.now() - new Date(settings.warmup_started_at).getTime()) / 864e5);
  const increments = Math.floor(days / Math.max(settings.warmup_increment_days || 3, 1));
  const ramped = (settings.warmup_start_cap ?? 10) + increments * (settings.warmup_increment ?? 5);
  return Math.min(ramped, settings.daily_send_cap ?? 50);
}

// J48 — confetti burst (canvas particles, no library)
export function fireConfetti() {
  if (typeof document === 'undefined') return;
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;z-index:9999;pointer-events:none;';
  document.body.appendChild(canvas);
  canvas.width = innerWidth; canvas.height = innerHeight;
  const ctx = canvas.getContext('2d');
  const particles = Array.from({ length: 120 }, () => ({
    x: innerWidth / 2, y: innerHeight / 2,
    vx: (Math.random() - 0.5) * 16, vy: (Math.random() - 1.5) * 16,
    color: `hsl(${Math.random() * 360},80%,60%)`, life: 1,
  }));
  function tick() {
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    let alive = false;
    for (const p of particles) {
      p.x += p.vx; p.y += p.vy; p.vy += 0.4; p.life -= 0.012;
      if (p.life > 0) { alive = true; ctx.globalAlpha = p.life; ctx.fillStyle = p.color; ctx.fillRect(p.x, p.y, 6, 6); }
    }
    if (alive) requestAnimationFrame(tick); else canvas.remove();
  }
  tick();
}

// A5 — networking score from real data
export function computeNetworkingScore({ relCount, activities30d, dealsWon }) {
  return (relCount || 0) * 2 + (activities30d || 0) * 3 + (dealsWon || 0) * 15;
}

// ===========================================================================
// C12 — OFFER COMPARATOR
// ===========================================================================
function OfferComparator({ user, applications, showToast }) {
  const [offers, setOffers] = useState(null);
  const [form, setForm] = useState({ company_name: '', base_salary: '', signing_bonus: '', equity_value: '', cost_of_living_index: '100', location: '', application_id: '' });
  const load = () => supabase.from('offer_comparisons').select('*').order('created_at', { ascending: false }).then(({ data }) => setOffers(data || []));
  useEffect(() => { load(); }, []);

  const adjusted = o => Math.round(((Number(o.base_salary) || 0) + (Number(o.signing_bonus) || 0) / 4 + (Number(o.equity_value) || 0) / 4) / ((Number(o.cost_of_living_index) || 100) / 100));

  async function add(e) {
    e.preventDefault();
    if (!form.company_name.trim()) return;
    const row = {
      user_id: user.id, company_name: form.company_name.trim(),
      base_salary: Number(form.base_salary) || null, signing_bonus: Number(form.signing_bonus) || null,
      equity_value: Number(form.equity_value) || null, cost_of_living_index: Number(form.cost_of_living_index) || 100,
      location: form.location.trim() || null, application_id: form.application_id ? Number(form.application_id) : null,
    };
    const { data, error } = await supabase.from('offer_comparisons').insert([row]).select();
    if (error) { showToast(error.message, 'error'); return; }
    setOffers(prev => [data[0], ...prev]);
    setForm({ company_name: '', base_salary: '', signing_bonus: '', equity_value: '', cost_of_living_index: '100', location: '', application_id: '' });
  }
  async function remove(id) {
    await supabase.from('offer_comparisons').delete().eq('id', id);
    setOffers(prev => prev.filter(o => o.id !== id));
  }

  const sorted = [...(offers || [])].sort((a, b) => adjusted(b) - adjusted(a));
  return (
    <div>
      <p className="text-[13px] text-gray-500 mb-4">Compare offers on a cost-of-living-adjusted total. COL index 100 = national average; enter a real regional index for accuracy.</p>
      <form onSubmit={add} className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-5 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl">
        <Field label="Company"><input className={inputCls} value={form.company_name} onChange={e => setForm(f => ({ ...f, company_name: e.target.value }))} required /></Field>
        <Field label="Base $"><input className={inputCls} type="number" value={form.base_salary} onChange={e => setForm(f => ({ ...f, base_salary: e.target.value }))} /></Field>
        <Field label="Signing $"><input className={inputCls} type="number" value={form.signing_bonus} onChange={e => setForm(f => ({ ...f, signing_bonus: e.target.value }))} /></Field>
        <Field label="Equity $ (total)"><input className={inputCls} type="number" value={form.equity_value} onChange={e => setForm(f => ({ ...f, equity_value: e.target.value }))} /></Field>
        <Field label="COL index"><input className={inputCls} type="number" value={form.cost_of_living_index} onChange={e => setForm(f => ({ ...f, cost_of_living_index: e.target.value }))} /></Field>
        <Field label="Location"><input className={inputCls} value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} /></Field>
        <Field label="Link to application">
          <select className={inputCls} value={form.application_id} onChange={e => setForm(f => ({ ...f, application_id: e.target.value }))}>
            <option value="">— none —</option>
            {(applications || []).map(a => <option key={a.id} value={a.id}>{a.company_name} · {a.role_title}</option>)}
          </select>
        </Field>
        <div className="flex items-end"><TBtn>Add offer</TBtn></div>
      </form>

      {offers === null ? <p className="text-[13px] text-gray-400">Loading…</p> : sorted.length === 0 ? (
        <p className="text-[13px] text-gray-400 text-center py-8">No offers yet — add one above to compare.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-100 dark:border-gray-800">
          <table className="w-full text-[13px] min-w-[640px]">
            <thead className="bg-gray-50 dark:bg-gray-900/50"><tr>
              <th className="text-left px-3 py-2 font-semibold text-gray-500">Company</th>
              <th className="text-right px-3 py-2 font-semibold text-gray-500">Base</th>
              <th className="text-right px-3 py-2 font-semibold text-gray-500">Signing</th>
              <th className="text-right px-3 py-2 font-semibold text-gray-500">Equity</th>
              <th className="text-right px-3 py-2 font-semibold text-gray-500">COL</th>
              <th className="text-right px-3 py-2 font-semibold text-gray-500">Adjusted total</th>
              <th />
            </tr></thead>
            <tbody>
              {sorted.map((o, i) => (
                <tr key={o.id} className={`border-t border-gray-50 dark:border-gray-800 ${i === 0 ? 'bg-green-50/40 dark:bg-green-950/20' : ''}`}>
                  <td className="px-3 py-2 font-semibold text-gray-900 dark:text-white">{o.company_name}{i === 0 && <span className="ml-1.5 text-[9px] font-bold text-green-700 dark:text-green-400">BEST</span>}{o.location ? <span className="block text-[10px] text-gray-400">{o.location}</span> : null}</td>
                  <td className="px-3 py-2 text-right">${(Number(o.base_salary) || 0).toLocaleString()}</td>
                  <td className="px-3 py-2 text-right">${(Number(o.signing_bonus) || 0).toLocaleString()}</td>
                  <td className="px-3 py-2 text-right">${(Number(o.equity_value) || 0).toLocaleString()}</td>
                  <td className="px-3 py-2 text-right">{o.cost_of_living_index}</td>
                  <td className="px-3 py-2 text-right font-bold text-green-600 dark:text-green-400">${adjusted(o).toLocaleString()}</td>
                  <td className="px-3 py-2 text-right"><button onClick={() => remove(o.id)} className="text-[11px] text-gray-300 hover:text-red-500">Delete</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ===========================================================================
// C13 — INTERVIEW PRACTICE MODE
// ===========================================================================
const PRACTICE_CATEGORIES = ['Software Engineering', 'Product Management', 'Investment Banking', 'Consulting', 'General Behavioral'];
function PracticeMode({ user, showToast }) {
  const [questions, setQuestions] = useState(null);
  const [category, setCategory] = useState('General Behavioral');
  const [current, setCurrent] = useState(null);
  const [answer, setAnswer] = useState('');
  const [seconds, setSeconds] = useState(0);
  const [running, setRunning] = useState(false);
  const [history, setHistory] = useState([]);
  const timerRef = useRef(null);

  useEffect(() => {
    supabase.from('interview_questions').select('*').then(({ data }) => setQuestions(data || []));
    supabase.from('practice_sessions').select('*, interview_questions(question)').order('created_at', { ascending: false }).limit(20).then(({ data }) => setHistory(data || []));
  }, []);

  function startNew() {
    const pool = (questions || []).filter(q => q.role_category === category);
    if (!pool.length) { showToast('No questions seeded for this category yet.', 'error'); return; }
    setCurrent(pool[Math.floor(Math.random() * pool.length)]);
    setAnswer(''); setSeconds(0); setRunning(true);
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => setSeconds(s => s + 1), 1000);
  }
  async function finish() {
    clearInterval(timerRef.current); setRunning(false);
    const { data } = await supabase.from('practice_sessions').insert([{ user_id: user.id, question_id: current.id, my_answer: answer, duration_seconds: seconds }]).select('*, interview_questions(question)');
    if (data) setHistory(prev => [data[0], ...prev]);
    setCurrent(null);
  }
  useEffect(() => () => clearInterval(timerRef.current), []);

  return (
    <div className="max-w-xl mx-auto">
      {!current ? (
        <div className="text-center py-6">
          <select className={`${inputCls} max-w-xs mx-auto mb-4`} value={category} onChange={e => setCategory(e.target.value)}>
            {PRACTICE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <div><TBtn onClick={startNew}>Start practice</TBtn></div>
          {history.length > 0 && (
            <div className="mt-8 text-left">
              <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-2">Recent sessions</p>
              {history.slice(0, 8).map(h => (
                <div key={h.id} className="py-2 border-t border-gray-50 dark:border-gray-800">
                  <p className="text-[12.5px] font-medium text-gray-800 dark:text-gray-200">{h.interview_questions?.question || 'Question'}</p>
                  <p className="text-[11px] text-gray-400">{fmtTime(h.duration_seconds || 0)} · {(h.my_answer || '').slice(0, 80)}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="text-center">
          <p className="text-[11px] uppercase tracking-wider text-gray-400 mb-2 font-mono">{fmtTime(seconds)}</p>
          <p className="text-[17px] font-semibold text-gray-900 dark:text-white mb-4">{current.question}</p>
          <textarea className={inputCls} rows={6} value={answer} onChange={e => setAnswer(e.target.value)} placeholder="Jot your answer as you say it out loud…" />
          <div className="flex justify-center gap-2 mt-4">
            <TBtn variant="ghost" onClick={startNew}>Skip</TBtn>
            <TBtn onClick={finish}>Done — save & next</TBtn>
          </div>
        </div>
      )}
    </div>
  );
}

// ===========================================================================
// B10 — NEGOTIATION SCRIPTS
// ===========================================================================
// B10 — the 5 built-in scripts ship as constants rather than seeded rows:
// negotiation_scripts.user_id is NOT NULL and its RLS is own-rows-only, so a
// globally-shared seed row is impossible in that table (it would be invisible
// to everyone but its owner). "Make my version" persists a real owned copy.
const BUILTIN_SCRIPTS = [
  { id: 'b1', is_builtin: true, scenario: 'Price Objection', title: 'Reframe to value', body: 'I hear that the price is a concern. Before we talk numbers, can I ask what a good outcome here would be worth to you? I want to compare the cost against the value, not against zero. I can also walk through exactly what is driving the figure so nothing feels like a black box.' },
  { id: 'b2', is_builtin: true, scenario: 'Timeline Pushback', title: 'Protect the timeline', body: 'Totally understand the pressure on timing. To hit that date safely, here is what I would need from your side by [date]. If that slips I would rather flag it now than surprise you later. Would it help to scope a smaller first phase to keep momentum?' },
  { id: 'b3', is_builtin: true, scenario: 'Counter-Offer', title: 'Respond to a counter', body: 'Thanks for the counter, I appreciate you being direct. Here is where I have room and where I do not: I can move on [X], I really cannot move on [Y] without changing scope. Can we find the version that works for both of us rather than splitting the difference?' },
  { id: 'b4', is_builtin: true, scenario: 'Extending a Deadline', title: 'Ask for more time gracefully', body: 'I want to do this properly rather than rush and hand you something half-baked. Could we push to [date]? If the original date is firm, tell me and I will cut scope to hit it. I would rather you make that call than me guess.' },
  { id: 'b5', is_builtin: true, scenario: 'Asking for a Referral Fee', title: 'Raise a referral fee', body: 'I would love to send business your way and I suspect you feel the same. Would you be open to a simple referral arrangement, say [X] percent or a flat [amount] per closed intro? Happy to put it in writing so it is clean for both of us.' },
];

function NegotiationScripts({ user, showToast }) {
  const [mine, setMine] = useState(null);
  const [editing, setEditing] = useState(null);
  useEffect(() => { supabase.from('negotiation_scripts').select('*').order('created_at').then(({ data }) => setMine(data || [])); }, []);
  const scripts = [...BUILTIN_SCRIPTS, ...(mine || [])];
  async function saveCopy(s) {
    const { data, error } = await supabase.from('negotiation_scripts').insert([{ user_id: user.id, scenario: s.scenario, title: `${s.title} (my version)`, body: s.body, is_builtin: false }]).select();
    if (error) { showToast(error.message, 'error'); return; }
    setMine(prev => [...(prev || []), data[0]]);
    setEditing(data[0]);
    showToast('Copied to your scripts — edit freely.', 'success');
  }
  async function saveEdit() {
    const { error } = await supabase.from('negotiation_scripts').update({ title: editing.title, body: editing.body }).eq('id', editing.id);
    if (error) { showToast(error.message, 'error'); return; }
    setMine(prev => (prev || []).map(s => s.id === editing.id ? editing : s));
    setEditing(null);
    showToast('Saved.', 'success');
  }
  async function removeMine(id) {
    await supabase.from('negotiation_scripts').delete().eq('id', id);
    setMine(prev => (prev || []).filter(s => s.id !== id));
  }
  if (mine === null) return <p className="text-[13px] text-gray-400">Loading…</p>;
  return (
    <div className="space-y-3">
      <p className="text-[13px] text-gray-500">Proven scripts for tough moments. Copy any into your own editable version, then insert it into an email from the composer.</p>
      {scripts.length === 0 && <p className="text-[12px] text-gray-400">No scripts seeded yet.</p>}
      {scripts.map(s => (
        <div key={s.id} className="p-4 rounded-xl border border-gray-100 dark:border-gray-800">
          <div className="flex items-center justify-between mb-1">
            <div><span className="text-[10px] font-bold uppercase tracking-wider text-indigo-500">{s.scenario}</span><p className="text-[13.5px] font-bold text-gray-900 dark:text-white">{s.title}</p></div>
            <div className="flex gap-2 text-[11.5px] font-semibold">
              <button onClick={() => { navigator.clipboard?.writeText(s.body); showToast('Copied to clipboard.'); }} className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">Copy text</button>
              {s.is_builtin ? <button onClick={() => saveCopy(s)} className="text-indigo-600 dark:text-indigo-400 hover:underline">Make my version</button>
                : <>
                    <button onClick={() => setEditing(s)} className="text-indigo-600 dark:text-indigo-400 hover:underline">Edit</button>
                    <button onClick={() => removeMine(s.id)} className="text-gray-300 hover:text-red-500">Delete</button>
                  </>}
            </div>
          </div>
          {editing?.id === s.id ? (
            <div className="mt-2 space-y-2">
              <input className={inputCls} value={editing.title} onChange={e => setEditing({ ...editing, title: e.target.value })} />
              <textarea className={inputCls} rows={4} value={editing.body} onChange={e => setEditing({ ...editing, body: e.target.value })} />
              <div className="flex gap-2"><TBtn onClick={saveEdit}>Save</TBtn><TBtn variant="ghost" onClick={() => setEditing(null)}>Cancel</TBtn></div>
            </div>
          ) : <p className="text-[12.5px] text-gray-600 dark:text-gray-300 whitespace-pre-wrap mt-1">{s.body}</p>}
        </div>
      ))}
    </div>
  );
}

// ===========================================================================
// B8 — SEND REPUTATION DASHBOARD  +  A5 — NETWORKING SCORE
// ===========================================================================
function ReputationAndScore({ user, sends, clients, activities, deals, showToast }) {
  const rep = useMemo(() => {
    const cutoff = Date.now() - 30 * 864e5;
    const recent = (sends || []).filter(s => s.sent_at && new Date(s.sent_at).getTime() > cutoff);
    const bounced = recent.filter(s => s.bounced_at).length;
    const unsub = recent.filter(s => s.unsubscribed_at).length;
    const bounceRate = recent.length ? (bounced / recent.length * 100) : 0;
    const complaintRate = recent.length ? (unsub / recent.length * 100) : 0;
    return { total: recent.length, bounceRate, complaintRate, healthy: bounceRate < 2 && complaintRate < 0.5 };
  }, [sends]);

  const score = useMemo(() => {
    const cutoff = Date.now() - 30 * 864e5;
    const a30 = (activities || []).filter(a => a.activity_date && new Date(a.activity_date).getTime() > cutoff).length;
    const won = (deals || []).filter(d => d.stage === 'Won').length;
    return computeNetworkingScore({ relCount: (clients || []).length, activities30d: a30, dealsWon: won });
  }, [clients, activities, deals]);

  const [optIn, setOptIn] = useState(false);
  useEffect(() => { supabase.from('networking_scores').select('opt_in').eq('user_id', user.id).maybeSingle().then(({ data }) => setOptIn(!!data?.opt_in)); }, [user.id]);
  async function saveScore(nextOptIn) {
    await supabase.from('networking_scores').upsert({ user_id: user.id, score, opt_in: nextOptIn, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
    setOptIn(nextOptIn);
    showToast(nextOptIn ? 'Score published to the opt-in leaderboard.' : 'Score saved (private).', 'success');
  }

  const dot = rep.healthy ? 'bg-green-500' : (rep.bounceRate >= 5 || rep.complaintRate >= 1) ? 'bg-red-500' : 'bg-amber-500';
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div className="p-5 rounded-2xl border border-gray-100 dark:border-gray-800">
        <div className="flex items-center gap-2 mb-3"><span className={`w-2 h-2 rounded-full ${dot}`} /><h3 className="text-[14px] font-bold text-gray-900 dark:text-white">Send reputation (30d)</h3></div>
        <div className="flex gap-6">
          <div><p className="text-[22px] font-bold text-gray-900 dark:text-white tabular-nums">{rep.bounceRate.toFixed(1)}%</p><p className="text-[11px] text-gray-400">bounce rate</p></div>
          <div><p className="text-[22px] font-bold text-gray-900 dark:text-white tabular-nums">{rep.complaintRate.toFixed(1)}%</p><p className="text-[11px] text-gray-400">unsub/complaint</p></div>
          <div><p className="text-[22px] font-bold text-gray-900 dark:text-white tabular-nums">{rep.total}</p><p className="text-[11px] text-gray-400">sent</p></div>
        </div>
        {!rep.healthy && rep.total > 0 && <p className="mt-3 text-[12px] text-amber-700 dark:text-amber-400">Bounce &gt;2% or complaints &gt;0.5% — consider pausing sending and cleaning your list before continuing.</p>}
      </div>
      <div className="p-5 rounded-2xl border border-gray-100 dark:border-gray-800">
        <h3 className="text-[14px] font-bold text-gray-900 dark:text-white mb-1">Networking score</h3>
        <p className="text-[34px] font-bold text-indigo-600 dark:text-indigo-400 leading-none tabular-nums">{score}</p>
        <p className="text-[11px] text-gray-400 mt-1">relationships×2 + activities(30d)×3 + deals won×15</p>
        <label className="flex items-center gap-2 mt-3 text-[12px] text-gray-500 cursor-pointer">
          <input type="checkbox" checked={optIn} onChange={e => saveScore(e.target.checked)} className="rounded border-gray-300 dark:border-gray-600 dark:bg-gray-800" />
          Show me on the opt-in public leaderboard
        </label>
      </div>
    </div>
  );
}

// ===========================================================================
// D20 — MULTI-PERSON SCHEDULING OVERLAP
// ===========================================================================
function SchedulingOverlap({ clients }) {
  const [picked, setPicked] = useState([]);
  const myTz = -new Date().getTimezoneOffset(); // minutes east of UTC
  const withTz = (clients || []).filter(c => c.timezone || c.timezone_offset != null);
  const participants = [
    { name: 'You', tzOffset: myTz, workingHours: { start: 9, end: 17 } },
    ...picked.map(id => {
      const c = clients.find(x => x.id === id);
      return { name: c?.name, tzOffset: c?.timezone_offset ?? 0, workingHours: { start: 9, end: 17 } };
    }),
  ];
  const overlap = findOverlappingAvailability(participants);
  const localLabel = utcHour => { const h = (((utcHour + myTz / 60) % 24) + 24) % 24; const hh = Math.floor(h); return `${hh === 0 ? 12 : hh > 12 ? hh - 12 : hh}${hh < 12 ? 'am' : 'pm'}`; };

  return (
    <div>
      <p className="text-[13px] text-gray-500 mb-3">Pick relationships (with a timezone set) to see the hours that fall inside everyone’s 9–5 working day, shown in your local time.</p>
      <div className="flex flex-wrap gap-1.5 mb-4">
        {withTz.length === 0 && <p className="text-[12px] text-gray-400">No relationships have a timezone set yet.</p>}
        {withTz.map(c => (
          <button key={c.id} onClick={() => setPicked(p => p.includes(c.id) ? p.filter(x => x !== c.id) : [...p, c.id])}
            className={`px-2.5 py-1 text-[12px] font-semibold rounded-full ${picked.includes(c.id) ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900' : 'bg-gray-100 dark:bg-gray-800 text-gray-500'}`}>{c.name}</button>
        ))}
      </div>
      <div className="p-4 rounded-xl bg-indigo-50 dark:bg-indigo-950/30">
        {overlap.length === 0 ? <p className="text-[13px] text-indigo-700 dark:text-indigo-300">No overlapping working hours for this group.</p>
          : <p className="text-[13px] font-semibold text-indigo-700 dark:text-indigo-300">Works for everyone (your time): {overlap.map(localLabel).join(', ')}</p>}
      </div>
    </div>
  );
}

// ===========================================================================
// TOOLKIT SHELL
// ===========================================================================
export default function OutreachToolkit({ user, showToast, clients, activities, deals, sends, applications }) {
  const [tab, setTab] = useState('offers');
  const tabs = [
    ['offers', 'Offer comparator'],
    ['practice', 'Interview practice'],
    ['scripts', 'Negotiation scripts'],
    ['reputation', 'Reputation & score'],
    ['scheduling', 'Find a meeting time'],
  ];
  return (
    <div className="animate-in fade-in duration-200">
      <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-100 mb-1">Toolkit</h1>
      <p className="text-[13px] text-gray-500 mb-5">Deterministic tools — no AI, all computed from your own data.</p>
      <div className="flex gap-1.5 flex-wrap mb-6">
        {tabs.map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)} className={`px-3 py-1.5 text-[12.5px] font-semibold rounded-lg transition-colors ${tab === k ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'}`}>{label}</button>
        ))}
      </div>
      {tab === 'offers' && <OfferComparator user={user} applications={applications} showToast={showToast} />}
      {tab === 'practice' && <PracticeMode user={user} showToast={showToast} />}
      {tab === 'scripts' && <NegotiationScripts user={user} showToast={showToast} />}
      {tab === 'reputation' && <ReputationAndScore user={user} sends={sends} clients={clients} activities={activities} deals={deals} showToast={showToast} />}
      {tab === 'scheduling' && <SchedulingOverlap clients={clients} />}
    </div>
  );
}

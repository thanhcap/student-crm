'use client';
// ============================================================================
// SMART AUTOMATIONS (Part B) — time-based triggers that fire with NO manual
// enrollment. The sequence-runner already evaluates
// sequence_triggers.trigger_event = 'birthday_approaching' every 15 minutes;
// this is the UI that was missing to set one up.
//
// Data model reconciliation (the important part):
//   · automation_triggers  — the UI-facing record the user edits here.
//   · The runner reads sequence_triggers, NOT automation_triggers. So enabling
//     the birthday automation also ensures a dedicated email_sequences row +
//     one email sequence_step + a sequence_triggers row exist and are in sync.
//
// Only the birthday trigger is backed by the runner today. Re-engagement and
// anniversary are shown but clearly marked "coming soon" so we never imply an
// email will send when nothing evaluates it yet.
// ============================================================================
import { useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';

const inputCls = 'w-full px-3 py-2 text-[13px] border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-lg focus:outline-none focus:border-gray-400';

function relTime(iso) {
  if (!iso) return 'Never';
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const h = Math.round(mins / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return d < 30 ? `${d}d ago` : new Date(iso).toLocaleDateString();
}

const DEFAULT_SUBJECT = 'Happy Birthday, {{first_name}}! 🎂';
const DEFAULT_BODY =
  "Hi {{first_name}},\n\nWishing you a wonderful birthday! Hope this year brings everything you're working toward.\n\nBest,\n{{sender_name}}";

const TRIGGER_TYPES = [
  { key: 'birthday', label: 'Birthday Email', icon: '🎂', live: true,
    desc: 'Automatically emails each relationship on or before their birthday. No enrollment needed — it works for everyone who has a birthday date set.' },
  { key: 'days_since_contact', label: 'Re-Engagement', icon: '📬', live: false,
    desc: "Emails relationships you haven't contacted in N days." },
  { key: 'anniversary', label: 'Relationship Anniversary', icon: '🎉', live: false,
    desc: 'Emails contacts on the anniversary of when you first connected.' },
];

function Field({ label, hint, children }) {
  return (
    <label className="block">
      <span className="block text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-1">{label}</span>
      {children}
      {hint && <span className="block text-[11px] text-gray-400 mt-1">{hint}</span>}
    </label>
  );
}

const btnPrimary = 'px-4 py-2 text-[13px] font-semibold rounded-xl text-white dark:text-gray-900 bg-gray-900 dark:bg-white hover:bg-gray-700 dark:hover:bg-gray-200 disabled:opacity-50';
const btnGhost = 'px-4 py-2 text-[13px] font-semibold rounded-xl text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800';

function SmartTriggerCard({ type, ctx }) {
  const { user, automationTriggers, setAutomationTriggers, sequences, setSequences,
    sequenceSteps, setSequenceSteps, clients, showToast } = ctx;
  const trigger = automationTriggers.find(t => t.trigger_type === type.key);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    enabled: trigger?.enabled ?? false,
    days_before: trigger?.days_before ?? 0,
    subject: trigger?.subject ?? DEFAULT_SUBJECT,
    body: trigger?.body ?? DEFAULT_BODY,
  });

  const withBirthday = clients.filter(c => c.birthday).length;
  const withoutBirthday = clients.filter(c => !c.birthday).length;

  // Ensure the runner-facing rows (email_sequences + step + sequence_triggers)
  // exist and match the form. Returns nothing; keeps local state in sync.
  //
  // NOTE: email_sequences.trigger_type has a CHECK constraint that does NOT
  // include 'birthday_approaching' — the birthday event lives only in
  // sequence_triggers.trigger_event, and the runner keys off that plus the
  // sequence's is_active flag. So the sequence is created as 'manual' and found
  // again by its stable name.
  async function ensureBirthdaySequenceAndTrigger(cfg) {
    const BIRTHDAY_SEQ_NAME = 'Happy Birthday (Auto)';
    let seq = sequences.find(s => s.name === BIRTHDAY_SEQ_NAME);

    if (!seq) {
      // Only create the sequence when enabling — don't litter drafts otherwise.
      if (!cfg.enabled) return;
      const { data: newSeq, error } = await supabase.from('email_sequences').insert([{
        user_id: user.id, name: BIRTHDAY_SEQ_NAME, status: 'active',
        is_active: true, trigger_type: 'manual',
        description: 'Sends automatically to anyone whose birthday is coming up.',
      }]).select().single();
      if (error || !newSeq) { showToast?.(error?.message || 'Could not create the birthday sequence.', 'error'); return; }
      seq = newSeq;
      setSequences(prev => [...prev, newSeq]);

      const { data: step } = await supabase.from('sequence_steps').insert([{
        user_id: user.id, sequence_id: seq.id, step_order: 0, node_type: 'email',
        channel: 'email', wait_days: 0, subject: cfg.subject, body: cfg.body,
        condition: 'always', pos_x: 320, pos_y: 160,
      }]).select().single();
      if (step) setSequenceSteps(prev => [...prev, step]);
    } else {
      // Update the existing email step's subject/body + (de)activate the seq.
      const step = sequenceSteps.find(s => s.sequence_id === seq.id && s.node_type === 'email');
      if (step) {
        await supabase.from('sequence_steps').update({ subject: cfg.subject, body: cfg.body }).eq('id', step.id);
        setSequenceSteps(prev => prev.map(s => s.id === step.id ? { ...s, subject: cfg.subject, body: cfg.body } : s));
      }
      await supabase.from('email_sequences').update({ is_active: cfg.enabled, status: cfg.enabled ? 'active' : 'paused' }).eq('id', seq.id);
      setSequences(prev => prev.map(s => s.id === seq.id ? { ...s, is_active: cfg.enabled, status: cfg.enabled ? 'active' : 'paused' } : s));
    }

    if (!seq) return;

    // Upsert the sequence_triggers row the runner actually reads.
    const { data: existing } = await supabase.from('sequence_triggers')
      .select('id').eq('sequence_id', seq.id).eq('trigger_event', 'birthday_approaching').maybeSingle();
    const trigRow = {
      user_id: user.id, sequence_id: seq.id, trigger_event: 'birthday_approaching',
      enabled: cfg.enabled, trigger_config: { days: Number(cfg.days_before) || 0 },
    };
    if (existing) await supabase.from('sequence_triggers').update(trigRow).eq('id', existing.id);
    else await supabase.from('sequence_triggers').insert([trigRow]);
  }

  async function handleSave() {
    setSaving(true);
    const payload = {
      enabled: form.enabled,
      days_before: Number(form.days_before) || 0,
      subject: form.subject,
      body: form.body,
    };
    let row = trigger;
    if (trigger) {
      const { error } = await supabase.from('automation_triggers').update(payload).eq('id', trigger.id);
      if (error) { showToast?.(error.message, 'error'); setSaving(false); return; }
      setAutomationTriggers(prev => prev.map(t => t.id === trigger.id ? { ...t, ...payload } : t));
    } else {
      const { data, error } = await supabase.from('automation_triggers')
        .insert([{ user_id: user.id, trigger_type: type.key, ...payload }]).select().single();
      if (error) { showToast?.(error.message, 'error'); setSaving(false); return; }
      row = data;
      setAutomationTriggers(prev => [...prev, data]);
    }

    // Birthday is the only runner-backed trigger — reconcile its plumbing.
    if (type.key === 'birthday') {
      await ensureBirthdaySequenceAndTrigger(payload);
    }

    setSaving(false);
    setEditing(false);
    showToast?.(`${type.label} ${payload.enabled ? 'enabled' : 'disabled'}.`, 'success');
  }

  return (
    <div className="p-5 rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900">
      <div className="flex items-center justify-between mb-2 gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xl" aria-hidden>{type.icon}</span>
          <p className="text-[14px] font-bold text-gray-900 dark:text-white">{type.label}</p>
          {trigger?.enabled && type.live && (
            <span className="px-2 py-0.5 text-[10px] font-bold uppercase bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400 rounded-full">Active</span>
          )}
          {!type.live && (
            <span className="px-2 py-0.5 text-[10px] font-bold uppercase bg-gray-100 dark:bg-gray-800 text-gray-500 rounded-full">Coming soon</span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {trigger && type.live && <p className="text-[11px] text-gray-400 hidden sm:block">Last ran: {relTime(trigger.last_ran_at)}</p>}
          {type.live && (
            <button className={btnGhost} onClick={() => setEditing(v => !v)}>{editing ? 'Cancel' : 'Configure'}</button>
          )}
        </div>
      </div>
      <p className="text-[12px] text-gray-400">{type.desc}</p>

      {!type.live && (
        <p className="text-[12px] text-gray-400 mt-2 italic">
          Not firing yet — the automation engine evaluates birthdays today; this trigger type is on the roadmap.
        </p>
      )}

      {editing && type.live && (
        <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800 space-y-3">
          <label className="flex items-center gap-2 text-[13px] font-semibold cursor-pointer">
            <input type="checkbox" checked={form.enabled} onChange={e => setForm(f => ({ ...f, enabled: e.target.checked }))} className="rounded" />
            Enable this automation
          </label>

          {type.key === 'birthday' && (
            <Field label="Send how many days before the birthday?">
              <select value={form.days_before} onChange={e => setForm(f => ({ ...f, days_before: Number(e.target.value) }))} className={inputCls}>
                <option value={0}>On the birthday itself</option>
                <option value={1}>1 day before</option>
                <option value={2}>2 days before</option>
                <option value={3}>3 days before</option>
                <option value={7}>1 week before</option>
              </select>
            </Field>
          )}

          <Field label="Email subject">
            <input value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} className={inputCls} placeholder={DEFAULT_SUBJECT} />
          </Field>
          <Field label="Email body" hint="Supports {{first_name}}, {{name}}, {{company}}, {{sender_name}}">
            <textarea value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))} className={inputCls} rows={5} />
          </Field>

          <button className={btnPrimary} onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : trigger ? 'Save changes' : 'Enable automation'}
          </button>

          {type.key === 'birthday' && (
            <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900">
              <p className="text-[12px] text-blue-700 dark:text-blue-300 font-semibold mb-1">Who will receive this?</p>
              <p className="text-[12px] text-blue-600/70 dark:text-blue-400/60">
                Every relationship with a birthday date set. Currently {withBirthday} relationship{withBirthday === 1 ? '' : 's'} {withBirthday === 1 ? 'has' : 'have'} a birthday.
                {withoutBirthday > 0 && ` ${withoutBirthday} ${withoutBirthday === 1 ? 'has' : 'have'} no birthday set — add it on their profile.`}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function SmartAutomationsView(ctx) {
  return (
    <div className="max-w-3xl mx-auto">
      <h2 className="text-[20px] font-bold text-gray-900 dark:text-white mb-1">Smart Automations</h2>
      <p className="text-[13px] text-gray-400 mb-6">
        These run automatically every 15 minutes — no manual enrollment, no clicking send.
        Enable one, write your email, and it fires for everyone it applies to.
      </p>
      <div className="space-y-3">
        {TRIGGER_TYPES.map(t => <SmartTriggerCard key={t.key} type={t} ctx={ctx} />)}
      </div>
    </div>
  );
}

// Dashboard widget — relationships with a birthday in the next 14 days.
export function UpcomingBirthdaysWidget({ clients, onQuickEmail }) {
  const upcoming = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return (clients || [])
      .filter(c => c.birthday)
      .map(c => {
        const bd = new Date(c.birthday);
        const thisYear = new Date(today.getFullYear(), bd.getMonth(), bd.getDate());
        let daysUntil = Math.round((thisYear - today) / 86400000);
        if (daysUntil < 0) {
          const nextYear = new Date(today.getFullYear() + 1, bd.getMonth(), bd.getDate());
          daysUntil = Math.round((nextYear - today) / 86400000);
        }
        return { ...c, daysUntil };
      })
      .filter(c => c.daysUntil >= 0 && c.daysUntil <= 14)
      .sort((a, b) => a.daysUntil - b.daysUntil);
  }, [clients]);

  if (!upcoming.length) return null;

  return (
    <div className="p-4 rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900">
      <h3 className="text-[13px] font-bold text-gray-900 dark:text-white mb-3">🎂 Upcoming Birthdays</h3>
      {upcoming.map(c => (
        <div key={c.id} className="flex items-center justify-between py-2 border-t border-gray-50 dark:border-gray-800 first:border-0">
          <div className="min-w-0">
            <p className="text-[13px] font-medium text-gray-900 dark:text-white truncate">{c.name}</p>
            <p className="text-[11px] text-gray-400">
              {c.daysUntil === 0 ? '🎉 Today!' : c.daysUntil === 1 ? 'Tomorrow' : `In ${c.daysUntil} days`}
            </p>
          </div>
          {onQuickEmail && c.email && (
            <button onClick={() => onQuickEmail(c)} className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline shrink-0 ml-2">Send message</button>
          )}
        </div>
      ))}
    </div>
  );
}

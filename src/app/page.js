'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import Papa from 'papaparse';
import { supabase } from '../lib/supabase';
import { useRouter } from 'next/navigation';

// ==========================================
// REUSABLE CONFIRM DIALOG COMPONENT
// ==========================================
function ConfirmDialog({ isOpen, title, message, confirmLabel, confirmVariant = 'primary', onConfirm, onCancel, isLoading }) {
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape' && isOpen && !isLoading) onCancel();
    };
    if (isOpen) window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, isLoading, onCancel]);

  if (!isOpen) return null;

  const isPrimary = confirmVariant === 'primary';
  const isDanger = confirmVariant === 'danger';

  return (
    <div className="fixed inset-0 bg-gray-950/60 backdrop-blur-sm z-[150] flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md border border-gray-100 dark:border-gray-800 overflow-hidden animate-in zoom-in-95 duration-200 p-6 sm:p-8">
        <h3 className="text-[15px] font-bold text-gray-900 dark:text-gray-100">{title}</h3>
        <p className="text-[13px] text-gray-500 mt-2 leading-relaxed">{message}</p>
        <div className="flex gap-3 pt-6 mt-6 border-t border-gray-100">
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="flex-1 py-2.5 text-[13px] font-semibold text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className={`flex-1 py-2.5 px-4 text-[13px] font-semibold rounded-lg transition-colors shadow-sm flex items-center justify-center gap-2 ${
              isDanger
                ? 'bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 disabled:hover:bg-red-600'
                : 'bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-50 disabled:hover:bg-gray-900'
            }`}
          >
            {isLoading && (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            )}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// TOAST NOTIFICATION SYSTEM
// ==========================================
function Toast({ id, type, message, onClose }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const bgColor = type === 'success' ? 'bg-green-50 dark:bg-green-900/40 border-green-100 dark:border-green-800 text-green-800 dark:text-green-200' : 'bg-red-50 dark:bg-red-900/40 border-red-100 dark:border-red-800 text-red-800 dark:text-red-200';
  const icon = type === 'success' ? (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
    </svg>
  ) : (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
    </svg>
  );

  return (
    <div className={`fixed bottom-6 right-6 flex items-center gap-3 px-4 py-3 rounded-xl border ${bgColor} shadow-lg animate-in slide-in-from-bottom-2 fade-in z-[200]`}>
      {icon}
      <span className="text-[13px] font-medium">{message}</span>
    </div>
  );
}

// ==========================================
// MODULE-SCOPE CONSTANTS
// ==========================================
const PIPELINE_STAGES = ['New', 'Contacted', 'Engaged', 'Active', 'Inactive'];
const DEAL_STAGES = ['Prospect', 'Proposal', 'Negotiation', 'Contract Sent', 'Won', 'Lost'];
const TAG_COLORS = ['#6366F1', '#10B981', '#F59E0B', '#EF4444', '#3B82F6', '#8B5CF6', '#EC4899', '#6B7280'];
const CLIENT_SOURCES = ['LinkedIn', 'Referral', 'Website', 'Cold Outreach', 'Event', 'Other'];
const WEBHOOK_EVENTS = [
  { value: 'client.created', label: 'Relationship created' },
  { value: 'client.updated', label: 'Relationship updated' },
  { value: 'client.deleted', label: 'Relationship deleted' },
  { value: 'deal.created', label: 'Deal created' },
  { value: 'deal.won', label: 'Deal won' },
  { value: 'deal.lost', label: 'Deal lost' },
  { value: 'task.completed', label: 'Task completed' },
  { value: 'activity.logged', label: 'Activity logged' },
  { value: 'deal.updated', label: 'Deal updated' },
  { value: 'task.created', label: 'Task created' },
  { value: 'sequence.enrolled', label: 'Sequence enrolled' },
  { value: 'sequence.completed', label: 'Sequence completed' },
  { value: 'email.replied', label: 'Email replied (auto-stop)' },
];
const DEFAULT_ACTIVITY_TEMPLATES = [
  { name: 'Quick call', type: 'Call', desc: 'Spoke for 15 minutes. Discussed next steps.' },
  { name: 'Follow-up email', type: 'Email', desc: 'Sent follow-up email after last meeting.' },
  { name: 'Intro meeting', type: 'Meeting', desc: '30-minute intro meeting. They are interested.' },
  { name: 'Voicemail', type: 'Note', desc: 'Left voicemail. Will try again next week.' },
];

// PART B — email compose URLs (opens the user's own mail client in a new tab)
function buildGmailUrl(to, subject, body) {
  return `https://mail.google.com/mail/?${new URLSearchParams({ view: 'cm', fs: '1', to, su: subject, body })}`;
}
function buildMailtoUrl(to, subject, body) {
  return `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

// Lead score: 0-100, computed client-side (Feature 6)
function computeLeadScore(client, clientActivities, clientTasks, clientDeals) {
  let s = 0;
  s += ({ New: 5, Contacted: 10, Engaged: 18, Active: 25, Inactive: 0 }[client.status] || 0);          // max 25
  s += ({ High: 15, Medium: 8, Low: 3 }[client.relationship] || 0);                                     // max 15
  if (clientActivities.length > 0) {
    const days = Math.floor((Date.now() - new Date(clientActivities[0].activity_date)) / 86400000);
    s += days <= 7 ? 20 : days <= 14 ? 15 : days <= 30 ? 10 : days <= 60 ? 5 : 0;                       // max 20
  }
  const c30 = new Date(); c30.setDate(c30.getDate() - 30);
  s += Math.min(clientActivities.filter(a => new Date(a.activity_date) >= c30).length * 4, 20);         // max 20
  s += Math.min(clientTasks.filter(t => t.status === 'pending').length * 3, 10);                        // max 10
  if (clientDeals.length > 0) s += 5;
  if (clientDeals.some(d => d.stage === 'Won')) s += 5;                                                 // max 10
  return Math.min(Math.round(s), 100);
}

function ScoreBar({ score }) {
  const col = score >= 75 ? 'bg-green-500' : score >= 50 ? 'bg-blue-500' : score >= 25 ? 'bg-yellow-400' : 'bg-gray-300';
  return (
    <div className="flex items-center gap-2 w-24">
      <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-full h-1.5 overflow-hidden">
        <div className={`anim-grow-w h-full rounded-full ${col}`} style={{ width: `${score}%` }} />
      </div>
      <span className="text-[11px] font-bold text-gray-500 w-5 text-right">{score}</span>
    </div>
  );
}

function TagPill({ tag, onRemove }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold"
      style={{ backgroundColor: tag.color + '22', color: tag.color, border: `1px solid ${tag.color}44` }}>
      {tag.name}
      {onRemove && <button onClick={() => onRemove(tag.id)} className="hover:opacity-70 ml-0.5">×</button>}
    </span>
  );
}

// ==========================================
// LGM UPGRADES — sequence state machine (CLIENT COPY).
// ⚠ KEEP BEHAVIORALLY IDENTICAL to supabase/functions/sequence-runner/_shared/sequence-logic.ts
// ==========================================
const SEQ_CHANNELS = [
  { value: 'email', label: '✉️ Email' },
  { value: 'linkedin_view', label: '🔗 LinkedIn view' },
  { value: 'linkedin_connect', label: '🤝 LinkedIn connect' },
  { value: 'call', label: '📞 Call' },
  { value: 'manual_task', label: '✅ Manual task' },
];
const SEQ_CONDITIONS = [
  { value: 'always', label: 'Always send' },
  { value: 'if_no_reply', label: 'Only if no reply yet' },
  { value: 'if_no_open', label: 'Only if not opened' },
  { value: 'if_opened', label: 'Only if opened, no reply' },
];
const CHANNEL_TASK_LABEL = { linkedin_view: 'LinkedIn: view profile of', linkedin_connect: 'LinkedIn: connect with', call: 'Call', manual_task: 'Task for' };

// ==========================================
// V2 — EMAIL AUTOMATION CANVAS (node meta, triggers, templates)
// ==========================================
// node_type values map 1:1 onto the runner's graph walker:
// trigger | email | wait | condition | linkedin_view | linkedin_connect | call | manual_task | goal
const NODE_META = {
  trigger:          { label: 'Trigger',           emoji: '⚡', border: 'border-l-purple-500',  dot: 'bg-purple-500' },
  email:            { label: 'Email',             emoji: '✉️', border: 'border-l-blue-500',    dot: 'bg-blue-500' },
  wait:             { label: 'Wait',              emoji: '⏱', border: 'border-l-gray-400',    dot: 'bg-gray-400' },
  condition:        { label: 'Condition',         emoji: '🔀', border: 'border-l-amber-500',   dot: 'bg-amber-500' },
  linkedin_view:    { label: 'LinkedIn: View',    emoji: '🔗', border: 'border-l-indigo-500',  dot: 'bg-indigo-500' },
  linkedin_connect: { label: 'LinkedIn: Connect', emoji: '🤝', border: 'border-l-indigo-500',  dot: 'bg-indigo-500' },
  call:             { label: 'Call',              emoji: '📞', border: 'border-l-green-500',   dot: 'bg-green-500' },
  manual_task:      { label: 'Task',              emoji: '✅', border: 'border-l-teal-500',    dot: 'bg-teal-500' },
  goal:             { label: 'Goal',              emoji: '🎯', border: 'border-l-emerald-500', dot: 'bg-emerald-500' },
};
const NODE_PALETTE = ['email', 'wait', 'condition', 'linkedin_view', 'linkedin_connect', 'call', 'manual_task', 'goal'];
const CONDITION_TYPES = [
  { value: 'if_no_reply', label: 'If no reply yet' },
  { value: 'if_replied', label: 'If replied' },
  { value: 'if_opened', label: 'If opened' },
  { value: 'if_no_open', label: 'If not opened' },
];
// Part 8 — event triggers a non-technical user can configure (sequence_triggers rows)
const TRIGGER_TYPES = [
  { value: 'manual', label: 'Manual', desc: 'Users enroll contacts manually.' },
  { value: 'deal_won', label: 'Deal Won', desc: 'When any deal is marked Won.' },
  { value: 'deal_lost', label: 'Deal Lost', desc: 'When any deal is marked Lost.' },
  { value: 'deal_stage_changed', label: 'Deal Stage', desc: 'When a deal moves to a stage.', config: 'stage' },
  { value: 'relationship_created', label: 'New Relationship', desc: 'When a new relationship is added.' },
  { value: 'relationship_stage_changed', label: 'Relationship Stage', desc: 'When a relationship moves to a stage.', config: 'stage' },
  { value: 'tag_applied', label: 'Tag Applied', desc: 'When a tag is applied to a relationship.', config: 'tag' },
  { value: 'task_completed', label: 'Task Completed', desc: 'When any task is marked done.' },
  { value: 'no_activity_days', label: 'No Activity', desc: 'When no activity is logged for N days.', config: 'days' },
  { value: 'birthday_approaching', label: 'Birthday', desc: 'When a birthday is coming up in N days.', config: 'days' },
];
// Part 6 — one-click sequence templates. Node `pos` are canvas coordinates;
// edges are [fromIdx, toIdx, branch].
const SEQ_TEMPLATES = [
  {
    key: 'linkedin_email', emoji: '🔗', name: 'LinkedIn + Email Outreach',
    desc: 'View profile → connect → cold email → 2 conditional follow-ups. The classic multichannel cadence.',
    nodes: [
      { node_type: 'trigger', pos: [300, 30], config: { type: 'manual' } },
      { node_type: 'linkedin_view', task_note: 'View {{name}}’s profile — {{linkedin_url}}', wait_days: 0, pos: [300, 160] },
      { node_type: 'wait', config: { days: 1 }, pos: [300, 290] },
      { node_type: 'linkedin_connect', task_note: 'Connect with {{name}} — {{linkedin_url}}', wait_days: 0, pos: [300, 420] },
      { node_type: 'wait', config: { days: 2 }, pos: [300, 550] },
      { node_type: 'email', subject: 'Loved your work at {{company}}, {{first_name}}', body: 'Hi {{first_name}},\n\nI came across {{company}} and was impressed by what you’re building. I work with teams like yours to [one-line value prop].\n\nWorth a quick chat this week?\n\nBest,\n[Your name]', wait_days: 0, pos: [300, 680] },
      { node_type: 'wait', config: { days: 3 }, pos: [300, 810] },
      { node_type: 'condition', config: { type: 'if_no_reply' }, pos: [300, 940] },
      { node_type: 'email', subject: 'Quick follow-up, {{first_name}}', body: 'Hi {{first_name}},\n\nJust floating this back to the top of your inbox — I know things get busy.\n\nWould it make sense to connect for 15 minutes?\n\nBest,\n[Your name]', wait_days: 0, pos: [120, 1070] },
      { node_type: 'goal', config: { label: 'Replied — stop sequence' }, pos: [520, 1070] },
      { node_type: 'wait', config: { days: 4 }, pos: [120, 1200] },
      { node_type: 'condition', config: { type: 'if_no_reply' }, pos: [120, 1330] },
      { node_type: 'email', subject: 'Closing the loop, {{first_name}}', body: 'Hi {{first_name}},\n\nI’ll stop here — if improving [pain point] ever becomes a priority at {{company}}, my door is open.\n\nAll the best,\n[Your name]', wait_days: 0, pos: [0, 1460] },
      { node_type: 'goal', config: { label: 'Replied — stop sequence' }, pos: [340, 1460] },
      { node_type: 'goal', config: { label: 'Sequence complete' }, pos: [0, 1590] },
    ],
    edges: [[0,1,'default'],[1,2,'default'],[2,3,'default'],[3,4,'default'],[4,5,'default'],[5,6,'default'],[6,7,'default'],[7,8,'yes'],[7,9,'no'],[8,10,'default'],[10,11,'default'],[11,12,'yes'],[11,13,'no'],[12,14,'default']],
  },
  {
    key: 'cold_3step', emoji: '✉️', name: '3-Email Cold Outreach',
    desc: 'Cold intro → follow-up if no reply → breakup email. Simple and effective.',
    nodes: [
      { node_type: 'trigger', pos: [300, 30], config: { type: 'manual' } },
      { node_type: 'email', subject: 'Idea for {{company}}, {{first_name}}', body: 'Hi {{first_name}},\n\n[One-sentence personalized opener about {{company}}.]\n\nWe help teams like yours [value prop]. Open to a quick chat?\n\nBest,\n[Your name]', wait_days: 0, pos: [300, 160] },
      { node_type: 'wait', config: { days: 3 }, pos: [300, 290] },
      { node_type: 'condition', config: { type: 'if_no_reply' }, pos: [300, 420] },
      { node_type: 'email', subject: 'Re: Idea for {{company}}', body: 'Hi {{first_name}},\n\nBumping this in case it got buried. Happy to share a 2-minute overview if useful.\n\nBest,\n[Your name]', wait_days: 0, pos: [120, 550] },
      { node_type: 'goal', config: { label: 'Replied — stop' }, pos: [520, 550] },
      { node_type: 'wait', config: { days: 4 }, pos: [120, 680] },
      { node_type: 'condition', config: { type: 'if_no_reply' }, pos: [120, 810] },
      { node_type: 'email', subject: 'Should I close your file, {{first_name}}?', body: 'Hi {{first_name}},\n\nI’ll take the hint and stop here. If [pain point] ever moves up your list, just reply to this email.\n\nAll the best,\n[Your name]', wait_days: 0, pos: [0, 940] },
      { node_type: 'goal', config: { label: 'Replied — stop' }, pos: [340, 940] },
      { node_type: 'goal', config: { label: 'Sequence complete' }, pos: [0, 1070] },
    ],
    edges: [[0,1,'default'],[1,2,'default'],[2,3,'default'],[3,4,'yes'],[3,5,'no'],[4,6,'default'],[6,7,'default'],[7,8,'yes'],[7,9,'no'],[8,10,'default']],
  },
  {
    key: 'post_meeting', emoji: '🤝', name: 'Post-Meeting Nurture',
    desc: 'Thank-you email, then branch on engagement: LinkedIn connect if opened, follow-up email if not.',
    nodes: [
      { node_type: 'trigger', pos: [300, 30], config: { type: 'manual' } },
      { node_type: 'email', subject: 'Great meeting you, {{first_name}}', body: 'Hi {{first_name}},\n\nThanks for the time today — really enjoyed the conversation about {{company}}.\n\nAs promised, here’s [resource/next step].\n\nBest,\n[Your name]', wait_days: 0, pos: [300, 160] },
      { node_type: 'wait', config: { days: 7 }, pos: [300, 290] },
      { node_type: 'condition', config: { type: 'if_opened' }, pos: [300, 420] },
      { node_type: 'linkedin_connect', task_note: 'Connect with {{name}} on LinkedIn — they engaged with your email', wait_days: 0, pos: [120, 550] },
      { node_type: 'email', subject: 'Following up on our meeting, {{first_name}}', body: 'Hi {{first_name}},\n\nCircling back on our conversation — any thoughts on the next step we discussed?\n\nBest,\n[Your name]', wait_days: 0, pos: [520, 550] },
      { node_type: 'goal', config: { label: 'Nurture complete' }, pos: [300, 680] },
    ],
    edges: [[0,1,'default'],[1,2,'default'],[2,3,'default'],[3,4,'yes'],[3,5,'no'],[4,6,'default'],[5,6,'default']],
  },
  {
    key: 'deal_won_onboarding', emoji: '🏆', name: 'Deal Won Onboarding',
    desc: 'Auto-fires when a deal is marked Won: welcome → setup tips → check-in.',
    trigger: { trigger_event: 'deal_won', trigger_config: {} },
    nodes: [
      { node_type: 'trigger', pos: [300, 30], config: { type: 'deal_won' } },
      { node_type: 'email', subject: 'Welcome aboard, {{first_name}}! 🎉', body: 'Hi {{first_name}},\n\nThrilled to be working with {{company}}! Here’s what happens next:\n\n1. [Step one]\n2. [Step two]\n3. [Step three]\n\nQuestions? Just reply to this email.\n\nBest,\n[Your name]', wait_days: 0, pos: [300, 160] },
      { node_type: 'wait', config: { days: 3 }, pos: [300, 290] },
      { node_type: 'email', subject: 'Getting the most out of week one', body: 'Hi {{first_name}},\n\nA few tips to hit the ground running:\n\n• [Tip 1]\n• [Tip 2]\n• [Tip 3]\n\nBest,\n[Your name]', wait_days: 0, pos: [300, 420] },
      { node_type: 'wait', config: { days: 7 }, pos: [300, 550] },
      { node_type: 'email', subject: 'How’s everything going, {{first_name}}?', body: 'Hi {{first_name}},\n\nJust checking in — how has the first stretch felt? Anything blocking you?\n\nBest,\n[Your name]', wait_days: 0, pos: [300, 680] },
      { node_type: 'goal', config: { label: 'Onboarding complete' }, pos: [300, 810] },
    ],
    edges: [[0,1,'default'],[1,2,'default'],[2,3,'default'],[3,4,'default'],[4,5,'default'],[5,6,'default']],
  },
];

function stepConditionMet(step, enrollment, sends) {
  const cond = step.condition || 'always';
  if (cond === 'always') return true;
  const prior = sends.filter(s => s.enrollment_id === enrollment.id);
  const replied = prior.some(s => s.replied_at);
  const opened = prior.some(s => s.opened_at);
  if (cond === 'if_no_reply') return !replied;
  if (cond === 'if_no_open') return !opened;
  if (cond === 'if_opened') return opened && !replied;
  return true;
}
function resolveDueStep(enrollment, steps, sends) {
  let idx = enrollment.current_step;
  while (idx < steps.length) {
    if (stepConditionMet(steps[idx], enrollment, sends)) return { step: steps[idx], index: idx };
    idx++;
  }
  return null;
}
function pickSubjectVariant(step, enrollment) {
  if (step.subject_b && String(step.subject_b).trim()) {
    return enrollment.id % 2 === 0 ? { subject: step.subject, variant: 'A' } : { subject: step.subject_b, variant: 'B' };
  }
  return { subject: step.subject, variant: null };
}

// Country/region combobox source — full country list, rendered as a <datalist>
// so every country field supports type-to-filter AND click-to-browse.
const COUNTRY_LIST = ['Afghanistan','Albania','Algeria','Andorra','Angola','Antigua and Barbuda','Argentina','Armenia','Australia','Austria','Azerbaijan','Bahamas','Bahrain','Bangladesh','Barbados','Belarus','Belgium','Belize','Benin','Bhutan','Bolivia','Bosnia and Herzegovina','Botswana','Brazil','Brunei','Bulgaria','Burkina Faso','Burundi','Cabo Verde','Cambodia','Cameroon','Canada','Central African Republic','Chad','Chile','China','Colombia','Comoros','Congo (DRC)','Congo (Republic)','Costa Rica','Croatia','Cuba','Cyprus','Czechia','Denmark','Djibouti','Dominica','Dominican Republic','Ecuador','Egypt','El Salvador','Equatorial Guinea','Eritrea','Estonia','Eswatini','Ethiopia','Fiji','Finland','France','Gabon','Gambia','Georgia','Germany','Ghana','Greece','Grenada','Guatemala','Guinea','Guinea-Bissau','Guyana','Haiti','Honduras','Hong Kong','Hungary','Iceland','India','Indonesia','Iran','Iraq','Ireland','Israel','Italy','Ivory Coast','Jamaica','Japan','Jordan','Kazakhstan','Kenya','Kiribati','Kosovo','Kuwait','Kyrgyzstan','Laos','Latvia','Lebanon','Lesotho','Liberia','Libya','Liechtenstein','Lithuania','Luxembourg','Macau','Madagascar','Malawi','Malaysia','Maldives','Mali','Malta','Marshall Islands','Mauritania','Mauritius','Mexico','Micronesia','Moldova','Monaco','Mongolia','Montenegro','Morocco','Mozambique','Myanmar','Namibia','Nauru','Nepal','Netherlands','New Zealand','Nicaragua','Niger','Nigeria','North Korea','North Macedonia','Norway','Oman','Pakistan','Palau','Palestine','Panama','Papua New Guinea','Paraguay','Peru','Philippines','Poland','Portugal','Qatar','Romania','Russia','Rwanda','Saint Kitts and Nevis','Saint Lucia','Saint Vincent and the Grenadines','Samoa','San Marino','Sao Tome and Principe','Saudi Arabia','Senegal','Serbia','Seychelles','Sierra Leone','Singapore','Slovakia','Slovenia','Solomon Islands','Somalia','South Africa','South Korea','South Sudan','Spain','Sri Lanka','Sudan','Suriname','Sweden','Switzerland','Syria','Taiwan','Tajikistan','Tanzania','Thailand','Timor-Leste','Togo','Tonga','Trinidad and Tobago','Tunisia','Turkey','Turkmenistan','Tuvalu','Uganda','Ukraine','United Arab Emirates','United Kingdom','United States','Uruguay','Uzbekistan','Vanuatu','Vatican City','Venezuela','Vietnam','Yemen','Zambia','Zimbabwe'];

// G11 — one-click automation recipes (pre-configured automation_rules rows)
const AUTOMATION_RECIPES = [
  {
    name: 'Remind me 3 days before a deal close date',
    desc: 'Sends a notification when an open deal is 3 days from closing.',
    note: 'Evaluated by the daily job',
    rule: { trigger_type: 'deal_close_approaching', trigger_value: '3', action_type: 'send_notification', action_value: { message: 'A deal closes in 3 days — check in.' } },
  },
  {
    name: 'LinkedIn relationships → High priority',
    desc: 'New relationships sourced from LinkedIn are automatically set to High priority.',
    note: 'Runs instantly on add',
    rule: { trigger_type: 'source_is', trigger_value: 'LinkedIn', action_type: 'set_priority', action_value: { priority: 'High' } },
  },
  {
    name: 'Alert at 30 days without contact',
    desc: 'Notifies you when a relationship goes 30 days without any logged activity.',
    note: 'Evaluated by the daily job',
    rule: { trigger_type: 'no_activity_days', trigger_value: '30', action_type: 'send_notification', action_value: { message: 'A relationship has gone 30 days without contact.' } },
  },
];

// G17 — company logo via Google's public favicon endpoint (builds on Part F's company_url)
function companyFaviconUrl(companyUrl, size = 64) {
  if (!companyUrl) return null;
  try {
    const host = new URL(companyUrl.startsWith('http') ? companyUrl : `https://${companyUrl}`).hostname;
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=${size}`;
  } catch { return null; }
}

// PART 2 (v4) — company is ALWAYS a real link: the company_url when set,
// otherwise a LinkedIn company search for the name. Handles both relationship
// clients (company_name/company_url) and cold contacts (company).
function companyLinkFor(contact) {
  if (contact?.company_url) {
    const url = contact.company_url.trim();
    return /^https?:\/\//i.test(url) ? url : `https://${url}`;
  }
  const name = contact?.company_name || contact?.company;
  if (name) return `https://www.linkedin.com/search/results/companies/?keywords=${encodeURIComponent(name)}`;
  return null;
}

function CompanyLink({ client, className = '' }) {
  const name = client?.company_name || client?.company;
  if (!name) return null;
  const href = companyLinkFor(client);
  return (
    <a href={href} target="_blank" rel="noopener noreferrer"
       onClick={e => e.stopPropagation()} /* rows that open the profile shouldn't swallow this click */
       className={`inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline ${className}`}>
      {name}
      <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
      </svg>
    </a>
  );
}

// G20 — multi-currency (static rates, display-only directional context)
const CURRENCIES = ['USD', 'EUR', 'GBP', 'VND', 'JPY', 'AUD', 'CAD'];
const FX_TO_USD = { USD: 1, EUR: 1.09, GBP: 1.27, VND: 0.000039, JPY: 0.0067, AUD: 0.66, CAD: 0.73 };
const CURRENCY_SYMBOL = { USD: '$', EUR: '€', GBP: '£', VND: '₫', JPY: '¥', AUD: 'A$', CAD: 'C$' };
const toUSD = (value, currency) => (parseFloat(value) || 0) * (FX_TO_USD[currency || 'USD'] ?? 1);
const fmtCurrency = (n, cur) => `${CURRENCY_SYMBOL[cur || 'USD'] || '$'}${(parseFloat(n) || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

// PART E — stage accent colors (kanban card left borders)
const STAGE_COLORS = {
  New: '#3B82F6', Contacted: '#F97316', Engaged: '#6366F1', Active: '#22C55E', Inactive: '#9CA3AF',
  Prospect: '#9CA3AF', Proposal: '#3B82F6', Negotiation: '#F59E0B', 'Contract Sent': '#8B5CF6', Won: '#22C55E', Lost: '#EF4444',
};

// PART E — reusable empty state with abstract inline-SVG illustration
function EmptyState({ title, desc, ctaLabel, onCta }) {
  return (
    <div className="flex flex-col items-center text-center py-10 px-6">
      <svg viewBox="0 0 120 80" className="w-28 h-20 mb-4 text-gray-200 dark:text-gray-700" fill="none" aria-hidden="true">
        <rect x="18" y="14" width="84" height="14" rx="7" fill="currentColor" opacity="0.6" />
        <rect x="18" y="34" width="60" height="14" rx="7" fill="currentColor" />
        <rect x="18" y="54" width="72" height="14" rx="7" fill="currentColor" opacity="0.4" />
        <circle cx="104" cy="61" r="12" fill="currentColor" opacity="0.8" />
        <path d="M100 61l3 3 5-6" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <p className="text-[15px] font-semibold text-gray-900 dark:text-gray-100">{title}</p>
      {desc && <p className="text-[13px] text-gray-400 mt-1 max-w-xs leading-relaxed">{desc}</p>}
      {ctaLabel && onCta && (
        <button onClick={onCta} className="mt-4 px-4 py-2 text-[13px] font-semibold text-white dark:text-gray-900 bg-gray-900 dark:bg-white rounded-xl hover:opacity-90 shadow-sm transition-opacity">{ctaLabel}</button>
      )}
    </div>
  );
}

// PART E — skeleton loading rows (replaces bare "Loading..." text)
function SkeletonRows({ rows = 5 }) {
  return (
    <div className="p-6 space-y-4" aria-busy="true" aria-label="Loading">
      {[...Array(rows)].map((_, i) => (
        <div key={i} className="flex items-center gap-4 animate-pulse">
          <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-3 rounded-full bg-gray-100 dark:bg-gray-800" style={{ width: `${55 + ((i * 17) % 35)}%` }} />
            <div className="h-2.5 rounded-full bg-gray-100 dark:bg-gray-800" style={{ width: `${30 + ((i * 23) % 30)}%` }} />
          </div>
          <div className="w-16 h-5 rounded-full bg-gray-100 dark:bg-gray-800 shrink-0" />
        </div>
      ))}
    </div>
  );
}

// PART C2 — delta badge vs previous period
function DeltaBadge({ current, prev }) {
  if (prev == null) return null;
  if (prev === 0 && current === 0) return <span className="text-[10px] font-semibold text-gray-400 block mt-0.5">— no change</span>;
  const pct = prev === 0 ? 100 : Math.round(((current - prev) / Math.abs(prev)) * 100);
  if (pct === 0) return <span className="text-[10px] font-semibold text-gray-400 block mt-0.5">— 0% vs last period</span>;
  const up = pct > 0;
  return (
    <span className={`text-[10px] font-bold block mt-0.5 ${up ? 'text-green-600' : 'text-red-500'}`}>
      {up ? '▲' : '▼'} {Math.abs(pct)}% vs last period
    </span>
  );
}

function formatFileSize(bytes) {
  if (bytes == null) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Animations â€” number counts up instead of snapping (respects reduced motion)
function CountUp({ value, suffix = '' }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    const target = Number(value) || 0;
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { setN(target); return; }
    let raf;
    const t0 = performance.now();
    const dur = 600;
    const tick = (t) => {
      const p = Math.min((t - t0) / dur, 1);
      setN(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <>{n}{suffix}</>;
}

export default function App() {
  const router = useRouter();
  
  // Navigation State
  const [appStep, setAppStep] = useState('LOADING');
  const [user, setUser] = useState(null);
  const [isNewUserSignUp, setIsNewUserSignUp] = useState(false);

  // Auth & Profile Form States
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [username, setUsername] = useState('');
  const [phone, setPhone] = useState('');
  const [country, setCountry] = useState('');
  const [linkedin, setLinkedin] = useState('');
  
  // Visibility States for Passwords
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const [otpToken, setOtpToken] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authMessage, setAuthMessage] = useState('');

  // CRM States
  const [clients, setClients] = useState([]);
  const [loadingClients, setLoadingClients] = useState(true);
  const [name, setName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  
  // PIPELINE UPDATE: Status is now a multi-stage pipeline instead of just Active/Inactive
  const [status, setStatus] = useState('New'); 
  const [notes, setNotes] = useState('');
  
  // CRM FIELD STATES
  const [clientCountry, setClientCountry] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientConversation, setClientConversation] = useState(''); // Legacy fallback
  const [clientLinkedin, setClientLinkedin] = useState('');
  const [clientBirthday, setClientBirthday] = useState('');
  const [clientRelationship, setClientRelationship] = useState('Medium');
  // PART F — company fields
  const [clientCompanyName, setClientCompanyName] = useState('');
  const [clientCompanyUrl, setClientCompanyUrl] = useState('');
  const [clientReferredBy, setClientReferredBy] = useState(''); // G18
  const [crmErrorMessage, setCrmErrorMessage] = useState('');

  // TASK STATES
  const [tasks, setTasks] = useState([]);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDate, setNewTaskDate] = useState('');
  const [tasksFilter, setTasksFilter] = useState('pending');

  // FEATURE STATES (Search, Filters, Sort, Editing)
  const [searchTerm, setSearchTerm] = useState('');
  const [filterPriority, setFilterPriority] = useState('All');
  const [filterStatus, setFilterStatus] = useState('All');
  const [sortBy, setSortBy] = useState('created_at_desc');
  const [editingClient, setEditingClient] = useState(null); 

  // ADVANCED FEATURE STATES (Pagination, Detail View, Import/Export, Bulk Actions)
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [viewingClient, setViewingClient] = useState(null);
  const fileInputRef = useRef(null);
  const [selectedClientIds, setSelectedClientIds] = useState([]);

  // KANBAN VIEW STATE
  const [viewMode, setViewMode] = useState('table'); // 'table' or 'board'

  // NOTIFICATIONS STATES
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notificationSyncLoading, setNotificationSyncLoading] = useState(false);
  const [notificationSyncMessage, setNotificationSyncMessage] = useState('');

  // GLOBAL SEARCH STATES
  const [showGlobalSearch, setShowGlobalSearch] = useState(false);
  const [globalSearchTerm, setGlobalSearchTerm] = useState('');
  const [globalSearchResults, setGlobalSearchResults] = useState({ clients: [], activities: [] });

  // CUSTOM FIELDS STATES
  const [customFieldDefs, setCustomFieldDefs] = useState([]);
  const [customFieldValues, setCustomFieldValues] = useState([]); // Array of all values from DB
  const [newCfName, setNewCfName] = useState('');
  const [newCfType, setNewCfType] = useState('text');
  const [newCfOptions, setNewCfOptions] = useState(''); // comma separated
  const [formCustomValues, setFormCustomValues] = useState({}); // For Add/Edit client forms

  // ACTIVITY LOG STATES (Detail View)
  const [activities, setActivities] = useState([]); // New structured activities
  const [activityType, setActivityType] = useState('Note');
  const [activityDesc, setActivityDesc] = useState('');
  const [activityDate, setActivityDate] = useState(new Date().toISOString().split('T')[0]);

  // G3 — voice memo quick-log (Web Speech API, browser-native)
  const [voiceListening, setVoiceListening] = useState(false);
  const recognitionRef = useRef(null);

  const [activityFilterType, setActivityFilterType] = useState('All');
  const [editingActivityId, setEditingActivityId] = useState(null);
  const [editingActivityDesc, setEditingActivityDesc] = useState('');

  // USER MANAGEMENT & SETTINGS STATES
  const [profile, setProfile] = useState({ username: '', phone_number: '', country: '', linkedin_profile: '' });
  const [settingsMessage, setSettingsMessage] = useState({ type: '', text: '' });
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);
  
  // DANGER ZONE STATES
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteAccountEmail, setDeleteAccountEmail] = useState('');

  // CONFIRM DIALOG & TOAST STATES
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, title: '', message: '', confirmLabel: '', confirmVariant: 'primary', isLoading: false, onConfirm: null });
  const [toasts, setToasts] = useState([]);

  // FEATURE 1 — DEALS PIPELINE STATES
  const [deals, setDeals] = useState([]);
  const [showDealForm, setShowDealForm] = useState(false);
  const [editingDeal, setEditingDeal] = useState(null);
  const [dealTitle, setDealTitle] = useState('');
  const [dealValue, setDealValue] = useState('');
  const [dealStage, setDealStage] = useState('Proposal');
  const [dealProbability, setDealProbability] = useState(50);
  const [dealCloseDate, setDealCloseDate] = useState('');
  const [dealNotes, setDealNotes] = useState('');
  const [dealClientId, setDealClientId] = useState('');
  const [dealCurrency, setDealCurrency] = useState('USD'); // G20
  // G19 — recurring revenue fields
  const [dealIsRecurring, setDealIsRecurring] = useState(false);
  const [dealBillingCycle, setDealBillingCycle] = useState('monthly');
  const [dealRenewalDate, setDealRenewalDate] = useState('');
  const [dealSaving, setDealSaving] = useState(false);

  // FEATURE 3 — REPORTS STATE
  const [reportRange, setReportRange] = useState('30');

  // PART C — CUSTOM REPORTS STATES
  const [customDimension, setCustomDimension] = useState('Stage');
  const [customMetric, setCustomMetric] = useState('Count');
  const [customDateGrouping, setCustomDateGrouping] = useState('month');
  const [customReports, setCustomReports] = useState([]);
  const [savingReportName, setSavingReportName] = useState(null); // null = hidden, '' = open input
  const [compareReports, setCompareReports] = useState(false); // C2 toggle
  const [dealsStageFilter, setDealsStageFilter] = useState(''); // C3 drill-down target on Deals page

  // FEATURE 4 — EMAIL COMPOSER STATES
  const [showEmailComposer, setShowEmailComposer] = useState(false);
  const [emailTo, setEmailTo] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  // PART B — 'gmail' opens a Gmail compose tab, 'mailto' hands off to the default mail app
  const [emailProvider, setEmailProvider] = useState('gmail');
  const [emailTemplates, setEmailTemplates] = useState([]);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [templateName, setTemplateName] = useState('');
  const [templateSubject, setTemplateSubject] = useState('');
  const [templateBody, setTemplateBody] = useState('');

  // FEATURE 5 — AUTOMATION RULES STATES
  const [automationRules, setAutomationRules] = useState([]);
  const [showRuleForm, setShowRuleForm] = useState(false);
  const [newRule, setNewRule] = useState({ name: '', triggerType: 'stage_change', triggerValue: '', actionType: 'create_task', actionValue: {} });

  // FEATURE 7 — FILE ATTACHMENTS STATES
  const [clientFiles, setClientFiles] = useState([]);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [activeProfileTab, setActiveProfileTab] = useState('activity');
  const fileUploadRef = useRef(null);

  // FEATURE 8 — CALENDAR STATES
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [calendarView, setCalendarView] = useState('month');
  const [selectedCalendarDay, setSelectedCalendarDay] = useState(null);

  // FEATURE 9 — TAGS STATES
  const [tags, setTags] = useState([]);
  const [clientTagMap, setClientTagMap] = useState({});
  const [filterTags, setFilterTags] = useState([]);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#6366F1');

  // FEATURE 10 — TEAM WORKSPACE STATES
  const [workspace, setWorkspace] = useState(null);
  const [workspaceMembers, setWorkspaceMembers] = useState([]);
  const [myRole, setMyRole] = useState('owner');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState('');

  // N8N — EMAIL SEQUENCE WORKFLOW STATES
  const [sequences, setSequences] = useState([]);
  const [sequenceSteps, setSequenceSteps] = useState([]);
  const [sequenceEnrollments, setSequenceEnrollments] = useState([]);
  const [newSeqName, setNewSeqName] = useState('');
  const [newSeqTrigger, setNewSeqTrigger] = useState('manual');
  const [newSeqTriggerValue, setNewSeqTriggerValue] = useState('');
  const [seqStepDraft, setSeqStepDraft] = useState(null); // { sequenceId, wait_days, subject, body }
  const [enrollPick, setEnrollPick] = useState({}); // sequenceId -> clientId

  // n8n & API INTEGRATION STATES
  const [apiKeys, setApiKeys] = useState([]);
  const [integrationLogs, setIntegrationLogs] = useState([]);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyRaw, setNewKeyRaw] = useState(null); // shown ONCE
  const [logDirFilter, setLogDirFilter] = useState('all');
  const [n8nHook, setN8nHook] = useState({ url: '', events: [] });

  // G1 — GMAIL SYNC STATES
  const [gmailConn, setGmailConn] = useState(null);
  const [gmailSyncing, setGmailSyncing] = useState(false);

  // LGM UPGRADES — automation states
  const [sequenceSends, setSequenceSends] = useState([]);
  const [emailSettings, setEmailSettings] = useState(null); // null = no row yet
  const [sequenceTriggers, setSequenceTriggers] = useState([]); // V2 — event-driven auto-enrollment rules
  const [sequenceEdges, setSequenceEdges] = useState([]); // V2 — graph edges for branching sequences
  // V2 — Email Automation hub state
  const [seqView, setSeqView] = useState('sequences'); // 'sequences' | 'contacts' | 'unsubs'
  const [editingSeqId, setEditingSeqId] = useState(null); // canvas editor open for this sequence
  const [selectedNodeId, setSelectedNodeId] = useState(null); // canvas: selected node (config panel)
  const [connectFrom, setConnectFrom] = useState(null); // canvas: { nodeId, branch } while wiring an edge
  const [nodeDrag, setNodeDrag] = useState(null); // canvas: { nodeId, offsetX, offsetY } while dragging
  // V2 — cold contacts
  const [coldContacts, setColdContacts] = useState([]);
  const [unsubscribesList, setUnsubscribesList] = useState([]);
  const [coldSearch, setColdSearch] = useState('');
  const [coldFilter, setColdFilter] = useState('All');
  const [coldSelected, setColdSelected] = useState({}); // { [id]: true }
  const [coldImportPreview, setColdImportPreview] = useState(null); // rows or null
  const [coldImportLoading, setColdImportLoading] = useState(false);
  const [coldDraft, setColdDraft] = useState({ email: '', first_name: '', last_name: '', company: '', title: '', linkedin_url: '' });
  const [coldEnrollSeqId, setColdEnrollSeqId] = useState('');
  // V4 Part 3 — "Who Has Replied?" cross-campaign view (null seq filter = all campaigns)
  const [showWhoRepliedView, setShowWhoRepliedView] = useState(false);
  const [whoRepliedSeqFilter, setWhoRepliedSeqFilter] = useState(null);
  // V4 Part 4 — CRM-connected enroll panel
  const [showEnrollPanel, setShowEnrollPanel] = useState(null); // sequence id or null
  const [enrollFilterStatus, setEnrollFilterStatus] = useState('All');
  const [enrollFilterPriority, setEnrollFilterPriority] = useState('All');
  const [enrollFilterSource, setEnrollFilterSource] = useState('All');
  const [enrollFilterScoreMin, setEnrollFilterScoreMin] = useState(0);
  const [enrollSearchTerm, setEnrollSearchTerm] = useState('');
  const [enrollFilterTags, setEnrollFilterTags] = useState([]);
  const [stepEdit, setStepEdit] = useState(null); // inline editor: full step draft
  const [enrollMulti, setEnrollMulti] = useState({}); // sequenceId -> Set-ish {clientId: true}
  const repliesCheckedRef = useRef(false);

  // FEATURE 11 — WEBHOOKS STATES
  const [webhooks, setWebhooks] = useState([]);
  const [showWebhookForm, setShowWebhookForm] = useState(false);
  const [newWebhook, setNewWebhook] = useState({ name: '', url: '', events: [], secret: '' });

  // FEATURE 12 — MOBILE NAV STATE
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // FEATURE 13 — DARK MODE STATE
  const [darkMode, setDarkMode] = useState(false);

  // FEATURE 14 — DUPLICATE DETECTION STATE
  const [duplicateWarning, setDuplicateWarning] = useState(null);
  const [forceSaveDuplicate, setForceSaveDuplicate] = useState(false);

  // FEATURE 15 — QUICK NOTES STATES
  const [quickNoteValue, setQuickNoteValue] = useState('');
  const [quickNoteSaved, setQuickNoteSaved] = useState(false);
  const [quickNoteSaving, setQuickNoteSaving] = useState(false);

  // FEATURE 16 — IMPORT PREVIEW STATES
  const [importPreviewData, setImportPreviewData] = useState([]);
  const [showImportPreview, setShowImportPreview] = useState(false);
  const [importLoading, setImportLoading] = useState(false);

  // FEATURE 17 — STREAK STATES
  const [streakData, setStreakData] = useState({ current: 0, longest: 0, lastActive: null });

  // FEATURE 18 — BULK EMAIL STATES
  const [showBulkEmailModal, setShowBulkEmailModal] = useState(false);
  const [bulkEmailSubject, setBulkEmailSubject] = useState('');
  const [bulkEmailBody, setBulkEmailBody] = useState('');
  const [bulkEmailSending, setBulkEmailSending] = useState(false);
  const [bulkEmailProgress, setBulkEmailProgress] = useState('');

  // FEATURE 19 — HEALTH FILTER STATE
  const [filterHealth, setFilterHealth] = useState('');

  // FEATURE 20 — RECURRING TASK FORM STATES
  const [newTaskRecurrence, setNewTaskRecurrence] = useState('');
  const [newTaskRecurrenceEnd, setNewTaskRecurrenceEnd] = useState('');

  // FEATURE 22 — ACTIVITY TEMPLATES STATES
  const [activityTemplates, setActivityTemplates] = useState(DEFAULT_ACTIVITY_TEMPLATES);
  const [savingTemplateName, setSavingTemplateName] = useState(null); // null = hidden, '' = open input

  // FEATURE 23 — FOLLOW-UP SUGGESTION STATES
  const [followUpSuggestion, setFollowUpSuggestion] = useState('');
  const [followUpLoading, setFollowUpLoading] = useState(false);

  // FEATURE 24 — CLIENT TIMELINE STATE
  const [timelineClient, setTimelineClient] = useState(null);

  // FEATURE 25 — SOURCE FORM STATE
  const [clientSource, setClientSource] = useState('');

  // FEATURE 26 — GOALS STATES
  const [goals, setGoals] = useState([]);
  const [showGoalForm, setShowGoalForm] = useState(false);
  const [goalType, setGoalType] = useState('new_clients');
  const [goalTarget, setGoalTarget] = useState(10);

  // FEATURE 27 — CLIENT MERGE STATES
  const [showMergeTool, setShowMergeTool] = useState(false);
  const [mergeSource, setMergeSource] = useState(null);
  const [mergeTarget, setMergeTarget] = useState(null);
  const [mergeStep, setMergeStep] = useState(1);
  const [mergeSearch, setMergeSearch] = useState('');
  const [mergeFieldChoices, setMergeFieldChoices] = useState({});
  const [mergeLoading, setMergeLoading] = useState(false);

  // FEATURE 28 — KEYBOARD SHORTCUTS STATE
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);

  // FEATURE 29 — ADVANCED FILTERS & SAVED VIEWS STATES
  const [filterDateAdded, setFilterDateAdded] = useState('');
  const [filterSource, setFilterSource] = useState(''); // PART C3 — drill-down from Reports needs a source filter
  const [filterHasDeals, setFilterHasDeals] = useState(false);
  const [filterHasActivity, setFilterHasActivity] = useState('');
  const [filterScore, setFilterScore] = useState('');
  const [savedViews, setSavedViews] = useState([]);
  const [showMoreFilters, setShowMoreFilters] = useState(false);
  const [savingViewName, setSavingViewName] = useState(null); // null = hidden, '' = open input

  // FEATURE 30 — ONBOARDING STATES
  const [onboardingDismissed, setOnboardingDismissed] = useState(false);
  const [dashboardExplored, setDashboardExplored] = useState(false);

  // HELPER: Show Toast Notification
  function showToast(message, type = 'success') {
    const id = Date.now();
    setToasts(prev => [...prev, { id, type, message }]);
  }

  // HELPER: Show Confirm Dialog
  function showConfirm(title, message, confirmLabel, confirmVariant = 'primary', onConfirmCallback) {
    setConfirmDialog({
      isOpen: true,
      title,
      message,
      confirmLabel,
      confirmVariant,
      isLoading: false,
      onConfirm: onConfirmCallback
    });
  }

  // HELPER: Close Confirm Dialog
  function closeConfirm() {
    setConfirmDialog(prev => ({ ...prev, isOpen: false }));
  }

  // HELPER: Handle Confirm Dialog Confirm Button
  function handleConfirmDialogConfirm() {
    if (confirmDialog.onConfirm) {
      const result = confirmDialog.onConfirm();
      if (result instanceof Promise) {
        setConfirmDialog(prev => ({ ...prev, isLoading: true }));
        result.finally(() => {
          setConfirmDialog(prev => ({ ...prev, isLoading: false, isOpen: false }));
        });
      } else {
        closeConfirm();
      }
    }
  }

  // ==========================================
  // INITIALIZATION & EVENT LISTENERS
  // ==========================================
  
  useEffect(() => {
    checkSession();
    // Load preferred view mode
    const savedMode = localStorage.getItem('crm_view_mode');
    if (savedMode) setViewMode(savedMode);

    // Global Search CMD+K Shortcut
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowGlobalSearch(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // PART B — email provider preference
  useEffect(() => {
    const saved = localStorage.getItem('crm_email_provider');
    if (saved === 'gmail' || saved === 'mailto') setEmailProvider(saved);
  }, []);

  function setEmailProviderPersist(p) {
    setEmailProvider(p);
    localStorage.setItem('crm_email_provider', p);
  }

  // FEATURE 13 — Dark mode: init from localStorage, toggle root class
  useEffect(() => {
    const saved = localStorage.getItem('crm_dark_mode') === 'true';
    setDarkMode(saved);
    document.documentElement.classList.toggle('dark', saved);
  }, []);

  function toggleDarkMode() {
    const next = !darkMode;
    setDarkMode(next);
    document.documentElement.classList.toggle('dark', next);
    localStorage.setItem('crm_dark_mode', String(next));
  }

  // FEATURE 22 — Load saved activity templates, merge with defaults (dedupe by name)
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('crm_activity_templates') || '[]');
      if (Array.isArray(saved) && saved.length > 0) {
        setActivityTemplates(prev => {
          const merged = [...prev];
          saved.forEach(t => { if (t.name && !merged.some(m => m.name === t.name)) merged.push(t); });
          return merged;
        });
      }
    } catch { /* corrupt localStorage — ignore */ }
  }, []);

  // FEATURE 30 — Onboarding: dismissed flag + "explored dashboard" step
  useEffect(() => {
    setOnboardingDismissed(localStorage.getItem('crm_onboarding_dismissed') === 'true');
    setDashboardExplored(localStorage.getItem('crm_dashboard_explored') === 'true');
  }, []);

  useEffect(() => {
    if (appStep !== 'DASHBOARD' || dashboardExplored) return;
    const timer = setTimeout(() => {
      setDashboardExplored(true);
      localStorage.setItem('crm_dashboard_explored', 'true');
    }, 30000);
    return () => clearTimeout(timer);
  }, [appStep, dashboardExplored]);

  // FEATURE 14 — Duplicate email detection (debounced 500ms)
  useEffect(() => {
    const t = setTimeout(() => {
      if (!clientEmail) { setDuplicateWarning(null); setForceSaveDuplicate(false); return; }
      const existing = clients.find(c =>
        (c.email || '').toLowerCase() === clientEmail.toLowerCase() && c.id !== editingClient?.id
      );
      setDuplicateWarning(existing || null);
      if (!existing) setForceSaveDuplicate(false);
    }, 500);
    return () => clearTimeout(t);
  }, [clientEmail, clients, editingClient]);

  // FEATURE 15 — Quick note: sync value on client open, debounced auto-save (800ms)
  useEffect(() => {
    if (viewingClient) {
      setQuickNoteValue(viewingClient.quick_note || '');
      setQuickNoteSaved(false);
      setActiveProfileTab('activity');
      fetchClientFiles(viewingClient.id);
      setFollowUpSuggestion('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewingClient?.id]);

  useEffect(() => {
    if (!viewingClient) return;
    if (quickNoteValue === (viewingClient.quick_note || '')) return;
    const t = setTimeout(async () => {
      setQuickNoteSaving(true);
      const { error } = await supabase.from('clients').update({ quick_note: quickNoteValue }).eq('id', viewingClient.id);
      setQuickNoteSaving(false);
      if (!error) {
        setClients(prev => prev.map(c => c.id === viewingClient.id ? { ...c, quick_note: quickNoteValue } : c));
        setViewingClient(prev => prev ? { ...prev, quick_note: quickNoteValue } : prev);
        setQuickNoteSaved(true);
        setTimeout(() => setQuickNoteSaved(false), 2000);
      }
    }, 800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quickNoteValue]);

  // UPGRADE 2 — run the reply-stop pass once after data loads
  useEffect(() => {
    if (repliesCheckedRef.current || !user || activities.length === 0 || sequenceEnrollments.length === 0) return;
    repliesCheckedRef.current = true;
    detectRepliesAndStopSequences(activities, sequenceEnrollments, sequenceSends);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activities, sequenceEnrollments, user]);

  // FEATURE 23 — Smart follow-up suggestion (only when last activity >14 days or none)
  useEffect(() => {
    if (!viewingClient) return;
    const clientActs = activities.filter(a => a.client_id === viewingClient.id);
    const lastAct = clientActs[0];
    const daysSince = lastAct
      ? Math.floor((Date.now() - new Date(lastAct.activity_date)) / 86400000)
      : 999;
    if (daysSince < 14) return;
    generateFollowUpSuggestion(viewingClient, clientActs);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewingClient?.id]);

  // FEATURE 28 — Keyboard shortcuts. Refs keep user/appStep current inside the
  // stable listener (the empty-dep effect would otherwise close over stale values).
  const userRef = useRef(user);
  const appStepRef = useRef(appStep);
  useEffect(() => { userRef.current = user; }, [user]);
  useEffect(() => { appStepRef.current = appStep; }, [appStep]);

  useEffect(() => {
    const handleShortcuts = (e) => {
      const tag = (e.target?.tagName || '').toLowerCase();
      const typing = tag === 'input' || tag === 'textarea' || tag === 'select' || e.target?.isContentEditable;
      if (e.key === '?' && !e.metaKey && !e.ctrlKey && !typing) setShowKeyboardHelp(true);
      if (e.key === 'Escape') {
        setShowKeyboardHelp(false);
        setShowGlobalSearch(false);
        setShowNotifications(false);
        setShowDealForm(false);
        setShowEmailComposer(false);
        setShowGoalForm(false);
        setShowImportPreview(false);
        setShowMergeTool(false);
        setShowBulkEmailModal(false);
      }
      if (!userRef.current) return;
      if (e.altKey && !typing) {
        if (e.key === '1') setAppStep('DASHBOARD');
        if (e.key === '2') setAppStep('CLIENTS');
        if (e.key === '3') setAppStep('GLOBAL_TASKS');
        if (e.key === '4') setAppStep('REPORTS');
        if (e.key === '5') setAppStep('CALENDAR');
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'n' && appStepRef.current === 'CLIENTS') {
        e.preventDefault();
        document.getElementById('add-client-form')?.scrollIntoView({ behavior: 'smooth' });
        document.querySelector('#add-client-form input[type="text"]')?.focus();
      }
    };
    window.addEventListener('keydown', handleShortcuts);
    return () => window.removeEventListener('keydown', handleShortcuts);
  }, []);

  // Global Search Debounce
  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      if (globalSearchTerm.length > 1) {
        performGlobalSearch(globalSearchTerm);
      } else {
        setGlobalSearchResults({ clients: [], activities: [] });
      }
    }, 300);
    return () => clearTimeout(delayDebounce);
  }, [globalSearchTerm, clients, activities]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterPriority, filterStatus, sortBy]);

  async function checkSession() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setAppStep('LOG_IN');
      return;
    }
    setUser(session.user);
    setAppStep('DASHBOARD');
    
    // Parallel fetching for performance
    await Promise.all([
      fetchClients(session.user.id),
      fetchTasks(session.user.id),
      fetchProfile(session.user.id),
      fetchCustomFields(session.user.id),
      fetchActivities(session.user.id),
      fetchNotifications(session.user.id),
      fetchDeals(session.user.id),
      fetchEmailTemplates(session.user.id),
      fetchAutomationRules(session.user.id),
      fetchTags(session.user.id),
      fetchWebhooks(session.user.id),
      fetchGoals(session.user.id),
      fetchSavedViews(session.user.id),
      fetchCustomReports(session.user.id),
      fetchSequences(session.user.id),
      fetchColdData(session.user.id),
      fetchGmailConn(session.user.id),
      fetchIntegration(session.user.id)
    ]);
    // G1 — post-OAuth landing feedback
    const qp = new URLSearchParams(window.location.search);
    if (qp.get('gmail') === 'connected') {
      showToast('Gmail connected — emails will sync as activities.', 'success');
      window.history.replaceState({}, '', window.location.pathname);
    } else if (qp.get('gmail_error')) {
      showToast(`Gmail connect failed: ${qp.get('gmail_error')}`, 'error');
      window.history.replaceState({}, '', window.location.pathname);
    }
    // Workspace depends on the session user; invite acceptance needs the email
    await fetchWorkspace(session.user.id, session.user.email);
  }

  // ==========================================
  // NEW FEATURE DATA FETCHING
  // ==========================================

  async function fetchDeals(userId) {
    const { data } = await supabase.from('deals').select('*').eq('user_id', userId).order('created_at', { ascending: false });
    if (data) setDeals(data);
  }

  async function fetchEmailTemplates(userId) {
    const { data } = await supabase.from('email_templates').select('*').eq('user_id', userId).order('created_at', { ascending: false });
    if (data) setEmailTemplates(data);
  }

  async function fetchAutomationRules(userId) {
    const { data } = await supabase.from('automation_rules').select('*').eq('user_id', userId).order('created_at', { ascending: false });
    if (data) setAutomationRules(data);
  }

  async function fetchTags(userId) {
    const { data: tagRows } = await supabase.from('tags').select('*').eq('user_id', userId).order('name');
    if (tagRows) {
      setTags(tagRows);
      const tagIds = tagRows.map(t => t.id);
      if (tagIds.length > 0) {
        const { data: links } = await supabase.from('client_tags').select('client_id, tag_id').in('tag_id', tagIds);
        if (links) {
          const map = {};
          links.forEach(l => { (map[l.client_id] = map[l.client_id] || []).push(l.tag_id); });
          setClientTagMap(map);
        }
      } else {
        setClientTagMap({});
      }
    }
  }

  async function fetchWebhooks(userId) {
    const { data } = await supabase.from('webhooks').select('*').eq('user_id', userId).order('created_at', { ascending: false });
    if (data) setWebhooks(data);
  }

  async function fetchGoals(userId) {
    const { data } = await supabase.from('goals').select('*').eq('user_id', userId);
    if (data) setGoals(data);
  }

  async function fetchSavedViews(userId) {
    const { data } = await supabase.from('saved_views').select('*').eq('user_id', userId).order('created_at');
    if (data) setSavedViews(data);
  }

  // PART C4 — saved custom reports
  async function fetchCustomReports(userId) {
    const { data } = await supabase.from('custom_reports').select('*').eq('user_id', userId).order('created_at');
    if (data) setCustomReports(data);
  }

  async function handleSaveCustomReport(name) {
    if (!name.trim()) return;
    const config = { dimension: customDimension, metric: customMetric, dateGrouping: customDateGrouping, range: reportRange };
    const { data, error } = await supabase.from('custom_reports').insert([{ user_id: user.id, name: name.trim(), config }]).select();
    if (!error && data) {
      setCustomReports(prev => [...prev, data[0]]);
      setSavingReportName(null);
      showToast('Report saved.', 'success');
    } else showToast(`Error saving report: ${error?.message}`, 'error');
  }

  function applyCustomReport(r) {
    const c = r.config || {};
    if (c.dimension) setCustomDimension(c.dimension);
    if (c.metric) setCustomMetric(c.metric);
    if (c.dateGrouping) setCustomDateGrouping(c.dateGrouping);
    if (c.range) setReportRange(String(c.range));
  }

  function handleDeleteCustomReport(id) {
    showConfirm('Delete Report', 'Delete this saved report?', 'Delete', 'danger',
      async () => {
        const { error } = await supabase.from('custom_reports').delete().eq('id', id);
        if (!error) setCustomReports(prev => prev.filter(r => r.id !== id));
      });
  }

  // PART C5 — cycle email frequency: off → weekly → monthly → off.
  // NOTE: only stores the flag; actual delivery needs a scheduled Edge Function (see CHANGELOG).
  async function handleCycleReportFrequency(r) {
    const next = !r.send_frequency ? 'weekly' : r.send_frequency === 'weekly' ? 'monthly' : null;
    const { error } = await supabase.from('custom_reports').update({ send_frequency: next }).eq('id', r.id);
    if (!error) {
      setCustomReports(prev => prev.map(x => x.id === r.id ? { ...x, send_frequency: next } : x));
      showToast(next ? `Email schedule set to ${next} (delivery wiring pending — see changelog).` : 'Email schedule turned off.', 'success');
    } else showToast(`Error: ${error.message}`, 'error');
  }

  // PART C5 — client-side CSV export of the currently displayed custom report
  function exportCustomReportCSV() {
    const rows = [[customDimension, customMetric], ...customReportData.map(r => [
      r.label,
      customMetric === 'Avg Lead Score' ? r.value.toFixed(1) : r.value,
    ])];
    const csv = rows.map(row => row.map(x => `"${String(x).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a'); link.href = url; link.setAttribute('download', 'custom_report.csv');
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  // PART C3 — drill from a custom-report row into the pre-filtered Relationships list
  function drillCustomDimension(label) {
    if (customDimension === 'Month Added') return; // no matching list filter
    clearAllFilters();
    if (customDimension === 'Stage') setFilterStatus(label);
    if (customDimension === 'Priority') setFilterPriority(label);
    if (customDimension === 'Source') setFilterSource(label);
    if (customDimension === 'Tag') {
      const t = tags.find(x => x.name === label);
      if (t) setFilterTags([t.id]);
    }
    setAppStep('CLIENTS');
  }

  async function fetchClientFiles(clientId) {
    const { data } = await supabase.from('client_files').select('*').eq('client_id', clientId).order('created_at', { ascending: false });
    if (data) setClientFiles(data);
  }

  // ==========================================
  // FEATURE 10 — TEAM WORKSPACE
  // ==========================================

  async function fetchWorkspace(userId, userEmail) {
    // Accept pending invite for this email if one exists
    if (userEmail) {
      const { data: pending } = await supabase.from('workspace_members')
        .select('*').eq('invited_email', userEmail).eq('accepted', false).limit(1);
      if (pending && pending.length > 0) {
        await supabase.from('workspace_members')
          .update({ user_id: userId, accepted: true }).eq('id', pending[0].id);
      }
    }
    // Bug B — deterministic membership pick. If a user belongs to more than one
    // workspace, order by created_at so the oldest (their original) membership always
    // wins, rather than an arbitrary row that could show the wrong role.
    const { data: membership } = await supabase.from('workspace_members')
      .select('*').eq('user_id', userId).eq('accepted', true)
      .order('created_at', { ascending: true }).limit(1);
    if (membership && membership.length > 0) {
      const m = membership[0];
      setMyRole(m.role);
      const { data: ws } = await supabase.from('workspaces').select('*').eq('id', m.workspace_id).single();
      if (ws) setWorkspace(ws);
      const { data: members } = await supabase.from('workspace_members').select('*').eq('workspace_id', m.workspace_id);
      if (members) setWorkspaceMembers(members);
    }
  }

  async function handleCreateWorkspace(e) {
    e.preventDefault();
    if (!newWorkspaceName.trim()) return;
    const { data: ws, error } = await supabase.from('workspaces').insert([{ name: newWorkspaceName.trim(), owner_id: user.id }]).select();
    if (error || !ws) { showToast(`Error creating workspace: ${error?.message}`, 'error'); return; }
    const { data: member } = await supabase.from('workspace_members')
      .insert([{ workspace_id: ws[0].id, user_id: user.id, role: 'owner', accepted: true, invited_email: user.email }]).select();
    setWorkspace(ws[0]);
    setMyRole('owner');
    setWorkspaceMembers(member || []);
    setNewWorkspaceName('');
    showToast('Workspace created.', 'success');
  }

  async function handleInviteMember(e) {
    e.preventDefault();
    if (!inviteEmail.trim() || !workspace) return;
    const email = inviteEmail.trim().toLowerCase();
    setInviteLoading(true);
    // Pre-check: skip the insert entirely if an invite for this email is already pending
    const { data: existing } = await supabase.from('workspace_members')
      .select('id').eq('workspace_id', workspace.id)
      .eq('invited_email', email).maybeSingle();
    if (existing) {
      showToast('An invite for this email is already pending.', 'error');
      setInviteLoading(false);
      return;
    }
    // user_id stays null until the invited person signs up and accepts —
    // inserting the inviter's id here collided with UNIQUE(workspace_id, user_id)
    const { data, error } = await supabase.from('workspace_members')
      .insert([{ workspace_id: workspace.id, user_id: null, role: 'member', invited_email: email, accepted: false }]).select();
    if (error) {
      showToast(`Invite error: ${error.message}`, 'error');
    } else {
      if (data) setWorkspaceMembers(prev => [...prev, data[0]]);
      // Send the invite email via Resend (best-effort)
      fetch('/api/send-email', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: inviteEmail.trim(),
          subject: `You've been invited to ${workspace.name} on Student CRM`,
          body: `${profile.username || user.email} invited you to join the "${workspace.name}" workspace. Sign up with this email address to accept.`,
          fromName: profile.username || 'Student CRM',
        }),
      }).catch(() => {});
      showToast(`Invite sent to ${inviteEmail.trim()}.`, 'success');
      setInviteEmail('');
    }
    setInviteLoading(false);
  }

  async function handleUpdateMemberRole(memberId, role) {
    // Bug D — the true owner's role is derived from workspaces.owner_id and must never
    // be reassigned through the members UI.
    const target = workspaceMembers.find(m => m.id === memberId);
    if (target?.role === 'owner') { showToast('The workspace owner’s role cannot be changed.', 'error'); return; }
    // Bug C — client-side guard + verify the DB actually changed a row. Under RLS a
    // non-owner's update returns { error: null, data: [] }; without .select() the old
    // code optimistically showed a false success.
    if (!['owner', 'admin'].includes(myRole)) { showToast('Only the owner or an admin can change roles.', 'error'); return; }
    const { data, error } = await supabase.from('workspace_members').update({ role }).eq('id', memberId).select();
    if (error || !data || data.length === 0) {
      showToast('You do not have permission to change this role.', 'error');
      return;
    }
    setWorkspaceMembers(prev => prev.map(m => m.id === memberId ? { ...m, role } : m));
  }

  function handleRemoveMember(memberId) {
    const member = workspaceMembers.find(m => m.id === memberId);
    // Bug C/D — guard: only owner/admin may remove, and the owner can never be removed.
    if (member?.role === 'owner') { showToast('The workspace owner cannot be removed.', 'error'); return; }
    if (!['owner', 'admin'].includes(myRole)) { showToast('Only the owner or an admin can remove members.', 'error'); return; }
    showConfirm(
      'Remove Member',
      `Remove ${member?.invited_email || 'this member'} from the workspace? They will lose access immediately.`,
      'Remove', 'danger',
      async () => {
        const { error } = await supabase.from('workspace_members').delete().eq('id', memberId);
        if (!error) setWorkspaceMembers(prev => prev.filter(m => m.id !== memberId));
        else showToast(`Error removing member: ${error.message}`, 'error');
      }
    );
  }

  function handleLeaveWorkspace() {
    showConfirm(
      'Leave Workspace',
      'Are you sure you want to leave this workspace? You will lose access to shared data.',
      'Leave', 'danger',
      async () => {
        const mine = workspaceMembers.find(m => m.user_id === user.id);
        if (mine) await supabase.from('workspace_members').delete().eq('id', mine.id);
        setWorkspace(null); setWorkspaceMembers([]); setMyRole('owner');
      }
    );
  }

  const canEdit = !workspace || ['owner', 'admin', 'member'].includes(myRole);
  const canDelete = !workspace || ['owner', 'admin'].includes(myRole);
  const isViewer = workspace && myRole === 'viewer';

  // ==========================================
  // FEATURE 1 — DEALS HANDLERS
  // ==========================================

  function resetDealForm() {
    setDealTitle(''); setDealValue(''); setDealStage('Proposal'); setDealProbability(50);
    setDealCloseDate(''); setDealNotes(''); setDealClientId(''); setDealCurrency('USD');
    setDealIsRecurring(false); setDealBillingCycle('monthly'); setDealRenewalDate(''); setEditingDeal(null);
  }

  async function handleCreateDeal(e) {
    e.preventDefault();
    if (!dealTitle.trim() || !dealClientId) return;
    setDealSaving(true);
    const payload = {
      user_id: user.id, client_id: parseInt(dealClientId, 10), title: dealTitle.trim(),
      value: parseFloat(dealValue) || 0, stage: dealStage,
      probability: Math.max(0, Math.min(100, parseInt(dealProbability, 10) || 0)),
      close_date: dealCloseDate || null, notes: dealNotes || null,
      currency: dealCurrency || 'USD', // G20
      // G19
      is_recurring: dealIsRecurring,
      billing_cycle: dealIsRecurring ? dealBillingCycle : null,
      renewal_date: dealIsRecurring ? (dealRenewalDate || null) : null,
    };
    if (editingDeal) {
      const { data, error } = await supabase.from('deals').update(payload).eq('id', editingDeal.id).select();
      if (!error && data) {
        setDeals(prev => prev.map(d => d.id === editingDeal.id ? data[0] : d));
        dispatchWebhook('deal.updated', data[0]);
        showToast('Deal updated.', 'success');
        setShowDealForm(false); resetDealForm();
      } else showToast(`Error updating deal: ${error?.message}`, 'error');
    } else {
      const { data, error } = await supabase.from('deals').insert([payload]).select();
      if (!error && data) {
        setDeals(prev => [data[0], ...prev]);
        dispatchWebhook('deal.created', data[0]);
        showToast('Deal created.', 'success');
        setShowDealForm(false); resetDealForm();
      } else showToast(`Error creating deal: ${error?.message}`, 'error');
    }
    setDealSaving(false);
  }

  async function handleUpdateDealStage(deal, newStage) {
    const { error } = await supabase.from('deals').update({ stage: newStage }).eq('id', deal.id);
    if (!error) {
      setDeals(prev => prev.map(d => d.id === deal.id ? { ...d, stage: newStage } : d));
      if (newStage === 'Won') dispatchWebhook('deal.won', { ...deal, stage: newStage });
      if (newStage === 'Lost') dispatchWebhook('deal.lost', { ...deal, stage: newStage });
      executeAutomations('deal_stage_change', newStage, deal.client_id);
      // V2 — event-driven sequence auto-enrollment
      if (newStage === 'Won') triggerSequenceEnrollment('deal_won', deal.id, 'deal', { ...deal, stage: newStage });
      if (newStage === 'Lost') triggerSequenceEnrollment('deal_lost', deal.id, 'deal', { ...deal, stage: newStage });
      triggerSequenceEnrollment('deal_stage_changed', deal.id, 'deal', { ...deal, stage: newStage });
    } else showToast(`Error moving deal: ${error.message}`, 'error');
  }

  function handleDeleteDeal(deal) {
    showConfirm(
      'Delete Deal',
      `Are you sure you want to delete "${deal.title}"? This cannot be undone.`,
      'Delete', 'danger',
      async () => {
        const { error } = await supabase.from('deals').delete().eq('id', deal.id);
        if (!error) setDeals(prev => prev.filter(d => d.id !== deal.id));
        else showToast(`Error deleting deal: ${error.message}`, 'error');
      }
    );
  }

  const handleDealDragStart = (e, dealId) => e.dataTransfer.setData('text/deal-id', dealId.toString());
  const handleDealDrop = async (e, targetStage) => {
    e.preventDefault();
    const idStr = e.dataTransfer.getData('text/deal-id');
    if (!idStr) return;
    // deals.id is a uuid string — never parseInt it
    const deal = deals.find(d => String(d.id) === idStr);
    if (deal && deal.stage !== targetStage) await handleUpdateDealStage(deal, targetStage);
  };

  // ==========================================
  // FEATURE 2 — AI SUMMARY / FEATURE 23 — FOLLOW-UP
  // ==========================================

  async function generateFollowUpSuggestion(client, clientActs) {
    setFollowUpLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/ai-summary`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token || ''}` },
        body: JSON.stringify({
          clientName: client.name,
          activities: clientActs,
          tasks: tasks.filter(t => t.client_id === client.id),
          deals: deals.filter(d => d.client_id === client.id),
          notes: client.note_conversation,
          mode: 'follow_up_suggestion',
        }),
      });
      const { summary, error } = await res.json();
      if (!error && summary) setFollowUpSuggestion(summary);
    } catch { /* silent — suggestion is best-effort */ }
    setFollowUpLoading(false);
  }

  // ==========================================
  // FEATURE 4 — EMAIL COMPOSER / FEATURE 18 — BULK EMAIL
  // ==========================================

  function resolveMergeTags(str, client) {
    return (str || '')
      .replace(/{{name}}/g, client?.name || '')
      .replace(/{{email}}/g, client?.email || '')
      .replace(/{{phone}}/g, client?.phone_number || '')
      .replace(/{{stage}}/g, client?.status || '')
      .replace(/{{company}}/g, client?.company_name || ''); // LGM — mirrors the runner's mergeTags
  }

  // PART B — default send path opens a real compose tab in the user's browser.
  // (No RESEND_API_KEY is configured and /api/send-email does not exist, so the
  // old fetch-based flow always failed; the opt-in "send automatically" link is
  // intentionally omitted until Resend is actually set up.)
  async function handleSendEmail(e) {
    e.preventDefault();
    if (!emailTo || !emailSubject || !emailBody) return;
    const subject = resolveMergeTags(emailSubject, viewingClient);
    const body = resolveMergeTags(emailBody, viewingClient);

    if (emailProvider === 'mailto') {
      window.location.href = buildMailtoUrl(emailTo, subject, body);
    } else {
      const tab = window.open(buildGmailUrl(emailTo, subject, body), '_blank', 'noopener,noreferrer');
      if (!tab) window.location.href = buildMailtoUrl(emailTo, subject, body);
    }

    if (viewingClient) {
      const { data } = await supabase.from('activities').insert([{
        client_id: viewingClient.id, user_id: user.id,
        activity_type: 'Email', activity_date: new Date().toISOString().split('T')[0],
        description: `Drafted — Subject: ${subject}\n\n${body}`,
        // no outcome field — see Part A
      }]).select();
      if (data) setActivities(prev => [data[0], ...prev]);
    }
    showToast('Opened in a new tab — send from there.', 'success');
    setShowEmailComposer(false); setEmailSubject(''); setEmailBody('');
  }

  async function handleSaveEmailTemplate(e) {
    e?.preventDefault();
    if (!templateName.trim() || !templateSubject || !templateBody) return;
    if (editingTemplate) {
      const { data, error } = await supabase.from('email_templates')
        .update({ name: templateName.trim(), subject: templateSubject, body: templateBody })
        .eq('id', editingTemplate.id).select();
      if (!error && data) {
        setEmailTemplates(prev => prev.map(t => t.id === editingTemplate.id ? data[0] : t));
        showToast('Template updated.', 'success');
      } else showToast(`Error: ${error?.message}`, 'error');
    } else {
      const { data, error } = await supabase.from('email_templates')
        .insert([{ user_id: user.id, name: templateName.trim(), subject: templateSubject, body: templateBody }]).select();
      if (!error && data) {
        setEmailTemplates(prev => [data[0], ...prev]);
        showToast('Template saved.', 'success');
      } else showToast(`Error: ${error?.message}`, 'error');
    }
    setEditingTemplate(null); setTemplateName(''); setTemplateSubject(''); setTemplateBody('');
  }

  function handleDeleteEmailTemplate(id) {
    showConfirm('Delete Template', 'Delete this email template? This cannot be undone.', 'Delete', 'danger',
      async () => {
        const { error } = await supabase.from('email_templates').delete().eq('id', id);
        if (!error) setEmailTemplates(prev => prev.filter(t => t.id !== id));
      });
  }

  // PART B — bulk flow opens one compose tab per recipient (300ms apart so the
  // popup blocker doesn't treat the burst as spam).
  async function handleBulkSendEmail(e) {
    e.preventDefault();
    if (!bulkEmailSubject || !bulkEmailBody || selectedClientIds.length === 0) return;
    setBulkEmailSending(true);
    let opened = 0, blocked = 0;
    const targets = clients.filter(c => selectedClientIds.includes(c.id) && c.email);
    for (let i = 0; i < targets.length; i++) {
      const c = targets[i];
      setBulkEmailProgress(`Opening tab ${i + 1} of ${targets.length}...`);
      const subject = resolveMergeTags(bulkEmailSubject, c);
      const body = resolveMergeTags(bulkEmailBody, c);
      const url = emailProvider === 'mailto' ? buildMailtoUrl(c.email, subject, body) : buildGmailUrl(c.email, subject, body);
      const tab = window.open(url, '_blank', 'noopener,noreferrer');
      if (tab) {
        opened++;
        const { data } = await supabase.from('activities').insert([{
          client_id: c.id, user_id: user.id, activity_type: 'Email',
          activity_date: new Date().toISOString().split('T')[0],
          description: `Drafted bulk email — Subject: ${subject}`,
        }]).select();
        if (data) setActivities(prev => [data[0], ...prev]);
      } else {
        blocked++;
      }
      if (i < targets.length - 1) await new Promise(r => setTimeout(r, 300));
    }
    if (blocked > 0) {
      showToast(`Opened ${opened} tab${opened === 1 ? '' : 's'} — ${blocked} blocked. Allow popups for this site and retry.`, 'error');
    } else {
      showToast(`Opened ${opened} compose tab${opened === 1 ? '' : 's'} — send each from there.`, 'success');
    }
    setSelectedClientIds([]);
    setShowBulkEmailModal(false); setBulkEmailSubject(''); setBulkEmailBody(''); setBulkEmailProgress('');
    setBulkEmailSending(false);
  }

  // ==========================================
  // FEATURE 5 — AUTOMATION RULES ENGINE
  // ==========================================

  async function executeAutomations(triggerType, triggerValue, clientId) {
    const matching = automationRules.filter(r =>
      r.enabled && r.trigger_type === triggerType && r.trigger_value === String(triggerValue));
    for (const rule of matching) {
      if (rule.action_type === 'create_task') {
        const due = new Date();
        due.setDate(due.getDate() + (parseInt(rule.action_value?.days_offset) || 1));
        const { data } = await supabase.from('tasks').insert([{
          user_id: user.id, client_id: clientId,
          title: rule.action_value?.title || 'Follow up',
          due_date: due.toISOString().split('T')[0], status: 'pending',
        }]).select();
        if (data) setTasks(prev => [...prev, data[0]]);
        showToast(`Automation: task "${rule.action_value?.title || 'Follow up'}" created.`, 'success');
      }
      if (rule.action_type === 'send_notification') {
        await supabase.from('notifications').insert([{
          user_id: user.id, type: 'system', reference_id: clientId,
          message: rule.action_value?.message || `Rule triggered: ${rule.name}`,
        }]);
        fetchNotifications(user.id);
      }
      // G11 — set_priority action (used by the LinkedIn recipe)
      if (rule.action_type === 'set_priority') {
        const pr = rule.action_value?.priority || 'High';
        await supabase.from('clients').update({ relationship: pr }).eq('id', clientId);
        setClients(prev => prev.map(c => c.id === clientId ? { ...c, relationship: pr } : c));
        showToast(`Automation: priority set to ${pr}.`, 'success');
      }
      if (rule.action_type === 'change_stage') {
        await supabase.from('clients').update({ status: rule.action_value?.stage }).eq('id', clientId);
        setClients(prev => prev.map(c => c.id === clientId ? { ...c, status: rule.action_value.stage } : c));
        showToast(`Automation: moved relationship to "${rule.action_value?.stage}".`, 'success');
      }
      if (rule.action_type === 'send_email') {
        const target = clients.find(c => c.id === clientId);
        if (target?.email) {
          fetch('/api/send-email', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              to: target.email,
              subject: resolveMergeTags(rule.action_value?.subject || '', target),
              body: resolveMergeTags(rule.action_value?.body || '', target),
              fromName: profile.username || 'CRM',
            }),
          }).catch(() => {});
        }
      }
      await supabase.from('automation_rules')
        .update({ run_count: (rule.run_count || 0) + 1, last_run_at: new Date().toISOString() })
        .eq('id', rule.id);
      setAutomationRules(prev => prev.map(r => r.id === rule.id ? { ...r, run_count: (r.run_count || 0) + 1 } : r));
    }
  }

  // ==========================================
  // G1 — GMAIL SYNC
  // ==========================================

  async function fetchIntegration(userId) {
    const [{ data: keys }, { data: logs }] = await Promise.all([
      supabase.from('api_keys').select('id, name, key_prefix, scopes, last_used_at, revoked, created_at').eq('user_id', userId).order('created_at', { ascending: false }),
      supabase.from('integration_logs').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(100),
    ]);
    if (keys) setApiKeys(keys);
    if (logs) setIntegrationLogs(logs);
  }

  // Raw key shown once; only SHA-256 hash + prefix stored.
  async function handleGenerateApiKey(e) {
    e.preventDefault();
    if (!newKeyName.trim()) return;
    const bytes = new Uint8Array(16); crypto.getRandomValues(bytes);
    const raw = 'n8n_' + Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
    const hash = Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
    const { data, error } = await supabase.from('api_keys').insert([{
      user_id: user.id, name: newKeyName.trim(), key_hash: hash, key_prefix: raw.slice(0, 8), scopes: ['read', 'write'],
    }]).select('id, name, key_prefix, scopes, last_used_at, revoked, created_at');
    if (!error && data) { setApiKeys(prev => [data[0], ...prev]); setNewKeyRaw(raw); setNewKeyName(''); }
    else showToast(`Error: ${error?.message}`, 'error');
  }

  async function handleRevokeApiKey(k) {
    const { error } = await supabase.from('api_keys').update({ revoked: true }).eq('id', k.id);
    if (!error) setApiKeys(prev => prev.map(x => x.id === k.id ? { ...x, revoked: true } : x));
  }

  async function handleConnectN8n(e) {
    e.preventDefault();
    if (!n8nHook.url.trim() || n8nHook.events.length === 0) return;
    const { data, error } = await supabase.from('webhooks').insert([{
      user_id: user.id, name: 'n8n workflow', url: n8nHook.url.trim(), events: n8nHook.events,
      secret: (crypto.randomUUID ? crypto.randomUUID() : String(Math.random())).replace(/-/g, ''), enabled: true, provider: 'n8n',
    }]).select();
    if (!error && data) { setWebhooks(prev => [data[0], ...prev]); setN8nHook({ url: '', events: [] }); showToast('n8n webhook connected.', 'success'); }
    else showToast(`Error: ${error?.message}`, 'error');
  }

  async function fetchGmailConn(userId) {
    const { data } = await supabase.from('gmail_connections')
      .select('id, email_address, connected_at, last_synced_at, revoked_at, needs_reauth')
      .eq('user_id', userId).is('revoked_at', null).maybeSingle();
    setGmailConn(data || null);
  }

  function handleConnectGmail() {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!clientId) { showToast('NEXT_PUBLIC_GOOGLE_CLIENT_ID is not set in .env.local.', 'error'); return; }
    const redirect = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/gmail-oauth`;
    window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams({
      client_id: clientId, redirect_uri: redirect, response_type: 'code',
      scope: 'https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send',
      access_type: 'offline', prompt: 'consent', state: user.id,
    })}`;
  }

  function handleDisconnectGmail() {
    showConfirm('Disconnect Gmail', 'Stop syncing Gmail messages as activities? Already-synced activities are kept.', 'Disconnect', 'danger',
      async () => {
        const { data: { session } } = await supabase.auth.getSession();
        const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/gmail-disconnect`, {
          method: 'POST', headers: { Authorization: `Bearer ${session?.access_token || ''}` },
        }).catch(() => null);
        if (res?.ok) setGmailConn(null);
        else showToast('Disconnect failed — try again.', 'error');
      });
  }

  async function handleGmailSyncNow() {
    setGmailSyncing(true);
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/gmail-sync`, {
      method: 'POST', headers: { Authorization: `Bearer ${session?.access_token || ''}` },
    }).catch(() => null);
    const out = res ? await res.json().catch(() => ({})) : {};
    if (res?.ok) {
      showToast(`Gmail sync complete — ${out.synced ?? 0} new email activit${(out.synced ?? 0) === 1 ? 'y' : 'ies'}${out.autoStopped ? `, ${out.autoStopped} sequence(s) auto-stopped (replied)` : ''}.`, 'success');
      fetchActivities(user.id);
      fetchGmailConn(user.id);
      fetchSequences(user.id); // UPGRADE 2 — pick up server-side reply-stops
    } else {
      showToast(`Gmail sync failed: ${out.error || 'network error'}${out.error === 'server_not_configured' || out.detail ? ' — check GOOGLE_CLIENT_SECRET in Supabase function secrets' : ''}`, 'error');
    }
    setGmailSyncing(false);
  }

  // ==========================================
  // N8N — EMAIL SEQUENCE WORKFLOWS
  // ==========================================

  async function fetchSequences(userId) {
    const [{ data: seqs }, { data: steps }, { data: enr }, { data: sends }, { data: settings }, { data: trigs }, { data: edges }] = await Promise.all([
      supabase.from('email_sequences').select('*').eq('user_id', userId).order('created_at'),
      supabase.from('sequence_steps').select('*').eq('user_id', userId).order('step_order'),
      supabase.from('sequence_enrollments').select('*').eq('user_id', userId),
      supabase.from('sequence_sends').select('*').eq('user_id', userId).order('sent_at', { ascending: false }),
      supabase.from('email_settings').select('*').eq('user_id', userId).maybeSingle(),
      supabase.from('sequence_triggers').select('*').eq('user_id', userId),
      supabase.from('sequence_edges').select('*').eq('user_id', userId),
    ]);
    if (seqs) setSequences(seqs);
    if (steps) setSequenceSteps(steps);
    if (enr) setSequenceEnrollments(enr);
    if (sends) setSequenceSends(sends);
    setEmailSettings(settings || null);
    if (trigs) setSequenceTriggers(trigs);
    if (edges) setSequenceEdges(edges);
  }

  // UPGRADE 1/7 — Email Automation settings
  async function handleSaveEmailSettings(patch) {
    const next = {
      user_id: user.id,
      auto_send_enabled: emailSettings?.auto_send_enabled ?? false,
      daily_send_cap: emailSettings?.daily_send_cap ?? 50,
      send_days: emailSettings?.send_days ?? [1, 2, 3, 4, 5],
      send_window_start: emailSettings?.send_window_start ?? 9,
      send_window_end: emailSettings?.send_window_end ?? 17,
      send_tz_offset: emailSettings?.send_tz_offset ?? -new Date().getTimezoneOffset(),
      linkedin_daily_cap: emailSettings?.linkedin_daily_cap ?? 20,
      ...patch,
    };
    const { data, error } = await supabase.from('email_settings').upsert([next], { onConflict: 'user_id' }).select();
    if (!error && data) { setEmailSettings(data[0]); showToast('Email automation settings saved.', 'success'); }
    else showToast(`Error: ${error?.message}`, 'error');
  }

  // UPGRADE 2 — client-side reply detection fallback (server does this too)
  async function detectRepliesAndStopSequences(acts, enrs, sendsList) {
    const stopped = [];
    for (const en of enrs.filter(e => e.status === 'active')) {
      const replied = acts.some(a =>
        a.client_id === en.client_id && a.gmail_message_id &&
        (a.description || '').startsWith('Gmail — Received') &&
        new Date(a.created_at) >= new Date(en.enrolled_at));
      if (!replied) continue;
      const { error } = await supabase.from('sequence_enrollments')
        .update({ status: 'replied', stopped_reason: 'replied', next_send_at: null }).eq('id', en.id);
      if (error) continue;
      const lastSend = sendsList.filter(s => s.enrollment_id === en.id && !s.replied_at)
        .sort((a, b) => new Date(b.sent_at) - new Date(a.sent_at))[0];
      if (lastSend) {
        await supabase.from('sequence_sends').update({ replied_at: new Date().toISOString() }).eq('id', lastSend.id);
        setSequenceSends(prev => prev.map(s => s.id === lastSend.id ? { ...s, replied_at: new Date().toISOString() } : s));
      }
      stopped.push(en.id);
      dispatchWebhook('email.replied', { enrollment_id: en.id, client_id: en.client_id, sequence_id: en.sequence_id });
    }
    if (stopped.length) {
      setSequenceEnrollments(prev => prev.map(x => stopped.includes(x.id) ? { ...x, status: 'replied', stopped_reason: 'replied', next_send_at: null } : x));
      showToast(`${stopped.length} enrollment${stopped.length === 1 ? '' : 's'} auto-stopped — they replied.`, 'success');
    }
  }

  const seqStepsFor = (id) => sequenceSteps.filter(s => s.sequence_id === id).sort((a, b) => a.step_order - b.step_order || a.id - b.id);
  const addDaysStr = (days, base = new Date()) => { const d = new Date(base); d.setDate(d.getDate() + (parseInt(days, 10) || 0)); return d.toISOString().split('T')[0]; };

  async function handleCreateSequence(e) {
    e.preventDefault();
    if (!newSeqName.trim()) return;
    const { data, error } = await supabase.from('email_sequences').insert([{
      user_id: user.id, name: newSeqName.trim(), status: 'draft',
      trigger_type: newSeqTrigger, trigger_value: newSeqTrigger === 'tag_applied' ? (newSeqTriggerValue || null) : null,
    }]).select();
    if (!error && data) {
      setSequences(prev => [...prev, data[0]]);
      setNewSeqName(''); setNewSeqTrigger('manual'); setNewSeqTriggerValue('');
      showToast('Workflow created — add steps, then activate it.', 'success');
    } else showToast(`Error: ${error?.message}`, 'error');
  }

  async function handleSetSequenceStatus(seq, status) {
    if (status === 'active' && seqStepsFor(seq.id).length === 0) { showToast('Add at least one step before activating.', 'error'); return; }
    const { error } = await supabase.from('email_sequences').update({ status }).eq('id', seq.id);
    if (!error) setSequences(prev => prev.map(s => s.id === seq.id ? { ...s, status } : s));
  }

  function handleDeleteSequence(seq) {
    showConfirm('Delete Workflow', `Delete "${seq.name}" and all its steps/enrollments? This cannot be undone.`, 'Delete', 'danger',
      async () => {
        const { error } = await supabase.from('email_sequences').delete().eq('id', seq.id);
        if (!error) {
          setSequences(prev => prev.filter(s => s.id !== seq.id));
          setSequenceSteps(prev => prev.filter(s => s.sequence_id !== seq.id));
          setSequenceEnrollments(prev => prev.filter(s => s.sequence_id !== seq.id));
        }
      });
  }

  async function handleDuplicateSequence(seq) {
    const { data, error } = await supabase.from('email_sequences').insert([{
      user_id: user.id, name: `${seq.name} (copy)`, status: 'draft',
      trigger_type: seq.trigger_type, trigger_value: seq.trigger_value,
    }]).select();
    if (error || !data) { showToast(`Error: ${error?.message}`, 'error'); return; }
    const steps = seqStepsFor(seq.id).map(s => ({
      sequence_id: data[0].id, user_id: user.id, step_order: s.step_order,
      wait_days: s.wait_days, subject: s.subject, body: s.body,
    }));
    if (steps.length > 0) {
      const { data: sd } = await supabase.from('sequence_steps').insert(steps).select();
      if (sd) setSequenceSteps(prev => [...prev, ...sd]);
    }
    setSequences(prev => [...prev, data[0]]);
    showToast('Workflow duplicated as draft.', 'success');
  }

  // UPGRADE 5/6/8 — add step with channel/condition/A-B, optionally inserted
  // between existing steps (insertAt = index or null for end).
  // DB has subject/body NOT NULL, so non-email steps store '' (documented).
  async function handleAddSequenceStep(e) {
    e.preventDefault();
    const d = seqStepDraft;
    if (!d) return;
    const isEmail = !d.channel || d.channel === 'email';
    if (isEmail && (!d.subject?.trim() || !d.body?.trim())) return;
    if (!isEmail && !d.task_note?.trim()) { showToast('Add a note describing the task.', 'error'); return; }
    const steps = seqStepsFor(d.sequenceId);
    const at = d.insertAt == null ? steps.length : Math.min(d.insertAt, steps.length);
    // shift later steps down by one (batched)
    await Promise.all(steps.slice(at).map(s =>
      supabase.from('sequence_steps').update({ step_order: s.step_order + 1 }).eq('id', s.id)));
    const { data, error } = await supabase.from('sequence_steps').insert([{
      sequence_id: d.sequenceId, user_id: user.id, step_order: at,
      wait_days: Math.max(0, parseInt(d.wait_days, 10) || 0),
      subject: isEmail ? d.subject.trim() : '',
      body: isEmail ? d.body : '',
      subject_b: isEmail && d.subject_b?.trim() ? d.subject_b : null,
      channel: d.channel || 'email',
      condition: d.condition || 'always',
      task_note: !isEmail ? d.task_note : null,
    }]).select();
    if (!error && data) {
      setSequenceSteps(prev => [
        ...prev.map(s => (s.sequence_id === d.sequenceId && s.step_order >= at && s.id !== data[0].id) ? { ...s, step_order: s.step_order + 1 } : s),
        data[0],
      ]);
      setSeqStepDraft(null);
    } else showToast(`Error: ${error?.message}`, 'error');
  }

  async function handleDeleteSequenceStep(step) {
    const { error } = await supabase.from('sequence_steps').delete().eq('id', step.id);
    if (!error) setSequenceSteps(prev => prev.filter(s => s.id !== step.id));
  }

  async function enrollClientInSequence(seq, clientId, { silent = false } = {}) {
    const steps = seqStepsFor(seq.id);
    if (steps.length === 0) { if (!silent) showToast('This workflow has no steps yet.', 'error'); return false; }
    const cid = parseInt(clientId, 10);
    if (sequenceEnrollments.some(en => en.sequence_id === seq.id && en.client_id === cid && en.status === 'active')) {
      if (!silent) showToast('Already enrolled in this workflow.', 'error');
      return false;
    }
    const { data, error } = await supabase.from('sequence_enrollments').insert([{
      sequence_id: seq.id, client_id: cid, user_id: user.id,
      status: 'active', current_step: 0, next_send_at: addDaysStr(steps[0].wait_days),
    }]).select();
    if (!error && data) {
      setSequenceEnrollments(prev => [...prev, data[0]]);
      dispatchWebhook('sequence.enrolled', data[0]);
      if (!silent) showToast('Enrolled — first email is in the Outbox when due.', 'success');
      return true;
    }
    if (!silent) showToast(`Error: ${error?.message}`, 'error');
    return false;
  }

  // V2 — event-driven auto-enrollment: called from CRM handlers when something
  // happens (deal won, tag applied, ...). Matches enabled sequence_triggers rows,
  // evaluates their trigger_config, honors the unsubscribe list, then enrolls.
  async function triggerSequenceEnrollment(triggerEvent, entityId, entityType, context = {}) {
    try {
      // Resolve the relationship this event is about
      const clientId = entityType === 'client' ? entityId : context?.client_id;
      if (!clientId) return;
      const client = clients.find(c => c.id === parseInt(clientId, 10)) || context?.client || null;

      // V3 — collect matching sequences from BOTH trigger systems:
      //  (a) sequence_triggers rows (canvas Trigger-node config), and
      //  (b) email_sequences.trigger_type/trigger_value (older per-sequence config the
      //      founder used — e.g. the "Auto email" sequence). Dedupe by sequence id.
      const matchedSeqIds = new Set();
      const toEnroll = [];

      for (const trig of sequenceTriggers.filter(t => t.enabled && t.trigger_event === triggerEvent)) {
        const seq = sequences.find(s => s.id === trig.sequence_id);
        if (!seq || !(seq.is_active || seq.status === 'active')) continue;
        if (trig.target_audience === 'cold_contacts') continue; // CRM events only touch relationships
        const cfg = trig.trigger_config || {};
        if (triggerEvent === 'deal_stage_changed' && cfg.stage && context?.stage !== cfg.stage) continue;
        if (triggerEvent === 'relationship_stage_changed' && cfg.stage && context?.status !== cfg.stage) continue;
        if (triggerEvent === 'tag_applied' && cfg.tag_id && String(context?.tagId) !== String(cfg.tag_id)) continue;
        if (!matchedSeqIds.has(seq.id)) { matchedSeqIds.add(seq.id); toEnroll.push(seq); }
      }

      // Legacy N8N trigger_type names map onto the current event names
      const LEGACY_ALIASES = {
        relationship_created: ['relationship_created', 'new_relationship'],
        tag_applied: ['tag_applied'],
        deal_won: ['deal_won'],
        deal_lost: ['deal_lost'],
        deal_stage_changed: ['deal_stage_changed'],
        relationship_stage_changed: ['relationship_stage_changed'],
        task_completed: ['task_completed'],
      };
      const acceptTypes = LEGACY_ALIASES[triggerEvent] || [triggerEvent];
      for (const seq of sequences.filter(s => (s.is_active || s.status === 'active') && acceptTypes.includes(s.trigger_type))) {
        // stage/tag-scoped legacy triggers match on trigger_value
        if (triggerEvent === 'deal_stage_changed' && seq.trigger_value && context?.stage !== seq.trigger_value) continue;
        if (triggerEvent === 'relationship_stage_changed' && seq.trigger_value && context?.status !== seq.trigger_value) continue;
        if (triggerEvent === 'tag_applied' && seq.trigger_value && context?.tagName && String(context.tagName) !== String(seq.trigger_value)) continue;
        if (!matchedSeqIds.has(seq.id)) { matchedSeqIds.add(seq.id); toEnroll.push(seq); }
      }

      if (toEnroll.length === 0) return;

      // Honor the unsubscribe list before enrolling
      if (client?.email) {
        const { data: unsub } = await supabase.from('unsubscribes')
          .select('id').eq('user_id', user.id).eq('email', client.email.toLowerCase()).maybeSingle();
        if (unsub) return;
      }

      for (const seq of toEnroll) {
        const ok = await enrollClientInSequence(seq, clientId, { silent: true });
        if (ok) showToast(`1 relationship auto-enrolled in "${seq.name}".`, 'success');
      }
    } catch (err) {
      console.error('triggerSequenceEnrollment error:', err);
    }
  }

  // ==========================================
  // V2 — COLD CONTACTS (Part 5)
  // ==========================================

  async function fetchColdData(userId) {
    const [{ data: cc }, { data: us }] = await Promise.all([
      supabase.from('cold_contacts').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
      supabase.from('unsubscribes').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
    ]);
    if (cc) setColdContacts(cc);
    if (us) setUnsubscribesList(us);
  }

  // CSV import — same PapaParse + validated-preview pattern as the relationships importer
  function handleColdCsvFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const parsed = Papa.parse(event.target.result, { header: true, skipEmptyLines: true });
      if (!parsed.data || parsed.data.length === 0) {
        showToast('CSV file must contain headers and at least one row of data.', 'error');
        return;
      }
      const pick = (row, keys) => {
        for (const k of Object.keys(row)) {
          if (keys.includes(k.trim().toLowerCase())) return (row[k] || '').trim();
        }
        return '';
      };
      const seen = new Set();
      const rows = parsed.data.map((row, i) => {
        const email = pick(row, ['email', 'e-mail', 'email address']).toLowerCase();
        const first = pick(row, ['first_name', 'first name', 'firstname', 'first']);
        const last = pick(row, ['last_name', 'last name', 'lastname', 'last']);
        const company = pick(row, ['company', 'company name', 'organization']);
        const title = pick(row, ['title', 'job title', 'position', 'role']);
        const linkedin = pick(row, ['linkedin_url', 'linkedin', 'linkedin url', 'linkedin profile']);
        const phone = pick(row, ['phone', 'phone number', 'phone_number']);
        let error = null, warning = null;
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) error = 'Invalid email';
        else if (seen.has(email)) error = 'Duplicate in file';
        else if (coldContacts.some(c => c.email === email)) warning = 'Already imported';
        seen.add(email);
        return { key: i, email, first_name: first, last_name: last, company, title, linkedin_url: linkedin, phone, error, warning, checked: !error && !warning };
      });
      setColdImportPreview(rows);
    };
    reader.readAsText(file);
    e.target.value = null;
  }

  async function handleConfirmColdImport() {
    const selected = (coldImportPreview || []).filter(r => r.checked && !r.error);
    if (selected.length === 0) return;
    setColdImportLoading(true);
    const inserts = selected.map(r => ({
      user_id: user.id, email: r.email, first_name: r.first_name || null, last_name: r.last_name || null,
      company: r.company || null, title: r.title || null, linkedin_url: r.linkedin_url || null,
      phone: r.phone || null, source: 'csv',
    }));
    const { data, error } = await supabase.from('cold_contacts').insert(inserts).select();
    if (data && !error) {
      setColdContacts(prev => [...data, ...prev]);
      const skipped = (coldImportPreview || []).length - data.length;
      const invalid = (coldImportPreview || []).filter(r => r.error && r.error !== 'Duplicate in file').length;
      showToast(`${data.length} added, ${skipped - invalid} duplicates skipped, ${invalid} invalid email${invalid === 1 ? '' : 's'}.`, 'success');
      setColdImportPreview(null);
    } else showToast(`Import error: ${error?.message}`, 'error');
    setColdImportLoading(false);
  }

  async function handleAddColdContact(e) {
    e.preventDefault();
    const email = coldDraft.email.trim().toLowerCase();
    if (!email) return;
    if (coldContacts.some(c => c.email === email)) { showToast('This email is already in your cold contacts.', 'error'); return; }
    const { data, error } = await supabase.from('cold_contacts').insert([{
      user_id: user.id, email,
      first_name: coldDraft.first_name.trim() || null, last_name: coldDraft.last_name.trim() || null,
      company: coldDraft.company.trim() || null, title: coldDraft.title.trim() || null,
      linkedin_url: coldDraft.linkedin_url.trim() || null, source: 'manual',
    }]).select();
    if (data && !error) {
      setColdContacts(prev => [data[0], ...prev]);
      setColdDraft({ email: '', first_name: '', last_name: '', company: '', title: '', linkedin_url: '' });
      showToast('Cold contact added.', 'success');
    } else showToast(`Error: ${error?.message}`, 'error');
  }

  async function handleUnsubscribeColdContacts(ids) {
    const targets = coldContacts.filter(c => ids.includes(c.id));
    if (targets.length === 0) return;
    const now = new Date().toISOString();
    await supabase.from('unsubscribes').upsert(
      targets.map(c => ({ user_id: user.id, email: c.email, reason: 'manual' })),
      { onConflict: 'user_id,email', ignoreDuplicates: true });
    await supabase.from('cold_contacts').update({ status: 'unsubscribed', unsubscribed_at: now }).in('id', ids);
    await supabase.from('sequence_enrollments').update({ status: 'stopped', stopped_reason: 'unsubscribed', next_send_at: null })
      .eq('user_id', user.id).eq('status', 'active').in('cold_contact_id', ids);
    setColdContacts(prev => prev.map(c => ids.includes(c.id) ? { ...c, status: 'unsubscribed', unsubscribed_at: now } : c));
    setSequenceEnrollments(prev => prev.map(en => ids.includes(en.cold_contact_id) && en.status === 'active' ? { ...en, status: 'stopped', stopped_reason: 'unsubscribed', next_send_at: null } : en));
    setColdSelected({});
    fetchColdData(user.id);
    showToast(`${targets.length} contact${targets.length === 1 ? '' : 's'} unsubscribed.`, 'success');
  }

  function handleDeleteColdContacts(ids) {
    showConfirm('Delete Contacts', `Delete ${ids.length} cold contact${ids.length === 1 ? '' : 's'}? Their enrollments will also be removed.`, 'Delete', 'danger',
      async () => {
        const { error } = await supabase.from('cold_contacts').delete().in('id', ids);
        if (!error) {
          setColdContacts(prev => prev.filter(c => !ids.includes(c.id)));
          setSequenceEnrollments(prev => prev.filter(en => !ids.includes(en.cold_contact_id)));
          setColdSelected({});
        } else showToast(`Error: ${error.message}`, 'error');
      });
  }

  async function handleRemoveUnsubscribe(row) {
    const { error } = await supabase.from('unsubscribes').delete().eq('id', row.id);
    if (!error) {
      setUnsubscribesList(prev => prev.filter(u => u.id !== row.id));
      showToast(`${row.email} removed from the unsubscribe list.`, 'success');
    }
  }

  async function enrollColdContactsInSequence(seq, ids) {
    const steps = seqStepsFor(seq.id);
    if (steps.length === 0) { showToast('This sequence has no steps yet.', 'error'); return; }
    const unsubEmails = new Set(unsubscribesList.map(u => u.email));
    let enrolled = 0, skipped = 0;
    const inserts = [];
    for (const id of ids) {
      const c = coldContacts.find(x => x.id === id);
      if (!c || c.status === 'unsubscribed' || c.status === 'bounced' || unsubEmails.has(c.email)) { skipped++; continue; }
      if (sequenceEnrollments.some(en => en.sequence_id === seq.id && en.cold_contact_id === id && en.status === 'active')) { skipped++; continue; }
      inserts.push({
        sequence_id: seq.id, cold_contact_id: id, client_id: null, user_id: user.id,
        status: 'active', current_step: 0, next_send_at: addDaysStr(steps[0].wait_days),
      });
    }
    if (inserts.length > 0) {
      const { data, error } = await supabase.from('sequence_enrollments').insert(inserts).select();
      if (error) { showToast(`Enroll error: ${error.message}`, 'error'); return; }
      enrolled = data.length;
      setSequenceEnrollments(prev => [...prev, ...data]);
    }
    setColdSelected({});
    showToast(`${enrolled} enrolled in "${seq.name}"${skipped ? ` · ${skipped} skipped (unsubscribed or already enrolled)` : ''}.`, enrolled ? 'success' : 'error');
  }

  // ==========================================
  // V2 — CANVAS + TEMPLATES (Parts 6-8)
  // ==========================================

  const seqNodesFor = (seqId) => sequenceSteps.filter(s => s.sequence_id === seqId).sort((a, b) => (a.step_order - b.step_order) || (a.id - b.id));
  const seqEdgesFor = (seqId) => sequenceEdges.filter(e => e.sequence_id === seqId);
  // Canvas coordinates: stored pos, or a vertical auto-layout for pre-canvas rows
  const nodePos = (node, idx) => ({ x: node.pos_x ?? 300, y: node.pos_y ?? (30 + idx * 130) });

  // Part 6 — one-click template instantiation: sequence + steps + edges (+ trigger row)
  async function handleCreateFromTemplate(tpl) {
    const { data: seqRows, error: seqErr } = await supabase.from('email_sequences').insert([{
      user_id: user.id, name: tpl.name, status: 'draft', trigger_type: 'manual', is_active: false,
    }]).select();
    if (seqErr || !seqRows) { showToast(`Error: ${seqErr?.message}`, 'error'); return; }
    const seq = seqRows[0];
    const stepInserts = tpl.nodes.map((n, i) => ({
      sequence_id: seq.id, user_id: user.id, step_order: i,
      node_type: n.node_type, channel: n.node_type === 'email' ? 'email' : n.node_type,
      wait_days: n.wait_days ?? 0, condition: 'always',
      subject: n.subject || '', body: n.body || '', subject_b: n.subject_b || null,
      task_note: n.task_note || null, config: n.config || {},
      pos_x: n.pos[0], pos_y: n.pos[1],
    }));
    const { data: stepRows, error: stepErr } = await supabase.from('sequence_steps').insert(stepInserts).select();
    if (stepErr || !stepRows) { showToast(`Error creating steps: ${stepErr?.message}`, 'error'); return; }
    // insert order is preserved — map template indexes onto created ids
    const sorted = [...stepRows].sort((a, b) => a.step_order - b.step_order);
    const edgeInserts = tpl.edges.map(([from, to, branch]) => ({
      user_id: user.id, sequence_id: seq.id,
      from_step_id: sorted[from].id, to_step_id: sorted[to].id, branch: branch || 'default',
    }));
    const { data: edgeRows, error: edgeErr } = await supabase.from('sequence_edges').insert(edgeInserts).select();
    if (edgeErr) { showToast(`Error creating arrows: ${edgeErr.message}`, 'error'); return; }
    if (tpl.trigger) {
      const { data: trigRows } = await supabase.from('sequence_triggers').insert([{
        user_id: user.id, sequence_id: seq.id, trigger_event: tpl.trigger.trigger_event,
        trigger_config: tpl.trigger.trigger_config || {}, enabled: true,
      }]).select();
      if (trigRows) setSequenceTriggers(prev => [...prev, ...trigRows]);
    }
    setSequences(prev => [...prev, seq]);
    setSequenceSteps(prev => [...prev, ...stepRows]);
    setSequenceEdges(prev => [...prev, ...(edgeRows || [])]);
    setEditingSeqId(seq.id);
    setSelectedNodeId(null);
    showToast(`"${tpl.name}" created — customize it, then flip it Active.`, 'success');
  }

  // Part 7 — canvas node CRUD
  async function handleAddNode(seqId, nodeType) {
    const nodes = seqNodesFor(seqId);
    const maxOrder = nodes.reduce((m, n) => Math.max(m, n.step_order), -1);
    const last = nodes[nodes.length - 1];
    const base = last ? nodePos(last, nodes.length - 1) : { x: 300, y: -100 };
    const defaults = {
      email: { subject: 'New email — click to edit', body: '' },
      wait: { config: { days: 1 } },
      condition: { config: { type: 'if_no_reply' } },
      goal: { config: { label: 'Goal reached' } },
    }[nodeType] || {};
    const { data, error } = await supabase.from('sequence_steps').insert([{
      sequence_id: seqId, user_id: user.id, step_order: maxOrder + 1,
      node_type: nodeType, channel: nodeType === 'email' ? 'email' : nodeType,
      wait_days: 0, condition: 'always', subject: defaults.subject || '', body: defaults.body || '',
      task_note: null, config: defaults.config || {},
      pos_x: base.x + 40, pos_y: base.y + 150,
    }]).select();
    if (error || !data) { showToast(`Error: ${error?.message}`, 'error'); return; }
    setSequenceSteps(prev => [...prev, data[0]]);
    setSelectedNodeId(data[0].id);
  }

  async function handleUpdateNode(nodeId, patch) {
    setSequenceSteps(prev => prev.map(s => s.id === nodeId ? { ...s, ...patch } : s));
    const { error } = await supabase.from('sequence_steps').update(patch).eq('id', nodeId);
    if (error) showToast(`Save error: ${error.message}`, 'error');
  }

  function handleDeleteNode(node) {
    showConfirm('Delete Node', `Delete this ${NODE_META[node.node_type || 'email']?.label || 'node'}? Arrows touching it will also be removed.`, 'Delete', 'danger',
      async () => {
        await supabase.from('sequence_edges').delete().or(`from_step_id.eq.${node.id},to_step_id.eq.${node.id}`);
        const { error } = await supabase.from('sequence_steps').delete().eq('id', node.id);
        if (!error) {
          setSequenceSteps(prev => prev.filter(s => s.id !== node.id));
          setSequenceEdges(prev => prev.filter(e => e.from_step_id !== node.id && e.to_step_id !== node.id));
          if (selectedNodeId === node.id) setSelectedNodeId(null);
        } else showToast(`Error: ${error.message}`, 'error');
      });
  }

  // wiring: one outgoing edge per (node, branch) — re-wiring replaces it
  async function handleAddEdge(seqId, fromId, branch, toId) {
    if (fromId === toId) { setConnectFrom(null); return; }
    const existing = sequenceEdges.find(e => e.from_step_id === fromId && (e.branch || 'default') === branch);
    if (existing) {
      await supabase.from('sequence_edges').delete().eq('id', existing.id);
      setSequenceEdges(prev => prev.filter(e => e.id !== existing.id));
    }
    const { data, error } = await supabase.from('sequence_edges').insert([{
      user_id: user.id, sequence_id: seqId, from_step_id: fromId, to_step_id: toId, branch,
    }]).select();
    if (data && !error) setSequenceEdges(prev => [...prev, data[0]]);
    else showToast(`Error: ${error?.message}`, 'error');
    setConnectFrom(null);
  }

  async function handleDeleteEdge(edge) {
    await supabase.from('sequence_edges').delete().eq('id', edge.id);
    setSequenceEdges(prev => prev.filter(e => e.id !== edge.id));
  }

  // Active toggle drives BOTH gates: status (legacy UI) and is_active (runner v4+)
  async function handleSetSequenceActive(seq, active) {
    if (active && seqNodesFor(seq.id).filter(n => !['trigger', 'goal', 'wait'].includes(n.node_type || 'email')).length === 0) {
      showToast('Add at least one action step before activating.', 'error'); return;
    }
    const patch = { is_active: active, status: active ? 'active' : 'paused' };
    const { error } = await supabase.from('email_sequences').update(patch).eq('id', seq.id);
    if (!error) setSequences(prev => prev.map(s => s.id === seq.id ? { ...s, ...patch } : s));
    else showToast(`Error: ${error.message}`, 'error');
  }

  // Part 8 — trigger config: one sequence_triggers row per sequence (manual = no row)
  async function handleSaveSequenceTrigger(seqId, triggerEvent, triggerConfig) {
    const existing = sequenceTriggers.filter(t => t.sequence_id === seqId);
    if (existing.length > 0) {
      await supabase.from('sequence_triggers').delete().in('id', existing.map(t => t.id));
      setSequenceTriggers(prev => prev.filter(t => t.sequence_id !== seqId));
    }
    if (triggerEvent && triggerEvent !== 'manual') {
      const { data, error } = await supabase.from('sequence_triggers').insert([{
        user_id: user.id, sequence_id: seqId, trigger_event: triggerEvent,
        trigger_config: triggerConfig || {}, enabled: true,
      }]).select();
      if (data && !error) setSequenceTriggers(prev => [...prev, data[0]]);
      else if (error) { showToast(`Error: ${error.message}`, 'error'); return; }
    }
    showToast('Trigger saved.', 'success');
  }

  async function handleStopEnrollment(enr) {
    const { error } = await supabase.from('sequence_enrollments').update({ status: 'stopped', next_send_at: null }).eq('id', enr.id);
    if (!error) setSequenceEnrollments(prev => prev.map(x => x.id === enr.id ? { ...x, status: 'stopped', next_send_at: null } : x));
  }

  // MANUAL send path (fallback + default when auto-send is off). Runs the SAME
  // state machine as the server runner: condition skips (U4), channel tasks (U5),
  // A/B variant pick (U6), sequence_sends row (U3 funnel counting).
  // Note: manual new-tab sends cannot be open/click tracked — only Gmail auto-sends are.
  async function handleSendSequenceStep(enr) {
    const seq = sequences.find(s => s.id === enr.sequence_id);
    const steps = seqStepsFor(enr.sequence_id);
    const c = clients.find(x => x.id === enr.client_id);
    if (!seq || !c) { showToast('Missing sequence or relationship.', 'error'); return; }
    const today = new Date().toISOString().split('T')[0];

    // UPGRADE 4 — resolve the next step whose condition is met
    const resolved = resolveDueStep(enr, steps, sequenceSends);
    if (!resolved) {
      const patch = { status: 'completed', stopped_reason: 'completed', current_step: steps.length, next_send_at: null };
      await supabase.from('sequence_enrollments').update(patch).eq('id', enr.id);
      setSequenceEnrollments(prev => prev.map(x => x.id === enr.id ? { ...x, ...patch } : x));
      showToast('All remaining steps were skipped by their conditions — sequence completed.', 'success');
      return;
    }
    const { step, index } = resolved;
    const token = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `tk_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    let description = '';
    let variant = null;

    if (step.channel && step.channel !== 'email') {
      // UPGRADE 5 — non-email step becomes a task
      const title = `${CHANNEL_TASK_LABEL[step.channel] || 'Task for'} ${c.name}${step.task_note ? ' — ' + resolveMergeTags(step.task_note, c) : ''}`.slice(0, 250);
      const { data: t } = await supabase.from('tasks').insert([{
        user_id: user.id, client_id: c.id, title, due_date: today, status: 'pending',
      }]).select();
      if (t) setTasks(prev => [...prev, t[0]]);
      description = `Sequence "${seq.name}" — ${step.channel} task created: ${title}`;
      showToast('Task created for this step — find it in Tasks.', 'success');
    } else {
      if (!c.email) { showToast('This relationship has no email address.', 'error'); return; }
      // UPGRADE 6 — A/B variant
      const pick = pickSubjectVariant(step, enr);
      variant = pick.variant;
      const subject = resolveMergeTags(pick.subject, c);
      const body = resolveMergeTags(step.body, c);
      const url = emailProvider === 'mailto' ? buildMailtoUrl(c.email, subject, body) : buildGmailUrl(c.email, subject, body);
      const tab = window.open(url, '_blank', 'noopener,noreferrer');
      if (!tab && emailProvider !== 'mailto') window.location.href = buildMailtoUrl(c.email, subject, body);
      description = `Sequence "${seq.name}" — step ${index + 1}${variant ? ` (variant ${variant})` : ''}: ${subject}`;
    }

    // UPGRADE 3 — record the send for the funnel (manual sends: no tracking pixel)
    const { data: sendRow } = await supabase.from('sequence_sends').insert([{
      user_id: user.id, enrollment_id: enr.id, sequence_id: seq.id, step_id: step.id,
      client_id: c.id, track_token: token, channel: step.channel || 'email', subject_variant: variant,
    }]).select();
    if (sendRow) setSequenceSends(prev => [sendRow[0], ...prev]);

    const { data: act } = await supabase.from('activities').insert([{
      client_id: c.id, user_id: user.id,
      activity_type: (!step.channel || step.channel === 'email') ? 'Email' : 'Note',
      activity_date: today, description,
    }]).select();
    if (act) setActivities(prev => [act[0], ...prev]);

    const nextIdx = index + 1;
    const nextStep = steps[nextIdx];
    const patch = nextStep
      ? { current_step: nextIdx, next_send_at: addDaysStr(nextStep.wait_days), last_channel_sent: step.channel || 'email' }
      : { current_step: nextIdx, status: 'completed', stopped_reason: 'completed', next_send_at: null, last_channel_sent: step.channel || 'email' };
    await supabase.from('sequence_enrollments').update(patch).eq('id', enr.id);
    setSequenceEnrollments(prev => prev.map(x => x.id === enr.id ? { ...x, ...patch } : x));
    await supabase.from('email_sequences').update({ last_run_at: new Date().toISOString() }).eq('id', seq.id);
    setSequences(prev => prev.map(s => s.id === seq.id ? { ...s, last_run_at: new Date().toISOString() } : s));
    if (!nextStep) { dispatchWebhook('sequence.completed', { enrollment_id: enr.id, client_id: c.id, sequence_id: seq.id }); showToast('Sequence completed for this relationship.', 'success'); }
  }

  // UPGRADE 8 — reorder a step up/down (batched step_order swap)
  async function handleMoveStep(seqId, index, dir) {
    const steps = seqStepsFor(seqId);
    const j = index + dir;
    if (j < 0 || j >= steps.length) return;
    const a = steps[index], b = steps[j];
    await Promise.all([
      supabase.from('sequence_steps').update({ step_order: j }).eq('id', a.id),
      supabase.from('sequence_steps').update({ step_order: index }).eq('id', b.id),
    ]);
    setSequenceSteps(prev => prev.map(s => s.id === a.id ? { ...s, step_order: j } : s.id === b.id ? { ...s, step_order: index } : s));
  }

  // UPGRADE 8 — inline edit save
  async function handleSaveStepEdit() {
    const d = stepEdit;
    if (!d) return;
    const patch = {
      wait_days: Math.max(0, parseInt(d.wait_days, 10) || 0),
      subject: d.channel === 'email' ? (d.subject || '') : '',
      body: d.channel === 'email' ? (d.body || '') : '',
      subject_b: d.channel === 'email' && d.subject_b?.trim() ? d.subject_b : null,
      condition: d.condition || 'always',
      channel: d.channel || 'email',
      task_note: d.channel !== 'email' ? (d.task_note || '') : null,
    };
    const { data, error } = await supabase.from('sequence_steps').update(patch).eq('id', d.id).select();
    if (!error && data) {
      setSequenceSteps(prev => prev.map(s => s.id === d.id ? data[0] : s));
      setStepEdit(null);
    } else showToast(`Error: ${error?.message}`, 'error');
  }

  // G11 — one-click insert of a pre-configured recipe rule
  async function handleEnableRecipe(recipe) {
    if (automationRules.some(r => r.name === recipe.name)) { showToast('Recipe already enabled.', 'error'); return; }
    const { data, error } = await supabase.from('automation_rules').insert([{
      user_id: user.id, name: recipe.name, enabled: true, ...recipe.rule,
    }]).select();
    if (!error && data) {
      setAutomationRules(prev => [data[0], ...prev]);
      showToast(`Recipe enabled: ${recipe.name}`, 'success');
    } else showToast(`Error enabling recipe: ${error?.message}`, 'error');
  }

  async function handleCreateRule(e) {
    e.preventDefault();
    if (!newRule.name.trim()) return;
    const { data, error } = await supabase.from('automation_rules').insert([{
      user_id: user.id, name: newRule.name.trim(), enabled: true,
      trigger_type: newRule.triggerType, trigger_value: newRule.triggerValue || null,
      action_type: newRule.actionType, action_value: newRule.actionValue,
    }]).select();
    if (!error && data) {
      setAutomationRules(prev => [data[0], ...prev]);
      setShowRuleForm(false);
      setNewRule({ name: '', triggerType: 'stage_change', triggerValue: '', actionType: 'create_task', actionValue: {} });
      showToast('Automation rule created.', 'success');
    } else showToast(`Error creating rule: ${error?.message}`, 'error');
  }

  async function handleToggleRule(rule) {
    const { error } = await supabase.from('automation_rules').update({ enabled: !rule.enabled }).eq('id', rule.id);
    if (!error) setAutomationRules(prev => prev.map(r => r.id === rule.id ? { ...r, enabled: !r.enabled } : r));
  }

  function handleDeleteRule(id) {
    showConfirm('Delete Rule', 'Delete this automation rule? This cannot be undone.', 'Delete', 'danger',
      async () => {
        const { error } = await supabase.from('automation_rules').delete().eq('id', id);
        if (!error) setAutomationRules(prev => prev.filter(r => r.id !== id));
      });
  }

  // ==========================================
  // FEATURE 7 — FILE ATTACHMENTS
  // ==========================================

  async function handleFileUpload(file) {
    if (!file || !viewingClient) return;
    if (file.size > 10 * 1024 * 1024) { showToast('File exceeds the 10MB limit.', 'error'); return; }
    setUploadingFile(true);
    // Path shape ${user.id}/... is required by the storage RLS policy
    const path = `${user.id}/${viewingClient.id}/${Date.now()}_${file.name}`;
    const { error: upErr } = await supabase.storage.from('client-files').upload(path, file);
    if (upErr) { showToast(`Upload failed: ${upErr.message}`, 'error'); setUploadingFile(false); return; }
    const { data, error } = await supabase.from('client_files').insert([{
      user_id: user.id, client_id: viewingClient.id,
      file_name: file.name, file_size: file.size, file_type: file.type, storage_path: path,
    }]).select();
    if (!error && data) {
      setClientFiles(prev => [data[0], ...prev]);
      showToast('File uploaded.', 'success');
    } else showToast(`Error saving file record: ${error?.message}`, 'error');
    setUploadingFile(false);
  }

  async function handleDownloadFile(f) {
    const { data, error } = await supabase.storage.from('client-files').createSignedUrl(f.storage_path, 60);
    if (data?.signedUrl) window.open(data.signedUrl, '_blank');
    else showToast(`Download failed: ${error?.message}`, 'error');
  }

  function handleDeleteFile(f) {
    showConfirm('Delete File', `Delete "${f.file_name}"? This cannot be undone.`, 'Delete', 'danger',
      async () => {
        await supabase.storage.from('client-files').remove([f.storage_path]);
        const { error } = await supabase.from('client_files').delete().eq('id', f.id);
        if (!error) setClientFiles(prev => prev.filter(x => x.id !== f.id));
      });
  }

  // ==========================================
  // FEATURE 9 — TAGS
  // ==========================================

  async function handleCreateTag(e) {
    e.preventDefault();
    if (!newTagName.trim()) return;
    const { data, error } = await supabase.from('tags').insert([{ user_id: user.id, name: newTagName.trim(), color: newTagColor }]).select();
    if (!error && data) {
      setTags(prev => [...prev, data[0]].sort((a, b) => a.name.localeCompare(b.name)));
      setNewTagName('');
      showToast('Tag created.', 'success');
    } else showToast(`Error creating tag: ${error?.message}`, 'error');
  }

  async function handleToggleClientTag(clientId, tagId) {
    const has = (clientTagMap[clientId] || []).includes(tagId);
    if (has) {
      const { error } = await supabase.from('client_tags').delete().eq('client_id', clientId).eq('tag_id', tagId);
      if (!error) setClientTagMap(prev => ({ ...prev, [clientId]: (prev[clientId] || []).filter(t => t !== tagId) }));
    } else {
      const { error } = await supabase.from('client_tags').insert([{ client_id: clientId, tag_id: tagId }]);
      if (!error) {
        setClientTagMap(prev => ({ ...prev, [clientId]: [...(prev[clientId] || []), tagId] }));
        // Auto-enroll workflows triggered by "tag applied" (both trigger systems, unified)
        const tagName = tags.find(t => t.id === tagId)?.name;
        triggerSequenceEnrollment('tag_applied', clientId, 'client', { client_id: clientId, tagId, tagName });
      }
    }
  }

  function handleDeleteTag(tag) {
    const count = Object.values(clientTagMap).filter(ids => ids.includes(tag.id)).length;
    showConfirm('Delete Tag', `Delete tag "${tag.name}"? It will be removed from ${count} relationship(s).`, 'Delete', 'danger',
      async () => {
        const { error } = await supabase.from('tags').delete().eq('id', tag.id);
        if (!error) {
          setTags(prev => prev.filter(t => t.id !== tag.id));
          setClientTagMap(prev => {
            const next = {};
            Object.keys(prev).forEach(cid => { next[cid] = prev[cid].filter(t => t !== tag.id); });
            return next;
          });
          setFilterTags(prev => prev.filter(t => t !== tag.id));
        }
      });
  }

  // ==========================================
  // FEATURE 11 — WEBHOOKS
  // ==========================================

  // ONE dispatch implementation lives server-side (app/api/v1/_lib/core.js).
  // The client just forwards the event with the user's JWT.
  async function dispatchWebhook(event, payload) {
    if (!webhooks.some(w => w.enabled && (w.events || []).includes(event))) return;
    const { data: { session } } = await supabase.auth.getSession();
    fetch('/api/webhook-dispatch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token || ''}` },
      body: JSON.stringify({ event, payload }),
    }).catch(() => {});
  }

  async function handleCreateWebhook(e) {
    e.preventDefault();
    if (!newWebhook.name.trim() || !newWebhook.url.trim() || newWebhook.events.length === 0) return;
    const { data, error } = await supabase.from('webhooks').insert([{
      user_id: user.id, name: newWebhook.name.trim(), url: newWebhook.url.trim(),
      events: newWebhook.events, secret: newWebhook.secret || null, enabled: true,
    }]).select();
    if (!error && data) {
      setWebhooks(prev => [data[0], ...prev]);
      setShowWebhookForm(false);
      setNewWebhook({ name: '', url: '', events: [], secret: '' });
      showToast('Webhook added.', 'success');
    } else showToast(`Error adding webhook: ${error?.message}`, 'error');
  }

  async function handleTestWebhook(w) {
    const res = await fetch('/api/webhook-dispatch', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        webhookUrl: w.url, event: 'webhook.test',
        payload: { timestamp: new Date().toISOString(), message: 'Test from CRM' },
        secret: w.secret || null,
      }),
    }).catch(() => null);
    if (res && res.ok) showToast('Test webhook delivered.', 'success');
    else showToast('Test webhook failed.', 'error');
  }

  async function handleToggleWebhook(w) {
    const { error } = await supabase.from('webhooks').update({ enabled: !w.enabled }).eq('id', w.id);
    if (!error) setWebhooks(prev => prev.map(x => x.id === w.id ? { ...x, enabled: !x.enabled } : x));
  }

  function handleDeleteWebhook(id) {
    showConfirm('Delete Webhook', 'Delete this webhook? This cannot be undone.', 'Delete', 'danger',
      async () => {
        const { error } = await supabase.from('webhooks').delete().eq('id', id);
        if (!error) setWebhooks(prev => prev.filter(w => w.id !== id));
      });
  }

  // ==========================================
  // FEATURE 17 — ACTIVITY STREAKS
  // ==========================================

  async function updateStreak() {
    const today = new Date().toISOString().split('T')[0];
    if (streakData.lastActive === today) return;
    const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
    const yStr = yesterday.toISOString().split('T')[0];
    const newStreak = streakData.lastActive === yStr ? streakData.current + 1 : 1;
    const newLongest = Math.max(newStreak, streakData.longest);
    await supabase.from('profiles').update({
      current_streak: newStreak, longest_streak: newLongest, last_active_date: today,
    }).eq('id', user.id);
    setStreakData({ current: newStreak, longest: newLongest, lastActive: today });
  }

  // ==========================================
  // FEATURE 15 — QUICK NOTES (auto-save handled by effect below)
  // ==========================================

  // ==========================================
  // FEATURE 26 — GOALS
  // ==========================================

  const currentMonthStr = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-01`;

  async function handleSaveGoal(e) {
    e.preventDefault();
    const target = parseInt(goalTarget, 10);
    if (!target || target < 1) return;
    const { data, error } = await supabase.from('goals').upsert(
      [{ user_id: user.id, month: currentMonthStr, goal_type: goalType, target_value: target }],
      { onConflict: 'user_id,month,goal_type' }
    ).select();
    if (!error && data) {
      setGoals(prev => [...prev.filter(g => !(g.month === currentMonthStr && g.goal_type === goalType)), data[0]]);
      setShowGoalForm(false);
      showToast('Goal saved.', 'success');
    } else showToast(`Error saving goal: ${error?.message}`, 'error');
  }

  function handleDeleteGoal(id) {
    showConfirm('Delete Goal', 'Delete this goal?', 'Delete', 'danger',
      async () => {
        const { error } = await supabase.from('goals').delete().eq('id', id);
        if (!error) setGoals(prev => prev.filter(g => g.id !== id));
      });
  }

  // ==========================================
  // FEATURE 27 — CLIENT MERGE
  // ==========================================

  async function handleExecuteMerge() {
    if (!mergeSource || !mergeTarget) return;
    setMergeLoading(true);
    try {
      // Move all child records from source to target
      await Promise.all([
        supabase.from('activities').update({ client_id: mergeTarget.id }).eq('client_id', mergeSource.id),
        supabase.from('tasks').update({ client_id: mergeTarget.id }).eq('client_id', mergeSource.id),
        supabase.from('deals').update({ client_id: mergeTarget.id }).eq('client_id', mergeSource.id),
        supabase.from('client_files').update({ client_id: mergeTarget.id }).eq('client_id', mergeSource.id),
      ]);
      // Apply chosen field overrides to target
      const overrides = {};
      Object.keys(mergeFieldChoices).forEach(field => {
        if (mergeFieldChoices[field] === 'source') overrides[field] = mergeSource[field];
      });
      if (Object.keys(overrides).length > 0) {
        await supabase.from('clients').update(overrides).eq('id', mergeTarget.id);
      }
      // Delete the source client
      await supabase.from('clients').delete().eq('id', mergeSource.id);
      await Promise.all([fetchClients(user.id), fetchActivities(user.id), fetchTasks(user.id), fetchDeals(user.id)]);
      showToast('Relationships merged successfully.', 'success');
      setShowMergeTool(false); setMergeSource(null); setMergeTarget(null); setMergeStep(1); setMergeFieldChoices({}); setMergeSearch('');
    } catch (err) {
      showToast(`Merge failed: ${err.message}`, 'error');
    }
    setMergeLoading(false);
  }

  // ==========================================
  // FEATURE 29 — SAVED VIEWS
  // ==========================================

  function applyView(filters) {
    setFilterPriority(filters.filterPriority ?? 'All');
    setFilterStatus(filters.filterStatus ?? 'All');
    setFilterDateAdded(filters.filterDateAdded ?? '');
    setFilterHasDeals(filters.filterHasDeals ?? false);
    setFilterHasActivity(filters.filterHasActivity ?? '');
    setFilterScore(filters.filterScore ?? '');
    setFilterTags(filters.filterTags ?? []);
    setFilterHealth(filters.filterHealth ?? '');
    setFilterSource(filters.filterSource ?? '');
  }

  async function handleSaveView(name) {
    if (!name.trim()) return;
    const filters = { filterPriority, filterStatus, filterDateAdded, filterHasDeals, filterHasActivity, filterScore, filterTags, filterHealth, filterSource };
    const { data, error } = await supabase.from('saved_views').insert([{ user_id: user.id, name: name.trim(), filters }]).select();
    if (!error && data) {
      setSavedViews(prev => [...prev, data[0]]);
      setSavingViewName(null);
      showToast('View saved.', 'success');
    } else showToast(`Error saving view: ${error?.message}`, 'error');
  }

  function handleDeleteView(id) {
    showConfirm('Delete View', 'Delete this saved view?', 'Delete', 'danger',
      async () => {
        const { error } = await supabase.from('saved_views').delete().eq('id', id);
        if (!error) setSavedViews(prev => prev.filter(v => v.id !== id));
      });
  }

  function clearAllFilters() {
    setFilterPriority('All'); setFilterStatus('All'); setFilterDateAdded('');
    setFilterHasDeals(false); setFilterHasActivity(''); setFilterScore('');
    setFilterTags([]); setFilterHealth(''); setFilterSource(''); setSearchTerm('');
  }

  // ==========================================
  // FEATURE 21 — PDF EXPORT
  // ==========================================

  // FIX: /api/client-report never existed, so export always failed. The report
  // is now generated fully client-side and handed to the browser's print dialog.
  function handleExportPDF(client) {
    const acts = activities.filter(a => a.client_id === client.id);
    const tks = tasks.filter(t => t.client_id === client.id && t.status === 'pending');
    const dls = deals.filter(d => d.client_id === client.id);
    const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const html = `<!DOCTYPE html><html><head><title>${esc(client.name)} — Relationship Report</title><style>
      body{font-family:-apple-system,'Segoe UI',sans-serif;margin:40px;color:#111827}
      h1{margin:0 0 4px;font-size:24px} .muted{color:#6b7280;font-size:12px}
      h2{font-size:14px;border-bottom:1px solid #e5e7eb;padding-bottom:4px;margin-top:28px}
      table{width:100%;border-collapse:collapse;font-size:12px;margin-top:8px}
      td,th{padding:6px 8px;border-bottom:1px solid #f3f4f6;text-align:left;vertical-align:top}
      th{color:#9ca3af;text-transform:uppercase;font-size:10px;letter-spacing:.05em}
      @media print{body{margin:16px}}
    </style></head><body>
      <h1>${esc(client.name)}</h1>
      <p class="muted">${esc(client.email || '')}${client.phone_number ? ' · ' + esc(client.phone_number) : ''} · Stage: ${esc(client.status || '—')} · Priority: ${esc(client.relationship || '—')} · Generated ${new Date().toLocaleDateString()}</p>
      <h2>Details</h2><table>
        <tr><th>Country</th><td>${esc(client.country || '—')}</td><th>Source</th><td>${esc(client.source || '—')}</td></tr>
        <tr><th>Company</th><td>${esc(client.company_name || '—')}</td><th>Website</th><td>${esc(client.company_url || '—')}</td></tr>
        <tr><th>Birthday</th><td>${esc(client.birthday || '—')}</td><th>LinkedIn</th><td>${esc(client.linkedin_url || '—')}</td></tr>
      </table>
      <h2>Deals (${dls.length})</h2>
      ${dls.length === 0 ? '<p class="muted">None.</p>' : `<table><tr><th>Title</th><th>Stage</th><th>Value</th><th>Close</th></tr>${dls.map(d => `<tr><td>${esc(d.title)}</td><td>${esc(d.stage)}</td><td>${esc(fmtCurrency(d.value, d.currency))}</td><td>${esc(d.close_date || '—')}</td></tr>`).join('')}</table>`}
      <h2>Open Tasks (${tks.length})</h2>
      ${tks.length === 0 ? '<p class="muted">None.</p>' : `<table><tr><th>Task</th><th>Due</th></tr>${tks.map(t => `<tr><td>${esc(t.title)}</td><td>${esc(t.due_date)}</td></tr>`).join('')}</table>`}
      <h2>Activity Timeline (${acts.length})</h2>
      ${acts.length === 0 ? '<p class="muted">None.</p>' : `<table><tr><th>Date</th><th>Type</th><th>Notes</th></tr>${acts.map(a => `<tr><td>${esc(a.activity_date)}</td><td>${esc(a.activity_type)}</td><td>${esc(a.description)}</td></tr>`).join('')}</table>`}
    </body></html>`;
    const w = window.open('', '_blank');
    if (!w) { showToast('Popup blocked — allow popups for this site to export.', 'error'); return; }
    w.document.write(html);
    w.document.close();
    showToast('Opening print dialog — choose "Save as PDF".', 'success');
    setTimeout(() => w.print(), 400);
  }

  // ==========================================
  // DATA FETCHING LOGIC
  // ==========================================

  async function fetchClients(userId) {
    setLoadingClients(true);
    const { data, error } = await supabase.from('clients').select('*').eq('user_id', userId).order('created_at', { ascending: false });
    if (!error && data) setClients(data);
    setLoadingClients(false);
  }

  async function fetchTasks(userId) {
    const { data, error } = await supabase.from('tasks').select('*').eq('user_id', userId).order('due_date', { ascending: true });
    if (!error && data) setTasks(data);
  }

  async function fetchCustomFields(userId) {
    const { data: defs } = await supabase.from('custom_field_definitions').select('*').eq('user_id', userId).order('display_order', { ascending: true });
    if (defs) setCustomFieldDefs(defs);
    
    const { data: vals } = await supabase.from('custom_field_values').select('id, client_id, field_definition_id, value');
    if (vals) setCustomFieldValues(vals);
  }

  async function fetchActivities(userId) {
    const { data } = await supabase.from('activities').select('*').eq('user_id', userId).order('created_at', { ascending: false });
    if (data) setActivities(data);
  }

  async function fetchNotifications(userId) {
    const { data } = await supabase.from('notifications').select('*').eq('user_id', userId).order('created_at', { ascending: false });
    if (data) {
      setNotifications(data);
      // Notifications are now generated server-side via Edge Function (daily-notifications)
      // which runs on pg_cron schedule at 8:00 AM UTC
    }
  }

  async function fetchProfile(userId) {
    const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
    if (data && !error) {
      setProfile({
        username: data.username || '',
        phone_number: data.phone_number || '',
        country: data.country || '',
        linkedin_profile: data.linkedin_profile || ''
      });
      setStreakData({
        current: data.current_streak || 0,
        longest: data.longest_streak || 0,
        lastActive: data.last_active_date || null,
      });
    }
  }

  // ==========================================
  // NOTIFICATIONS — Server-side via Edge Function
  // ==========================================
  // Notifications are now generated server-side by the Supabase Edge Function
  // (daily-notifications) which runs on pg_cron schedule at 8:00 AM UTC.
  // This eliminates race conditions and ensures consistency across devices.

  async function handleMarkNotificationRead(id, referenceId, type) {
    await supabase.from('notifications').update({ read: true }).eq('id', id);
    setNotifications(notifications.map(n => n.id === id ? { ...n, read: true } : n));
    setShowNotifications(false);

    // Route logic based on type
    if (type === 'task_due') {
      setAppStep('GLOBAL_TASKS');
    } else if (type === 'birthday') {
      const client = clients.find(c => c.id === referenceId);
      if (client) {
        setViewingClient(client);
        setAppStep('CLIENTS');
      }
    }
  }

  async function handleResyncNotifications() {
    setNotificationSyncLoading(true);
    setNotificationSyncMessage('');
    
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/daily-notifications`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${user?.session?.access_token || ''}`,
            'x-notification-sync-secret': process.env.NEXT_PUBLIC_NOTIFICATION_SYNC_SECRET || 'dev-secret'
          },
          body: JSON.stringify({ action: 'manual_sync' })
        }
      );

      if (response.ok) {
        setNotificationSyncMessage('Notifications synced successfully!');
        // Refresh notifications from database
        await fetchNotifications(user.id);
        setTimeout(() => setNotificationSyncMessage(''), 3000);
      } else {
        const errorData = await response.json();
        setNotificationSyncMessage(errorData.error || 'Failed to sync notifications');
      }
    } catch (error) {
      console.error('Notification sync error:', error);
      setNotificationSyncMessage('Error syncing notifications');
    } finally {
      setNotificationSyncLoading(false);
    }
  }

  // ==========================================
  // GLOBAL SEARCH ENGINE
  // ==========================================
  
  async function performGlobalSearch(term) {
    const lowerTerm = term.toLowerCase();

    // Search Clients (in-memory)
    let matchedClients = clients.filter(c =>
      (c.name || '').toLowerCase().includes(lowerTerm) ||
      (c.email || '').toLowerCase().includes(lowerTerm) ||
      (c.phone_number || '').toLowerCase().includes(lowerTerm)
    ).slice(0, 5);

    // Search Activities (in-memory)
    const matchedActivities = activities.filter(a =>
      (a.description || '').toLowerCase().includes(lowerTerm)
    ).slice(0, 5);

    setGlobalSearchResults({ clients: matchedClients, activities: matchedActivities });

    // Supabase fallback: local state can be stale on multi-device use
    if (term.length > 2 && user) {
      const { data } = await supabase.from('clients')
        .select('id, name, email, phone_number, status, relationship')
        .eq('user_id', user.id)
        .or(`name.ilike.%${term}%,email.ilike.%${term}%`)
        .limit(5);
      if (data && data.length > 0) {
        const merged = [...matchedClients];
        data.forEach(c => { if (!merged.some(m => m.id === c.id)) merged.push(c); });
        setGlobalSearchResults(prev => ({ ...prev, clients: merged.slice(0, 5) }));
      }
    }
  }

  // G30 — command actions in the ⌘K palette (simple keyword matching, additive
  // to the existing search results — never replaces them)
  function parseCommandAction(term) {
    const m = term.match(/^(create deal for|log (?:call|note|meeting|email) with|add task for|email)\s+(.+)$/i);
    if (!m) return null;
    const namePart = m[2].trim().toLowerCase();
    const target = clients.find(c => (c.name || '').toLowerCase().includes(namePart));
    if (!target) return null;
    const verb = m[1].toLowerCase();
    const close = () => { setShowGlobalSearch(false); setGlobalSearchTerm(''); };
    if (verb.startsWith('create deal')) {
      return { label: `Create deal for ${target.name}`, run: () => { close(); resetDealForm(); setDealClientId(String(target.id)); setShowDealForm(true); } };
    }
    if (verb.startsWith('log')) {
      const type = verb.includes('call') ? 'Call' : verb.includes('meeting') ? 'Meeting' : verb.includes('email') ? 'Email' : 'Note';
      return { label: `Log ${type.toLowerCase()} with ${target.name}`, run: () => { close(); setActivityType(type); setActiveProfileTab('activity'); setViewingClient(target); setAppStep('CLIENTS'); } };
    }
    if (verb.startsWith('add task')) {
      return { label: `Add task for ${target.name}`, run: () => { close(); setActiveProfileTab('tasks'); setViewingClient(target); setAppStep('CLIENTS'); } };
    }
    // email
    return { label: `Email ${target.name}`, run: () => { close(); setViewingClient(target); setEmailTo(target.email || ''); setShowEmailComposer(true); setAppStep('CLIENTS'); } };
  }

  function handleSearchSelection(type, item) {
    setShowGlobalSearch(false);
    setGlobalSearchTerm('');
    if (type === 'client') {
      setViewingClient(item);
      setAppStep('CLIENTS');
    } else if (type === 'activity') {
      const parentClient = clients.find(c => c.id === item.client_id);
      if (parentClient) {
        setViewingClient(parentClient);
        setAppStep('CLIENTS');
        // Hacky but effective: scroll to activities section after short delay
        setTimeout(() => document.getElementById('activity-timeline')?.scrollIntoView({ behavior: 'smooth' }), 300);
      }
    }
  }


  // ==========================================
  // AUTHENTICATION LOGIC
  // ==========================================
  
  async function handleLoginWithPassword(e) {
    e.preventDefault();
    setAuthLoading(true);
    setAuthMessage('');
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setAuthMessage(`Login Error: ${error.message}`);
    else if (data.session) checkSession(); // trigger bulk fetch
    setAuthLoading(false);
  }

  async function handleGoogleSignIn() {
    setAuthLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } });
    if (error) setAuthMessage(`Google Auth Error: ${error.message}`);
    setAuthLoading(false);
  }

  async function handleSignUp(e) {
    e.preventDefault();
    if (password !== confirmPassword) {
      setAuthMessage('Passwords do not match. Please try again.');
      return;
    }
    if (password.length < 6) {
      setAuthMessage('Password must be at least 6 characters.');
      return;
    }
    setAuthLoading(true);
    setAuthMessage('');
    setIsNewUserSignUp(true);
    const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin }});
    if (error) { setAuthMessage(`Sign Up Error: ${error.message}`); setAuthLoading(false); return; }
    // Part 4 — if the project's "Confirm email" setting is OFF, signUp() returns an active
    // session immediately and would drop the user straight into the Dashboard with no
    // verification. Defensively sign that session out so the account cannot be used until
    // the OTP is entered. (The real fix is the dashboard setting — see CHANGELOG.)
    if (data?.session) await supabase.auth.signOut();
    setAuthMessage('Account created! Check your email for the verification code.');
    setAppStep('VERIFY_OTP');
    setAuthLoading(false);
  }

  async function handleVerifyOtp(e) {
    e.preventDefault();
    setAuthLoading(true);
    setAuthMessage('');
    let { data: { session }, error } = await supabase.auth.verifyOtp({ email, token: otpToken, type: 'signup' });
    if (error) {
      const fallback = await supabase.auth.verifyOtp({ email, token: otpToken, type: 'email' });
      session = fallback.data?.session;
      error = fallback.error;
    }
    if (error) { setAuthMessage(`Verification Error: ${error.message}`); setAuthLoading(false); }
    else if (session) {
      // Persist the signup profile while we briefly hold the verified session...
      if (isNewUserSignUp) await supabase.from('profiles').upsert([{ id: session.user.id, username, phone_number: phone, country, linkedin_profile: linkedin || null }]);
      // Part 4 — per request: after verifying, do NOT auto-enter the Dashboard. Sign out
      // and send the user to the Login screen to authenticate explicitly.
      await supabase.auth.signOut();
      setIsNewUserSignUp(false);
      setPassword(''); setConfirmPassword(''); setOtpToken('');
      setAuthMessage('Email verified! Please log in.');
      setAppStep('LOG_IN');
      setAuthLoading(false);
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    setUser(null);
    setAppStep('LOG_IN');
  }

  async function handleForgotPassword(e) {
    e.preventDefault();
    setAuthLoading(true);
    setAuthMessage('');
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
    if (error) setAuthMessage(error.message);
    else setResetEmailSent(true);
    setAuthLoading(false);
  }

  // ==========================================
  // SYSTEM SETTINGS & CUSTOM FIELDS LOGIC
  // ==========================================

  async function handleUpdateProfile(e) {
    e.preventDefault();
    setSettingsMessage({ type: '', text: '' });
    const { error } = await supabase.from('profiles').upsert([{ id: user.id, username: profile.username, phone_number: profile.phone_number, country: profile.country, linkedin_profile: profile.linkedin_profile }]);
    if (error) setSettingsMessage({ type: 'error', text: `Error updating profile: ${error.message}` });
    else setSettingsMessage({ type: 'success', text: 'Profile information updated successfully.' });
  }

  async function handleUpdatePassword(e) {
    e.preventDefault();
    if (!currentPassword) return setSettingsMessage({ type: 'error', text: 'Please enter your current password.' });
    if (!newPassword || newPassword !== confirmNewPassword) return setSettingsMessage({ type: 'error', text: 'New passwords do not match.' });
    const { error: updateError } = await supabase.auth.updateUser({ current_password: currentPassword, password: newPassword });
    if (updateError) setSettingsMessage({ type: 'error', text: `Error updating password: ${updateError.message}` });
    else {
      setSettingsMessage({ type: 'success', text: 'Password successfully updated.' });
      setCurrentPassword(''); setNewPassword(''); setConfirmNewPassword('');
    }
  }

  async function handleDeleteAccount() {
    if (deleteAccountEmail !== user.email) return;
    setAuthLoading(true);
    const { error } = await supabase.rpc('delete_own_user');
    if (error) {
      showToast(`Error deleting account: ${error.message}`, 'error');
      setAuthLoading(false);
      return;
    }
    await supabase.auth.signOut();
    setUser(null);
    setShowDeleteModal(false);
    setAppStep('LOG_IN');
    setAuthLoading(false);
    showToast('Account and all data have been permanently deleted.', 'success');
  }

  async function handleAddCustomField(e) {
    e.preventDefault();
    if (!newCfName) return;
    let optionsJson = [];
    if (newCfType === 'select' && newCfOptions) {
      optionsJson = newCfOptions.split(',').map(s => s.trim()).filter(s => s);
    }
    const { data, error } = await supabase.from('custom_field_definitions').insert([{
      user_id: user.id, field_name: newCfName, field_type: newCfType, select_options: optionsJson, display_order: customFieldDefs.length
    }]).select();
    if (data && !error) {
      setCustomFieldDefs([...customFieldDefs, data[0]]);
      setNewCfName(''); setNewCfOptions('');
    }
  }

  function handleDeleteCustomField(id) {
    const fieldName = customFieldDefs.find(f => f.id === id)?.field_name || 'Field';
    showConfirm(
      'Delete Custom Field',
      `WARNING: Deleting the field "${fieldName}" will permanently delete all data stored in it for all relationships. This action cannot be undone.`,
      'Delete Field',
      'danger',
      async () => {
        await supabase.from('custom_field_definitions').delete().eq('id', id);
        setCustomFieldDefs(customFieldDefs.filter(f => f.id !== id));
        setCustomFieldValues(customFieldValues.filter(v => v.field_definition_id !== id));
      }
    );
  }

  function runStatusMigration() {
    showConfirm(
      'Migrate Legacy Statuses',
      "This will convert old 'Active/Inactive' statuses to the new Pipeline stages ('Active' → 'Engaged', 'Inactive' → 'Inactive'). This may take a moment.",
      'Start Migration',
      'primary',
      async () => {
        const toUpdate = clients.filter(c => c.status === 'Active' || c.status === 'Inactive');
        
        let updatedCount = 0;
        for (const client of toUpdate) {
          const newStatus = client.status === 'Active' ? 'Engaged' : 'Inactive';
          const { error } = await supabase.from('clients').update({ status: newStatus }).eq('id', client.id);
          if (!error) updatedCount++;
        }
        showToast(`Successfully migrated ${updatedCount} legacy statuses.`, 'success');
        fetchClients(user.id);
      }
    );
  }


  // ==========================================
  // CRM CORE LOGIC
  // ==========================================

  async function handleAddClient(e) {
    e.preventDefault();
    if (!name || !clientEmail) return;
    if (duplicateWarning && !forceSaveDuplicate) return; // FEATURE 14: blocked until "Save anyway"
    setCrmErrorMessage('');

    const { data, error } = await supabase.from('clients').insert([{
      name, email: clientEmail, status, notes, user_id: user.id,
      country: clientCountry || null, phone_number: clientPhone || null,
      note_conversation: clientConversation || null, linkedin_url: clientLinkedin || null,
      birthday: clientBirthday || null, relationship: clientRelationship,
      source: clientSource || null,
      company_name: clientCompanyName || null, company_url: clientCompanyUrl || null,
      referred_by_client_id: clientReferredBy ? parseInt(clientReferredBy, 10) : null // G18 (clients.id is bigint)
    }]).select();

    if (!error && data) {
      const newClient = data[0];
      setClients([newClient, ...clients]);
      
      // Save Custom Fields
      const cfInserts = [];
      Object.keys(formCustomValues).forEach(defId => {
        if (formCustomValues[defId]) {
          cfInserts.push({ client_id: newClient.id, field_definition_id: defId, value: formCustomValues[defId] });
        }
      });
      if (cfInserts.length > 0) {
        const { data: cfData } = await supabase.from('custom_field_values').insert(cfInserts).select();
        if (cfData) setCustomFieldValues([...customFieldValues, ...cfData]);
      }

      // Reset form
      setName(''); setClientEmail(''); setNotes(''); setStatus('New');
      setClientCountry(''); setClientPhone(''); setClientConversation('');
      setClientLinkedin(''); setClientBirthday(''); setClientRelationship('Medium');
      setClientCompanyName(''); setClientCompanyUrl(''); setClientReferredBy('');
      setClientSource(''); setForceSaveDuplicate(false); setDuplicateWarning(null);
      setFormCustomValues({});
      updateStreak();
      dispatchWebhook('client.created', newClient);
      if (newClient.source) executeAutomations('source_is', newClient.source, newClient.id); // G11
      // Auto-enroll workflows triggered by "new relationship added" (unified — honors both
      // legacy email_sequences.trigger_type='new_relationship' and sequence_triggers rows)
      triggerSequenceEnrollment('relationship_created', newClient.id, 'client', { ...newClient, client: newClient });
    } else if (error) {
      setCrmErrorMessage(`Database Sync Error: ${error.message}`);
    }
  }

  async function handleUpdateClient(e) {
    e.preventDefault();
    if (!editingClient.name || !editingClient.email) return;
    setCrmErrorMessage('');
  
    const prevClient = clients.find(c => c.id === editingClient.id);
    const { data, error } = await supabase.from('clients').update({
      name: editingClient.name, email: editingClient.email, status: editingClient.status,
      country: editingClient.country || null, phone_number: editingClient.phone_number || null,
      note_conversation: editingClient.note_conversation || null, linkedin_url: editingClient.linkedin_url || null,
      birthday: editingClient.birthday || null, relationship: editingClient.relationship,
      source: editingClient.source || null,
      company_name: editingClient.company_name || null, company_url: editingClient.company_url || null,
      referred_by_client_id: editingClient.referred_by_client_id || null // G18
    }).eq('id', editingClient.id).select();

    // Update custom fields atomically: run all upserts/deletes in parallel and fail together
    try {
      const ops = Object.keys(formCustomValues).map(defId => {
        const val = formCustomValues[defId];
        const existing = customFieldValues.find(v => v.client_id === editingClient.id && v.field_definition_id === defId);
        if (existing) {
          if (val) {
            return supabase.from('custom_field_values').update({ value: val }).eq('id', existing.id).select()
              .then(({ data: ud, error: e }) => { if (e) throw e; return { kind: 'update', existingId: existing.id, row: ud?.[0] }; });
          }
          return supabase.from('custom_field_values').delete().eq('id', existing.id)
            .then(({ error: e }) => { if (e) throw e; return { kind: 'delete', existingId: existing.id }; });
        }
        if (val) {
          return supabase.from('custom_field_values').insert([{ client_id: editingClient.id, field_definition_id: defId, value: val }]).select()
            .then(({ data: ind, error: e }) => { if (e) throw e; return { kind: 'insert', row: ind?.[0] }; });
        }
        return Promise.resolve(null);
      });
      const results = await Promise.all(ops);
      setCustomFieldValues(prev => {
        let next = [...prev];
        results.filter(Boolean).forEach(r => {
          if (r.kind === 'update' && r.row) next = next.map(v => v.id === r.existingId ? r.row : v);
          if (r.kind === 'delete') next = next.filter(v => v.id !== r.existingId);
          if (r.kind === 'insert' && r.row) next = [...next, r.row];
        });
        return next;
      });
    } catch {
      showToast('Error updating custom fields.', 'error');
      return; // keep the edit modal open so the user can retry
    }

    if (!error && data && data.length > 0) {
      setClients(clients.map(client => client.id === editingClient.id ? data[0] : client));
      setEditingClient(null);
      dispatchWebhook('client.updated', data[0]);
      if (prevClient && prevClient.status !== editingClient.status) {
        executeAutomations('stage_change', editingClient.status, editingClient.id);
        // V2 — event-driven sequence auto-enrollment
        triggerSequenceEnrollment('relationship_stage_changed', editingClient.id, 'client', { ...data[0], status: editingClient.status });
      }
    } else if (error) {
      setCrmErrorMessage(`Database Update Error: ${error.message}`);
    } else {
      setClients(clients.map(client => client.id === editingClient.id ? { ...client, ...editingClient } : client));
      setEditingClient(null);
    }
  }

  function handleDeleteClient(clientId) {
    const clientName = clients.find(c => c.id === clientId)?.name || 'Relationship';
    showConfirm(
      'Delete Relationship',
      `Are you sure you want to delete "${clientName}"? This action cannot be undone.`,
      'Delete',
      'danger',
      async () => {
        const deleted = clients.find(c => c.id === clientId);
        const { error } = await supabase.from('clients').delete().eq('id', clientId);
        if (!error) {
          setClients(clients.filter(client => client.id !== clientId));
          setSelectedClientIds(prev => prev.filter(id => id !== clientId));
          if (deleted) dispatchWebhook('client.deleted', deleted);
        }
      }
    );
  }

  // ==========================================
  // KANBAN DRAG AND DROP HANDLERS
  // ==========================================
  
  const handleDragStart = (e, clientId) => {
    e.dataTransfer.setData("text/plain", clientId.toString());
  };

  const handleDragOver = (e) => {
    e.preventDefault(); // CRITICAL: allows the drop event to fire
  };

  const handleDrop = async (e, targetStatus) => {
    e.preventDefault();
    
    const clientIdStr = e.dataTransfer.getData("text/plain");
    if (!clientIdStr) return;
    
    // Convert string ID back to BigInt for safe database updating
    const clientId = parseInt(clientIdStr, 10);

    // Optimistic UI Update
    const originalClients = [...clients];
    setClients(prevClients => 
      prevClients.map(client => 
        client.id === clientId ? { ...client, status: targetStatus } : client
      )
    );

    if (viewingClient && viewingClient.id === clientId) {
      setViewingClient(prev => ({ ...prev, status: targetStatus }));
    }

    const { error } = await supabase
      .from('clients')
      .update({ status: targetStatus })
      .eq('id', clientId);

    if (error) {
      console.error("Error updating status via drag and drop:", error);
      showToast(`Failed to save status: ${error.message}`, 'error');
      setClients(originalClients); // Rollback on failure
    } else {
      executeAutomations('stage_change', targetStatus, clientId);
    }
  };


  // ==========================================
  // ADVANCED ACTIVITY LOG LOGIC
  // ==========================================

  // G3 — dictate an activity note: final transcripts append to the description
  // field in real time. Browser-native (Web Speech API), no packages, no server.
  function toggleVoiceMemo() {
    const SR = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);
    if (!SR) { showToast('Speech recognition is not supported in this browser. Try Chrome or Safari.', 'error'); return; }
    if (voiceListening) { recognitionRef.current?.stop(); return; }
    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = navigator.language || 'en-US';
    rec.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) {
          const t = (e.results[i][0]?.transcript || '').trim();
          if (t) setActivityDesc(prev => (prev ? prev.replace(/\s+$/, '') + ' ' : '') + t);
        }
      }
    };
    rec.onerror = (e) => {
      if (e.error === 'not-allowed') showToast('Microphone access was denied.', 'error');
      setVoiceListening(false);
    };
    rec.onend = () => setVoiceListening(false);
    recognitionRef.current = rec;
    rec.start();
    setVoiceListening(true);
  }

  async function handleAddActivityLog(e) {
    e.preventDefault();
    if (!activityDesc.trim() || !viewingClient) return;

    // Use the activities table as configured via Option B
    const { data, error } = await supabase.from('activities').insert([{
      client_id: viewingClient.id,
      user_id: user.id,
      activity_type: activityType,
      activity_date: activityDate,
      description: activityDesc
    }]).select();

    if (!error && data) {
      setActivities([data[0], ...activities]);
      setActivityDesc('');
      setActivityDate(new Date().toISOString().split('T')[0]);
      setSavingTemplateName(''); // FEATURE 22: offer "save as template" after logging
      updateStreak();
      dispatchWebhook('activity.logged', data[0]);
    } else {
      showToast(`Error logging activity: ${error?.message}`, 'error');
    }
  }

  function handleDeleteActivity(id) {
    showConfirm(
      'Delete Activity Entry',
      'Are you sure you want to permanently delete this activity entry? This cannot be undone.',
      'Delete',
      'danger',
      async () => {
        const { error } = await supabase.from('activities').delete().eq('id', id);
        if (!error) {
          setActivities(activities.filter(a => a.id !== id));
        }
      }
    );
  }

  async function handleUpdateActivity(e) {
    e.preventDefault();
    const { data, error } = await supabase.from('activities').update({ description: editingActivityDesc }).eq('id', editingActivityId).select();
    if (!error && data) {
      setActivities(activities.map(a => a.id === editingActivityId ? data[0] : a));
      setEditingActivityId(null);
      setEditingActivityDesc('');
    }
  }

  // ==========================================
  // TASK ACTIONS LOGIC
  // ==========================================

  async function handleCreateTask(e, clientId) {
    e.preventDefault();
    if (!newTaskTitle || !newTaskDate) return;

    const { data, error } = await supabase.from('tasks').insert([{
      client_id: clientId, user_id: user.id, title: newTaskTitle, due_date: newTaskDate, status: 'pending',
      recurrence: newTaskRecurrence || null,
      recurrence_end_date: (newTaskRecurrence && newTaskRecurrenceEnd) ? newTaskRecurrenceEnd : null
    }]).select();
    if (!error && data) {
      setTasks([...tasks, data[0]]);
      dispatchWebhook('task.created', data[0]);
      setNewTaskTitle('');
      setNewTaskDate('');
      setNewTaskRecurrence('');
      setNewTaskRecurrenceEnd('');
      updateStreak();
    } else {
      showToast(`Error creating task: ${error?.message}`, 'error');
    }
  }

  async function handleToggleTask(taskId, currentStatus) {
    const newStatus = currentStatus === 'pending' ? 'done' : 'pending';
    const task = tasks.find(t => t.id === taskId);
    const { error } = await supabase.from('tasks').update({ status: newStatus }).eq('id', taskId);
    if (!error) {
      setTasks(tasks.map(t => t.id === taskId ? { ...t, status: newStatus } : t));
      if (newStatus === 'done' && task) {
        dispatchWebhook('task.completed', { ...task, status: 'done' });
        // V2 — event-driven sequence auto-enrollment
        triggerSequenceEnrollment('task_completed', taskId, 'task', { ...task, status: 'done' });
        // FEATURE 20 — recurring tasks: auto-create next occurrence
        if (task.recurrence) {
          const nextDue = new Date(task.due_date);
          if (task.recurrence === 'daily') nextDue.setDate(nextDue.getDate() + 1);
          if (task.recurrence === 'weekly') nextDue.setDate(nextDue.getDate() + 7);
          if (task.recurrence === 'monthly') nextDue.setMonth(nextDue.getMonth() + 1);
          if (task.recurrence === 'quarterly') nextDue.setMonth(nextDue.getMonth() + 3);
          const nextDueStr = nextDue.toISOString().split('T')[0];
          if (!task.recurrence_end_date || nextDueStr <= task.recurrence_end_date) {
            await supabase.from('tasks').insert([{
              ...task, id: undefined, due_date: nextDueStr, status: 'pending', created_at: undefined
            }]).select();
            fetchTasks(user.id);
          }
        }
      }
    }
  }

  // ==========================================
  // BULK ACTIONS LOGIC
  // ==========================================
  
  const handleSelectAll = (e, targetClients) => {
    if (e.target.checked) setSelectedClientIds(targetClients.map(c => c.id));
    else setSelectedClientIds([]);
  };

  const handleSelectRow = (id) => {
    if (selectedClientIds.includes(id)) setSelectedClientIds(selectedClientIds.filter(selectedId => selectedId !== id));
    else setSelectedClientIds([...selectedClientIds, id]);
  };

  const handleBulkDelete = () => {
    showConfirm(
      'Delete Multiple Relationships',
      `You are about to delete ${selectedClientIds.length} relationship(s). This action cannot be undone.`,
      'Delete All',
      'danger',
      async () => {
        const { error } = await supabase.from('clients').delete().in('id', selectedClientIds);
        if (!error) {
          setClients(clients.filter(c => !selectedClientIds.includes(c.id)));
          setSelectedClientIds([]);
        } else {
          showToast(`Bulk Delete Error: ${error.message}`, 'error');
        }
      }
    );
  };

  const handleBulkStatusUpdate = async (newStatus) => {
    const { error } = await supabase.from('clients').update({ status: newStatus }).in('id', selectedClientIds);
    if (!error) {
      setClients(clients.map(c => selectedClientIds.includes(c.id) ? { ...c, status: newStatus } : c));
      showToast(`Updated ${selectedClientIds.length} relationships.`, 'success');
      setSelectedClientIds([]);
    } else {
      showToast(`Bulk Status Error: ${error.message}`, 'error');
    }
  };

  // Part 3B — bulk-enroll many relationships into a sequence in ONE batched insert.
  // The auto-send runner picks them up on its next tick; no per-row "Send Now" needed.
  // V4 Part 4 — one batched insert, shared by the table bulk bar AND the enroll panel
  const bulkEnrollClientsInSequence = async (seq, clientIds) => {
    if (!seq) return 0;
    const steps = seqStepsFor(seq.id);
    if (steps.length === 0) { showToast('That sequence has no steps yet.', 'error'); return 0; }
    const first = addDaysStr(steps[0].wait_days);
    // skip relationships already actively enrolled in this sequence, and those with no email
    const targets = clientIds.filter(cid => {
      const c = clients.find(x => x.id === cid);
      if (!c || !c.email) return false;
      return !sequenceEnrollments.some(en => en.sequence_id === seq.id && en.client_id === cid && en.status === 'active');
    });
    if (targets.length === 0) { showToast('Nothing to enroll (already enrolled or missing email).', 'error'); return 0; }
    const rows = targets.map(cid => ({
      sequence_id: seq.id, client_id: cid, user_id: user.id,
      status: 'active', current_step: 0, next_send_at: first,
    }));
    const { data, error } = await supabase.from('sequence_enrollments').insert(rows).select();
    if (error) { showToast(`Bulk enroll error: ${error.message}`, 'error'); return 0; }
    setSequenceEnrollments(prev => [...prev, ...data]);
    const skipped = clientIds.length - targets.length;
    showToast(`Enrolled ${data.length} in "${seq.name}"${skipped ? ` · ${skipped} skipped` : ''}. They send automatically.`, 'success');
    return data.length;
  };

  const handleBulkEnrollInSequence = async (sequenceId) => {
    const seq = sequences.find(s => String(s.id) === String(sequenceId));
    if (!seq) return;
    const n = await bulkEnrollClientsInSequence(seq, selectedClientIds);
    if (n > 0) setSelectedClientIds([]);
  };

  // ==========================================
  // CSV IMPORT / EXPORT LOGIC
  // ==========================================

  const handleExportCSV = () => {
    if (clients.length === 0) return;
    const headers = ['Name', 'Email', 'Phone', 'Country', 'Status', 'Priority', 'LinkedIn', 'Birthday', 'Notes'];
    const csvContent = [
      headers.join(','),
      ...clients.map(c => [
        `"${(c.name || '').replace(/"/g, '""')}"`, `"${(c.email || '').replace(/"/g, '""')}"`,
        `"${(c.phone_number || '').replace(/"/g, '""')}"`, `"${(c.country || '').replace(/"/g, '""')}"`,
        `"${(c.status || '').replace(/"/g, '""')}"`, `"${(c.relationship || '').replace(/"/g, '""')}"`,
        `"${(c.linkedin_url || '').replace(/"/g, '""')}"`, `"${(c.birthday || '').replace(/"/g, '""')}"`,
        `"${(c.note_conversation || '').replace(/"/g, '""')}"`
      ].join(','))
    ].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a'); link.href = url; link.setAttribute('download', 'crm_relationships_export.csv');
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  // BUG 2 + FEATURE 16 — robust PapaParse parsing + validated preview before insert
  const handleImportCSV = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target.result;
      const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
      if (!parsed.data || parsed.data.length === 0) {
        showToast('CSV file must contain headers and at least one row of data.', 'error');
        return;
      }
      // Case-insensitive column mapping
      const pick = (row, keys) => {
        for (const k of Object.keys(row)) {
          if (keys.includes(k.trim().toLowerCase())) return (row[k] || '').trim();
        }
        return '';
      };
      const rows = parsed.data.map((row, i) => {
        const rName = pick(row, ['name', 'full name', 'full_name']);
        const rEmail = pick(row, ['email', 'e-mail']);
        const rCountry = pick(row, ['country']);
        const rPhone = pick(row, ['phone', 'phone number', 'phone_number']);
        const rStatus = pick(row, ['status', 'stage']);
        let error = null, warning = null;
        if (!rName) error = 'Missing name';
        else if (!rEmail || !rEmail.includes('@')) error = 'Invalid email';
        else if (clients.some(c => (c.email || '').toLowerCase() === rEmail.toLowerCase())) warning = 'Already exists';
        return {
          key: i, name: rName, email: rEmail, country: rCountry, phone: rPhone,
          status: PIPELINE_STAGES.includes(rStatus) ? rStatus : 'New',
          error, warning, checked: !error,
        };
      });
      setImportPreviewData(rows);
      setShowImportPreview(true);
    };
    reader.readAsText(file);
    e.target.value = null;
  };

  async function handleConfirmImport() {
    const selected = importPreviewData.filter(r => r.checked && !r.error);
    if (selected.length === 0) return;
    setImportLoading(true);
    const inserts = selected.map(r => ({
      user_id: user.id, name: r.name, email: r.email,
      country: r.country || null, phone_number: r.phone || null,
      status: r.status, relationship: 'Medium',
    }));
    const { data, error } = await supabase.from('clients').insert(inserts).select();
    if (data && !error) {
      setClients(prev => [...data, ...prev]);
      showToast(`Imported ${data.length} relationships. ${importPreviewData.length - data.length} skipped.`, 'success');
      setShowImportPreview(false);
      setImportPreviewData([]);
    } else {
      showToast(`Import error: ${error?.message}`, 'error');
    }
    setImportLoading(false);
  }


  // ==========================================
  // COMPUTED DATA ENGINE
  // ==========================================
  
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  // FEATURE 6 — lead scores computed per client
  const clientsWithScores = useMemo(() =>
    (clients || []).filter(Boolean).map(c => ({
      ...c,
      leadScore: computeLeadScore(
        c,
        activities.filter(a => a.client_id === c.id),
        tasks.filter(t => t.client_id === c.id),
        (deals || []).filter(d => d.client_id === c.id),
      ),
    })), [clients, activities, tasks, deals]);

  // FEATURE 19 — relationship health per client
  const relationshipHealth = useMemo(() => clients.filter(Boolean).map(c => {
    const acts = activities.filter(a => a.client_id === c.id); // ordered newest-first by fetchActivities
    const lastAct = acts.length > 0 ? new Date(acts[0].activity_date) : new Date(c.created_at);
    const daysSince = Math.floor((Date.now() - lastAct) / 86400000);
    const openTasks = tasks.filter(t => t.client_id === c.id && t.status === 'pending').length;
    const health = daysSince <= 7 ? 'Excellent' : daysSince <= 14 ? 'Good' : daysSince <= 30 ? 'Fair' : daysSince <= 60 ? 'At Risk' : 'Critical';
    return { ...c, daysSince, health, openTasks, activityCount: acts.length };
  }), [clients, activities, tasks]);

  const healthCounts = useMemo(() => {
    const counts = { Excellent: 0, Good: 0, Fair: 0, 'At Risk': 0, Critical: 0 };
    relationshipHealth.forEach(c => { counts[c.health]++; });
    return counts;
  }, [relationshipHealth]);

  const healthByClientId = useMemo(() => {
    const m = {};
    relationshipHealth.forEach(c => { m[c.id] = c.health; });
    return m;
  }, [relationshipHealth]);

  // V4 Part 4 — ONE predicate shared by the main relationships table AND the enroll
  // panel, so "filter" means the same thing everywhere. All data dependencies are
  // passed via opts to keep it referentially honest.
  function matchesClientFilters(client, opts) {
    const {
      search = '', priority = 'All', status = 'All', tagIds = [], source = '',
      health = null, dateAdded = null, hasDeals = false, hasActivity = null,
      score = null, scoreMin = 0,
      clientTagMap = {}, healthByClientId = {}, deals = [], activities = [],
    } = opts;
    if (!client || typeof client !== 'object') return false;
    const q = search.toLowerCase();
    const matchesSearch = !q || (client.name || '').toLowerCase().includes(q) || (client.email || '').toLowerCase().includes(q) || (client.country || '').toLowerCase().includes(q) || (client.company_name || '').toLowerCase().includes(q);
    const matchesPriority = priority === 'All' || client.relationship === priority;
    const matchesStatus = status === 'All' || client.status === status;
    const matchesTags = tagIds.length === 0 || tagIds.every(id => (clientTagMap[client.id] || []).includes(id));
    const matchesHealth = !health || healthByClientId[client.id] === health;
    let matchesDateAdded = true;
    if (dateAdded) {
      const created = new Date(client.created_at || 0);
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      if (dateAdded === 'today') matchesDateAdded = created >= startOfDay;
      if (dateAdded === 'this_week') { const d = new Date(startOfDay); d.setDate(d.getDate() - d.getDay()); matchesDateAdded = created >= d; }
      if (dateAdded === 'this_month') matchesDateAdded = created >= new Date(now.getFullYear(), now.getMonth(), 1);
      if (dateAdded === 'this_quarter') matchesDateAdded = created >= new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
    }
    const matchesHasDeals = !hasDeals || deals.some(d => d.client_id === client.id);
    const matchesSource = !source || source === 'All' || (source === 'Unknown' ? !client.source : client.source === source);
    let matchesHasActivity = true;
    if (hasActivity) {
      const acts = activities.filter(a => a.client_id === client.id);
      if (hasActivity === 'none') matchesHasActivity = acts.length === 0;
      else {
        const days = hasActivity === 'last_7' ? 7 : 30;
        const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - days);
        matchesHasActivity = acts.some(a => new Date(a.activity_date) >= cutoff);
      }
    }
    let matchesScore = true;
    if (score === 'high') matchesScore = client.leadScore >= 75;
    if (score === 'medium') matchesScore = client.leadScore >= 50 && client.leadScore < 75;
    if (score === 'low') matchesScore = client.leadScore < 50;
    if (scoreMin > 0) matchesScore = matchesScore && (client.leadScore ?? 0) >= scoreMin;
    return matchesSearch && matchesPriority && matchesStatus && matchesTags && matchesHealth && matchesDateAdded && matchesHasDeals && matchesHasActivity && matchesScore && matchesSource;
  }

  const filteredAndSortedClients = useMemo(() => (clientsWithScores || [])
    .filter(Boolean)
    .filter(client => matchesClientFilters(client, {
      search: searchTerm, priority: filterPriority, status: filterStatus, tagIds: filterTags,
      source: filterSource, health: filterHealth, dateAdded: filterDateAdded,
      hasDeals: filterHasDeals, hasActivity: filterHasActivity, score: filterScore,
      clientTagMap, healthByClientId, deals, activities,
    })).sort((a, b) => {
      if (!a || !b) return 0;
      if (sortBy === 'created_at_desc') return new Date(b.created_at || 0) - new Date(a.created_at || 0);
      if (sortBy === 'created_at_asc') return new Date(a.created_at || 0) - new Date(b.created_at || 0);
      if (sortBy === 'name_asc') return (a.name || '').localeCompare(b.name || '');
      if (sortBy === 'name_desc') return (b.name || '').localeCompare(a.name || '');
      if (sortBy === 'score_desc') return b.leadScore - a.leadScore;
      if (sortBy === 'score_asc') return a.leadScore - b.leadScore;
      return 0;
    }), [clientsWithScores, searchTerm, filterPriority, filterStatus, sortBy, filterTags, clientTagMap, filterHealth, healthByClientId, filterDateAdded, filterHasDeals, filterHasActivity, filterScore, filterSource, deals, activities]);

  const activeFilterCount = [
    filterPriority !== 'All', filterStatus !== 'All', filterDateAdded, filterHasDeals,
    filterHasActivity, filterScore, filterTags.length > 0, filterHealth, filterSource,
  ].filter(Boolean).length;

  // V4 Part 3 — every reply across every campaign, straight from sequence_sends
  // (already loaded client-side; replied_at is stamped by gmail-sync / the runner).
  const repliesWithContact = useMemo(() => {
    return (sequenceSends || [])
      .filter(s => s.replied_at && (!whoRepliedSeqFilter || s.sequence_id === whoRepliedSeqFilter))
      .sort((a, b) => new Date(b.replied_at) - new Date(a.replied_at))
      .map(r => {
        const contact = r.client_id != null
          ? clients.find(c => c.id === r.client_id)
          : coldContacts.find(cc => cc.id === r.cold_contact_id);
        return {
          ...r, contact, isColdContact: r.cold_contact_id != null,
          seqName: sequences.find(q => q.id === r.sequence_id)?.name || 'campaign',
          stepSubject: sequenceSteps.find(st => st.id === r.step_id)?.subject || '',
        };
      })
      .filter(r => r.contact);
  }, [sequenceSends, whoRepliedSeqFilter, clients, coldContacts, sequences, sequenceSteps]);
  const allRepliesCount = useMemo(() => (sequenceSends || []).filter(s => s.replied_at).length, [sequenceSends]);

  // V4 Part 4 — enroll panel: SAME predicate as the main table (matchesClientFilters)
  const enrollMatchingClients = useMemo(() => {
    if (!showEnrollPanel) return [];
    return (clientsWithScores || []).filter(c => c && c.email && matchesClientFilters(c, {
      search: enrollSearchTerm, status: enrollFilterStatus, priority: enrollFilterPriority,
      source: enrollFilterSource, tagIds: enrollFilterTags, scoreMin: enrollFilterScoreMin,
      clientTagMap, healthByClientId, deals, activities,
    }));
  }, [showEnrollPanel, clientsWithScores, enrollSearchTerm, enrollFilterStatus, enrollFilterPriority, enrollFilterSource, enrollFilterTags, enrollFilterScoreMin, clientTagMap, healthByClientId, deals, activities]);

  const BUILT_IN_VIEWS = [
    { name: 'High Priority', filters: { filterPriority: 'High' } },
    { name: 'New This Week', filters: { filterDateAdded: 'this_week', filterStatus: 'New' } },
    { name: 'Needs Follow-up', filters: { filterHasActivity: 'none' } },
    { name: 'Active Deals', filters: { filterHasDeals: true } },
  ];

  // FEATURE 1 — deal rollups
  // G20 — roll-ups normalize to USD via static FX rates (directional, not accounting-grade)
  const pipelineValue = useMemo(() => deals.filter(d => !['Won', 'Lost'].includes(d.stage)).reduce((s, d) => s + toUSD(d.value, d.currency), 0), [deals]);
  const weightedForecast = useMemo(() => deals.filter(d => !['Won', 'Lost'].includes(d.stage)).reduce((s, d) => s + toUSD(d.value, d.currency) * ((d.probability || 0) / 100), 0), [deals]);
  const wonValue = useMemo(() => deals.filter(d => d.stage === 'Won').reduce((s, d) => s + toUSD(d.value, d.currency), 0), [deals]);
  const openDealsCount = useMemo(() => deals.filter(d => !['Won', 'Lost'].includes(d.stage)).length, [deals]);

  // N8N — enrollments whose next step is due (the Outbox)
  const dueSequenceSends = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return sequenceEnrollments
      .filter(en => en.status === 'active' && en.next_send_at && en.next_send_at <= today)
      .map(en => {
        const seq = sequences.find(s => s.id === en.sequence_id);
        const step = sequenceSteps.filter(s => s.sequence_id === en.sequence_id).sort((a, b) => a.step_order - b.step_order || a.id - b.id)[en.current_step];
        const c = clients.find(x => x.id === en.client_id);
        return seq && seq.status === 'active' && step && c ? { enr: en, seq, step, client: c } : null;
      })
      .filter(Boolean);
  }, [sequenceEnrollments, sequences, sequenceSteps, clients]);

  // G19 — MRR from Won recurring deals, normalized to monthly USD
  const mrr = useMemo(() => deals
    .filter(d => d.stage === 'Won' && d.is_recurring)
    .reduce((s, d) => {
      const usd = toUSD(d.value, d.currency);
      return s + (d.billing_cycle === 'annual' ? usd / 12 : d.billing_cycle === 'quarterly' ? usd / 3 : usd);
    }, 0), [deals]);

  // G19 — renewals due in the next 30 days
  const upcomingRenewals = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const in30 = new Date(); in30.setDate(in30.getDate() + 30);
    const in30Str = in30.toISOString().split('T')[0];
    return deals
      .filter(d => d.is_recurring && d.renewal_date && d.renewal_date >= today && d.renewal_date <= in30Str)
      .sort((a, b) => a.renewal_date.localeCompare(b.renewal_date));
  }, [deals]);
  const fmtMoney = (n) => `$${(n || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

  // FEATURE 3 — reports computed
  const reportStats = useMemo(() => {
    const days = parseInt(reportRange, 10);
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - days);
    const activitiesInRange = activities.filter(a => new Date(a.activity_date) >= cutoff);
    const activityByType = { Note: 0, Call: 0, Email: 0, Meeting: 0 };
    activitiesInRange.forEach(a => { if (activityByType[a.activity_type] !== undefined) activityByType[a.activity_type]++; });
    const clientsByStage = {};
    PIPELINE_STAGES.forEach(s => { clientsByStage[s] = clients.filter(c => c.status === s).length; });
    const dealsByStage = {};
    DEAL_STAGES.forEach(s => {
      const stageDeals = deals.filter(d => d.stage === s);
      dealsByStage[s] = { count: stageDeals.length, value: stageDeals.reduce((sum, d) => sum + (parseFloat(d.value) || 0), 0) };
    });
    const perClient = {};
    activitiesInRange.forEach(a => { perClient[a.client_id] = (perClient[a.client_id] || 0) + 1; });
    const topClientsByActivity = Object.entries(perClient)
      .map(([cid, count]) => ({ client: clients.find(c => c.id === parseInt(cid, 10)), count }))
      .filter(x => x.client)
      .sort((a, b) => b.count - a.count).slice(0, 5);
    const clientsAddedByWeek = [...Array(8)].map((_, i) => {
      const start = new Date(); start.setDate(start.getDate() - (7 - i) * 7);
      const end = new Date(start); end.setDate(end.getDate() + 7);
      return {
        label: start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        count: clients.filter(c => { const d = new Date(c.created_at); return d >= start && d < end; }).length,
      };
    });
    const won = deals.filter(d => d.stage === 'Won').length;
    const lost = deals.filter(d => d.stage === 'Lost').length;
    const winRate = (won + lost) > 0 ? Math.round((won / (won + lost)) * 100) : 0;
    // Approximate: average gap in days between consecutive activities, per client
    let gapSum = 0, gapCount = 0;
    clients.forEach(c => {
      const acts = activities.filter(a => a.client_id === c.id).map(a => new Date(a.activity_date)).sort((a, b) => a - b);
      for (let i = 1; i < acts.length; i++) { gapSum += (acts[i] - acts[i - 1]) / 86400000; gapCount++; }
    });
    const avgResponseTime = gapCount > 0 ? (gapSum / gapCount).toFixed(1) : null;
    const doneTasks = tasks.filter(t => t.status === 'done').length;
    const taskCompletionRate = tasks.length > 0 ? Math.round((doneTasks / tasks.length) * 100) : 0;
    const avgActivitiesPerClient = clients.length > 0 ? (activitiesInRange.length / clients.length).toFixed(1) : '0';
    const clientsBySource = {};
    CLIENT_SOURCES.forEach(s => { clientsBySource[s] = clients.filter(c => c.source === s).length; });
    return { activitiesInRange, activityByType, clientsByStage, dealsByStage, topClientsByActivity, clientsAddedByWeek, winRate, avgResponseTime, taskCompletionRate, avgActivitiesPerClient, clientsBySource };
  }, [reportRange, activities, clients, deals, tasks]);

  // PART C1 — custom report: group clients by dimension, aggregate the chosen metric
  const customReportData = useMemo(() => {
    const days = parseInt(reportRange, 10);
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - days);
    const bucketsFor = (c) => {
      if (customDimension === 'Stage') return [c.status || 'Unknown'];
      if (customDimension === 'Priority') return [c.relationship || 'Unknown'];
      if (customDimension === 'Source') return [c.source || 'Unknown'];
      if (customDimension === 'Tag') {
        const ids = clientTagMap[c.id] || [];
        return ids.length ? ids.map(id => tags.find(t => t.id === id)?.name || 'Unknown') : ['Untagged'];
      }
      // Month Added — honors the Day/Week/Month grouping selector
      const d = new Date(c.created_at || 0);
      if (customDateGrouping === 'day') return [d.toISOString().split('T')[0]];
      if (customDateGrouping === 'week') {
        const w = new Date(d); w.setDate(w.getDate() - w.getDay());
        return [`Wk of ${w.toISOString().split('T')[0]}`];
      }
      return [`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`];
    };
    const acc = {};
    clientsWithScores.forEach(c => {
      const cDealValue = deals.filter(d => d.client_id === c.id).reduce((s, d) => s + (parseFloat(d.value) || 0), 0);
      const cActs = activities.filter(a => a.client_id === c.id && new Date(a.activity_date) >= cutoff).length;
      bucketsFor(c).forEach(k => {
        const b = acc[k] = acc[k] || { count: 0, dealValue: 0, scoreSum: 0, activityCount: 0 };
        b.count++; b.dealValue += cDealValue; b.scoreSum += c.leadScore || 0; b.activityCount += cActs;
      });
    });
    const metricVal = (b) =>
      customMetric === 'Count' ? b.count
      : customMetric === 'Total Deal Value' ? b.dealValue
      : customMetric === 'Avg Lead Score' ? (b.count ? b.scoreSum / b.count : 0)
      : b.activityCount; // Activity Count (within the selected range)
    let rows = Object.entries(acc).map(([label, b]) => ({ label, value: metricVal(b) }));
    const ordered = customDimension === 'Stage' ? PIPELINE_STAGES : customDimension === 'Priority' ? ['High', 'Medium', 'Low'] : null;
    if (ordered) rows.sort((a, b) => ordered.indexOf(a.label) - ordered.indexOf(b.label));
    else if (customDimension === 'Month Added') rows.sort((a, b) => a.label.localeCompare(b.label));
    else rows.sort((a, b) => b.value - a.value);
    return rows;
  }, [customDimension, customMetric, customDateGrouping, reportRange, clientsWithScores, deals, activities, clientTagMap, tags]);

  const fmtCustomValue = (v) =>
    customMetric === 'Total Deal Value' ? fmtMoney(v)
    : customMetric === 'Avg Lead Score' ? v.toFixed(1)
    : v;

  // PART C2 — each stat tile's value now vs its value as of one period ago.
  // Range-based numbers (Activities, Avg Act/Client) compare current vs prior window;
  // cumulative numbers (Clients, Pipeline, Win Rate, Task Completion) compare
  // "now" vs "computed only on data that existed at the period boundary".
  const comparisonStats = useMemo(() => {
    if (!compareReports) return null;
    const days = parseInt(reportRange, 10);
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - days);
    const prevCutoff = new Date(); prevCutoff.setDate(prevCutoff.getDate() - days * 2);
    const inCur = (d) => d >= cutoff;
    const inPrev = (d) => d >= prevCutoff && d < cutoff;

    const actsCur = activities.filter(a => inCur(new Date(a.activity_date))).length;
    const actsPrev = activities.filter(a => inPrev(new Date(a.activity_date))).length;
    const clientsNow = clients.length;
    const clientsThen = clients.filter(c => new Date(c.created_at) < cutoff).length;
    const openVal = (list) => list.filter(d => !['Won', 'Lost'].includes(d.stage)).reduce((s, d) => s + (parseFloat(d.value) || 0), 0);
    const pipeNow = openVal(deals);
    const pipeThen = openVal(deals.filter(d => new Date(d.created_at) < cutoff));
    const winRateOf = (list) => {
      const w = list.filter(d => d.stage === 'Won').length, l = list.filter(d => d.stage === 'Lost').length;
      return (w + l) > 0 ? Math.round((w / (w + l)) * 100) : 0;
    };
    const closedThen = deals.filter(d => ['Won', 'Lost'].includes(d.stage) && new Date(d.close_date || d.created_at) < cutoff);
    const tcOf = (list) => list.length > 0 ? Math.round((list.filter(t => t.status === 'done').length / list.length) * 100) : 0;
    const tasksThen = tasks.filter(t => new Date(t.created_at || t.due_date) < cutoff);

    return {
      'Relationships': [clientsNow, clientsThen],
      'Activities': [actsCur, actsPrev],
      'Pipeline $': [pipeNow, pipeThen],
      'Win Rate': [winRateOf(deals.filter(d => ['Won', 'Lost'].includes(d.stage))), winRateOf(closedThen)],
      'Task Completion': [tcOf(tasks), tcOf(tasksThen)],
      'Avg Act/Relationship': [clientsNow > 0 ? actsCur / clientsNow : 0, clientsThen > 0 ? actsPrev / clientsThen : 0],
    };
  }, [compareReports, reportRange, activities, clients, deals, tasks]);

  // FEATURE 8 — calendar events
  const calendarEvents = useMemo(() => {
    const events = [];
    const yr = new Date().getFullYear();
    tasks.forEach(t => {
      if (t.due_date) events.push({ id: `task-${t.id}`, date: t.due_date, type: 'task', label: t.title, clientId: t.client_id, isOverdue: t.status === 'pending' && t.due_date < todayStr, task: t });
    });
    activities.forEach(a => {
      if (a.activity_date) events.push({ id: `act-${a.id}`, date: a.activity_date, type: 'activity', label: `${a.activity_type}: ${(a.description || '').slice(0, 40)}`, clientId: a.client_id, activity: a });
    });
    clients.forEach(c => {
      if (c.birthday) {
        const b = new Date(c.birthday);
        const thisYear = `${yr}-${String(b.getMonth() + 1).padStart(2, '0')}-${String(b.getDate()).padStart(2, '0')}`;
        events.push({ id: `bday-${c.id}`, date: thisYear, type: 'birthday', label: `🎂 ${c.name}'s birthday`, clientId: c.id, client: c });
      }
    });
    deals.forEach(d => {
      if (d.close_date && !['Won', 'Lost'].includes(d.stage)) events.push({ id: `deal-${d.id}`, date: d.close_date, type: 'deal', label: `${d.title} (${fmtMoney(d.value)})`, clientId: d.client_id, deal: d });
    });
    return events;
  }, [tasks, activities, clients, deals, todayStr]);

  // FEATURE 26 — goal progress
  const goalProgress = useMemo(() => goals.filter(g => g.month === currentMonthStr).map(g => {
    let current = 0;
    const monthStart = new Date(g.month);
    const monthEnd = new Date(monthStart); monthEnd.setMonth(monthEnd.getMonth() + 1);
    const monthEndStr = monthEnd.toISOString().split('T')[0];
    if (g.goal_type === 'new_clients')
      current = clients.filter(c => new Date(c.created_at) >= monthStart && new Date(c.created_at) < monthEnd).length;
    if (g.goal_type === 'activities_logged')
      current = activities.filter(a => a.activity_date >= g.month && a.activity_date < monthEndStr).length;
    if (g.goal_type === 'deals_closed')
      current = (deals || []).filter(d => d.stage === 'Won' && d.close_date >= g.month).length;
    if (g.goal_type === 'tasks_completed')
      current = tasks.filter(t => t.status === 'done').length;
    return { ...g, current, pct: Math.min(Math.round((current / g.target_value) * 100), 100) };
  }), [goals, clients, activities, deals, tasks, currentMonthStr]);

  // FEATURE 30 — onboarding
  const onboardingSteps = [
    { title: 'Add your first relationship', desc: 'Start tracking relationships.', done: clients.length > 0 },
    { title: 'Log your first activity', desc: 'Open a client and log an activity.', done: activities.length > 0 },
    { title: 'Create your first task', desc: 'Stay on top of follow-ups.', done: tasks.length > 0 },
    { title: 'Explore your dashboard', desc: 'Look around for 30 seconds.', done: dashboardExplored },
  ];
  const onboardingDone = onboardingSteps.filter(s => s.done).length;
  const onboardingComplete = onboardingDone === onboardingSteps.length;

  // FEATURE 6 — top leads for dashboard widget
  const topLeads = useMemo(() => [...clientsWithScores].sort((a, b) => b.leadScore - a.leadScore).slice(0, 5), [clientsWithScores]);

  const totalPages = useMemo(() => Math.ceil(filteredAndSortedClients.length / itemsPerPage) || 1, [filteredAndSortedClients, itemsPerPage]);
  const paginatedClients = useMemo(() => filteredAndSortedClients.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage), [filteredAndSortedClients, currentPage, itemsPerPage]);

  const upcomingBirthdays = useMemo(() => clients.filter(c => {
    if (!c.birthday) return false;
    const bdate = new Date(c.birthday);
    const today = new Date();
    bdate.setFullYear(today.getFullYear());
    if (bdate < today && bdate.toDateString() !== today.toDateString()) bdate.setFullYear(today.getFullYear() + 1);
    const diffTime = bdate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays >= 0 && diffDays <= 30;
  }).sort((a, b) => {
    const getNextOcc = (d) => {
      const dt = new Date(d);
      const today = new Date();
      dt.setFullYear(today.getFullYear());
      if (dt < today && dt.toDateString() !== today.toDateString()) dt.setFullYear(today.getFullYear() + 1);
      return dt;
    };
    return getNextOcc(a.birthday) - getNextOcc(b.birthday);
  }), [clients]);

  const recentActivity = useMemo(() => [...clients].filter(Boolean).sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 4), [clients]);

  const staleClients = useMemo(() => {
    const today = new Date();
    return clients.map(client => {
      const clientActivities = activities.filter(a => a.client_id === client.id);
      let lastDate = new Date(client.created_at);
      if (clientActivities.length > 0) {
        lastDate = new Date(Math.max(...clientActivities.map(a => new Date(a.created_at))));
      }
      const daysStale = Math.ceil((today - lastDate) / (1000 * 60 * 60 * 24));
      return { ...client, daysStale };
    }).filter(c => c.daysStale > 30).sort((a, b) => b.daysStale - a.daysStale).slice(0, 5);
  }, [clients, activities]);

  const chartData = useMemo(() => [...Array(7)].map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const ds = d.toISOString().split('T')[0];
    const count = activities.filter(a => a.activity_date === ds).length;
    return { date: ds, label: d.toLocaleDateString(undefined, { weekday: 'short' }), count };
  }), [activities]);
  const maxChartVal = Math.max(...chartData.map(d => d.count), 1); 

  // REUSABLE ICONS
  const EyeIcon = () => (<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>);
  const EyeSlashIcon = () => (<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" /></svg>);
  const BellIcon = () => (<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0018 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" /></svg>);
  const SearchIcon = () => (<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" /></svg>);

  if (appStep === 'LOADING') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAFAFA] dark:bg-[#0A0A0A] text-gray-900 dark:text-gray-100 font-sans">
        <div className="flex flex-col items-center gap-4">
          <div className="w-5 h-5 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" />
          <span className="text-[13px] font-medium tracking-wide text-gray-500">Initializing workspace...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA] dark:bg-[#0A0A0A] text-gray-900 dark:text-gray-100 font-sans flex flex-col selection:bg-gray-900 selection:text-white relative">
      
      {/* GLOBAL SEARCH COMMAND PALETTE */}
      {showGlobalSearch && (
        <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm z-[100] flex justify-center pt-[10vh] px-4 animate-in fade-in" onClick={() => setShowGlobalSearch(false)}>
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh] border border-gray-100" onClick={e => e.stopPropagation()}>
            <div className="flex items-center px-4 py-3 border-b border-gray-100 bg-gray-50/50 dark:bg-gray-800/40">
              <SearchIcon className="text-gray-400" />
              <input type="text" autoFocus placeholder='Search... or try "create deal for Sarah", "log call with Sarah"' value={globalSearchTerm} onChange={e => setGlobalSearchTerm(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { const a = parseCommandAction(globalSearchTerm); if (a) { e.preventDefault(); a.run(); } } }} className="dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 w-full bg-transparent border-none focus:ring-0 px-3 py-1 text-[15px] outline-none placeholder-gray-400 dark:placeholder-gray-500" />
              <button onClick={() => setShowGlobalSearch(false)} className="text-[10px] font-bold text-gray-400 bg-gray-200 px-2 py-1 rounded hover:bg-gray-300">ESC</button>
            </div>
            
            <div className="overflow-y-auto flex-1 p-2">
              {globalSearchTerm.length < 2 ? (
                <p className="text-[13px] text-gray-400 p-4 text-center">Type at least 2 characters to search.</p>
              ) : (
                <div className="space-y-4 p-2">
                  {/* G30 — COMMAND ACTION (if the query parses as one) */}
                  {(() => {
                    const action = parseCommandAction(globalSearchTerm);
                    if (!action) return null;
                    return (
                      <div>
                        <h4 className="text-[11px] font-bold uppercase tracking-wider text-gray-400 px-3 mb-2">Actions</h4>
                        <button onClick={action.run} className="w-full flex items-center justify-between p-3 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition-colors text-left group">
                          <span className="text-[14px] font-semibold text-indigo-800">⚡ {action.label}</span>
                          <span className="text-[11px] font-bold text-indigo-400 border border-indigo-200 px-1.5 py-0.5 rounded group-hover:bg-white">Run ↵</span>
                        </button>
                      </div>
                    );
                  })()}
                  {/* CLIENT MATCHES */}
                  {globalSearchResults.clients.length > 0 && (
                    <div>
                      <h4 className="text-[11px] font-bold uppercase tracking-wider text-gray-400 px-3 mb-2">Relationships</h4>
                      {globalSearchResults.clients.map(c => (
                        <button key={c.id} onClick={() => handleSearchSelection('client', c)} className="w-full flex items-center justify-between p-3 hover:bg-gray-50 rounded-xl transition-colors text-left group">
                          <div>
                            <p className="text-[14px] font-semibold text-gray-900">{c.name}</p>
                            <p className="text-[12px] text-gray-500">{c.email} {c.phone_number ? `• ${c.phone_number}` : ''}</p>
                          </div>
                          <span className="text-[12px] text-gray-400 group-hover:text-gray-900 transition-colors">View Profile &rarr;</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* ACTIVITY MATCHES */}
                  {globalSearchResults.activities.length > 0 && (
                    <div>
                      <h4 className="text-[11px] font-bold uppercase tracking-wider text-gray-400 px-3 mb-2 mt-4">Activity Notes</h4>
                      {globalSearchResults.activities.map(a => {
                        const parentClient = clients.find(c => c.id === a.client_id);
                        return (
                          <button key={a.id} onClick={() => handleSearchSelection('activity', a)} className="w-full flex flex-col p-3 hover:bg-gray-50 rounded-xl transition-colors text-left group gap-1">
                            <div className="flex justify-between w-full items-center">
                              <span className="text-[12px] font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">{parentClient?.name || 'Unknown Relationship'}</span>
                              <span className="text-[11px] text-gray-400">{a.activity_date}</span>
                            </div>
                            <p className="text-[13px] text-gray-800 line-clamp-2 leading-snug">{a.description}</p>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {globalSearchResults.clients.length === 0 && globalSearchResults.activities.length === 0 && (
                    <p className="text-[13px] text-gray-400 p-4 text-center">No results found for "{globalSearchTerm}"</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      
      {/* PART E — LEFT SIDEBAR (desktop, 240px) */}
      {user && (
        <aside className="hidden md:flex flex-col fixed inset-y-0 left-0 w-60 bg-white dark:bg-gray-900 border-r border-gray-100 dark:border-gray-800 z-40">
          {/* Logo */}
          <div className="flex items-center gap-2.5 px-5 h-16 shrink-0 border-b border-gray-100 dark:border-gray-800">
            <div className="w-6 h-6 bg-gray-900 dark:bg-gray-100 rounded-md" />
            <span className="text-[15px] font-semibold tracking-tight">Student CRM</span>
          </div>
          {/* Nav items */}
          <nav className="flex-1 overflow-y-auto px-3 py-4 flex flex-col gap-0.5">
            {[
              ['DASHBOARD', 'Dashboard'],
              ['CLIENTS', 'Relationships'],
              ['DEALS', 'Deals'],
              ['N8N', 'Email Automation'],
              ['GLOBAL_TASKS', 'Tasks'],
              ['CALENDAR', 'Calendar'],
              ['REPORTS', 'Reports'],
              ['SETTINGS', 'Settings'],
            ].map(([step, label]) => (
              <button key={step} onClick={() => setAppStep(step)} className={`text-left px-3 py-2 rounded-xl text-[13px] font-medium transition-all ${appStep === step ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-semibold' : 'text-gray-500 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800/50'}`}>
                {label}
              </button>
            ))}
          </nav>
          {/* Utilities + user block */}
          <div className="px-3 py-3 border-t border-gray-100 dark:border-gray-800 space-y-0.5">
            <button onClick={() => setShowGlobalSearch(true)} className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-[13px] font-medium text-gray-500 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-all">
              <span className="flex items-center gap-2"><SearchIcon /> Search</span>
              <span className="text-[10px] font-semibold border border-gray-200 dark:border-gray-700 px-1.5 py-0.5 rounded text-gray-400">⌘K</span>
            </button>
            <div className="relative">
              <button onClick={() => setShowNotifications(!showNotifications)} className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-[13px] font-medium text-gray-500 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-all">
                <span className="flex items-center gap-2"><BellIcon /> Notifications</span>
                {notifications.filter(n => !n.read).length > 0 && (
                  <span className="text-[10px] font-bold bg-red-500 text-white rounded-full px-1.5 py-0.5">{notifications.filter(n => !n.read).length}</span>
                )}
              </button>
              {showNotifications && (
                <div className="absolute left-full bottom-0 ml-3 w-80 bg-white dark:bg-gray-900 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-800 overflow-hidden z-50">
                  <div className="p-3 bg-gray-50/80 dark:bg-gray-800/80 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center">
                    <span className="text-[13px] font-semibold text-gray-900 dark:text-gray-100">Notifications</span>
                    {notifications.filter(n => !n.read).length > 0 && (
                      <button onClick={() => notifications.forEach(n => !n.read && handleMarkNotificationRead(n.id, n.reference_id, n.type))} className="text-[11px] text-indigo-600 font-medium hover:underline">Mark all read</button>
                    )}
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <EmptyState title="All caught up" desc="Notifications about tasks and birthdays will appear here." />
                    ) : (
                      notifications.slice(0, 10).map(n => (
                        <div key={n.id} onClick={() => handleMarkNotificationRead(n.id, n.reference_id, n.type)} className={`p-3 border-b border-gray-50 dark:border-gray-800 last:border-0 cursor-pointer transition-colors ${n.read ? 'bg-white dark:bg-gray-900 opacity-60' : 'bg-indigo-50/30 dark:bg-indigo-900/10 hover:bg-indigo-50/50'}`}>
                          <p className="text-[12px] font-medium text-gray-900 dark:text-gray-100 leading-snug">{n.message}</p>
                          <p className="text-[10px] text-gray-400 mt-1">{new Date(n.created_at).toLocaleDateString()}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
            <button onClick={toggleDarkMode} className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-[13px] font-medium text-gray-500 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-all">
              {darkMode ? '☀️ Light mode' : '🌙 Dark mode'}
            </button>
            <div className="flex items-center gap-2.5 px-3 pt-3 mt-1 border-t border-gray-100 dark:border-gray-800">
              <span className="w-8 h-8 rounded-full bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-[11px] font-bold flex items-center justify-center shrink-0">
                {(profile.username || user.email || '?').slice(0, 2).toUpperCase()}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-semibold text-gray-900 dark:text-gray-100 truncate">{profile.username || user.email}</p>
                <p className="text-[10px] text-gray-400 truncate">{workspace ? workspace.name : 'Solo workspace'}</p>
              </div>
              <button onClick={handleLogout} title="Log out" className="text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 p-1 transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" /></svg>
              </button>
            </div>
          </div>
        </aside>
      )}

      {/* TOP NAVIGATION BAR (mobile when logged in; all sizes when logged out) */}
      <nav className={`bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 sticky top-0 z-40 shadow-sm ${user ? 'md:hidden' : ''}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-14 items-center">
            <div className="flex items-center gap-8">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 bg-gray-900 rounded-sm" />
                <span className="text-[15px] font-semibold tracking-tight">Student CRM</span>
              </div>
              
              {user && (
                <div className="hidden md:flex items-center gap-1">
                  {[
                    ['DASHBOARD', 'Dashboard'],
                    ['CLIENTS', 'Relationships'],
                    ['DEALS', 'Deals'],
                    ['GLOBAL_TASKS', 'Tasks'],
                    ['CALENDAR', 'Calendar'],
                    ['REPORTS', 'Reports'],
                    ['SETTINGS', 'Settings'],
                  ].map(([step, label]) => (
                    <button key={step} onClick={() => setAppStep(step)} className={`px-3 py-1.5 rounded-md text-[13px] font-medium transition-all ${appStep === step ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100' : 'text-gray-500 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800/50'}`}>{label}</button>
                  ))}
                </div>
              )}
            </div>
            
            {user ? (
              <div className="flex items-center gap-4">
                {/* Mobile hamburger (Feature 12) */}
                <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="flex md:hidden text-gray-500 hover:text-gray-900 dark:hover:text-gray-100 p-1" title="Menu">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    {mobileMenuOpen
                      ? <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      : <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />}
                  </svg>
                </button>

                {/* Dark mode toggle (Feature 13) */}
                <button onClick={toggleDarkMode} className="text-gray-500 hover:text-gray-900 dark:hover:text-gray-100 p-1 transition-colors" title={darkMode ? 'Light mode' : 'Dark mode'}>
                  {darkMode ? (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" /></svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" /></svg>
                  )}
                </button>

                {/* Search Trigger */}
                <button onClick={() => setShowGlobalSearch(true)} className="text-gray-500 hover:text-gray-900 p-1 rounded-full transition-colors hidden sm:flex items-center gap-2 group" title="Search (Cmd+K)">
                  <SearchIcon />
                  <span className="text-[11px] font-medium border border-gray-200 px-1.5 py-0.5 rounded text-gray-400 group-hover:bg-gray-100 transition-colors">⌘K</span>
                </button>

                {/* Notifications Bell */}
                <div className="relative">
                  <button onClick={() => setShowNotifications(!showNotifications)} className="text-gray-500 hover:text-gray-900 p-1 relative transition-colors">
                    <BellIcon />
                    {notifications.filter(n => !n.read).length > 0 && (
                      <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white"></span>
                    )}
                  </button>

                  {/* Notifications Dropdown */}
                  {showNotifications && (
                    <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden z-50">
                      <div className="p-3 bg-gray-50/80 border-b border-gray-100 flex justify-between items-center">
                        <span className="text-[13px] font-bold text-gray-900">Notifications</span>
                        {notifications.filter(n => !n.read).length > 0 && (
                          <button onClick={() => notifications.forEach(n => !n.read && handleMarkNotificationRead(n.id, n.reference_id, n.type))} className="text-[11px] text-blue-600 font-medium hover:underline">Mark all read</button>
                        )}
                      </div>
                      <div className="max-h-80 overflow-y-auto">
                        {notifications.length === 0 ? (
                          <p className="text-[13px] text-gray-400 p-6 text-center">No notifications yet.</p>
                        ) : (
                          notifications.slice(0, 10).map(n => (
                            <div key={n.id} onClick={() => handleMarkNotificationRead(n.id, n.reference_id, n.type)} className={`p-3 border-b border-gray-50 last:border-0 cursor-pointer transition-colors ${n.read ? 'bg-white opacity-60' : 'bg-blue-50/30 hover:bg-blue-50/50'}`}>
                              <p className="text-[12px] font-medium text-gray-900 leading-snug">{n.message}</p>
                              <p className="text-[10px] text-gray-400 mt-1">{new Date(n.created_at).toLocaleDateString()}</p>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <div className="h-4 w-px bg-gray-200 hidden sm:block" />
                <button onClick={handleLogout} className="text-[13px] font-medium text-gray-500 hover:text-gray-900 transition-colors">Log Out</button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button onClick={() => { setAppStep('LOG_IN'); setAuthMessage(''); }} className={`px-3 py-1.5 rounded-md text-[13px] font-medium transition-all ${appStep === 'LOG_IN' || appStep === 'FORGOT_PASSWORD' ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'}`}>Log In</button>
                <button onClick={() => { setAppStep('SIGN_UP'); setAuthMessage(''); }} className="px-3 py-1.5 rounded-md text-[13px] font-medium bg-gray-900 text-white hover:bg-gray-800 transition-all shadow-sm">Sign Up</button>
              </div>
            )}
          </div>
        </div>

        {/* MOBILE NAV DRAWER (Feature 12) */}
        {user && mobileMenuOpen && (
          <div className="md:hidden border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 animate-in slide-in-from-top-2 fade-in duration-200">
            <div className="px-4 py-3 flex flex-col gap-1">
              {[
                ['DASHBOARD', 'Dashboard'],
                ['CLIENTS', 'Relationships'],
                ['DEALS', 'Deals'],
                ['N8N', 'Email Automation'],
                ['GLOBAL_TASKS', 'Tasks'],
                ['CALENDAR', 'Calendar'],
                ['REPORTS', 'Reports'],
                ['SETTINGS', 'Settings'],
              ].map(([step, label]) => (
                <button key={step} onClick={() => { setAppStep(step); setMobileMenuOpen(false); }} className={`text-left px-3 py-2.5 min-h-[44px] rounded-md text-[13px] font-medium transition-all ${appStep === step ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100' : 'text-gray-500 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800/50'}`}>{label}</button>
              ))}
            </div>
          </div>
        )}
      </nav>

      {/* GLOBAL FLOATING ACTION BUTTON */}
      {user && (appStep === 'DASHBOARD' || appStep === 'CLIENTS') && (
        <button 
          onClick={() => { 
            if (appStep === 'DASHBOARD') {
              setAppStep('CLIENTS'); 
              setTimeout(() => document.getElementById('add-client-form')?.scrollIntoView({behavior: 'smooth'}), 100);
            } else {
              // Already on CLIENTS, just scroll to form
              setTimeout(() => document.getElementById('add-client-form')?.scrollIntoView({behavior: 'smooth'}), 100);
            }
          }}
          className="fixed bottom-6 right-4 md:bottom-8 md:right-8 z-50 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 p-4 rounded-full shadow-xl hover:bg-gray-800 dark:hover:bg-white hover:scale-105 transition-all active:scale-95 group flex items-center justify-center"
          title="Add New Relationship"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
        </button>
      )}

      {/* FIX: page padding lives on the inner wrapper so it can never fight the
          sidebar offset (md:pl-60) for padding-left â€” content always sits beside
          the 240px nav at every breakpoint, no horizontal scrollbar. */}
      <main className={`flex-1 w-full min-w-0 ${user ? 'md:pl-60' : ''}`}>
        <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 sm:py-12">

        {/* VIEW: LOG IN */}
        {appStep === 'LOG_IN' && (
          <div className="max-w-[400px] mx-auto mt-10 sm:mt-20">
            <div className="bg-white rounded-2xl shadow-sm hover:shadow-md transition-shadow border border-gray-100 p-8 sm:p-10">
              <h2 className="text-xl font-semibold text-gray-900 mb-1">Welcome back</h2>
              <p className="text-[13px] text-gray-500 mb-6">Enter your credentials to access your workspace.</p>
              
              {authMessage && (
                <div className="mb-6 p-3 rounded-lg text-[13px] font-medium bg-red-50 text-red-700 border border-red-100 flex items-start gap-2">
                  <svg className="w-4 h-4 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" /></svg>
                  {authMessage}
                </div>
              )}

              <button onClick={handleGoogleSignIn} type="button" className="w-full flex items-center justify-center gap-3 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 text-[13px] font-medium py-2.5 px-4 rounded-lg shadow-sm transition-all active:scale-[0.98] mb-4">
                <svg className="w-4 h-4" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                Sign in with Google
              </button>

              <div className="relative mb-4">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200"></div></div>
                <div className="relative flex justify-center text-sm"><span className="px-2 bg-white text-[11px] text-gray-500 uppercase tracking-widest">Or continue with</span></div>
              </div>

              <form onSubmit={handleLoginWithPassword} className="space-y-4">
                <div>
                  <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Email address</label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="name@company.com" className="w-full px-3 py-2 text-[13px] bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm placeholder-gray-400 dark:placeholder-gray-500 dark:text-gray-100 focus:outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-400 transition-colors" />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-gray-700 mb-1.5 flex justify-between">
                    Password
                    <button type="button" onClick={() => {setAppStep('FORGOT_PASSWORD'); setAuthMessage('');}} className="text-gray-500 hover:text-gray-800 focus:outline-none transition-colors">Forgot password?</button>
                  </label>
                  <div className="relative">
                    <input type={showLoginPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="••••••••" className="w-full px-3 py-2 pr-10 text-[13px] bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm placeholder-gray-400 dark:placeholder-gray-500 dark:text-gray-100 focus:outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-400 transition-colors" />
                    <button type="button" onClick={() => setShowLoginPassword(!showLoginPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none p-1 rounded">
                      {showLoginPassword ? <EyeSlashIcon /> : <EyeIcon />}
                    </button>
                  </div>
                </div>
                <button type="submit" disabled={authLoading} className="w-full py-2.5 px-4 text-[13px] font-semibold text-white bg-gray-900 rounded-xl hover:opacity-90 shadow-sm transition-all active:scale-[0.98] mt-2 flex justify-center items-center">
                  {authLoading ? 'Signing in...' : 'Sign In'}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* VIEW: SIGN UP */}
        {appStep === 'SIGN_UP' && (
          <div className="max-w-[400px] mx-auto mt-10 sm:mt-20">
            <div className="bg-white rounded-2xl shadow-sm hover:shadow-md transition-shadow border border-gray-100 p-8 sm:p-10">
              <h2 className="text-xl font-semibold text-gray-900 mb-1">Create an account</h2>
              <p className="text-[13px] text-gray-500 mb-6">Enter your details below to get started.</p>

              {authMessage && (
                <div className="mb-6 p-3 rounded-lg text-[13px] font-medium bg-red-50 text-red-700 border border-red-100 flex items-start gap-2">
                  <svg className="w-4 h-4 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" /></svg>
                  {authMessage}
                </div>
              )}

              <form onSubmit={handleSignUp} className="space-y-4">
                <div>
                  <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Email address</label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="name@company.com" className="w-full px-3 py-2 text-[13px] bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm placeholder-gray-400 dark:placeholder-gray-500 dark:text-gray-100 focus:outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-400 transition-colors" />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Password</label>
                  <div className="relative">
                    <input type={showSignupPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="••••••••" className="w-full px-3 py-2 pr-10 text-[13px] bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm placeholder-gray-400 dark:placeholder-gray-500 dark:text-gray-100 focus:outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-400 transition-colors" />
                    <button type="button" onClick={() => setShowSignupPassword(!showSignupPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none p-1 rounded">
                      {showSignupPassword ? <EyeSlashIcon /> : <EyeIcon />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Confirm Password</label>
                  <div className="relative">
                    <input type={showConfirmPassword ? 'text' : 'password'} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required placeholder="••••••••" className="w-full px-3 py-2 pr-10 text-[13px] bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm placeholder-gray-400 dark:placeholder-gray-500 dark:text-gray-100 focus:outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-400 transition-colors" />
                    <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none p-1 rounded">
                      {showConfirmPassword ? <EyeSlashIcon /> : <EyeIcon />}
                    </button>
                  </div>
                  {confirmPassword.length > 0 && password !== confirmPassword && (
                    <p className="text-[11px] text-red-500 mt-1">Passwords do not match</p>
                  )}
                </div>
                <button type="submit" disabled={authLoading || (confirmPassword.length > 0 && password !== confirmPassword)} className="w-full py-2.5 px-4 text-[13px] font-semibold text-white bg-gray-900 rounded-xl hover:opacity-90 shadow-sm transition-all active:scale-[0.98] mt-2 flex justify-center items-center disabled:opacity-50 disabled:hover:bg-gray-900">
                  {authLoading ? 'Creating Account...' : 'Sign Up'}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* VIEW: VERIFY OTP */}
        {appStep === 'VERIFY_OTP' && (
          <div className="max-w-[400px] mx-auto mt-10 sm:mt-20">
            <div className="bg-white rounded-2xl shadow-sm hover:shadow-md transition-shadow border border-gray-100 p-8 sm:p-10">
              <h2 className="text-xl font-semibold text-gray-900 mb-1">Check your email</h2>
              <p className="text-[13px] text-gray-500 mb-6">We sent a verification code to {email}.</p>
              
              {authMessage && !authMessage.includes('initiated') && (
                <div className="mb-6 p-3 rounded-lg text-[13px] font-medium bg-red-50 text-red-700 border border-red-100 flex items-start gap-2">
                  {authMessage}
                </div>
              )}

              <form onSubmit={handleVerifyOtp} className="space-y-4">
                <div>
                  <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Verification Code</label>
                  <input type="text" value={otpToken} onChange={(e) => setOtpToken(e.target.value)} required placeholder="123456" className="w-full px-3 py-2 text-[13px] bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm placeholder-gray-400 dark:placeholder-gray-500 dark:text-gray-100 focus:outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-400 transition-colors tracking-widest text-center" />
                </div>
                <button type="submit" disabled={authLoading} className="w-full py-2.5 px-4 text-[13px] font-semibold text-white bg-gray-900 rounded-xl hover:opacity-90 shadow-sm transition-all active:scale-[0.98] mt-2 flex justify-center items-center">
                  {authLoading ? 'Verifying...' : 'Verify Email'}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* VIEW: FORGOT PASSWORD */}
        {appStep === 'FORGOT_PASSWORD' && (
          <div className="max-w-[400px] mx-auto mt-10 sm:mt-20">
            <div className="bg-white rounded-2xl shadow-sm hover:shadow-md transition-shadow border border-gray-100 p-8 sm:p-10">
              <h2 className="text-xl font-semibold text-gray-900 mb-1">Reset Password</h2>
              <p className="text-[13px] text-gray-500 mb-6">Enter your email and we'll send you a reset link.</p>
              
              {resetEmailSent ? (
                <div className="p-4 rounded-lg bg-green-50 border border-green-100 text-green-800 text-[13px] font-medium text-center">
                  Check your email for the password reset link!
                </div>
              ) : (
                <form onSubmit={handleForgotPassword} className="space-y-4">
                  {authMessage && (
                    <div className="p-3 rounded-lg text-[13px] font-medium bg-red-50 text-red-700 border border-red-100">
                      {authMessage}
                    </div>
                  )}
                  <div>
                    <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Email address</label>
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="name@company.com" className="w-full px-3 py-2 text-[13px] bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm placeholder-gray-400 dark:placeholder-gray-500 dark:text-gray-100 focus:outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-400 transition-colors" />
                  </div>
                  <button type="submit" disabled={authLoading} className="w-full py-2.5 px-4 text-[13px] font-semibold text-white bg-gray-900 rounded-xl hover:opacity-90 shadow-sm transition-all active:scale-[0.98] mt-2 flex justify-center items-center">
                    {authLoading ? 'Sending...' : 'Send Reset Link'}
                  </button>
                </form>
              )}
            </div>
          </div>
        )}

        {/* VIEW: DASHBOARD */}
        {appStep === 'DASHBOARD' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-100 mb-1">Overview</h1>
              <p className="text-[13px] text-gray-500">Monitor your workspace activity and relationship directory.</p>
            </div>

            {/* ONBOARDING CHECKLIST (Feature 30) */}
            {!onboardingComplete && !onboardingDismissed && (
              <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-md transition-shadow animate-in fade-in">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div>
                    <h3 className="text-[15px] font-bold text-gray-900 dark:text-gray-100">Welcome to your CRM! Get started in 4 steps:</h3>
                    <p className="text-[12px] text-gray-500 mt-0.5">{onboardingDone} of 4 complete</p>
                  </div>
                  <button onClick={() => { setOnboardingDismissed(true); localStorage.setItem('crm_onboarding_dismissed', 'true'); }} className="text-[12px] font-medium text-gray-400 hover:text-gray-700 dark:hover:text-gray-300">Dismiss</button>
                </div>
                <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2 overflow-hidden mb-5">
                  <div className="h-full bg-green-500 rounded-full transition-all duration-500" style={{ width: `${(onboardingDone / 4) * 100}%` }} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {onboardingSteps.map((step, i) => (
                    <div key={i} className={`flex items-start gap-3 p-3 rounded-xl border ${step.done ? 'border-green-100 dark:border-green-900 bg-green-50/40 dark:bg-green-900/10' : 'border-gray-100 dark:border-gray-700 bg-gray-50/40 dark:bg-gray-700/30'}`}>
                      <span className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 ${step.done ? 'bg-green-500 text-white' : 'bg-gray-200 dark:bg-gray-600 text-gray-500 dark:text-gray-300'}`}>{step.done ? '✓' : i + 1}</span>
                      <div className="flex-1">
                        <p className={`text-[13px] font-semibold ${step.done ? 'text-green-800 dark:text-green-300 line-through' : 'text-gray-900 dark:text-gray-100'}`}>{step.title}</p>
                        <p className="text-[11px] text-gray-500 mt-0.5">{step.desc}</p>
                        {!step.done && i === 0 && <button onClick={() => { setAppStep('CLIENTS'); setTimeout(() => document.getElementById('add-client-form')?.scrollIntoView({ behavior: 'smooth' }), 100); }} className="mt-1.5 text-[12px] font-semibold text-indigo-600 hover:underline">Add Relationship &rarr;</button>}
                        {!step.done && i === 2 && <button onClick={() => setAppStep('GLOBAL_TASKS')} className="mt-1.5 text-[12px] font-semibold text-indigo-600 hover:underline">Go to Tasks &rarr;</button>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* DASHBOARD TOP ROW: Charts and Tasks */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Activity Chart */}
              <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl shadow-sm hover:shadow-md transition-shadow border border-gray-100 dark:border-gray-800 lg:col-span-1 flex flex-col">
                <h3 className="text-[14px] font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-indigo-500"></span> Activity This Week
                </h3>
                <div className="flex-1 flex items-end gap-2 h-32 mt-auto pb-2">
                  {chartData.map(d => (
                    <div key={d.date} className="hover-lift flex-1 flex flex-col items-center gap-2 group relative">
                      <div className="w-full bg-indigo-100 dark:bg-indigo-500/15 rounded-sm relative overflow-hidden" style={{ height: '100px' }}>
                        <div className="anim-grow-h absolute bottom-0 w-full bg-indigo-500 transition-all duration-500" style={{ height: `${(d.count / maxChartVal) * 100}%` }}></div>
                      </div>
                      <span className="text-[10px] text-gray-400">{d.label}</span>
                      {/* Tooltip */}
                      <div className="absolute -top-8 bg-gray-900 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                        {d.count}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Tasks Widgets */}
              <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl shadow-sm hover:shadow-md transition-shadow border border-gray-100 dark:border-gray-800 lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-[14px] font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-red-500"></span> Overdue Tasks
                  </h3>
                  <div className="space-y-3">
                    {tasks.filter(t => t.status === 'pending' && new Date(t.due_date) < new Date(todayStr)).length === 0 && <p className="text-[13px] text-gray-500">No overdue tasks!</p>}
                    {tasks.filter(t => t.status === 'pending' && new Date(t.due_date) < new Date(todayStr)).slice(0,4).map(task => (
                      <div key={task.id} className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-800 last:border-0">
                        <div>
                          <p className="text-[13px] font-medium text-red-600 dark:text-red-400 truncate max-w-[150px]">{task.title}</p>
                          <p className="text-[11px] text-gray-500">Due: {task.due_date}</p>
                        </div>
                        <button onClick={() => { setViewingClient(clients.find(c => c.id === task.client_id)); setAppStep('CLIENTS'); }} className="text-[12px] text-gray-900 dark:text-gray-100 font-medium hover:underline shrink-0">View Relationship</button>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="text-[14px] font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-500"></span> Due Today
                  </h3>
                  <div className="space-y-3">
                    {tasks.filter(t => t.status === 'pending' && t.due_date === todayStr).length === 0 && <p className="text-[13px] text-gray-500">Nothing due today!</p>}
                    {tasks.filter(t => t.status === 'pending' && t.due_date === todayStr).slice(0,4).map(task => (
                      <div key={task.id} className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-800 last:border-0">
                        <p className="text-[13px] font-medium text-gray-900 dark:text-gray-100 truncate max-w-[150px]">{task.title}</p>
                        <button onClick={() => { setViewingClient(clients.find(c => c.id === task.client_id)); setAppStep('CLIENTS'); }} className="text-[12px] text-gray-900 dark:text-gray-100 font-medium hover:underline shrink-0">View Relationship</button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-md transition-shadow">
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Total records</p>
                <p className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100 mt-1">{clients.length}</p>
              </div>
              <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-md transition-shadow">
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">High Priority</p>
                <p className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100 mt-1">{clients.filter(c => c.relationship === 'High').length}</p>
              </div>
              <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-md transition-shadow">
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Active Stage</p>
                <p className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100 mt-1">{clients.filter(c => c.status === 'Active').length}</p>
              </div>
              <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-md transition-shadow">
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">New Stage</p>
                <p className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100 mt-1">{clients.filter(c => c.status === 'New').length}</p>
              </div>
              <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-md transition-shadow">
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Open Deals</p>
                <p className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100 mt-1">{openDealsCount}</p>
              </div>
              <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-md transition-shadow">
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Pipeline Value</p>
                <p className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100 mt-1">{fmtMoney(pipelineValue)}</p>
              </div>
            </div>

            {/* NEW WIDGETS ROW: Streak, Goals, Top Leads, Health, Sources */}
            <div className="anim-stagger grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Your Streak (Feature 17) */}
              <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-md transition-shadow">
                <h3 className="font-bold text-[14px] text-gray-900 dark:text-gray-100 flex items-center gap-1.5 mb-3">
                  <span>🔥</span> Your Streak
                </h3>
                <p className="text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100">{streakData.current} day{streakData.current === 1 ? '' : 's'}</p>
                <p className="text-[12px] text-gray-500 mt-1">Longest: {streakData.longest} days</p>
                <div className="flex gap-1.5 mt-4">
                  {[...Array(7)].map((_, i) => {
                    const d = new Date(); d.setDate(d.getDate() - (6 - i));
                    const ds = d.toISOString().split('T')[0];
                    const active = activities.some(a => (a.created_at || '').split('T')[0] === ds);
                    return <span key={i} className={`w-3 h-3 rounded-full ${active ? 'bg-orange-500' : 'bg-gray-200 dark:bg-gray-700'}`} title={ds} />;
                  })}
                </div>
                <p className="text-[12px] font-medium text-gray-600 dark:text-gray-300 mt-3">
                  {streakData.current === 0 ? 'Start your streak!' : streakData.current >= 30 ? 'On fire! 🔥' : streakData.current >= 7 ? 'One week! Keep it going!' : 'Keep it going!'}
                </p>
              </div>

              {/* Monthly Goals (Feature 26) */}
              <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold text-[14px] text-gray-900 dark:text-gray-100 flex items-center gap-1.5"><span>🎯</span> Monthly Goals</h3>
                  <button onClick={() => setShowGoalForm(true)} className="text-[12px] font-medium text-indigo-600 hover:underline">Set Goals</button>
                </div>
                {goalProgress.length === 0 ? (
                  <p className="text-[13px] text-gray-400 py-2">No goals set for this month yet.</p>
                ) : (
                  <div className="space-y-3">
                    {goalProgress.map(g => (
                      <div key={g.id} className="relative hover-lift rounded-lg">
                        <div className="flex justify-between text-[12px] mb-1">
                          <span className="font-medium text-gray-700 dark:text-gray-300">{{ new_clients: 'New Relationships', activities_logged: 'Activities Logged', deals_closed: 'Deals Closed', tasks_completed: 'Tasks Completed' }[g.goal_type]}</span>
                          <span className="font-bold text-gray-900 dark:text-gray-100"><CountUp value={g.current} /> of {g.target_value} <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] ${g.pct >= 100 ? 'bg-green-100 text-green-700' : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-300'}`}><CountUp value={g.pct} suffix="%" /></span></span>
                        </div>
                        <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                          <div className={`anim-grow-w h-full rounded-full transition-all duration-500 ${g.pct >= 100 ? 'bg-green-500' : g.pct >= 50 ? 'bg-blue-500' : 'bg-yellow-400'}`} style={{ width: `${g.pct}%` }} />
                        </div>
                        {g.pct >= 100 && <span className="goal-confetti absolute -top-1 right-0 text-[14px]">🎉</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Top Leads (Feature 6) */}
              <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-md transition-shadow">
                <h3 className="font-bold text-[14px] text-gray-900 dark:text-gray-100 flex items-center gap-1.5 mb-3"><span>⭐</span> Top Leads</h3>
                {topLeads.length === 0 ? (
                  <p className="text-[13px] text-gray-400 py-2">Add relationships to see lead scores.</p>
                ) : (
                  <div className="space-y-2.5">
                    {topLeads.map(c => (
                      <div key={c.id} className="hover-lift rounded-lg px-1 flex items-center justify-between gap-2 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                        <span className="text-[13px] font-medium text-gray-800 dark:text-gray-200 truncate flex-1">{c.name}</span>
                        <ScoreBar score={c.leadScore} />
                        <button onClick={() => { setViewingClient(c); setAppStep('CLIENTS'); }} className="text-[12px] text-gray-500 hover:text-gray-900 dark:hover:text-gray-100 font-medium shrink-0">View</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Relationship Health (Feature 19) */}
              <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-md transition-shadow">
                <h3 className="font-bold text-[14px] text-gray-900 dark:text-gray-100 flex items-center gap-1.5 mb-3"><span>💗</span> Relationship Health</h3>
                <div className="space-y-2">
                  {[['Excellent', 'bg-green-500'], ['Good', 'bg-teal-500'], ['Fair', 'bg-yellow-400'], ['At Risk', 'bg-orange-500'], ['Critical', 'bg-red-500']].map(([label, color]) => {
                    const count = healthCounts[label] || 0;
                    const total = Math.max(clients.length, 1);
                    return (
                      <button key={label} onClick={() => { setFilterHealth(label); setAppStep('CLIENTS'); }} className="w-full flex items-center gap-3 group">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${color}`} />
                        <span className="text-[12px] font-medium text-gray-600 dark:text-gray-300 w-16 text-left group-hover:text-gray-900 dark:group-hover:text-gray-100">{label}</span>
                        <span className="text-[12px] font-bold text-gray-900 dark:text-gray-100 w-6 text-right">{count}</span>
                        <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-full h-1.5 overflow-hidden">
                          <div className={`anim-grow-w h-full rounded-full ${color}`} style={{ width: `${(count / total) * 100}%` }} />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* G19 — Recurring Revenue */}
              <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-md transition-shadow">
                <h3 className="font-bold text-[14px] text-gray-900 dark:text-gray-100 flex items-center gap-1.5 mb-3"><span>🔁</span> Recurring Revenue</h3>
                <div className="flex gap-6">
                  <div>
                    <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">MRR</p>
                    <p className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">{fmtMoney(mrr)}</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">ARR</p>
                    <p className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">{fmtMoney(mrr * 12)}</p>
                  </div>
                </div>
                <p className="text-[11px] text-gray-400 mt-1.5">From Won deals marked recurring, normalized monthly.</p>
                <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-2">Renewals (next 30 days)</p>
                  {upcomingRenewals.length === 0 ? (
                    <p className="text-[12px] text-gray-400">No renewals coming up.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {upcomingRenewals.slice(0, 4).map(d => {
                        const rc = clients.find(c => c.id === d.client_id);
                        return (
                          <div key={d.id} className="flex items-center gap-2 text-[12px]">
                            <span className="font-semibold text-gray-800 dark:text-gray-200 truncate flex-1">{d.title}</span>
                            <span className="text-gray-400 shrink-0">{d.renewal_date}</span>
                            {rc && (
                              <button onClick={() => { setViewingClient(rc); setActivityType('Call'); setActivityDesc(`Renewal call — ${d.title} renews ${d.renewal_date}.`); setAppStep('CLIENTS'); }} className="text-indigo-600 font-medium hover:underline shrink-0">Log renewal call</button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Top Sources (Feature 25) */}
              <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-md transition-shadow">
                <h3 className="font-bold text-[14px] text-gray-900 dark:text-gray-100 flex items-center gap-1.5 mb-3"><span>📍</span> Top Sources</h3>
                {(() => {
                  const top = CLIENT_SOURCES.map(s => [s, clients.filter(c => c.source === s).length]).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]).slice(0, 3);
                  if (top.length === 0) return <p className="text-[13px] text-gray-400 py-2">No sources recorded yet — set a source when adding relationships.</p>;
                  return (
                    <div className="space-y-2.5">
                      {top.map(([source, count]) => (
                        <div key={source} className="flex items-center justify-between">
                          <span className="text-[13px] font-medium text-gray-800 dark:text-gray-200">{source}</span>
                          <span className="text-[12px] font-bold text-gray-500 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full">{count}</span>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* DASHBOARD BOTTOM ROW: Lists */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              {/* Birthdays */}
              <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow space-y-4 flex flex-col">
                <h3 className="font-bold text-[14px] text-gray-900 flex items-center gap-1.5">
                  <span>🎂</span> Birthdays (Next 30 Days)
                </h3>
                <div className="space-y-2.5 overflow-y-auto flex-1">
                  {upcomingBirthdays.length === 0 ? (
                    <p className="text-[13px] text-gray-400 py-2">No student birthdays in the next 30 days.</p>
                  ) : (
                    upcomingBirthdays.map(c => (
                      <button key={c.id} onClick={() => {setViewingClient(c); setAppStep('CLIENTS');}} className="w-full flex justify-between items-center p-2.5 rounded-lg border border-gray-100 bg-gray-50/40 hover:bg-gray-100 transition-colors text-left group">
                        <span className="font-medium text-[13px] text-gray-800 group-hover:text-gray-900">{c.name}</span>
                        <span className="text-gray-500 font-medium text-[12px]">{new Date(c.birthday).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</span>
                      </button>
                    ))
                  )}
                </div>
              </div>

              {/* Recent Activity */}
              <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow space-y-4 flex flex-col">
                <h3 className="font-bold text-[14px] text-gray-900 flex items-center gap-1.5">
                  <span>⚡</span> Recently Added Profiles
                </h3>
                <div className="space-y-2.5 flex-1">
                  {recentActivity.length === 0 ? (
                    <p className="text-[13px] text-gray-400 py-2">No entries logged yet.</p>
                  ) : (
                    recentActivity.map(c => (
                      <button key={c.id} onClick={() => {setViewingClient(c); setAppStep('CLIENTS');}} className="w-full flex items-center justify-between p-2.5 rounded-lg border border-gray-100 bg-gray-50/40 hover:bg-gray-100 transition-colors text-left group">
                        <div>
                          <p className="text-[13px] font-medium text-gray-800 group-hover:text-gray-900">{c.name}</p>
                          <p className="text-[11px] text-gray-400">{c.email}</p>
                        </div>
                        <span className="text-[11px] bg-white border px-2 py-0.5 rounded-full text-gray-500">
                          {c.created_at ? new Date(c.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'N/A'}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              </div>

              {/* Stale Clients */}
              <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow space-y-4 flex flex-col">
                <h3 className="font-bold text-[14px] text-gray-900 flex items-center gap-1.5">
                  <span>❄️</span> Stale Relationships (&gt;30 Days)
                </h3>
                <div className="space-y-2.5 flex-1">
                  {staleClients.length === 0 ? (
                    <p className="text-[13px] text-gray-400 py-2">All active relationships have recent activity. Great job!</p>
                  ) : (
                    staleClients.map(c => (
                      <button key={c.id} onClick={() => {setViewingClient(c); setAppStep('CLIENTS');}} className="w-full flex items-center justify-between p-2.5 rounded-lg border border-red-50 bg-red-50/40 hover:bg-red-50 transition-colors text-left group">
                        <div>
                          <p className="text-[13px] font-medium text-gray-800 group-hover:text-gray-900">{c.name}</p>
                          <p className="text-[11px] text-gray-500">Stale for {c.daysStale} days</p>
                        </div>
                        <span className="text-[12px] text-red-600 font-medium">&rarr; Log</span>
                      </button>
                    ))
                  )}
                </div>
              </div>

            </div>
          </div>
        )}

        {/* VIEW: CLIENTS */}
        {appStep === 'CLIENTS' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            {/* FEATURE 10 — read-only banner for viewers */}
            {isViewer && (
              <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg text-[13px] font-medium text-blue-800">
                👁️ Read-only access — you can view relationships but not edit them. Ask a workspace admin for a higher role.
              </div>
            )}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl font-semibold tracking-tight text-gray-900 mb-1">CRM Pipeline</h1>
                <p className="text-[13px] text-gray-500">Manage relationship data, pipeline stages, custom fields, and records.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {/* Kanban Toggle */}
                <div className="bg-gray-200/50 p-1 rounded-lg flex items-center gap-1 mr-2">
                  <button onClick={() => { setViewMode('table'); localStorage.setItem('crm_view_mode', 'table'); }} className={`px-3 py-1.5 text-[12px] font-medium rounded-md transition-all ${viewMode === 'table' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Table</button>
                  <button onClick={() => { setViewMode('board'); localStorage.setItem('crm_view_mode', 'board'); }} className={`px-3 py-1.5 text-[12px] font-medium rounded-md transition-all ${viewMode === 'board' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Board</button>
                </div>

                <input type="file" ref={fileInputRef} accept=".csv" onChange={handleImportCSV} className="dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 hidden" />
                <button onClick={() => fileInputRef.current?.click()} className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-[12px] font-medium text-gray-700 hover:bg-gray-50 transition-colors shadow-sm">Import CSV</button>
                <button onClick={handleExportCSV} className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-[12px] font-medium text-gray-700 hover:bg-gray-50 transition-colors shadow-sm">Export CSV</button>
              </div>
            </div>

            {/* ADD CLIENT FORM */}
            {canEdit && (
            <div id="add-client-form" className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow space-y-4">
              <h3 className="text-[13px] font-bold uppercase tracking-wider text-gray-400">Add New Student Profile Card</h3>
              {crmErrorMessage && <div className="p-2 bg-red-50 text-red-700 text-[12px] rounded-lg border border-red-100">{crmErrorMessage}</div>}
              
              <form onSubmit={handleAddClient} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-[13px]">
                <input type="text" required placeholder="Name *" value={name} onChange={e => setName(e.target.value)} className="px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50/50 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 focus:bg-white dark:focus:bg-gray-800 focus:outline-none focus:border-gray-400" />
                <div className="flex flex-col">
                  <input type="email" required placeholder="Email *" value={clientEmail} onChange={e => setClientEmail(e.target.value)} className="px-3 py-2 min-h-[44px] md:min-h-0 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50/50 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 focus:bg-white dark:focus:bg-gray-800 focus:outline-none focus:border-gray-400" />
                  {/* FEATURE 14 — duplicate detection */}
                  {duplicateWarning && (
                    <div className="flex items-center gap-2 p-2 bg-yellow-50 border border-yellow-200 rounded-lg mt-1">
                      <span className="text-[12px] text-yellow-800">
                        ⚠️ A relationship with this email already exists:
                        <button type="button" onClick={() => setViewingClient(duplicateWarning)} className="font-semibold ml-1 underline">{duplicateWarning.name}</button>
                      </span>
                    </div>
                  )}
                </div>
                <input type="text" list="country-list" placeholder="Country" value={clientCountry} onChange={e => setClientCountry(e.target.value)} className="px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50/50 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 focus:bg-white dark:focus:bg-gray-800 focus:outline-none focus:border-gray-400" />
                <input type="text" placeholder="Phone Number" value={clientPhone} onChange={e => setClientPhone(e.target.value)} className="px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50/50 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 focus:bg-white dark:focus:bg-gray-800 focus:outline-none focus:border-gray-400" />
                <input type="url" placeholder="LinkedIn URL" value={clientLinkedin} onChange={e => setClientLinkedin(e.target.value)} className="px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50/50 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 focus:bg-white dark:focus:bg-gray-800 focus:outline-none focus:border-gray-400" />

                {/* PART F — company fields */}
                <input type="text" placeholder="Company Name" value={clientCompanyName} onChange={e => setClientCompanyName(e.target.value)} className="px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50/50 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 focus:bg-white dark:focus:bg-gray-800 focus:outline-none focus:border-gray-400" />
                <input type="text" placeholder="Company Website" value={clientCompanyUrl} onChange={e => setClientCompanyUrl(e.target.value)} className="px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50/50 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 focus:bg-white dark:focus:bg-gray-800 focus:outline-none focus:border-gray-400" />

                {/* G18 — referral chain */}
                <select value={clientReferredBy} onChange={e => setClientReferredBy(e.target.value)} className="px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50/50 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 focus:bg-white dark:focus:bg-gray-800 text-gray-700 focus:outline-none">
                  <option value="">Referred by: —</option>
                  {[...clients].sort((a, b) => (a.name || '').localeCompare(b.name || '')).map(c => <option key={c.id} value={c.id}>Referred by: {c.name}</option>)}
                </select>
                
                <div className="flex items-center gap-1">
                  <label className="text-[11px] font-medium text-gray-400 px-1 whitespace-nowrap">Birth:</label>
                  <input type="date" value={clientBirthday} onChange={e => setClientBirthday(e.target.value)} className="w-full px-2 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50/50 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 focus:bg-white dark:focus:bg-gray-800 text-gray-600 focus:outline-none" />
                </div>

                <select value={clientRelationship} onChange={e => setClientRelationship(e.target.value)} className="px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50/50 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 focus:bg-white dark:focus:bg-gray-800 text-gray-700 focus:outline-none">
                  <option value="Low">Low Priority</option>
                  <option value="Medium">Medium Priority</option>
                  <option value="High">High Priority</option>
                </select>

                <select value={status} onChange={e => setStatus(e.target.value)} className="px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50/50 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 focus:bg-white dark:focus:bg-gray-800 text-gray-700 focus:outline-none">
                  {PIPELINE_STAGES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>

                {/* FEATURE 25 — source tracking */}
                <select value={clientSource} onChange={e => setClientSource(e.target.value)} className="px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50/50 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 focus:bg-white dark:focus:bg-gray-800 text-gray-700 focus:outline-none">
                  <option value="">Source: Unknown</option>
                  {CLIENT_SOURCES.map(s => <option key={s} value={s}>Source: {s}</option>)}
                </select>

                {/* DYNAMIC CUSTOM FIELDS RENDER */}
                {customFieldDefs.length > 0 && (
                  <div className="sm:col-span-2 lg:col-span-4 border-t border-gray-100 pt-3 mt-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {customFieldDefs.map(cf => (
                      <div key={cf.id} className="flex flex-col gap-1">
                        <label className="text-[11px] font-medium text-gray-500">{cf.field_name}</label>
                        {cf.field_type === 'select' ? (
                          <select value={formCustomValues[cf.id] || ''} onChange={e => setFormCustomValues({...formCustomValues, [cf.id]: e.target.value})} className="px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50/50 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 focus:bg-white dark:focus:bg-gray-800 text-gray-700 focus:outline-none">
                            <option value="">-- Select --</option>
                            {(cf.select_options || []).map(opt => <option key={opt} value={opt}>{opt}</option>)}
                          </select>
                        ) : (
                          <input type={cf.field_type} value={formCustomValues[cf.id] || ''} onChange={e => setFormCustomValues({...formCustomValues, [cf.id]: e.target.value})} className="px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50/50 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 focus:bg-white dark:focus:bg-gray-800 focus:outline-none focus:border-gray-400" />
                        )}
                      </div>
                    ))}
                  </div>
                )}

                <div className="sm:col-span-2 lg:col-span-4 flex items-center gap-2 pt-2 border-t border-gray-100">
                  <input type="text" placeholder="Legacy Note: Add conversation details log note remarks..." value={clientConversation} onChange={e => setClientConversation(e.target.value)} className="flex-1 px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50/50 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 focus:bg-white dark:focus:bg-gray-800 focus:outline-none" />
                  {duplicateWarning && !forceSaveDuplicate && (
                    <button type="button" onClick={() => setForceSaveDuplicate(true)} className="px-3 py-2 text-[12px] font-medium text-yellow-700 bg-white border border-yellow-300 rounded-lg hover:bg-yellow-50 whitespace-nowrap">Save anyway</button>
                  )}
                  <button type="submit" disabled={!!duplicateWarning && !forceSaveDuplicate} className="px-5 py-2 font-semibold text-white bg-gray-900 hover:bg-gray-800 rounded-lg shadow-sm transition-all whitespace-nowrap disabled:opacity-50 disabled:hover:bg-gray-900">Save Relationship</button>
                </div>
              </form>
            </div>
            )}

            {/* FILTER CONTROLS */}
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between text-[13px]">
              <div className="w-full md:w-auto flex-1 max-w-md">
                <input type="text" placeholder="Search profiles dynamically by name, email, country..." value={searchTerm} onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }} className="w-full px-3 py-1.5 border border-gray-200 dark:border-gray-700 bg-gray-50/30 dark:bg-gray-800 rounded-lg focus:outline-none focus:bg-white dark:focus:bg-gray-800 text-gray-900 dark:text-gray-100 dark:placeholder-gray-500" />
              </div>
              <div className="w-full md:w-auto flex flex-wrap items-center gap-2.5">
                <div className="flex items-center gap-1">
                  <span className="text-gray-400 text-[11px] font-semibold uppercase">Priority:</span>
                  <select value={filterPriority} onChange={e => { setFilterPriority(e.target.value); setCurrentPage(1); }} className="dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 border border-gray-200 dark:border-gray-700 rounded-md bg-white p-1 text-gray-700 focus:outline-none">
                    <option value="All">All Categories</option>
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                  </select>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-gray-400 text-[11px] font-semibold uppercase">Status:</span>
                  <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setCurrentPage(1); }} className="dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 border border-gray-200 dark:border-gray-700 rounded-md bg-white p-1 text-gray-700 focus:outline-none">
                    <option value="All">All Statuses</option>
                    {PIPELINE_STAGES.map(s => <option key={s} value={s}>{s}</option>)}
                    {/* Fallbacks for unmigrated data */}
                    <option value="Active">Legacy Active</option>
                    <option value="Inactive">Legacy Inactive</option>
                  </select>
                </div>
                {viewMode === 'table' && (
                  <div className="flex items-center gap-1">
                    <span className="text-gray-400 text-[11px] font-semibold uppercase">Sort:</span>
                    <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 border border-gray-200 dark:border-gray-700 rounded-md bg-white p-1 text-gray-700 focus:outline-none">
                      <option value="created_at_desc">Newest Added</option>
                      <option value="created_at_asc">Oldest Added</option>
                      <option value="name_asc">Name (A-Z)</option>
                      <option value="name_desc">Name (Z-A)</option>
                      <option value="score_desc">Score: High→Low</option>
                      <option value="score_asc">Score: Low→High</option>
                    </select>
                  </div>
                )}
                {/* FEATURE 29 — expand advanced filters */}
                <button onClick={() => setShowMoreFilters(!showMoreFilters)} className="relative px-3 py-1.5 border border-gray-200 rounded-md bg-white text-[12px] font-medium text-gray-700 hover:bg-gray-50">
                  More Filters
                  {activeFilterCount > 0 && <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-gray-900 text-white rounded-full text-[9px] font-bold flex items-center justify-center">{activeFilterCount}</span>}
                </button>
                {activeFilterCount > 0 && (
                  <button onClick={clearAllFilters} className="text-[12px] font-medium text-red-500 hover:text-red-700">Clear all filters</button>
                )}
              </div>
            </div>

            {/* FEATURE 29 — SAVED VIEWS PILLS */}
            <div className="flex flex-wrap items-center gap-2 text-[12px]">
              {BUILT_IN_VIEWS.map(v => (
                <button key={v.name} onClick={() => { clearAllFilters(); applyView(v.filters); }} className="px-3 py-1 rounded-full border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 font-medium">{v.name}</button>
              ))}
              {savedViews.map(v => (
                <span key={v.id} className="inline-flex items-center gap-1 px-3 py-1 rounded-full border border-indigo-200 bg-indigo-50 text-indigo-700 font-medium">
                  <button onClick={() => { clearAllFilters(); applyView(v.filters || {}); }}>{v.name}</button>
                  <button onClick={() => handleDeleteView(v.id)} className="hover:opacity-60 ml-0.5">×</button>
                </span>
              ))}
              {activeFilterCount > 0 && (
                savingViewName === null ? (
                  <button onClick={() => setSavingViewName('')} className="px-3 py-1 rounded-full border border-dashed border-gray-300 text-gray-500 hover:text-gray-800 font-medium">+ Save this view</button>
                ) : (
                  <form onSubmit={e => { e.preventDefault(); handleSaveView(savingViewName); }} className="inline-flex items-center gap-1">
                    <input autoFocus type="text" placeholder="View name..." value={savingViewName} onChange={e => setSavingViewName(e.target.value)} className="dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 px-2 py-1 border border-gray-200 dark:border-gray-700 rounded-full text-[12px] focus:outline-none" />
                    <button type="submit" className="px-2 py-1 bg-gray-900 text-white rounded-full text-[11px] font-medium">Save</button>
                    <button type="button" onClick={() => setSavingViewName(null)} className="text-gray-400 px-1">×</button>
                  </form>
                )
              )}
            </div>

            {/* FEATURE 29 — MORE FILTERS PANEL */}
            {showMoreFilters && (
              <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-[13px] animate-in fade-in">
                <div>
                  <label className="block text-[11px] font-semibold uppercase text-gray-400 mb-1">Date Added</label>
                  <select value={filterDateAdded} onChange={e => setFilterDateAdded(e.target.value)} className="dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 w-full border border-gray-200 dark:border-gray-700 rounded-md bg-white p-1.5 min-h-[44px] md:min-h-0 text-gray-700 focus:outline-none">
                    <option value="">Any time</option>
                    <option value="today">Today</option>
                    <option value="this_week">This week</option>
                    <option value="this_month">This month</option>
                    <option value="this_quarter">This quarter</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold uppercase text-gray-400 mb-1">Activity</label>
                  <select value={filterHasActivity} onChange={e => setFilterHasActivity(e.target.value)} className="dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 w-full border border-gray-200 dark:border-gray-700 rounded-md bg-white p-1.5 min-h-[44px] md:min-h-0 text-gray-700 focus:outline-none">
                    <option value="">Any</option>
                    <option value="none">No activity logged</option>
                    <option value="last_7">Active in last 7 days</option>
                    <option value="last_30">Active in last 30 days</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold uppercase text-gray-400 mb-1">Lead Score</label>
                  <select value={filterScore} onChange={e => setFilterScore(e.target.value)} className="dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 w-full border border-gray-200 dark:border-gray-700 rounded-md bg-white p-1.5 min-h-[44px] md:min-h-0 text-gray-700 focus:outline-none">
                    <option value="">Any</option>
                    <option value="high">High (75+)</option>
                    <option value="medium">Medium (50–74)</option>
                    <option value="low">Low (&lt;50)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold uppercase text-gray-400 mb-1">Health</label>
                  <select value={filterHealth} onChange={e => setFilterHealth(e.target.value)} className="dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 w-full border border-gray-200 dark:border-gray-700 rounded-md bg-white p-1.5 min-h-[44px] md:min-h-0 text-gray-700 focus:outline-none">
                    <option value="">Any</option>
                    {['Excellent', 'Good', 'Fair', 'At Risk', 'Critical'].map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold uppercase text-gray-400 mb-1">Source</label>
                  <select value={filterSource} onChange={e => setFilterSource(e.target.value)} className="dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 w-full border border-gray-200 dark:border-gray-700 rounded-md bg-white p-1.5 min-h-[44px] md:min-h-0 text-gray-700 focus:outline-none">
                    <option value="">Any</option>
                    <option value="Unknown">Unknown / not set</option>
                    {CLIENT_SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <input id="filter-has-deals" type="checkbox" checked={filterHasDeals} onChange={e => setFilterHasDeals(e.target.checked)} className="dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 rounded border-gray-300 dark:border-gray-600 text-gray-900 focus:ring-0" />
                  <label htmlFor="filter-has-deals" className="text-[12px] font-medium text-gray-700">Has at least one deal</label>
                </div>
                {tags.length > 0 && (
                  <div className="sm:col-span-2 lg:col-span-3">
                    <label className="block text-[11px] font-semibold uppercase text-gray-400 mb-1">Tags (must have all selected)</label>
                    <div className="flex flex-wrap gap-1.5">
                      {tags.map(t => (
                        <button key={t.id} onClick={() => setFilterTags(prev => prev.includes(t.id) ? prev.filter(x => x !== t.id) : [...prev, t.id])}
                          className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border transition-all ${filterTags.includes(t.id) ? 'ring-2 ring-offset-1 ring-gray-400' : 'opacity-70 hover:opacity-100'}`}
                          style={{ backgroundColor: t.color + '22', color: t.color, borderColor: t.color + '44' }}>
                          {t.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* BULK ACTIONS BAR (Table mode only) */}
            {viewMode === 'table' && selectedClientIds.length > 0 && (
              <div className="bg-blue-50 border border-blue-100 p-3 rounded-lg flex items-center justify-between animate-in fade-in">
                <span className="text-[13px] font-medium text-blue-800">{selectedClientIds.length} relationships selected</span>
                <div className="flex flex-wrap items-center gap-2">
                  <select onChange={e => {if(e.target.value) handleBulkStatusUpdate(e.target.value); e.target.value='';}} className="dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 px-3 py-1.5 bg-white border border-gray-200 dark:border-gray-700 text-gray-700 rounded-md text-[12px] font-medium hover:bg-gray-50 outline-none">
                    <option value="">Change Status...</option>
                    {PIPELINE_STAGES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <button onClick={() => setShowBulkEmailModal(true)} className="px-3 py-1.5 bg-indigo-600 text-white rounded-md text-[12px] font-medium hover:bg-indigo-700 shadow-sm">Bulk Email</button>
                  {sequences.length > 0 && (
                    <select onChange={e => { if (e.target.value) handleBulkEnrollInSequence(e.target.value); e.target.value = ''; }} className="dark:bg-gray-800 dark:text-gray-100 px-3 py-1.5 bg-white border border-gray-200 dark:border-gray-700 text-gray-700 rounded-md text-[12px] font-medium hover:bg-gray-50 outline-none">
                      <option value="">Enroll in sequence...</option>
                      {sequences.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  )}
                  <button onClick={handleBulkDelete} className="px-3 py-1.5 bg-red-600 text-white rounded-md text-[12px] font-medium hover:bg-red-700 shadow-sm">Delete Selected</button>
                </div>
              </div>
            )}

            {/* DATA VIEW CONTAINER */}
            {loadingClients ? (
              <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm"><SkeletonRows rows={6} /></div>
            ) : filteredAndSortedClients.length === 0 ? (
              <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
                {clients.length === 0 ? (
                  <EmptyState
                    title="No relationships yet"
                    desc="Add your first relationship to start tracking."
                    ctaLabel="Add Your First Relationship"
                    onCta={() => document.getElementById('add-client-form')?.scrollIntoView({ behavior: 'smooth' })}
                  />
                ) : (
                  <EmptyState title="No matching records" desc="Try adjusting or clearing your filters." ctaLabel="Clear all filters" onCta={clearAllFilters} />
                )}
              </div>
            ) : (
              viewMode === 'table' ? (
                /* ------------------- TABLE VIEW ------------------- */
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow overflow-hidden animate-in fade-in">
                  {/* FEATURE 12 — mobile card layout */}
                  <div className="block md:hidden space-y-3 p-3">
                    {paginatedClients.map(client => {
                      const isSelected = selectedClientIds.includes(client.id);
                      return (
                        <div key={client.id} className={`relative p-4 rounded-xl border ${isSelected ? 'border-gray-400 bg-gray-50' : 'border-gray-200 bg-white'}`}>
                          <input type="checkbox" checked={isSelected} onChange={() => handleSelectRow(client.id)} className="dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 absolute top-4 left-4 rounded border-gray-300 dark:border-gray-600 text-gray-900 focus:ring-0" />
                          <div className="pl-8">
                            <p className="text-[14px] font-bold text-gray-900">{client.name} {client.quick_note && <span className="text-[12px]">📝</span>}</p>
                            <p className="text-[12px] text-gray-500 break-all">{client.email}</p>
                            <div className="flex flex-wrap items-center gap-2 mt-2">
                              <span className="text-[11px] font-bold text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full">{client.status}</span>
                              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ring-1 ring-inset ${client.relationship === 'High' ? 'bg-red-50 text-red-700 ring-red-600/10' : client.relationship === 'Medium' ? 'bg-orange-50 text-orange-700 ring-orange-600/10' : 'bg-blue-50 text-blue-700 ring-blue-600/10'}`}>{client.relationship}</span>
                              <ScoreBar score={client.leadScore || 0} />
                            </div>
                            <div className="flex gap-4 mt-3 text-[13px] font-medium">
                              <button onClick={() => setViewingClient(client)} className="text-gray-600 min-h-[44px]">View</button>
                              <button onClick={() => {
                                setEditingClient(client);
                                const cfs = {};
                                customFieldDefs.forEach(def => {
                                  const existing = customFieldValues.find(v => v.client_id === client.id && v.field_definition_id === def.id);
                                  cfs[def.id] = existing ? existing.value : '';
                                });
                                setFormCustomValues(cfs);
                              }} className="text-gray-900 min-h-[44px]">Edit</button>
                              <button onClick={() => handleDeleteClient(client.id)} className="text-red-600 min-h-[44px]">Delete</button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="overflow-x-auto hidden md:block">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-gray-50/70 border-b border-gray-200 text-[11px] font-bold uppercase tracking-wider text-gray-400 select-none">
                          <th className="p-4 w-10 text-center">
                            <input type="checkbox" checked={paginatedClients.length > 0 && paginatedClients.every(c => selectedClientIds.includes(c.id))} onChange={(e) => handleSelectAll(e, paginatedClients)} className="dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 rounded border-gray-300 dark:border-gray-600 text-gray-900 focus:ring-0" />
                          </th>
                          <th className="p-4">Relationship</th>
                          <th className="p-4">Tags</th>
                          <th className="p-4">Priority</th>
                          <th className="p-4">Score</th>
                          <th className="p-4">Pipeline Stage</th>
                          <th className="p-4">Health</th>
                          <th className="p-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 text-[13px] font-medium text-gray-800">
                        {paginatedClients.map(client => {
                          const isSelected = selectedClientIds.includes(client.id);
                          return (
                            <tr key={client.id} className={`hover:bg-gray-50/60 transition-colors ${isSelected ? 'bg-gray-50/80' : ''}`}>
                              <td className="p-4 text-center">
                                <input type="checkbox" checked={isSelected} onChange={() => handleSelectRow(client.id)} className="dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 rounded border-gray-300 dark:border-gray-600 text-gray-900 focus:ring-0" />
                              </td>
                              <td className="p-4">
                                <div>
                                  <span className="font-semibold text-gray-900 text-[14px] flex items-center gap-1.5">
                                    {/* G17 — company logo in the table row */}
                                    {companyFaviconUrl(client.company_url) && (
                                      // eslint-disable-next-line @next/next/no-img-element
                                      <img src={companyFaviconUrl(client.company_url, 32)} alt="" className="w-4 h-4 rounded shrink-0" loading="lazy" onError={e => { e.currentTarget.style.display = 'none'; }} />
                                    )}
                                    {client.name}
                                    {client.quick_note && <span className="ml-1.5 text-[12px]" title={client.quick_note.slice(0, 60)}>📝</span>}
                                  </span>
                                  <span className="text-[11px] text-gray-400 block font-normal mt-0.5">{client.email}</span>
                                  <CompanyLink client={client} className="text-[11px] mt-0.5" />
                                </div>
                              </td>
                              <td className="p-4">
                                <div className="flex flex-wrap gap-1 max-w-[140px]">
                                  {(clientTagMap[client.id] || []).slice(0, 3).map(tid => {
                                    const t = tags.find(x => x.id === tid);
                                    return t ? <TagPill key={tid} tag={t} /> : null;
                                  })}
                                  {(clientTagMap[client.id] || []).length > 3 && <span className="text-[11px] text-gray-400 font-medium">+{(clientTagMap[client.id] || []).length - 3}</span>}
                                </div>
                              </td>
                              <td className="p-4">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ring-1 ring-inset ${
                                  client.relationship === 'High' ? 'bg-red-50 text-red-700 ring-red-600/10' :
                                  client.relationship === 'Medium' ? 'bg-orange-50 text-orange-700 ring-orange-600/10' :
                                  'bg-blue-50 text-blue-700 ring-blue-600/10'
                                }`}>
                                  {client.relationship || 'Low'}
                                </span>
                              </td>
                              <td className="p-4"><ScoreBar score={client.leadScore || 0} /></td>
                              <td className="p-4">
                                <span className={`inline-flex items-center gap-1 text-[12px] font-bold ${
                                  client.status === 'New' ? 'text-blue-600' : 
                                  client.status === 'Contacted' ? 'text-orange-500' :
                                  client.status === 'Engaged' ? 'text-indigo-500' :
                                  client.status === 'Active' ? 'text-green-600' : 'text-gray-400'
                                }`}>
                                  <span className={`w-1.5 h-1.5 rounded-full ${
                                    client.status === 'New' ? 'bg-blue-500' : 
                                    client.status === 'Contacted' ? 'bg-orange-500' :
                                    client.status === 'Engaged' ? 'bg-indigo-500' :
                                    client.status === 'Active' ? 'bg-green-500' : 'bg-gray-400'
                                  }`}></span>
                                  {client.status}
                                </span>
                              </td>
                              <td className="p-4">
                                {(() => {
                                  const h = healthByClientId[client.id];
                                  const cls = { Excellent: 'bg-green-50 text-green-700 ring-green-600/10', Good: 'bg-teal-50 text-teal-700 ring-teal-600/10', Fair: 'bg-yellow-50 text-yellow-700 ring-yellow-600/20', 'At Risk': 'bg-orange-50 text-orange-700 ring-orange-600/10', Critical: 'bg-red-50 text-red-700 ring-red-600/10' }[h] || 'bg-gray-50 text-gray-500 border-gray-100';
                                  return <button onClick={() => setFilterHealth(h)} className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold ring-1 ring-inset ${cls}`}>{h}</button>;
                                })()}
                              </td>
                              <td className="p-4 text-right font-normal">
                                <div className="flex justify-end gap-3 text-[12px] font-medium">
                                  <button onClick={() => setViewingClient(client)} className="text-gray-500 hover:text-gray-900 transition-colors">View</button>
                                  <button onClick={() => { setTimelineClient(client); setAppStep('CLIENT_TIMELINE'); }} className="text-gray-500 hover:text-gray-900 transition-colors">Timeline</button>
                                  <button onClick={() => { setMergeSource(client); setMergeTarget(null); setMergeStep(1); setMergeFieldChoices({}); setMergeSearch(''); setShowMergeTool(true); }} className="text-gray-500 hover:text-gray-900 transition-colors">Merge</button>
                                  <button onClick={() => {
                                    setEditingClient(client);
                                    // Preload custom fields into form
                                    const cfs = {};
                                    customFieldDefs.forEach(def => {
                                      const existing = customFieldValues.find(v => v.client_id === client.id && v.field_definition_id === def.id);
                                      cfs[def.id] = existing ? existing.value : '';
                                    });
                                    setFormCustomValues(cfs);
                                  }} className="text-gray-900 hover:underline">Edit</button>
                                  <button onClick={() => handleDeleteClient(client.id)} className="text-red-600 hover:text-red-900 transition-colors">Delete</button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  {totalPages > 1 && (
                    <div className="p-4 border-t border-gray-100 bg-gray-50/50 dark:bg-gray-800/40 flex items-center justify-between text-[12px] font-semibold text-gray-500">
                      <span>Displaying page {currentPage} of {totalPages}</span>
                      <div className="flex items-center gap-1.5">
                        <button disabled={currentPage === 1} onClick={() => setCurrentPage(currentPage - 1)} className="px-3 py-1.5 border border-gray-200 rounded-md bg-white hover:bg-gray-50 disabled:opacity-40 transition-colors">Prev</button>
                        <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(currentPage + 1)} className="px-3 py-1.5 border border-gray-200 rounded-md bg-white hover:bg-gray-50 disabled:opacity-40 transition-colors">Next</button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* ------------------- BOARD VIEW (KANBAN) ------------------- */
                <div className="flex gap-4 overflow-x-auto pb-4 h-[70vh] animate-in fade-in" style={{ scrollSnapType: 'x mandatory' }}>
                  {PIPELINE_STAGES.map(stage => {
                    const columnClients = filteredAndSortedClients.filter(c => c.status === stage);
                    return (
                      <div
                        key={stage}
                        className="flex-shrink-0 w-[280px] bg-gray-200/50 rounded-2xl flex flex-col border border-gray-100"
                        style={{ scrollSnapAlign: 'start' }}
                        onDragOver={handleDragOver}
                        onDrop={e => handleDrop(e, stage)}
                      >
                        <div className="p-4 border-b border-gray-200 bg-gray-100/50 rounded-t-2xl flex justify-between items-center">
                          <h4 className="text-[14px] font-bold text-gray-800">{stage}</h4>
                          <span className="text-[12px] font-semibold text-gray-500 bg-white border border-gray-200 px-2 py-0.5 rounded-full">{columnClients.length}</span>
                        </div>
                        <div className="p-3 flex-1 overflow-y-auto space-y-3">
                          {columnClients.map(client => {
                            const clActs = activities.filter(a => a.client_id === client.id);
                            const lastAct = clActs.length > 0 ? clActs[0].activity_date : (client.created_at ? new Date(client.created_at).toISOString().split('T')[0] : 'N/A');
                            
                            return (
                              <div 
                                key={client.id}
                                draggable
                                onDragStart={e => handleDragStart(e, client.id)}
                                onClick={() => setViewingClient(client)}
                                className="bg-white dark:bg-gray-900 p-3.5 rounded-xl border border-gray-100 dark:border-gray-800 border-l-4 shadow-sm hover:shadow-md active:shadow-lg transition-shadow cursor-grab active:cursor-grabbing flex flex-col gap-2 relative group"
                                style={{ borderLeftColor: STAGE_COLORS[stage] || '#9CA3AF' }}
                              >
                                <div className="flex justify-between items-start">
                                  <p className="text-[13px] font-bold text-gray-900 leading-tight pr-4">{client.name}</p>
                                  <span className={`shrink-0 text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full ring-1 ring-inset ${
                                    client.relationship === 'High' ? 'bg-red-50 text-red-700 ring-red-600/10' :
                                    client.relationship === 'Medium' ? 'bg-orange-50 text-orange-700 ring-orange-600/10' :
                                    'bg-blue-50 text-blue-700 ring-blue-600/10'
                                  }`}>{client.relationship}</span>
                                </div>
                                <div className="text-[11px] text-gray-500 truncate">{client.email}</div>
                                <div className="text-[10px] font-medium text-gray-400 mt-2 flex items-center justify-between">
                                  <span>Activity: {lastAct}</span>
                                  {tasks.filter(t => t.client_id === client.id && t.status === 'pending').length > 0 && (
                                    <span className="text-red-500 font-bold flex items-center gap-1"><BellIcon /> Task</span>
                                  )}
                                </div>
                              </div>
                            )
                          })}
                          {columnClients.length === 0 && (
                            <div className="border-2 border-dashed border-gray-300 rounded-xl h-24 flex items-center justify-center text-[12px] text-gray-400 font-medium">Drop here</div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            )}
          </div>
        )}

        {/* VIEW: DEALS (Feature 1) */}
        {appStep === 'DEALS' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-100 mb-1">Deals Pipeline</h1>
                <p className="text-[13px] text-gray-500">Track opportunities, forecast revenue, and close more deals.</p>
              </div>
              {canEdit && (
                <button onClick={() => { resetDealForm(); setShowDealForm(true); }} className="px-4 py-2 text-[13px] font-semibold text-white bg-gray-900 dark:bg-gray-100 dark:text-gray-900 rounded-xl hover:opacity-90 transition-colors shadow-sm">+ New Deal</button>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                ['Total Pipeline', fmtMoney(pipelineValue)],
                ['Weighted Forecast', fmtMoney(weightedForecast)],
                ['Won', fmtMoney(wonValue)],
                ['Deal Count', deals.length],
              ].map(([label, value]) => (
                <div key={label} className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-md transition-shadow">
                  <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">{label}</p>
                  <p className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100 mt-1">{value}</p>
                </div>
              ))}
            </div>

            {/* PART C3 — drill-down stage filter (set from Reports) */}
            {dealsStageFilter && (
              <div className="flex items-center gap-2 p-3 bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-100 dark:border-indigo-800 rounded-lg text-[13px] font-medium text-indigo-800 dark:text-indigo-300">
                Showing only <span className="font-bold">{dealsStageFilter}</span> deals
                <button onClick={() => setDealsStageFilter('')} className="ml-auto px-2 py-0.5 rounded-full bg-white dark:bg-gray-800 border border-indigo-200 dark:border-indigo-700 text-[12px] hover:bg-indigo-100">Show all stages ×</button>
              </div>
            )}

            {deals.length === 0 ? (
              <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
                <EmptyState
                  title="No deals yet"
                  desc="Create your first deal to start tracking your pipeline."
                  ctaLabel={canEdit ? 'Create Deal' : undefined}
                  onCta={canEdit ? () => { resetDealForm(); setShowDealForm(true); } : undefined}
                />
              </div>
            ) : (
              <div className="flex gap-4 overflow-x-auto pb-4 animate-in fade-in" style={{ scrollSnapType: 'x mandatory' }}>
                {(dealsStageFilter ? DEAL_STAGES.filter(s => s === dealsStageFilter) : DEAL_STAGES).map(stage => {
                  const stageDeals = deals.filter(d => d.stage === stage);
                  const stageValue = stageDeals.reduce((s, d) => s + toUSD(d.value, d.currency), 0);
                  return (
                    <div key={stage} className="flex-shrink-0 w-[280px] bg-gray-200/50 dark:bg-gray-800/60 rounded-2xl flex flex-col border border-gray-100 dark:border-gray-800"
                      style={{ scrollSnapAlign: 'start' }}
                      onDragOver={handleDragOver} onDrop={e => handleDealDrop(e, stage)}>
                      <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-100/50 dark:bg-gray-800 rounded-t-2xl flex justify-between items-center">
                        <div>
                          <h4 className="text-[14px] font-bold text-gray-800 dark:text-gray-100">{stage}</h4>
                          <p className="text-[11px] text-gray-400">{fmtMoney(stageValue)}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[12px] font-semibold text-gray-500 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 px-2 py-0.5 rounded-full">{stageDeals.length}</span>
                          {canEdit && <button onClick={() => { resetDealForm(); setDealStage(stage); setShowDealForm(true); }} className="w-6 h-6 rounded-full bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-500 hover:text-gray-900 dark:hover:text-gray-100 text-[14px] font-bold leading-none">+</button>}
                        </div>
                      </div>
                      <div className="p-3 flex-1 overflow-y-auto space-y-3 min-h-[100px] max-h-[60vh]">
                        {stageDeals.map(deal => {
                          const dealClient = clients.find(c => c.id === deal.client_id);
                          return (
                            <div key={deal.id} draggable onDragStart={e => handleDealDragStart(e, deal.id)}
                              className="bg-white dark:bg-gray-900 p-3.5 rounded-xl border border-gray-100 dark:border-gray-800 border-l-4 shadow-sm hover:shadow-md active:shadow-lg transition-shadow cursor-grab active:cursor-grabbing flex flex-col gap-2 group"
                              style={{ borderLeftColor: STAGE_COLORS[stage] || '#9CA3AF' }}>
                              <div className="flex justify-between items-start gap-2">
                                <p className="text-[13px] font-bold text-gray-900 dark:text-gray-100 leading-tight">{deal.title}</p>
                                <span className="shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 ring-1 ring-inset ring-indigo-600/20 dark:ring-indigo-400/30">{deal.probability}%</span>
                              </div>
                              <div className="text-[11px] text-gray-500 truncate">{dealClient?.name || 'Unknown relationship'}</div>
                              <div className="flex items-center justify-between">
                                <span className="text-[13px] font-bold text-gray-900 dark:text-gray-100">
                                  {fmtCurrency(deal.value, deal.currency)}
                                  {(deal.currency || 'USD') !== 'USD' && (
                                    <span className="ml-1 text-[10px] font-medium text-gray-400" title="Approximate USD (static rate)">≈ {fmtMoney(toUSD(deal.value, deal.currency))} USD</span>
                                  )}
                                </span>
                                {deal.close_date && <span className="text-[10px] text-gray-400">Close: {deal.close_date}</span>}
                              </div>
                              {canEdit && (
                                <div className="flex gap-2 text-[11px] font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button onClick={() => {
                                    setEditingDeal(deal); setDealTitle(deal.title); setDealValue(String(deal.value ?? ''));
                                    setDealCurrency(deal.currency || 'USD');
                                    setDealIsRecurring(!!deal.is_recurring); setDealBillingCycle(deal.billing_cycle || 'monthly'); setDealRenewalDate(deal.renewal_date || '');
                                    setDealStage(deal.stage); setDealProbability(deal.probability ?? 50);
                                    setDealCloseDate(deal.close_date || ''); setDealNotes(deal.notes || '');
                                    setDealClientId(String(deal.client_id)); setShowDealForm(true);
                                  }} className="text-gray-500 hover:text-gray-900 dark:hover:text-gray-100">Edit</button>
                                  {canDelete && <button onClick={() => handleDeleteDeal(deal)} className="text-red-500 hover:text-red-700">Delete</button>}
                                </div>
                              )}
                            </div>
                          );
                        })}
                        {stageDeals.length === 0 && (
                          <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl h-20 flex items-center justify-center text-[12px] text-gray-400 font-medium">Drop here</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* VIEW: REPORTS (Feature 3) */}
        {appStep === 'REPORTS' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-100 mb-1">Reports</h1>
                <p className="text-[13px] text-gray-500">Analytics across relationships, activities, deals, and tasks.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="bg-gray-200/50 dark:bg-gray-800 p-1 rounded-lg flex items-center gap-1">
                  {[['7', '7d'], ['30', '30d'], ['90', '90d'], ['365', '1yr']].map(([v, label]) => (
                    <button key={v} onClick={() => setReportRange(v)} className={`px-3 py-1.5 text-[12px] font-medium rounded-md transition-all ${reportRange === v ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>{label}</button>
                  ))}
                </div>
                {/* PART C2 — period comparison toggle */}
                <button onClick={() => setCompareReports(!compareReports)} className={`px-3 py-1.5 text-[12px] font-medium rounded-lg border transition-all ${compareReports ? 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 border-gray-900 dark:border-gray-100' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'}`}>
                  Compare to previous period {compareReports ? '✓' : ''}
                </button>
              </div>
            </div>

            {/* PART C4 — saved report pills */}
            {customReports.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 text-[12px]">
                <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Saved reports:</span>
                {customReports.map(r => (
                  <span key={r.id} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 font-medium">
                    <button onClick={() => applyCustomReport(r)}>{r.name}</button>
                    <button onClick={() => handleCycleReportFrequency(r)} title="Cycle email schedule: off → weekly → monthly" className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${r.send_frequency ? 'bg-indigo-600 text-white' : 'bg-indigo-100 dark:bg-indigo-900/60 text-indigo-400'}`}>
                      ✉ {r.send_frequency === 'weekly' ? 'wk' : r.send_frequency === 'monthly' ? 'mo' : 'off'}
                    </button>
                    <button onClick={() => handleDeleteCustomReport(r.id)} className="hover:opacity-60">×</button>
                  </span>
                ))}
              </div>
            )}

            {/* PART C1 — CUSTOM REPORT BUILDER */}
            <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-md transition-shadow space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-[14px] font-semibold text-gray-900 dark:text-gray-100">Build Custom Report</h3>
                <div className="flex flex-wrap items-center gap-2">
                  {/* PART C5 — CSV export of the displayed table */}
                  <button onClick={exportCustomReportCSV} className="px-3 py-1.5 text-[12px] font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 shadow-sm">Export CSV</button>
                  {savingReportName === null ? (
                    <button onClick={() => setSavingReportName('')} className="px-3 py-1.5 text-[12px] font-semibold text-white bg-gray-900 dark:bg-gray-100 dark:text-gray-900 rounded-xl hover:opacity-90 shadow-sm">Save this report</button>
                  ) : (
                    <form onSubmit={e => { e.preventDefault(); handleSaveCustomReport(savingReportName); }} className="inline-flex items-center gap-1">
                      <input autoFocus type="text" placeholder="Report name..." value={savingReportName} onChange={e => setSavingReportName(e.target.value)} className="px-2 py-1.5 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg text-[12px] focus:outline-none" />
                      <button type="submit" className="px-3 py-1.5 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded-lg text-[12px] font-medium">Save</button>
                      <button type="button" onClick={() => setSavingReportName(null)} className="text-gray-400 px-1">×</button>
                    </form>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-[13px]">
                <div>
                  <label className="block text-[11px] font-semibold uppercase text-gray-400 mb-1">Dimension (group by)</label>
                  <select value={customDimension} onChange={e => setCustomDimension(e.target.value)} className="w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg bg-white p-2 text-gray-700 focus:outline-none">
                    {['Stage', 'Priority', 'Source', 'Tag', 'Month Added'].map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold uppercase text-gray-400 mb-1">Metric</label>
                  <select value={customMetric} onChange={e => setCustomMetric(e.target.value)} className="w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg bg-white p-2 text-gray-700 focus:outline-none">
                    {['Count', 'Total Deal Value', 'Avg Lead Score', 'Activity Count'].map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold uppercase text-gray-400 mb-1">Date grouping {customDimension !== 'Month Added' && <span className="normal-case font-normal">(for "Month Added")</span>}</label>
                  <select value={customDateGrouping} onChange={e => setCustomDateGrouping(e.target.value)} disabled={customDimension !== 'Month Added'} className="w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg bg-white p-2 text-gray-700 focus:outline-none disabled:opacity-50">
                    {[['day', 'Day'], ['week', 'Week'], ['month', 'Month']].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
              </div>
              {customReportData.length === 0 ? (
                <p className="text-[13px] text-gray-400 text-center py-6">No data for this configuration yet.</p>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Bar chart (same pure-Tailwind pattern as the fixed charts) */}
                  <div className="space-y-2.5">
                    {customReportData.map(row => {
                      const max = Math.max(...customReportData.map(r => r.value), 1);
                      return (
                        <button key={row.label} onClick={() => drillCustomDimension(row.label)} disabled={customDimension === 'Month Added'} className="w-full flex items-center gap-3 group disabled:cursor-default">
                          <span className="text-[12px] font-medium text-gray-600 dark:text-gray-300 w-28 truncate text-left group-hover:text-gray-900 dark:group-hover:text-gray-100" title={row.label}>{row.label}</span>
                          <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-full h-4 overflow-hidden">
                            <div className="anim-grow-w h-full rounded-full bg-indigo-500 transition-all duration-500" style={{ width: `${(row.value / max) * 100}%` }} />
                          </div>
                          <span className="text-[12px] font-bold text-gray-900 dark:text-gray-100 w-16 text-right">{fmtCustomValue(row.value)}</span>
                        </button>
                      );
                    })}
                  </div>
                  {/* Table */}
                  <div className="overflow-y-auto max-h-64 border border-gray-100 dark:border-gray-700 rounded-xl">
                    <table className="w-full text-left text-[12px]">
                      <thead className="sticky top-0 bg-gray-50 dark:bg-gray-700">
                        <tr className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                          <th className="p-2.5">{customDimension}</th>
                          <th className="p-2.5 text-right">{customMetric}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
                        {customReportData.map(row => (
                          <tr key={row.label} onClick={() => drillCustomDimension(row.label)} className={customDimension !== 'Month Added' ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50' : ''}>
                            <td className="p-2.5 font-semibold text-gray-900 dark:text-gray-100">{row.label}</td>
                            <td className="p-2.5 text-right font-bold text-gray-900 dark:text-gray-100">{fmtCustomValue(row.value)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Stat tiles — clickable (C3) with prior-period deltas (C2) */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
              {[
                ['Relationships', clients.length, () => { clearAllFilters(); setAppStep('CLIENTS'); }],
                ['Activities', reportStats.activitiesInRange.length, () => { clearAllFilters(); setFilterHasActivity(reportRange === '7' ? 'last_7' : 'last_30'); setAppStep('CLIENTS'); }],
                ['Pipeline $', fmtMoney(pipelineValue), () => { setDealsStageFilter(''); setAppStep('DEALS'); }],
                ['Win Rate', `${reportStats.winRate}%`, () => { setDealsStageFilter('Won'); setAppStep('DEALS'); }],
                ['Task Completion', `${reportStats.taskCompletionRate}%`, () => setAppStep('GLOBAL_TASKS')],
                ['Avg Act/Relationship', reportStats.avgActivitiesPerClient, () => { clearAllFilters(); setAppStep('CLIENTS'); }],
              ].map(([label, value, onClick]) => (
                <button key={label} onClick={onClick} className="bg-white dark:bg-gray-900 p-4 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm text-left hover:shadow-md hover:border-gray-300 dark:hover:border-gray-500 transition-all">
                  <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">{label}</p>
                  <p className="text-xl font-bold tracking-tight text-gray-900 dark:text-gray-100 mt-1">{value}</p>
                  {compareReports && comparisonStats?.[label] && (
                    <DeltaBadge current={comparisonStats[label][0]} prev={comparisonStats[label][1]} />
                  )}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Chart 1 — Activity by type */}
              <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-md transition-shadow">
                <h3 className="text-[14px] font-semibold text-gray-900 dark:text-gray-100 mb-4">Activity by Type</h3>
                <div className="space-y-3">
                  {Object.entries(reportStats.activityByType).map(([type, count]) => {
                    const max = Math.max(...Object.values(reportStats.activityByType), 1);
                    const color = { Note: 'bg-gray-400', Call: 'bg-blue-500', Email: 'bg-green-500', Meeting: 'bg-purple-500' }[type];
                    return (
                      <button key={type} onClick={() => { setCalendarView('agenda'); setAppStep('CALENDAR'); }} className="w-full flex items-center gap-3 group" title="See activities in the Calendar agenda">
                        <span className="text-[12px] font-medium text-gray-600 dark:text-gray-300 w-16 text-left group-hover:text-gray-900 dark:group-hover:text-gray-100">{type}</span>
                        <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-full h-4 overflow-hidden">
                          <div className={`anim-grow-w h-full rounded-full ${color} transition-all duration-500`} style={{ width: `${(count / max) * 100}%` }} />
                        </div>
                        <span className="text-[12px] font-bold text-gray-900 dark:text-gray-100 w-8 text-right">{count}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Chart 2 — Pipeline funnel */}
              <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-md transition-shadow">
                <h3 className="text-[14px] font-semibold text-gray-900 dark:text-gray-100 mb-4">Pipeline Funnel</h3>
                <div className="space-y-3">
                  {PIPELINE_STAGES.map(stage => {
                    const count = reportStats.clientsByStage[stage] || 0;
                    const max = Math.max(...Object.values(reportStats.clientsByStage), 1);
                    return (
                      <button key={stage} onClick={() => { clearAllFilters(); setFilterStatus(stage); setAppStep('CLIENTS'); }} className="w-full flex items-center gap-3 group" title={`View ${stage} relationships`}>
                        <span className="text-[12px] font-medium text-gray-600 dark:text-gray-300 w-20 text-left group-hover:text-gray-900 dark:group-hover:text-gray-100">{stage}</span>
                        <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-full h-4 overflow-hidden">
                          <div className="anim-grow-w h-full rounded-full bg-indigo-500 transition-all duration-500" style={{ width: `${(count / max) * 100}%` }} />
                        </div>
                        <span className="text-[12px] font-bold text-gray-900 dark:text-gray-100 w-8 text-right">{count}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Chart 3 — Deal stages */}
              <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-md transition-shadow">
                <h3 className="text-[14px] font-semibold text-gray-900 dark:text-gray-100 mb-4">Deal Stages</h3>
                <div className="space-y-2">
                  {DEAL_STAGES.map(stage => {
                    const s = reportStats.dealsByStage[stage] || { count: 0, value: 0 };
                    const pct = deals.length > 0 ? Math.round((s.count / deals.length) * 100) : 0;
                    return (
                      <button key={stage} onClick={() => { setDealsStageFilter(stage); setAppStep('DEALS'); }} className="w-full flex items-center gap-3 py-1.5 border-b border-gray-50 dark:border-gray-700/50 last:border-0 group" title={`View ${stage} deals`}>
                        <span className="text-[12px] font-medium text-gray-600 dark:text-gray-300 w-28 text-left group-hover:text-gray-900 dark:group-hover:text-gray-100">{stage}</span>
                        <span className="text-[12px] text-gray-500 w-8 text-left">{s.count}</span>
                        <span className="text-[12px] font-bold text-gray-900 dark:text-gray-100 w-20 text-left">{fmtMoney(s.value)}</span>
                        <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-full h-1.5 overflow-hidden">
                          <div className="anim-grow-w h-full rounded-full bg-gray-900 dark:bg-gray-300" style={{ width: `${pct}%` }} />
                        </div>
                      </button>
                    );
                  })}
                </div>
                {reportStats.avgResponseTime && (
                  <p className="text-[11px] text-gray-400 mt-3">Avg. time between activities: ~{reportStats.avgResponseTime} days (approx)</p>
                )}
              </div>

              {/* Chart 4 — Clients added over time */}
              <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-md transition-shadow flex flex-col">
                <h3 className="text-[14px] font-semibold text-gray-900 dark:text-gray-100 mb-4">Relationships Added (8 Weeks)</h3>
                <div className="flex-1 flex items-end gap-2 h-32 mt-auto pb-2">
                  {reportStats.clientsAddedByWeek.map((w, i) => {
                    const max = Math.max(...reportStats.clientsAddedByWeek.map(x => x.count), 1);
                    return (
                      <div key={i} className="hover-lift flex-1 flex flex-col items-center gap-2 group relative">
                        <div className="w-full bg-indigo-100 dark:bg-indigo-900/40 rounded-sm relative overflow-hidden" style={{ height: '100px' }}>
                          <div className="anim-grow-h absolute bottom-0 w-full bg-indigo-500 transition-all duration-500" style={{ height: `${(w.count / max) * 100}%` }} />
                        </div>
                        <span className="text-[9px] text-gray-400">{w.label}</span>
                        <div className="absolute -top-8 bg-gray-900 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">{w.count}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Chart 5 — Clients by source (Feature 25) */}
              <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-md transition-shadow">
                <h3 className="text-[14px] font-semibold text-gray-900 dark:text-gray-100 mb-4">Relationships by Source</h3>
                <div className="space-y-3">
                  {CLIENT_SOURCES.map(source => {
                    const count = reportStats.clientsBySource[source] || 0;
                    const max = Math.max(...Object.values(reportStats.clientsBySource), 1);
                    return (
                      <button key={source} onClick={() => { clearAllFilters(); setFilterSource(source); setAppStep('CLIENTS'); }} className="w-full flex items-center gap-3 group" title={`View relationships from ${source}`}>
                        <span className="text-[12px] font-medium text-gray-600 dark:text-gray-300 w-24 text-left group-hover:text-gray-900 dark:group-hover:text-gray-100">{source}</span>
                        <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-full h-4 overflow-hidden">
                          <div className="anim-grow-w h-full rounded-full bg-teal-500 transition-all duration-500" style={{ width: `${(count / max) * 100}%` }} />
                        </div>
                        <span className="text-[12px] font-bold text-gray-900 dark:text-gray-100 w-8 text-right">{count}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Table — Most active clients */}
              <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-md transition-shadow">
                <h3 className="text-[14px] font-semibold text-gray-900 dark:text-gray-100 mb-4">Most Active Relationships</h3>
                {reportStats.topClientsByActivity.length === 0 ? (
                  <p className="text-[13px] text-gray-400">No activities logged in this range.</p>
                ) : (
                  <div className="space-y-2">
                    {reportStats.topClientsByActivity.map((x, i) => (
                      <div key={x.client.id} className="flex items-center gap-3 py-2 border-b border-gray-50 dark:border-gray-700/50 last:border-0">
                        <span className="text-[12px] font-bold text-gray-400 w-5">#{i + 1}</span>
                        <span className="text-[13px] font-semibold text-gray-900 dark:text-gray-100 flex-1 truncate">{x.client.name}</span>
                        <span className="text-[11px] font-bold text-gray-500 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full">{x.client.status}</span>
                        <span className="text-[12px] font-bold text-gray-900 dark:text-gray-100">{x.count}</span>
                        <button onClick={() => { setViewingClient(x.client); setAppStep('CLIENTS'); }} className="text-[12px] text-gray-500 hover:text-gray-900 dark:hover:text-gray-100 font-medium">View</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* VIEW: CALENDAR (Feature 8) */}
        {appStep === 'CALENDAR' && (() => {
          const y = calendarDate.getFullYear();
          const m = calendarDate.getMonth();
          const firstDay = new Date(y, m, 1).getDay();
          const daysInMonth = new Date(y, m + 1, 0).getDate();
          const cells = [];
          for (let i = 0; i < firstDay; i++) cells.push(null);
          for (let d = 1; d <= daysInMonth; d++) cells.push(d);
          const dateStr = (d) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
          const eventsOn = (ds) => calendarEvents.filter(ev => ev.date === ds);
          const typeColor = { task: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300', activity: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300', birthday: 'bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300', deal: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' };
          const next30 = [...Array(30)].map((_, i) => { const d = new Date(); d.setDate(d.getDate() + i); return d.toISOString().split('T')[0]; });
          const selEvents = selectedCalendarDay ? eventsOn(selectedCalendarDay) : [];
          return (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-100 mb-1">Calendar</h1>
                  <p className="text-[13px] text-gray-500">Tasks, activities, birthdays, and deal close dates in one view.</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="bg-gray-200/50 dark:bg-gray-800 p-1 rounded-lg flex items-center gap-1">
                    <button onClick={() => setCalendarView('month')} className={`px-3 py-1.5 text-[12px] font-medium rounded-md ${calendarView === 'month' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm' : 'text-gray-500'}`}>Month</button>
                    <button onClick={() => setCalendarView('agenda')} className={`px-3 py-1.5 text-[12px] font-medium rounded-md ${calendarView === 'agenda' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm' : 'text-gray-500'}`}>Agenda</button>
                  </div>
                </div>
              </div>

              {calendarView === 'month' ? (
                <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-md transition-shadow p-4 sm:p-6">
                  <div className="flex items-center justify-between mb-4">
                    <button onClick={() => setCalendarDate(new Date(y, m - 1, 1))} className="px-3 py-1.5 text-[13px] border border-gray-200 dark:border-gray-600 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300">&larr; Prev</button>
                    <h3 className="text-[15px] font-bold text-gray-900 dark:text-gray-100">{calendarDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</h3>
                    <button onClick={() => setCalendarDate(new Date(y, m + 1, 1))} className="px-3 py-1.5 text-[13px] border border-gray-200 dark:border-gray-600 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300">Next &rarr;</button>
                  </div>
                  <div className="grid grid-cols-7 gap-1 text-center mb-1">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                      <div key={d} className="text-[11px] font-bold uppercase tracking-wider text-gray-400 py-2">{d}</div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-1">
                    {cells.map((d, i) => {
                      if (d === null) return <div key={`e-${i}`} className="min-h-[90px]" />;
                      const ds = dateStr(d);
                      const evs = eventsOn(ds);
                      const isToday = ds === todayStr;
                      return (
                        <button key={ds} onClick={() => setSelectedCalendarDay(ds)} className={`min-h-[90px] p-1.5 rounded-lg border text-left align-top transition-colors ${selectedCalendarDay === ds ? 'border-gray-900 dark:border-gray-300' : 'border-gray-100 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-500'}`}>
                          <span className={`text-[12px] font-semibold inline-flex items-center justify-center ${isToday ? 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded-full w-6 h-6' : 'text-gray-600 dark:text-gray-300'}`}>{d}</span>
                          <div className="mt-1 space-y-0.5">
                            {evs.slice(0, 3).map(ev => (
                              <div key={ev.id} className={`text-[9px] font-medium px-1 py-0.5 rounded truncate ${typeColor[ev.type]}`}>{ev.label}</div>
                            ))}
                            {evs.length > 3 && <div className="text-[9px] text-gray-400 font-medium px-1">+{evs.length - 3} more</div>}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-md transition-shadow p-6 space-y-4">
                  {next30.filter(ds => eventsOn(ds).length > 0).length === 0 && (
                    <p className="text-[13px] text-gray-400 text-center py-8">Nothing scheduled in the next 30 days.</p>
                  )}
                  {next30.map(ds => {
                    const evs = eventsOn(ds);
                    if (evs.length === 0) return null;
                    return (
                      <div key={ds}>
                        <h4 className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-2">{new Date(ds + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}{ds === todayStr ? ' · Today' : ''}</h4>
                        <div className="space-y-1.5">
                          {evs.map(ev => {
                            const evClient = clients.find(c => c.id === ev.clientId);
                            return (
                              <div key={ev.id} className="flex items-center gap-3 p-2.5 rounded-lg border border-gray-100 dark:border-gray-700 bg-gray-50/40 dark:bg-gray-700/30">
                                <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${typeColor[ev.type]}`}>{ev.type}</span>
                                <span className="text-[13px] text-gray-800 dark:text-gray-200 flex-1 truncate">{ev.label}</span>
                                {evClient && <button onClick={() => { setViewingClient(evClient); setAppStep('CLIENTS'); }} className="text-[12px] text-gray-500 hover:text-gray-900 dark:hover:text-gray-100 font-medium shrink-0">{evClient.name}</button>}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* SELECTED DAY PANEL */}
              {calendarView === 'month' && selectedCalendarDay && (
                <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-md transition-shadow p-6 space-y-4 animate-in fade-in">
                  <div className="flex items-center justify-between">
                    <h3 className="text-[14px] font-bold text-gray-900 dark:text-gray-100">{new Date(selectedCalendarDay + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</h3>
                    <button onClick={() => setSelectedCalendarDay(null)} className="text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 font-bold">&times;</button>
                  </div>
                  {selEvents.length === 0 && <p className="text-[13px] text-gray-400">Nothing scheduled for this day.</p>}
                  <div className="space-y-2">
                    {selEvents.map(ev => {
                      const evClient = clients.find(c => c.id === ev.clientId);
                      return (
                        <div key={ev.id} className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 dark:border-gray-700 bg-gray-50/40 dark:bg-gray-700/30">
                          <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded shrink-0 ${typeColor[ev.type]}`}>{ev.type}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-[13px] font-medium text-gray-900 dark:text-gray-100 truncate">{ev.label}</p>
                            {ev.type === 'task' && <span className={`text-[10px] font-bold ${ev.task.status === 'done' ? 'text-green-600' : ev.isOverdue ? 'text-red-500' : 'text-gray-400'}`}>{ev.task.status === 'done' ? 'Done' : ev.isOverdue ? 'Overdue' : 'Pending'}</span>}
                            {ev.type === 'deal' && <span className="text-[10px] text-gray-400">{ev.deal.stage}</span>}
                          </div>
                          {evClient && (
                            <div className="flex gap-2 shrink-0">
                              <button onClick={() => { setViewingClient(evClient); setAppStep('CLIENTS'); }} className="text-[12px] text-gray-500 hover:text-gray-900 dark:hover:text-gray-100 font-medium">Open Client</button>
                              {ev.type === 'birthday' && (
                                <button onClick={() => { setViewingClient(evClient); setAppStep('CLIENTS'); setEmailTo(evClient.email || ''); setShowEmailComposer(true); }} className="text-[12px] text-indigo-600 hover:underline font-medium">Send Email</button>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {/* Inline add-task for the selected day */}
                  {canEdit && clients.length > 0 && (
                    <form onSubmit={async (e) => {
                      e.preventDefault();
                      const cid = parseInt(e.target.elements.calTaskClient.value, 10);
                      if (!newTaskTitle || !cid) return;
                      const { data, error } = await supabase.from('tasks').insert([{
                        client_id: cid, user_id: user.id, title: newTaskTitle,
                        due_date: selectedCalendarDay, status: 'pending',
                      }]).select();
                      if (!error && data) {
                        setTasks(prev => [...prev, data[0]]);
                        setNewTaskTitle('');
                        updateStreak();
                        showToast('Task created.', 'success');
                      } else showToast(`Error creating task: ${error?.message}`, 'error');
                    }} className="flex flex-wrap gap-2 pt-3 border-t border-gray-100 dark:border-gray-700">
                      <input type="text" placeholder="Add task for this day..." value={newTaskTitle} onChange={e => setNewTaskTitle(e.target.value)} className="flex-1 min-w-[160px] px-3 py-1.5 min-h-[44px] md:min-h-0 text-[13px] border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:outline-none" />
                      <select name="calTaskClient" className="px-2 py-1.5 text-[13px] border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:outline-none">
                        {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                      <button type="submit" disabled={!newTaskTitle} className="px-3 py-1.5 text-[12px] font-semibold text-white bg-gray-900 dark:bg-gray-100 dark:text-gray-900 rounded-xl hover:opacity-90 disabled:opacity-50 shadow-sm">Add Task</button>
                    </form>
                  )}
                </div>
              )}
            </div>
          );
        })()}

        {/* VIEW: CLIENT TIMELINE (Feature 24) */}
        {appStep === 'CLIENT_TIMELINE' && timelineClient && (() => {
          const tc = clientsWithScores.find(c => c.id === timelineClient.id) || timelineClient;
          const tcActs = activities.filter(a => a.client_id === tc.id);
          const tcTasks = tasks.filter(t => t.client_id === tc.id);
          const tcDeals = deals.filter(d => d.client_id === tc.id);
          const tcFiles = clientFiles.filter(f => f.client_id === tc.id);
          const events = [
            ...tcActs.map(a => ({ id: `a-${a.id}`, date: a.activity_date, sort: a.created_at, kind: 'activity', color: { Note: 'bg-gray-400', Call: 'bg-blue-500', Email: 'bg-green-500', Meeting: 'bg-purple-500' }[a.activity_type] || 'bg-gray-400', title: `${a.activity_type}`, detail: a.description })),
            ...tcTasks.map(t => ({ id: `t-${t.id}`, date: t.due_date, sort: t.created_at || t.due_date, kind: t.status === 'done' ? 'task-done' : 'task', color: t.status === 'done' ? 'bg-green-500' : 'bg-gray-300', title: `${t.status === 'done' ? '✓ ' : ''}Task: ${t.title}`, detail: `Due ${t.due_date}` })),
            ...tcDeals.map(d => ({ id: `d-${d.id}`, date: d.close_date || (d.created_at || '').split('T')[0], sort: d.created_at, kind: 'deal', color: 'bg-emerald-500', title: `Deal: ${d.title}`, detail: `${fmtMoney(d.value)} · ${d.stage}` })),
            ...tcFiles.map(f => ({ id: `f-${f.id}`, date: (f.created_at || '').split('T')[0], sort: f.created_at, kind: 'file', color: 'bg-amber-500', title: `📎 ${f.file_name}`, detail: formatFileSize(f.file_size) })),
          ].sort((a, b) => new Date(b.sort || b.date || 0) - new Date(a.sort || a.date || 0));
          return (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <button onClick={() => { setTimelineClient(null); setAppStep('CLIENTS'); }} className="text-[13px] font-medium text-gray-500 hover:text-gray-900 dark:hover:text-gray-100">&larr; Back to Relationships</button>
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">{tc.name}</h1>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">{tc.status}</span>
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ring-1 ring-inset ${tc.relationship === 'High' ? 'bg-red-50 text-red-700 ring-red-600/10' : tc.relationship === 'Medium' ? 'bg-orange-50 text-orange-700 ring-orange-600/10' : 'bg-blue-50 text-blue-700 ring-blue-600/10'}`}>{tc.relationship}</span>
                <ScoreBar score={tc.leadScore || 0} />
                {canEdit && <button onClick={() => setEditingClient(tc)} className="ml-auto px-3 py-1.5 text-[12px] font-semibold text-white bg-gray-900 dark:bg-gray-100 dark:text-gray-900 rounded-xl hover:opacity-90 shadow-sm">Edit</button>}
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="space-y-4">
                  <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-md transition-shadow space-y-2 text-[13px]">
                    <h3 className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-2">Relationship Info</h3>
                    <p className="break-all"><span className="text-gray-400">Email:</span> <span className="font-semibold text-gray-800 dark:text-gray-200">{tc.email}</span></p>
                    <p><span className="text-gray-400">Phone:</span> <span className="font-semibold text-gray-800 dark:text-gray-200">{tc.phone_number || '—'}</span></p>
                    <p><span className="text-gray-400">Country:</span> <span className="font-semibold text-gray-800 dark:text-gray-200">{tc.country || '—'}</span></p>
                    <p><span className="text-gray-400">Source:</span> <span className="font-semibold text-gray-800 dark:text-gray-200">{tc.source || '—'}</span></p>
                  </div>
                  <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-md transition-shadow">
                    <h3 className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-2">Deals ({tcDeals.length})</h3>
                    {tcDeals.length === 0 ? <p className="text-[12px] text-gray-400 italic">No deals.</p> : tcDeals.map(d => (
                      <div key={d.id} className="flex justify-between py-1.5 border-b border-gray-50 dark:border-gray-700/50 last:border-0 text-[13px]">
                        <span className="truncate text-gray-800 dark:text-gray-200">{d.title}</span>
                        <span className="font-bold shrink-0 text-gray-900 dark:text-gray-100">{fmtMoney(d.value)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-md transition-shadow">
                    <h3 className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-2">Open Tasks ({tcTasks.filter(t => t.status === 'pending').length})</h3>
                    {tcTasks.filter(t => t.status === 'pending').length === 0 ? <p className="text-[12px] text-gray-400 italic">No open tasks.</p> : tcTasks.filter(t => t.status === 'pending').map(t => (
                      <div key={t.id} className="flex justify-between py-1.5 border-b border-gray-50 dark:border-gray-700/50 last:border-0 text-[13px]">
                        <span className="truncate text-gray-800 dark:text-gray-200">{t.title}</span>
                        <span className="text-gray-400 shrink-0">{t.due_date}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="lg:col-span-2 bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-md transition-shadow">
                  <h3 className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-4">Full History</h3>
                  {events.length === 0 ? (
                    <p className="text-[13px] text-gray-400 text-center py-8">No history yet — log an activity to get started.</p>
                  ) : (
                    <div className="relative pl-6 space-y-5 before:absolute before:left-[7px] before:top-1 before:bottom-1 before:w-px before:bg-gray-200 dark:before:bg-gray-700">
                      {events.map(ev => (
                        <div key={ev.id} className="relative">
                          <span className={`absolute -left-6 top-1 w-3.5 h-3.5 rounded-full ring-4 ring-white dark:ring-gray-800 ${ev.color}`} />
                          <div className="flex justify-between items-start gap-3">
                            <p className="text-[13px] font-semibold text-gray-900 dark:text-gray-100">{ev.title}</p>
                            <span className="text-[11px] text-gray-400 shrink-0">{ev.date}</span>
                          </div>
                          {ev.detail && <p className="text-[12px] text-gray-500 mt-0.5 whitespace-pre-wrap line-clamp-3">{ev.detail}</p>}
                        </div>
                      ))}
                    </div>
                  )}
                  {canEdit && (
                    <form onSubmit={async (e) => {
                      e.preventDefault();
                      if (!activityDesc.trim()) return;
                      const { data, error } = await supabase.from('activities').insert([{
                        client_id: tc.id, user_id: user.id, activity_type: activityType,
                        activity_date: new Date().toISOString().split('T')[0],
                        description: activityDesc,
                      }]).select();
                      if (!error && data) {
                        setActivities(prev => [data[0], ...prev]);
                        setActivityDesc('');
                        updateStreak();
                        dispatchWebhook('activity.logged', data[0]);
                        showToast('Activity logged.', 'success');
                      } else showToast(`Error logging activity: ${error?.message}`, 'error');
                    }} className="mt-6 pt-4 border-t border-gray-100 dark:border-gray-700 flex gap-2">
                      <textarea placeholder="Log an activity..." value={activityDesc} onChange={e => setActivityDesc(e.target.value)} rows={2} className="flex-1 px-3 py-2 text-[13px] border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:outline-none" />
                      <button type="submit" className="px-3 text-[12px] font-semibold text-white bg-gray-900 dark:bg-gray-100 dark:text-gray-900 rounded-xl hover:opacity-90 shadow-sm">Log</button>
                    </form>
                  )}
                </div>
              </div>
            </div>
          );
        })()}

        {/* VIEW: GLOBAL TASKS */}
        {appStep === 'GLOBAL_TASKS' && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h1 className="text-2xl font-semibold tracking-tight text-gray-900 mb-1">Task Management</h1>
                <p className="text-[13px] text-gray-500">Track and manage all client action items.</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setTasksFilter('pending')} className={`px-4 py-2 text-[13px] font-medium rounded-lg transition-all ${tasksFilter === 'pending' ? 'bg-gray-900 text-white shadow-sm' : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'}`}>Pending</button>
                <button onClick={() => setTasksFilter('done')} className={`px-4 py-2 text-[13px] font-medium rounded-lg transition-all ${tasksFilter === 'done' ? 'bg-gray-900 text-white shadow-sm' : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'}`}>Completed</button>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm hover:shadow-md transition-shadow border border-gray-100 p-6 space-y-4">
              {tasks.filter(t => t.status === tasksFilter).sort((a, b) => new Date(a.due_date) - new Date(b.due_date)).length === 0 && (
                tasks.length === 0 ? (
                  <EmptyState
                    title="No tasks yet"
                    desc="Create tasks to stay on top of your follow-ups — open a relationship profile to add one."
                    ctaLabel="Go to Relationships"
                    onCta={() => setAppStep('CLIENTS')}
                  />
                ) : (
                  <p className="text-center text-[13px] text-gray-500 py-8">No {tasksFilter} tasks found.</p>
                )
              )}
              {tasks.filter(t => t.status === tasksFilter).sort((a, b) => new Date(a.due_date) - new Date(b.due_date)).map(task => {
                const client = clients.find(c => c.id === task.client_id);
                const isOverdue = task.status === 'pending' && new Date(task.due_date) < new Date(todayStr);
                
                return (
                  <div key={task.id} className="flex items-center justify-between p-4 border border-gray-100 rounded-xl hover:border-gray-300 transition-colors bg-gray-50/50 dark:bg-gray-800/40">
                    <div className="flex items-center gap-4">
                      <input type="checkbox" checked={task.status === 'done'} onChange={() => handleToggleTask(task.id, task.status)} className="dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 w-5 h-5 rounded border-gray-300 dark:border-gray-600 text-gray-900 focus:ring-gray-900 cursor-pointer" />
                      <div>
                        <div className={`text-[14px] ${task.status === 'done' ? 'line-through text-gray-400' : isOverdue ? 'text-red-600 font-semibold' : 'text-gray-900 font-medium'}`}>
                          {task.recurrence && <span title={`Repeats ${task.recurrence}${task.recurrence_end_date ? ` until ${task.recurrence_end_date}` : ''}`}>🔁 </span>}
                          {task.title}
                        </div>
                        <div className="text-[12px] text-gray-500 mt-0.5">
                          Due: <span className={isOverdue ? 'text-red-500 font-medium' : ''}>{task.due_date}</span> 
                          &nbsp;•&nbsp; 
                          Relationship: <button onClick={() => { setViewingClient(client); setAppStep('CLIENTS'); }} className="text-gray-900 font-medium hover:underline">{client?.name || 'Unknown'}</button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* VIEW: N8N — EMAIL SEQUENCE WORKFLOWS */}
        {appStep === 'N8N' && (() => {
          const editingSeq = sequences.find(s => s.id === editingSeqId);
          const updateNodeLocal = (nodeId, patch) => setSequenceSteps(prev => prev.map(s => s.id === nodeId ? { ...s, ...patch } : s));

          // ================= CANVAS EDITOR (Part 7) =================
          if (editingSeq) {
            const nodes = seqNodesFor(editingSeq.id);
            const edges = seqEdgesFor(editingSeq.id);
            const sSends = sequenceSends.filter(s => s.sequence_id === editingSeq.id);
            const enrolled = sequenceEnrollments.filter(en => en.sequence_id === editingSeq.id);
            const activeEnr = enrolled.filter(en => en.status === 'active');
            const stats = {
              Sent: sSends.length,
              Opened: sSends.filter(s => s.opened_at).length,
              Clicked: sSends.filter(s => s.clicked_at).length,
              Replied: sSends.filter(s => s.replied_at).length,
              Unsubscribed: sSends.filter(s => s.unsubscribed_at).length,
            };
            const CARD_W = 256, CARD_H = 96;
            const posOf = {};
            nodes.forEach((n, i) => { posOf[n.id] = nodePos(n, i); });
            const contentW = Math.max(940, ...nodes.map(n => posOf[n.id].x + CARD_W + 100));
            const contentH = Math.max(560, ...nodes.map(n => posOf[n.id].y + CARD_H + 140));
            const selNode = nodes.find(n => n.id === selectedNodeId);
            const seqTrig = sequenceTriggers.find(t => t.sequence_id === editingSeq.id);
            const trigType = seqTrig?.trigger_event || 'manual';
            const trigCfg = seqTrig?.trigger_config || {};
            const outPort = (e) => {
              const p = posOf[e.from_step_id];
              if (!p) return null;
              const from = nodes.find(n => n.id === e.from_step_id);
              if ((from?.node_type) === 'condition') {
                return (e.branch === 'yes') ? { x: p.x + CARD_W * 0.25, y: p.y + CARD_H } : (e.branch === 'no') ? { x: p.x + CARD_W * 0.75, y: p.y + CARD_H } : { x: p.x + CARD_W / 2, y: p.y + CARD_H };
              }
              return { x: p.x + CARD_W / 2, y: p.y + CARD_H };
            };
            const nodeSummary = (n) => {
              const t = n.node_type || 'email';
              if (t === 'trigger') return TRIGGER_TYPES.find(x => x.value === trigType)?.label + (trigType === 'manual' ? ' enrollment' : '');
              if (t === 'email') return n.subject ? `“${n.subject.slice(0, 50)}${n.subject.length > 50 ? '…' : ''}”` : 'No subject yet';
              if (t === 'wait') return `Wait ${(n.config?.days ?? n.wait_days ?? 1)} day${(n.config?.days ?? n.wait_days ?? 1) === 1 ? '' : 's'}`;
              if (t === 'condition') return CONDITION_TYPES.find(x => x.value === (n.config?.type || 'if_no_reply'))?.label || 'Condition';
              if (t === 'goal') return n.config?.label || 'Goal reached';
              return n.task_note ? n.task_note.slice(0, 55) : NODE_META[t]?.label;
            };
            return (
              <div className="space-y-4 animate-in fade-in duration-300">
                {/* header bar */}
                <div className="flex flex-wrap items-center gap-3 bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm px-4 py-3">
                  <button onClick={() => { setEditingSeqId(null); setSelectedNodeId(null); setConnectFrom(null); }} className="text-[13px] font-medium text-gray-500 hover:text-gray-900 dark:hover:text-gray-100">← Back</button>
                  <h2 className="text-[15px] font-bold text-gray-900 dark:text-gray-100 truncate max-w-[240px]">{editingSeq.name}</h2>
                  <button onClick={() => handleSetSequenceActive(editingSeq, !editingSeq.is_active)}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-bold transition-colors ${editingSeq.is_active ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 ring-1 ring-inset ring-green-600/20' : 'bg-gray-100 dark:bg-gray-800 text-gray-500 ring-1 ring-inset ring-gray-500/10'}`}>
                    <span className={`w-2 h-2 rounded-full ${editingSeq.is_active ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
                    {editingSeq.is_active ? 'Active' : 'Paused'}
                  </button>
                  <details className="relative">
                    <summary className="px-3 py-1.5 text-[12px] font-semibold border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 cursor-pointer select-none list-none">Enroll {activeEnr.length > 0 ? `· ${activeEnr.length} active` : ''} ▾</summary>
                    <div className="absolute z-30 mt-1 w-64 max-h-56 overflow-y-auto bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg p-2 space-y-0.5">
                      {clients.filter(c => c.email).map(c => (
                        <label key={c.id} className="flex items-center gap-2 px-2 py-1 text-[12px] rounded hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer text-gray-700 dark:text-gray-200">
                          <input type="checkbox" checked={!!(enrollMulti[editingSeq.id] || {})[c.id]} onChange={e => setEnrollMulti(prev => ({ ...prev, [editingSeq.id]: { ...(prev[editingSeq.id] || {}), [c.id]: e.target.checked } }))} className="rounded border-gray-300 dark:border-gray-600" />
                          <span className="truncate">{c.name}</span>
                        </label>
                      ))}
                      <button onClick={async () => {
                        const ids = Object.entries(enrollMulti[editingSeq.id] || {}).filter(([, v]) => v).map(([k]) => k);
                        for (const id of ids) await enrollClientInSequence(editingSeq, id);
                        setEnrollMulti(prev => ({ ...prev, [editingSeq.id]: {} }));
                      }} className="w-full mt-1 px-2 py-1.5 text-[12px] font-semibold text-white bg-gray-900 dark:bg-gray-100 dark:text-gray-900 rounded-lg hover:opacity-90">▶ Enroll selected</button>
                    </div>
                  </details>
                  {/* V4 Part 4 — filter-driven bulk enroll */}
                  <button onClick={() => { setShowEnrollPanel(editingSeq.id); setEnrollSearchTerm(''); setEnrollFilterStatus('All'); setEnrollFilterPriority('All'); setEnrollFilterSource('All'); setEnrollFilterScoreMin(0); setEnrollFilterTags([]); }} className="px-3 py-1.5 text-[12px] font-semibold border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/40 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-950/70 transition-colors">Enroll by filter</button>
                  {/* stats bar — Replied is clickable (per-campaign who-replied, V4 Part 3) */}
                  <div className="ml-auto flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] font-medium text-gray-500">
                    <span>Sent <b className="text-gray-900 dark:text-gray-100">{stats.Sent}</b></span>
                    <span>Opened <b className="text-blue-600 dark:text-blue-400">{stats.Opened}{stats.Sent > 0 ? ` (${Math.round((stats.Opened / stats.Sent) * 100)}%)` : ''}</b></span>
                    <span>Clicked <b className="text-indigo-600 dark:text-indigo-400">{stats.Clicked}</b></span>
                    <button onClick={() => { setWhoRepliedSeqFilter(editingSeq.id); setShowWhoRepliedView(true); }} title="See who replied in this campaign" className="hover:underline decoration-green-400">Replied <b className="text-green-600 dark:text-green-400">{stats.Replied}</b></button>
                    <span>Unsubscribed <b className="text-red-500">{stats.Unsubscribed}</b></span>
                  </div>
                </div>

                {connectFrom && (
                  <div className="px-4 py-2 bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-800 rounded-xl text-[12px] font-medium text-indigo-700 dark:text-indigo-300 flex items-center gap-3">
                    🔌 Click a target node to connect the arrow{connectFrom.branch !== 'default' ? ` (${connectFrom.branch.toUpperCase()} branch)` : ''} — or
                    <button onClick={() => setConnectFrom(null)} className="underline font-semibold">cancel</button>
                  </div>
                )}

                {/* Part 6 — the config column only reserves width when a node is selected;
                    the palette is a compact icon rail. Canvas fills the viewport height. */}
                {/* V4 Part 5.2 — email steps get a wide (480px) writing panel; other nodes keep 300px */}
                <div className={`grid grid-cols-1 gap-4 items-start ${selNode ? ((selNode.node_type || 'email') === 'email' ? 'lg:grid-cols-[60px_1fr_480px]' : 'lg:grid-cols-[60px_1fr_300px]') : 'lg:grid-cols-[60px_1fr]'}`}>
                  {/* node palette — compact icon rail (label on hover) */}
                  <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-1.5 flex lg:flex-col gap-1 flex-wrap lg:sticky lg:top-4">
                    {NODE_PALETTE.map(t => (
                      <button key={t} onClick={() => handleAddNode(editingSeq.id, t)} title={`Add ${NODE_META[t].label}`} className="w-11 h-11 flex items-center justify-center text-[18px] rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors" aria-label={`Add ${NODE_META[t].label}`}>
                        {NODE_META[t].emoji}
                      </button>
                    ))}
                  </div>

                  {/* canvas — fills viewport height instead of a fixed 640px slab */}
                  <div className="relative bg-gray-50 dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-inner overflow-auto h-[calc(100vh-230px)] min-h-[420px]"
                    style={{ backgroundImage: 'radial-gradient(circle, rgba(148,163,184,0.25) 1px, transparent 1px)', backgroundSize: '22px 22px' }}>
                    <div className="relative" style={{ width: contentW, height: contentH }}
                      onMouseMove={e => {
                        if (!nodeDrag) return;
                        const nx = Math.max(0, e.clientX - nodeDrag.dx);
                        const ny = Math.max(0, e.clientY - nodeDrag.dy);
                        updateNodeLocal(nodeDrag.nodeId, { pos_x: nx, pos_y: ny });
                      }}
                      onMouseUp={() => {
                        if (!nodeDrag) return;
                        const n = sequenceSteps.find(s => s.id === nodeDrag.nodeId);
                        if (n) handleUpdateNode(n.id, { pos_x: Math.round(n.pos_x ?? 300), pos_y: Math.round(n.pos_y ?? 30) });
                        setNodeDrag(null);
                      }}
                      onMouseLeave={() => { if (nodeDrag) setNodeDrag(null); }}>
                      {/* arrows */}
                      <svg className="absolute inset-0 pointer-events-none" width={contentW} height={contentH}>
                        <defs>
                          <marker id="arr-default" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><polygon points="0 0, 8 4, 0 8" fill="#9ca3af" /></marker>
                          <marker id="arr-yes" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><polygon points="0 0, 8 4, 0 8" fill="#22c55e" /></marker>
                          <marker id="arr-no" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><polygon points="0 0, 8 4, 0 8" fill="#9ca3af" /></marker>
                        </defs>
                        {edges.map(e => {
                          const from = outPort(e);
                          const toP = posOf[e.to_step_id];
                          if (!from || !toP) return null;
                          const to = { x: toP.x + CARD_W / 2, y: toP.y };
                          const bend = Math.max(36, Math.min(90, (to.y - from.y) / 2));
                          const d = `M ${from.x},${from.y} C ${from.x},${from.y + bend} ${to.x},${to.y - bend} ${to.x},${to.y - 4}`;
                          const isYes = e.branch === 'yes', isNo = e.branch === 'no';
                          const midX = (from.x + to.x) / 2, midY = (from.y + to.y) / 2;
                          return (
                            <g key={e.id} className="pointer-events-auto cursor-pointer" onClick={() => showConfirm('Remove Arrow', 'Remove this connection?', 'Remove', 'danger', async () => handleDeleteEdge(e))}>
                              <path d={d} fill="none" strokeWidth="6" stroke="transparent" />
                              <path d={d} fill="none" strokeWidth="1.8" stroke={isYes ? '#22c55e' : '#9ca3af'} markerEnd={`url(#arr-${isYes ? 'yes' : isNo ? 'no' : 'default'})`} />
                              {(isYes || isNo) && (
                                <g>
                                  <rect x={midX - 17} y={midY - 9} width="34" height="18" rx="9" fill={isYes ? '#22c55e' : '#9ca3af'} />
                                  <text x={midX} y={midY + 3.5} textAnchor="middle" fontSize="10" fontWeight="700" fill="#fff">{isYes ? 'Yes' : 'No'}</text>
                                </g>
                              )}
                            </g>
                          );
                        })}
                      </svg>
                      {/* node cards */}
                      {nodes.map((n, i) => {
                        const t = n.node_type || 'email';
                        const meta = NODE_META[t] || NODE_META.email;
                        const p = posOf[n.id];
                        const nSends = sSends.filter(s => s.step_id === n.id).length;
                        const here = activeEnr.filter(en => en.current_node_id === n.id).length;
                        const isSel = selectedNodeId === n.id;
                        const connectTarget = connectFrom && connectFrom.nodeId !== n.id && t !== 'trigger';
                        return (
                          <div key={n.id}
                            className={`absolute w-64 bg-white dark:bg-gray-900 rounded-xl border ${isSel ? 'border-gray-900 dark:border-gray-100 shadow-md' : 'border-gray-200 dark:border-gray-700 shadow-sm'} border-l-4 ${meta.border} select-none ${connectTarget ? 'ring-2 ring-indigo-400 ring-offset-2 dark:ring-offset-gray-950 cursor-crosshair' : 'cursor-grab active:cursor-grabbing'}`}
                            style={{ left: p.x, top: p.y }}
                            onMouseDown={e => {
                              if (connectFrom) return;
                              if (e.target.closest('button')) return;
                              e.preventDefault();
                              setNodeDrag({ nodeId: n.id, dx: e.clientX - p.x, dy: e.clientY - p.y });
                              setSelectedNodeId(n.id);
                            }}
                            onClick={() => { if (connectFrom) handleAddEdge(editingSeq.id, connectFrom.nodeId, connectFrom.branch, n.id); else setSelectedNodeId(n.id); }}>
                            <div className="flex items-center gap-1.5 px-3 pt-2.5">
                              <span className="text-[13px]">{meta.emoji}</span>
                              <span className="text-[12px] font-bold text-gray-900 dark:text-gray-100">{meta.label}</span>
                              {t !== 'trigger' && (
                                <button onClick={() => handleDeleteNode(n)} className="ml-auto text-gray-300 hover:text-red-500 text-[13px] leading-none px-1" title="Delete node">✕</button>
                              )}
                            </div>
                            <div className="px-3 pb-2 pt-1">
                              <p className="text-[12px] text-gray-600 dark:text-gray-300 truncate">{nodeSummary(n)}</p>
                              <p className="text-[10px] text-gray-400 mt-0.5">
                                {t === 'email' && n.subject_b ? 'A/B test · ' : ''}
                                {['email', 'linkedin_view', 'linkedin_connect', 'call', 'manual_task'].includes(t) ? `${nSends} sent · ` : ''}
                                {here > 0 ? `${here} here now` : t === 'trigger' ? `${activeEnr.length} enrolled` : '—'}
                              </p>
                            </div>
                            {/* output ports */}
                            {t !== 'goal' && (t === 'condition' ? (
                              <div className="absolute -bottom-2 left-0 w-full flex justify-around">
                                <button title="Connect YES branch" onClick={() => setConnectFrom({ nodeId: n.id, branch: 'yes' })} className="w-4 h-4 rounded-full bg-green-500 border-2 border-white dark:border-gray-900 hover:scale-125 transition-transform" />
                                <button title="Connect NO branch" onClick={() => setConnectFrom({ nodeId: n.id, branch: 'no' })} className="w-4 h-4 rounded-full bg-gray-400 border-2 border-white dark:border-gray-900 hover:scale-125 transition-transform" />
                              </div>
                            ) : (
                              <button title="Connect to next node" onClick={() => setConnectFrom({ nodeId: n.id, branch: 'default' })}
                                className={`absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full ${meta.dot} border-2 border-white dark:border-gray-900 hover:scale-125 transition-transform`} />
                            ))}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* config panel — contextual: only mounts when a node is selected */}
                  {selNode && (
                  <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-4 lg:sticky lg:top-4 space-y-3">
                    {(() => {
                      const t = selNode.node_type || 'email';
                      const meta = NODE_META[t] || NODE_META.email;
                      return (
                        <>
                          <div className="flex items-center gap-2 pb-2 border-b border-gray-100 dark:border-gray-800">
                            <span className="text-lg">{meta.emoji}</span>
                            <span className="text-[14px] font-bold text-gray-900 dark:text-gray-100">{meta.label}</span>
                          </div>
                          {t === 'trigger' && (
                            <div className="space-y-2.5">
                              <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-400">When should this sequence start?</label>
                              <select value={trigType} onChange={e => handleSaveSequenceTrigger(editingSeq.id, e.target.value, {})} className="w-full px-3 py-2 text-[13px] border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none">
                                {TRIGGER_TYPES.map(x => <option key={x.value} value={x.value}>{x.label}</option>)}
                              </select>
                              <p className="text-[11px] text-gray-500">{TRIGGER_TYPES.find(x => x.value === trigType)?.desc}</p>
                              {TRIGGER_TYPES.find(x => x.value === trigType)?.config === 'stage' && (
                                <select value={trigCfg.stage || ''} onChange={e => handleSaveSequenceTrigger(editingSeq.id, trigType, { ...trigCfg, stage: e.target.value })} className="w-full px-3 py-2 text-[13px] border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none">
                                  <option value="">Any stage</option>
                                  {(trigType === 'deal_stage_changed' ? DEAL_STAGES : PIPELINE_STAGES).map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                              )}
                              {TRIGGER_TYPES.find(x => x.value === trigType)?.config === 'tag' && (
                                <select value={trigCfg.tag_id || ''} onChange={e => handleSaveSequenceTrigger(editingSeq.id, trigType, { ...trigCfg, tag_id: e.target.value })} className="w-full px-3 py-2 text-[13px] border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none">
                                  <option value="">— pick tag —</option>
                                  {tags.map(tg => <option key={tg.id} value={tg.id}>{tg.name}</option>)}
                                </select>
                              )}
                              {TRIGGER_TYPES.find(x => x.value === trigType)?.config === 'days' && (
                                <label className="flex items-center gap-2 text-[13px] text-gray-600 dark:text-gray-300">
                                  <input type="number" min="1" defaultValue={trigCfg.days || 30} onBlur={e => handleSaveSequenceTrigger(editingSeq.id, trigType, { ...trigCfg, days: parseInt(e.target.value, 10) || 30 })} className="w-20 px-2 py-1.5 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none" /> days
                                </label>
                              )}
                              {trigType !== 'manual' && (
                                <div className="p-2.5 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-lg text-[11px] text-blue-700 dark:text-blue-300">
                                  ℹ️ This sequence will auto-enroll matching relationships every time this event happens. Make sure your send window is configured in Settings → Email Automation.
                                </div>
                              )}
                            </div>
                          )}
                          {t === 'email' && (
                            <div className="space-y-2.5">
                              <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-400">Subject <span className="normal-case font-normal">(supports {'{{name}} {{first_name}} {{company}}'})</span></label>
                              <input type="text" value={selNode.subject || ''} onChange={e => updateNodeLocal(selNode.id, { subject: e.target.value })} onBlur={e => handleUpdateNode(selNode.id, { subject: e.target.value })} className="w-full px-3 py-2 text-[13px] border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none" />
                              <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-400">Subject B <span className="normal-case font-normal">(optional A/B test)</span></label>
                              <input type="text" value={selNode.subject_b || ''} onChange={e => updateNodeLocal(selNode.id, { subject_b: e.target.value })} onBlur={e => handleUpdateNode(selNode.id, { subject_b: e.target.value || null })} className="w-full px-3 py-2 text-[13px] border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none" />
                              <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-400">Body</label>
                              <textarea rows={8} value={selNode.body || ''} onChange={e => updateNodeLocal(selNode.id, { body: e.target.value })} onBlur={e => handleUpdateNode(selNode.id, { body: e.target.value })} className="w-full px-3 py-2 text-[13px] border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none font-mono" />
                              <label className="flex items-center gap-2 text-[12px] text-gray-600 dark:text-gray-300">Extra delay before this email:
                                <input type="number" min="0" value={selNode.wait_days ?? 0} onChange={e => updateNodeLocal(selNode.id, { wait_days: parseInt(e.target.value, 10) || 0 })} onBlur={e => handleUpdateNode(selNode.id, { wait_days: parseInt(e.target.value, 10) || 0 })} className="w-16 px-2 py-1 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none" /> days
                              </label>
                            </div>
                          )}
                          {t === 'wait' && (
                            <label className="flex items-center gap-2 text-[13px] text-gray-600 dark:text-gray-300">Wait
                              <input type="number" min="0" value={selNode.config?.days ?? 1} onChange={e => updateNodeLocal(selNode.id, { config: { ...(selNode.config || {}), days: parseInt(e.target.value, 10) || 0 } })} onBlur={e => handleUpdateNode(selNode.id, { config: { ...(selNode.config || {}), days: parseInt(e.target.value, 10) || 0 } })} className="w-20 px-2 py-1.5 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none" /> days before continuing
                            </label>
                          )}
                          {t === 'condition' && (
                            <div className="space-y-2.5">
                              <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-400">Branch on</label>
                              <select value={selNode.config?.type || 'if_no_reply'} onChange={e => handleUpdateNode(selNode.id, { config: { ...(selNode.config || {}), type: e.target.value } })} className="w-full px-3 py-2 text-[13px] border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none">
                                {CONDITION_TYPES.map(x => <option key={x.value} value={x.value}>{x.label}</option>)}
                              </select>
                              <p className="text-[11px] text-gray-500">Use the <span className="text-green-600 font-semibold">green dot</span> for the YES path and the <span className="font-semibold">gray dot</span> for NO.</p>
                            </div>
                          )}
                          {['linkedin_view', 'call', 'manual_task'].includes(t) && (
                            <div className="space-y-2.5">
                              <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-400">Task note <span className="normal-case font-normal">(supports {'{{name}} {{linkedin_url}}'})</span></label>
                              <textarea rows={3} value={selNode.task_note || ''} onChange={e => updateNodeLocal(selNode.id, { task_note: e.target.value })} onBlur={e => handleUpdateNode(selNode.id, { task_note: e.target.value })} className="w-full px-3 py-2 text-[13px] border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none" />
                              <p className="text-[11px] text-gray-500">When this step is due, a task is created in Tasks — LinkedIn and call steps are always manual.</p>
                            </div>
                          )}
                          {t === 'linkedin_connect' && (() => {
                            // Part 7 — personalized connection note + A/B variant + acceptance stats
                            const cfg = selNode.config || {};
                            const noteVal = cfg.note ?? selNode.task_note ?? '';
                            const liSends = sequenceSends.filter(s => s.step_id === selNode.id && s.channel === 'linkedin_connect');
                            const rate = (arr) => arr.length ? Math.round((arr.filter(s => s.accepted).length / arr.length) * 100) : 0;
                            const aS = liSends.filter(s => s.subject_variant !== 'B');
                            const bS = liSends.filter(s => s.subject_variant === 'B');
                            const DEFAULT_NOTE = 'Hi {{first_name}}, really enjoyed learning about your work at {{company}} — would love to connect.';
                            return (
                              <div className="space-y-2.5">
                                <div className="flex items-center justify-between">
                                  <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-400">Connection note</label>
                                  <button onClick={() => { updateNodeLocal(selNode.id, { config: { ...cfg, note: DEFAULT_NOTE } }); handleUpdateNode(selNode.id, { config: { ...cfg, note: DEFAULT_NOTE } }); }} className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline">Use suggested</button>
                                </div>
                                <textarea rows={3} placeholder="Hi {{first_name}}, ..." value={noteVal} onChange={e => updateNodeLocal(selNode.id, { config: { ...cfg, note: e.target.value } })} onBlur={e => handleUpdateNode(selNode.id, { config: { ...(selNode.config || {}), note: e.target.value } })} className="w-full px-3 py-2 text-[13px] border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none" />
                                <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-400">Note B <span className="normal-case font-normal">(optional A/B test)</span></label>
                                <textarea rows={2} placeholder="Alternate note — sent to half of enrollments" value={cfg.note_b || ''} onChange={e => updateNodeLocal(selNode.id, { config: { ...cfg, note_b: e.target.value } })} onBlur={e => handleUpdateNode(selNode.id, { config: { ...(selNode.config || {}), note_b: e.target.value || undefined } })} className="w-full px-3 py-2 text-[13px] border border-amber-200 dark:border-amber-800 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none" />
                                <p className="text-[11px] text-gray-500">💡 Merge tags: {'{{first_name}} {{company}} {{linkedin_url}}'}. Company is auto-appended when set. Warm-up tip: put a <b>LinkedIn View → Wait 1 day → Connect</b> ahead of this for higher acceptance.</p>
                                {liSends.length > 0 && (
                                  <div className="text-[11px] text-gray-600 dark:text-gray-300 border-t border-gray-100 dark:border-gray-800 pt-2">
                                    <p className="font-semibold mb-0.5">Acceptance {cfg.note_b ? '(A/B)' : ''}</p>
                                    {cfg.note_b
                                      ? <p>A: {rate(aS)}% ({aS.filter(s => s.accepted).length}/{aS.length}) · B: {rate(bS)}% ({bS.filter(s => s.accepted).length}/{bS.length})</p>
                                      : <p>{rate(liSends)}% accepted ({liSends.filter(s => s.accepted).length}/{liSends.length}) — tick “Accepted” on the generated task to record.</p>}
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                          {t === 'goal' && (
                            <div className="space-y-2.5">
                              <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-400">Goal label</label>
                              <input type="text" value={selNode.config?.label || ''} onChange={e => updateNodeLocal(selNode.id, { config: { ...(selNode.config || {}), label: e.target.value } })} onBlur={e => handleUpdateNode(selNode.id, { config: { ...(selNode.config || {}), label: e.target.value } })} className="w-full px-3 py-2 text-[13px] border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none" />
                              <p className="text-[11px] text-gray-500">Enrollments that reach a goal stop with “goal reached”.</p>
                            </div>
                          )}
                          {t !== 'trigger' && (
                            <button onClick={() => handleDeleteNode(selNode)} className="w-full mt-2 px-3 py-2 text-[12px] font-semibold text-red-600 border border-red-200 dark:border-red-900 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">Delete node</button>
                          )}
                        </>
                      );
                    })()}
                  </div>
                  )}
                </div>
              </div>
            );
          }

          // ================= HUB (Parts 5-6: list, templates, cold contacts) =================
          const filteredCold = coldContacts.filter(c => {
            if (coldFilter !== 'All' && c.status !== coldFilter.toLowerCase()) return false;
            const q = coldSearch.trim().toLowerCase();
            if (!q) return true;
            return [c.email, c.first_name, c.last_name, c.company, c.title].some(v => (v || '').toLowerCase().includes(q));
          });
          const coldSelectedIds = Object.entries(coldSelected).filter(([, v]) => v).map(([k]) => parseInt(k, 10));
          return (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="flex flex-wrap items-end gap-4">
                <div>
                  <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-100 mb-1">Email Automation</h1>
                  <p className="text-[13px] text-gray-500">Build multichannel sequences on a visual canvas — they enroll and send themselves.</p>
                </div>
                <div className="ml-auto flex flex-wrap items-center gap-2">
                  {/* V4 Part 3 — cross-campaign replies entry point, badge-counted */}
                  <button onClick={() => { setWhoRepliedSeqFilter(null); setShowWhoRepliedView(true); }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-semibold border border-green-200 dark:border-green-900 text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/30 hover:bg-green-100 dark:hover:bg-green-950/60 transition-colors">
                    💬 Who Has Replied?
                    {allRepliesCount > 0 && <span className="px-1.5 py-0.5 rounded-full bg-green-600 text-white text-[10px] font-bold">{allRepliesCount}</span>}
                  </button>
                  <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1">
                    {[['sequences', 'Sequences'], ['contacts', `Cold Contacts${coldContacts.length ? ` (${coldContacts.length})` : ''}`], ['unsubs', 'Unsubscribes']].map(([k, label]) => (
                      <button key={k} onClick={() => setSeqView(k)} className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all ${seqView === k ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 shadow-sm' : 'text-gray-500 hover:text-gray-900 dark:hover:text-gray-100'}`}>{label}</button>
                    ))}
                  </div>
                </div>
              </div>

              {seqView === 'sequences' && (
                <>
                  {/* OUTBOX — due manual sends */}
                  {dueSequenceSends.length > 0 && (
                    <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800 rounded-2xl p-5 space-y-2">
                      <h3 className="text-[14px] font-semibold text-indigo-900 dark:text-indigo-200">Outbox — {dueSequenceSends.length} email{dueSequenceSends.length === 1 ? '' : 's'} due</h3>
                      {dueSequenceSends.map(({ enr, seq, step, client: c }) => (
                        <div key={enr.id} className="flex flex-wrap items-center gap-3 bg-white dark:bg-gray-900 rounded-xl p-3 border border-indigo-100 dark:border-indigo-800">
                          <div className="flex-1 min-w-[180px]">
                            <p className="text-[13px] font-semibold text-gray-900 dark:text-gray-100">{c.name} <span className="text-gray-400 font-normal">· step {enr.current_step + 1} of {seqStepsFor(seq.id).length} · {seq.name}</span></p>
                            <p className="text-[12px] text-gray-500 truncate">{resolveMergeTags(step.subject, c)}</p>
                          </div>
                          <button onClick={() => handleStopEnrollment(enr)} className="text-[12px] font-medium text-red-500 hover:text-red-700">Stop</button>
                          <button onClick={() => handleSendSequenceStep(enr)} className="px-3 py-1.5 text-[12px] font-semibold text-white bg-gray-900 dark:bg-gray-100 dark:text-gray-900 rounded-xl hover:opacity-90 shadow-sm">Send now →</button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* TEMPLATE GALLERY (Part 6) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {SEQ_TEMPLATES.map(tpl => (
                      <button key={tpl.key} onClick={() => handleCreateFromTemplate(tpl)} className="text-left p-4 bg-white dark:bg-gray-900 rounded-2xl border border-dashed border-gray-300 dark:border-gray-600 hover:border-indigo-400 dark:hover:border-indigo-500 hover:shadow-md transition-all group">
                        <span className="text-xl">{tpl.emoji}</span>
                        <p className="text-[13px] font-bold text-gray-900 dark:text-gray-100 mt-1.5 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{tpl.name}</p>
                        <p className="text-[11px] text-gray-500 mt-1 line-clamp-2">{tpl.desc}</p>
                        <p className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 mt-2">＋ Use template</p>
                      </button>
                    ))}
                  </div>

                  {/* NEW BLANK SEQUENCE */}
                  <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
                    <form onSubmit={handleCreateSequence} className="flex flex-wrap gap-2 text-[13px]">
                      <input type="text" required placeholder="Or start blank — sequence name (e.g. Cold outreach — agencies)" value={newSeqName} onChange={e => setNewSeqName(e.target.value)} className="flex-1 min-w-[220px] px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50/50 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 focus:bg-white dark:focus:bg-gray-800 focus:outline-none focus:border-gray-400" />
                      <button type="submit" className="px-4 py-2 text-[13px] font-semibold text-white bg-gray-900 dark:bg-gray-100 dark:text-gray-900 rounded-xl hover:opacity-90 shadow-sm">Create Sequence</button>
                    </form>
                  </div>

                  {/* SEQUENCE CARD GRID */}
                  {sequences.length === 0 ? (
                    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
                      <EmptyState title="No sequences yet" desc="Start from a template above — the LinkedIn + Email cadence is one click away." />
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {sequences.map(seq => {
                        const enrolled = sequenceEnrollments.filter(en => en.sequence_id === seq.id);
                        const activeEnr = enrolled.filter(en => en.status === 'active');
                        const sSends = sequenceSends.filter(s => s.sequence_id === seq.id);
                        const trig = sequenceTriggers.find(t => t.sequence_id === seq.id);
                        return (
                          <div key={seq.id} className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-md transition-shadow p-5 flex flex-col gap-3">
                            <div className="flex items-start gap-2">
                              <h3 className="text-[14px] font-bold text-gray-900 dark:text-gray-100 flex-1 truncate">{seq.name}</h3>
                              <button onClick={() => handleSetSequenceActive(seq, !seq.is_active)} title={seq.is_active ? 'Pause' : 'Activate'}
                                className={`shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ring-1 ring-inset ${seq.is_active ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 ring-green-600/20' : 'bg-gray-100 dark:bg-gray-800 text-gray-500 ring-gray-500/10'}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${seq.is_active ? 'bg-green-500' : 'bg-gray-400'}`} />
                                {seq.is_active ? 'Active' : 'Paused'}
                              </button>
                            </div>
                            <p className="text-[11px] text-gray-500">
                              ⚡ {trig ? (TRIGGER_TYPES.find(x => x.value === trig.trigger_event)?.label || trig.trigger_event) : 'Manual'} ·
                              {' '}{activeEnr.length} enrolled · {sSends.length} sent
                              <br />Last sent: {seq.last_run_at ? new Date(seq.last_run_at).toLocaleDateString() : 'never'}
                            </p>
                            <div className="flex items-center gap-2 mt-auto pt-2 border-t border-gray-100 dark:border-gray-800 text-[12px] font-medium">
                              <button onClick={() => { setEditingSeqId(seq.id); setSelectedNodeId(null); }} className="px-3 py-1.5 font-semibold text-white bg-gray-900 dark:bg-gray-100 dark:text-gray-900 rounded-lg hover:opacity-90 shadow-sm">Open builder →</button>
                              <button onClick={() => { setEditingSeqId(seq.id); setSelectedNodeId(null); }} title="Enroll contacts now" className="px-2 py-1.5 text-gray-500 hover:text-gray-900 dark:hover:text-gray-100">▶ Run</button>
                              <span className="ml-auto flex gap-2">
                                <button onClick={() => handleDuplicateSequence(seq)} className="text-gray-400 hover:text-gray-900 dark:hover:text-gray-100" title="Duplicate">⧉</button>
                                <button onClick={() => handleDeleteSequence(seq)} className="text-gray-400 hover:text-red-600" title="Delete">🗑</button>
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl text-[12px] text-yellow-800 dark:text-yellow-300">
                    ⚠️ Two send modes: with Auto-send OFF (Settings → Email Automation), due steps wait in the Outbox for one-click manual sending. With Auto-send ON + Gmail connected (or a Resend sender configured), the runner sends automatically inside your send window with open/click tracking and unsubscribe handling.
                  </div>
                </>
              )}

              {seqView === 'contacts' && (
                <>
                  {/* import + manual add */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
                      <h3 className="text-[13px] font-bold uppercase tracking-wider text-gray-400 mb-2">Import prospects (CSV)</h3>
                      <label className="flex flex-col items-center justify-center gap-1 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl py-6 cursor-pointer hover:border-indigo-400 dark:hover:border-indigo-500 transition-colors">
                        <span className="text-xl">📥</span>
                        <span className="text-[13px] font-semibold text-gray-700 dark:text-gray-200">Click to upload a CSV</span>
                        <span className="text-[11px] text-gray-400">Columns auto-mapped: email, first_name, last_name, company, title, linkedin_url</span>
                        <input type="file" accept=".csv" onChange={handleColdCsvFile} className="hidden" />
                      </label>
                    </div>
                    <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
                      <h3 className="text-[13px] font-bold uppercase tracking-wider text-gray-400 mb-2">Add manually</h3>
                      <form onSubmit={handleAddColdContact} className="grid grid-cols-2 gap-2 text-[13px]">
                        <input type="email" required placeholder="Email *" value={coldDraft.email} onChange={e => setColdDraft({ ...coldDraft, email: e.target.value })} className="col-span-2 px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50/50 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 focus:outline-none focus:border-gray-400" />
                        <input type="text" placeholder="First name" value={coldDraft.first_name} onChange={e => setColdDraft({ ...coldDraft, first_name: e.target.value })} className="px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50/50 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 focus:outline-none focus:border-gray-400" />
                        <input type="text" placeholder="Last name" value={coldDraft.last_name} onChange={e => setColdDraft({ ...coldDraft, last_name: e.target.value })} className="px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50/50 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 focus:outline-none focus:border-gray-400" />
                        <input type="text" placeholder="Company" value={coldDraft.company} onChange={e => setColdDraft({ ...coldDraft, company: e.target.value })} className="px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50/50 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 focus:outline-none focus:border-gray-400" />
                        <input type="url" placeholder="LinkedIn URL" value={coldDraft.linkedin_url} onChange={e => setColdDraft({ ...coldDraft, linkedin_url: e.target.value })} className="px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50/50 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 focus:outline-none focus:border-gray-400" />
                        <button type="submit" className="col-span-2 px-4 py-2 text-[13px] font-semibold text-white bg-gray-900 dark:bg-gray-100 dark:text-gray-900 rounded-xl hover:opacity-90 shadow-sm">Add Contact</button>
                      </form>
                    </div>
                  </div>

                  {/* toolbar */}
                  <div className="flex flex-wrap items-center gap-2">
                    <input type="text" placeholder="Search cold contacts..." value={coldSearch} onChange={e => setColdSearch(e.target.value)} className="flex-1 min-w-[180px] px-3 py-2 text-[13px] border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 focus:outline-none focus:border-gray-400" />
                    {['All', 'Prospect', 'Contacted', 'Replied', 'Converted', 'Unsubscribed', 'Bounced'].map(f => (
                      <button key={f} onClick={() => setColdFilter(f)} className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all ${coldFilter === f ? 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900' : 'bg-gray-100 dark:bg-gray-800 text-gray-500 hover:text-gray-900 dark:hover:text-gray-100'}`}>{f}</button>
                    ))}
                  </div>

                  {/* bulk bar */}
                  {coldSelectedIds.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 bg-gray-900 dark:bg-gray-100 rounded-xl text-[12px] font-medium text-white dark:text-gray-900">
                      {coldSelectedIds.length} selected
                      <select value={coldEnrollSeqId} onChange={e => setColdEnrollSeqId(e.target.value)} className="px-2 py-1 rounded-lg bg-white/10 dark:bg-gray-900/10 border border-white/20 dark:border-gray-900/20 text-white dark:text-gray-900 focus:outline-none">
                        <option value="" className="text-gray-900">Enroll in sequence…</option>
                        {sequences.map(s => <option key={s.id} value={s.id} className="text-gray-900">{s.name}</option>)}
                      </select>
                      <button disabled={!coldEnrollSeqId} onClick={() => { const seq = sequences.find(s => String(s.id) === coldEnrollSeqId); if (seq) enrollColdContactsInSequence(seq, coldSelectedIds); }} className="px-3 py-1 rounded-lg bg-indigo-500 text-white font-semibold hover:opacity-90 disabled:opacity-40">▶ Enroll</button>
                      <span className="ml-auto flex gap-2">
                        <button onClick={() => handleUnsubscribeColdContacts(coldSelectedIds)} className="px-3 py-1 rounded-lg bg-white/10 dark:bg-gray-900/10 hover:bg-white/20">Unsubscribe</button>
                        <button onClick={() => handleDeleteColdContacts(coldSelectedIds)} className="px-3 py-1 rounded-lg bg-red-500/80 text-white hover:opacity-90">Delete</button>
                      </span>
                    </div>
                  )}

                  {/* list */}
                  <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
                    {filteredCold.length === 0 ? (
                      <EmptyState title="No cold contacts" desc="Upload a CSV of prospects or add one manually — then enroll them in a sequence." />
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-[13px]">
                          <thead>
                            <tr className="text-left text-[11px] font-bold uppercase tracking-wider text-gray-400 border-b border-gray-100 dark:border-gray-800">
                              <th className="px-4 py-2.5 w-8"><input type="checkbox" checked={filteredCold.length > 0 && filteredCold.every(c => coldSelected[c.id])} onChange={e => { const next = {}; if (e.target.checked) filteredCold.forEach(c => { next[c.id] = true; }); setColdSelected(next); }} /></th>
                              <th className="px-2 py-2.5">Contact</th>
                              <th className="px-2 py-2.5 hidden md:table-cell">Company</th>
                              <th className="px-2 py-2.5">Status</th>
                              <th className="px-2 py-2.5 hidden sm:table-cell">Enrolled</th>
                              <th className="px-4 py-2.5"></th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredCold.map(c => {
                              const enr = sequenceEnrollments.filter(en => en.cold_contact_id === c.id);
                              const activeIn = enr.filter(en => en.status === 'active');
                              const statusCls = {
                                prospect: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300',
                                contacted: 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
                                replied: 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400',
                                converted: 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400',
                                unsubscribed: 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400',
                                bounced: 'bg-orange-50 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400',
                              }[c.status] || 'bg-gray-100 text-gray-600';
                              return (
                                <tr key={c.id} className="border-b border-gray-50 dark:border-gray-800/60 hover:bg-gray-50/60 dark:hover:bg-gray-800/40">
                                  <td className="px-4 py-2.5"><input type="checkbox" checked={!!coldSelected[c.id]} onChange={e => setColdSelected(prev => ({ ...prev, [c.id]: e.target.checked }))} /></td>
                                  <td className="px-2 py-2.5">
                                    <p className="font-semibold text-gray-900 dark:text-gray-100">{[c.first_name, c.last_name].filter(Boolean).join(' ') || '—'}</p>
                                    <p className="text-[11px] text-gray-400">{c.email}{c.title ? ` · ${c.title}` : ''}</p>
                                  </td>
                                  <td className="px-2 py-2.5 hidden md:table-cell text-gray-600 dark:text-gray-300">{c.company ? <CompanyLink client={c} /> : '—'}</td>
                                  <td className="px-2 py-2.5"><span className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${statusCls}`}>{c.status}</span></td>
                                  <td className="px-2 py-2.5 hidden sm:table-cell text-[11px] text-gray-400">{activeIn.length > 0 ? `${activeIn.length} active sequence${activeIn.length === 1 ? '' : 's'}` : enr.length > 0 ? 'finished' : '—'}</td>
                                  <td className="px-4 py-2.5 text-right">
                                    {c.linkedin_url && <a href={c.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-[11px] font-semibold text-indigo-500 hover:underline">LinkedIn ↗</a>}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </>
              )}

              {seqView === 'unsubs' && (
                <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-5">
                  <h3 className="text-[13px] font-bold uppercase tracking-wider text-gray-400 mb-1">Unsubscribe list</h3>
                  <p className="text-[12px] text-gray-500 mb-4">Every address here is silently skipped by the auto-send runner — across all sequences.</p>
                  {unsubscribesList.length === 0 ? (
                    <p className="text-[13px] text-gray-400 py-4">Nobody has unsubscribed. 🎉</p>
                  ) : (
                    <div className="space-y-1.5">
                      {unsubscribesList.map(u => (
                        <div key={u.id} className="flex items-center gap-3 px-3 py-2 border border-gray-100 dark:border-gray-800 rounded-xl text-[13px]">
                          <span className="font-medium text-gray-900 dark:text-gray-100">{u.email}</span>
                          <span className="text-[11px] text-gray-400">{u.reason === 'link_click' ? 'via unsubscribe link' : 'manual'} · {new Date(u.created_at).toLocaleDateString()}</span>
                          <button onClick={() => handleRemoveUnsubscribe(u)} className="ml-auto text-[11px] font-semibold text-gray-400 hover:text-red-600">Remove</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* CSV IMPORT PREVIEW — full-screen view */}
              {coldImportPreview && (
                <div className="fixed inset-0 bg-white dark:bg-gray-950 z-[150] overflow-y-auto">
                  <div>
                    <div className="sticky top-0 z-10 bg-white/95 dark:bg-gray-950/95 backdrop-blur-sm px-4 sm:px-8 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center gap-3">
                      <button onClick={() => setColdImportPreview(null)} className="flex items-center gap-2 text-[13px] font-semibold text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 shrink-0"><span aria-hidden>←</span> Back</button>
                      <h3 className="text-[15px] font-bold text-gray-900 dark:text-gray-100">Import preview</h3>
                      <span className="text-[12px] text-gray-500">
                        {coldImportPreview.filter(r => !r.error && !r.warning).length} valid ·
                        {' '}{coldImportPreview.filter(r => r.warning).length} duplicates ·
                        {' '}{coldImportPreview.filter(r => r.error).length} invalid
                      </span>
                    </div>
                    <div className="max-w-5xl mx-auto w-full px-4 sm:px-8 py-6 overflow-x-auto">
                      <table className="w-full text-[12px]">
                        <thead><tr className="text-left text-[10px] font-bold uppercase tracking-wider text-gray-400"><th className="py-1.5 w-8"></th><th>Email</th><th>Name</th><th className="hidden sm:table-cell">Company</th><th>Status</th></tr></thead>
                        <tbody>
                          {coldImportPreview.map(r => (
                            <tr key={r.key} className={`border-t border-gray-50 dark:border-gray-800/60 ${r.error ? 'bg-red-50/60 dark:bg-red-900/10' : r.warning ? 'bg-yellow-50/60 dark:bg-yellow-900/10' : 'bg-green-50/40 dark:bg-green-900/10'}`}>
                              <td className="py-1.5"><input type="checkbox" disabled={!!r.error} checked={r.checked} onChange={e => setColdImportPreview(prev => prev.map(x => x.key === r.key ? { ...x, checked: e.target.checked } : x))} /></td>
                              <td className="py-1.5 font-medium text-gray-900 dark:text-gray-100">{r.email || '—'}</td>
                              <td className="py-1.5 text-gray-600 dark:text-gray-300">{[r.first_name, r.last_name].filter(Boolean).join(' ') || '—'}</td>
                              <td className="py-1.5 hidden sm:table-cell text-gray-600 dark:text-gray-300">{r.company || '—'}</td>
                              <td className="py-1.5">{r.error ? <span className="text-red-600 font-semibold">{r.error}</span> : r.warning ? <span className="text-yellow-600 font-semibold">{r.warning}</span> : <span className="text-green-600 font-semibold">OK</span>}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-800 flex justify-end gap-2">
                      <button onClick={() => setColdImportPreview(null)} className="px-4 py-2 text-[13px] font-semibold text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700">Cancel</button>
                      <button onClick={handleConfirmColdImport} disabled={coldImportLoading || coldImportPreview.filter(r => r.checked && !r.error).length === 0} className="px-4 py-2 text-[13px] font-semibold text-white bg-gray-900 dark:bg-gray-100 dark:text-gray-900 rounded-xl hover:opacity-90 shadow-sm disabled:opacity-50">
                        {coldImportLoading ? 'Importing…' : `Import ${coldImportPreview.filter(r => r.checked && !r.error).length} contacts`}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* VIEW: SETTINGS */}
        {appStep === 'SETTINGS' && (
          <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300 pb-12">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-gray-900 mb-1">Account Settings</h1>
              <p className="text-[13px] text-gray-500">Manage your profile, security preferences, system configuration, and custom CRM fields.</p>
            </div>

            {settingsMessage.text && (
              <div className={`p-4 rounded-xl text-[13px] font-medium ring-1 ring-inset ${settingsMessage.type === 'error' ? 'bg-red-50 text-red-700 ring-red-600/10' : 'bg-green-50 text-green-700 ring-green-600/10'}`}>
                {settingsMessage.text}
              </div>
            )}

            {/* FEATURE 10 — Team & Workspace (first section) */}
            <div className="bg-white p-6 sm:p-8 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
              <h2 className="text-[15px] font-bold text-gray-900 mb-2">Team & Workspace</h2>
              {!workspace ? (
                <>
                  <p className="text-[13px] text-gray-500 mb-4">You're in solo mode. Create a workspace to invite teammates and share your CRM.</p>
                  <form onSubmit={handleCreateWorkspace} className="flex flex-wrap gap-2 max-w-md">
                    <input type="text" placeholder="Workspace name..." value={newWorkspaceName} onChange={e => setNewWorkspaceName(e.target.value)} className="dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 flex-1 min-w-[160px] px-3 py-2 min-h-[44px] md:min-h-0 text-[13px] border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:border-gray-400" required />
                    <button type="submit" className="px-4 py-2 text-[13px] font-semibold text-white bg-gray-900 rounded-xl hover:opacity-90 shadow-sm">Create Workspace</button>
                  </form>
                </>
              ) : (
                <>
                  <p className="text-[13px] text-gray-500 mb-4">Workspace: <span className="font-bold text-gray-900">{workspace.name}</span> · Your role: <span className="font-semibold capitalize">{myRole}</span></p>
                  <div className="space-y-2 mb-5">
                    {workspaceMembers.map(m => (
                      <div key={m.id} className="flex items-center gap-3 p-3 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50/50 dark:bg-gray-800/40">
                        <span className="w-8 h-8 rounded-full bg-gray-900 text-white text-[12px] font-bold flex items-center justify-center shrink-0">
                          {(m.invited_email || '?').slice(0, 2).toUpperCase()}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-semibold text-gray-900 truncate">{m.invited_email || 'Member'}</p>
                          <p className="text-[11px] text-gray-400">{m.accepted ? 'Active' : 'Invite pending'}</p>
                        </div>
                        {/* Bug D — the owner's row is NEVER editable (for anyone): the owner
                            role is derived from workspaces.owner_id, not reassignable here. */}
                        {['owner', 'admin'].includes(myRole) && m.user_id !== user.id && m.role !== 'owner' ? (
                          <>
                            <select value={m.role} onChange={e => handleUpdateMemberRole(m.id, e.target.value)} className="dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 text-[12px] border border-gray-200 dark:border-gray-700 rounded-md bg-white p-1 text-gray-700 focus:outline-none">
                              {['admin', 'member', 'viewer'].map(r => <option key={r} value={r}>{r}</option>)}
                            </select>
                            <button onClick={() => handleRemoveMember(m.id)} className="text-[12px] font-medium text-red-500 hover:text-red-700">Remove</button>
                          </>
                        ) : (
                          <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">{m.role}</span>
                        )}
                      </div>
                    ))}
                  </div>
                  {['owner', 'admin'].includes(myRole) && (
                    <form onSubmit={handleInviteMember} className="flex flex-wrap gap-2 max-w-md mb-4">
                      <input type="email" placeholder="teammate@company.com" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} className="dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 flex-1 min-w-[160px] px-3 py-2 min-h-[44px] md:min-h-0 text-[13px] border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:border-gray-400" required />
                      <button type="submit" disabled={inviteLoading} className="px-4 py-2 text-[13px] font-semibold text-white bg-gray-900 rounded-xl hover:opacity-90 shadow-sm disabled:opacity-50">{inviteLoading ? 'Inviting...' : 'Invite'}</button>
                    </form>
                  )}
                  {myRole !== 'owner' && (
                    <button onClick={handleLeaveWorkspace} className="px-4 py-2 text-[13px] font-medium text-red-600 bg-red-50 border border-red-100 rounded-lg hover:bg-red-100">Leave Workspace</button>
                  )}
                </>
              )}
            </div>

            {/* n8n & API INTEGRATION HUB */}
            <div className="bg-white p-6 sm:p-8 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow space-y-6">
              <div>
                <h2 className="text-[15px] font-bold text-gray-900">n8n & API Integration</h2>
                <p className="text-[12px] text-gray-500 mt-1">Two-way: n8n reads/writes CRM data via the REST API below, and CRM events trigger your n8n workflows via webhooks.</p>
              </div>

              {/* A — API KEYS */}
              <div>
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-2">API Keys (inbound)</h4>
                {newKeyRaw && (
                  <div className="p-3 mb-2 bg-yellow-50 border border-yellow-200 rounded-xl text-[12px]">
                    <p className="font-semibold text-yellow-800 mb-1">Copy this key now — you won't see it again.</p>
                    <div className="flex gap-2 items-center">
                      <code className="flex-1 bg-white border border-yellow-200 rounded px-2 py-1 font-mono text-[11px] break-all">{newKeyRaw}</code>
                      <button onClick={() => { navigator.clipboard?.writeText(newKeyRaw); showToast('Key copied.', 'success'); }} className="px-2 py-1 text-[11px] font-semibold bg-gray-900 text-white rounded">Copy</button>
                      <button onClick={() => setNewKeyRaw(null)} className="text-gray-400">×</button>
                    </div>
                  </div>
                )}
                <div className="space-y-1.5 mb-2">
                  {apiKeys.length === 0 && <p className="text-[12px] text-gray-400">No keys yet.</p>}
                  {apiKeys.map(k => (
                    <div key={k.id} className="flex items-center gap-2 p-2 border border-gray-100 rounded-lg text-[12px]">
                      <span className="font-semibold text-gray-900">{k.name}</span>
                      <code className="text-gray-400 font-mono">{k.key_prefix}••••</code>
                      <span className="text-gray-400">{(k.scopes || []).join('+')}</span>
                      <span className="text-gray-400 ml-auto">{k.last_used_at ? `used ${new Date(k.last_used_at).toLocaleDateString()}` : 'never used'}</span>
                      {k.revoked ? <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/10">revoked</span>
                        : <button onClick={() => handleRevokeApiKey(k)} className="text-red-500 hover:text-red-700 font-medium">Revoke</button>}
                    </div>
                  ))}
                </div>
                <form onSubmit={handleGenerateApiKey} className="flex gap-2">
                  <input type="text" required placeholder='Key name (e.g. "n8n production")' value={newKeyName} onChange={e => setNewKeyName(e.target.value)} className="dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 flex-1 px-3 py-2 text-[13px] border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none" />
                  <button type="submit" className="px-3 py-2 text-[12px] font-semibold text-white bg-gray-900 rounded-xl hover:opacity-90">Generate API Key</button>
                </form>
              </div>

              {/* B — CONNECT n8n (outbound) */}
              <div>
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-2">Connect to n8n (outbound webhooks)</h4>
                <form onSubmit={handleConnectN8n} className="space-y-2">
                  <input type="url" required placeholder="https://your-n8n-host/webhook/xxxx (Webhook Trigger URL)" value={n8nHook.url} onChange={e => setN8nHook({ ...n8nHook, url: e.target.value })} className="dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 w-full px-3 py-2 text-[13px] border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none" />
                  <div className="flex flex-wrap gap-1.5">
                    {WEBHOOK_EVENTS.map(ev => (
                      <button key={ev.value} type="button" onClick={() => setN8nHook(prev => ({ ...prev, events: prev.events.includes(ev.value) ? prev.events.filter(x => x !== ev.value) : [...prev.events, ev.value] }))}
                        className={`text-[11px] font-semibold px-2 py-1 rounded-full ring-1 ring-inset ${n8nHook.events.includes(ev.value) ? 'bg-gray-900 text-white ring-gray-900' : 'bg-white text-gray-500 ring-gray-200'}`}>{ev.label}</button>
                    ))}
                  </div>
                  <button type="submit" className="px-3 py-2 text-[12px] font-semibold text-white bg-gray-900 rounded-xl hover:opacity-90">Create n8n Webhook</button>
                </form>
                {webhooks.filter(w => w.provider === 'n8n').map(w => (
                  <div key={w.id} className="mt-2 p-2 border border-gray-100 rounded-lg text-[12px] flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{w.name}</span><code className="text-gray-400 truncate max-w-[200px]">{w.url}</code>
                    <span className="text-gray-400">signing secret:</span>
                    <button onClick={() => { navigator.clipboard?.writeText(w.secret || ''); showToast('Secret copied.', 'success'); }} className="px-2 py-0.5 text-[11px] font-semibold bg-gray-100 rounded">Copy secret</button>
                    <button onClick={() => handleTestWebhook(w)} className="text-indigo-600 font-medium">Send test event</button>
                    {w.last_status_code != null && <span className="text-gray-400">last: {w.last_status_code}</span>}
                  </div>
                ))}
                <p className="text-[11px] text-gray-400 mt-1.5">Bodies are {'{ event, timestamp, data }'} signed with HMAC-SHA256 in the X-CRM-Signature header — verify in an n8n Function node with your secret. HTTPS URLs only.</p>
              </div>

              {/* C — API REFERENCE */}
              <details className="border border-gray-100 rounded-xl p-3">
                <summary className="text-[12px] font-semibold text-gray-700 cursor-pointer">API Reference — paste into n8n HTTP Request nodes</summary>
                <div className="mt-2 text-[11px] font-mono text-gray-600 space-y-1 overflow-x-auto">
                  <p className="font-sans text-gray-500">Base URL: this app's origin · Header: Authorization: Bearer &lt;your key&gt; · Responses: {'{ ok, data }'}</p>
                  <p>GET  /api/v1/me</p>
                  <p>GET  /api/v1/relationships?status=&priority=&search=&limit=&offset=</p>
                  <p>POST /api/v1/relationships {'{ name*, email*, phone_number, company_name, company_url, status, relationship, source, linkedin_url, notes }'}</p>
                  <p>GET|PATCH|DELETE /api/v1/relationships/:id</p>
                  <p>GET  /api/v1/relationships/:id/activities</p>
                  <p>POST /api/v1/activities {'{ client_id*, activity_type*, description*, activity_date? }'}</p>
                  <p>GET  /api/v1/deals?stage= · POST /api/v1/deals {'{ client_id*, title*, value, stage, ... }'} · PATCH /api/v1/deals/:id</p>
                  <p>GET  /api/v1/tasks?status= · POST /api/v1/tasks {'{ client_id*, title*, due_date }'} · PATCH /api/v1/tasks/:id</p>
                  <p>POST /api/v1/sequences/:id/enroll {'{ client_id* }'}</p>
                  <p className="font-sans text-gray-500">curl example: curl -H "Authorization: Bearer n8n_..." {'{origin}'}/api/v1/me</p>
                </div>
              </details>

              {/* D — ACTIVITY LOG */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Integration Activity Log</h4>
                  <select value={logDirFilter} onChange={e => setLogDirFilter(e.target.value)} className="dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 text-[11px] border border-gray-200 dark:border-gray-700 rounded p-0.5 ml-auto">
                    <option value="all">All</option><option value="inbound">Inbound</option><option value="outbound">Outbound</option><option value="failed">Failed only</option>
                  </select>
                  <button onClick={() => fetchIntegration(user.id)} className="text-[11px] text-indigo-600 font-medium">Refresh</button>
                </div>
                <div className="max-h-56 overflow-y-auto border border-gray-100 rounded-xl divide-y divide-gray-50 text-[11px]">
                  {integrationLogs.filter(l => logDirFilter === 'all' || (logDirFilter === 'failed' ? !l.ok : l.direction === logDirFilter)).slice(0, 50).map(l => (
                    <div key={l.id} className="flex items-center gap-2 px-2 py-1.5">
                      <span className="text-gray-400 w-32 shrink-0">{new Date(l.created_at).toLocaleString()}</span>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ring-1 ring-inset ${l.direction === 'inbound' ? 'bg-blue-50 text-blue-700 ring-blue-600/10' : 'bg-purple-50 text-purple-700 ring-purple-600/10'}`}>{l.direction}</span>
                      <span className="font-mono truncate flex-1">{l.method ? `${l.method} ` : ''}{l.event}</span>
                      <span className={`font-bold ${l.ok ? 'text-green-600' : 'text-red-500'}`}>{l.status_code ?? '—'}</span>
                    </div>
                  ))}
                  {integrationLogs.length === 0 && <p className="p-3 text-gray-400">No integration calls yet.</p>}
                </div>
              </div>
            </div>

            {/* UPGRADE 1 & 7 — EMAIL AUTOMATION */}
            <div className="bg-white p-6 sm:p-8 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
              <h2 className="text-[15px] font-bold text-gray-900 mb-2">Email Automation</h2>
              <p className="text-[13px] text-gray-500 mb-4">When enabled, due sequence steps send themselves every 15 minutes from your connected Gmail (within your send window). When off, steps wait in the N8N Outbox for manual sending — both paths always work.</p>
              <div className="space-y-4 text-[13px]">
                <div className="flex flex-wrap items-center gap-3">
                  {/* Sender = the user's OWN connected Gmail (Resend removed) */}
                  {gmailConn && !gmailConn.needs_reauth ? (
                    <span className="text-[13px] text-gray-700">Sends as <span className="font-semibold text-gray-900">{gmailConn.email_address || 'your Gmail'}</span></span>
                  ) : (
                    <span className="text-[13px] text-gray-500">No Gmail connected — <button onClick={handleConnectGmail} className="font-semibold text-indigo-600 hover:underline">Connect Gmail</button> to enable auto-send.</span>
                  )}
                  <button
                    onClick={() => handleSaveEmailSettings({ auto_send_enabled: !(emailSettings?.auto_send_enabled) })}
                    disabled={!gmailConn || gmailConn.needs_reauth}
                    title={!gmailConn || gmailConn.needs_reauth ? 'Connect Gmail first' : ''}
                    className={`px-4 py-2 text-[13px] font-semibold rounded-xl shadow-sm disabled:opacity-50 disabled:cursor-not-allowed ${emailSettings?.auto_send_enabled ? 'bg-green-600 text-white' : 'bg-gray-900 text-white hover:opacity-90'}`}>
                    {emailSettings?.auto_send_enabled ? 'Auto-send: ON ✓' : 'Auto-send: OFF — enable'}
                  </button>
                </div>
                {gmailConn?.needs_reauth && (
                  <p className="text-[12px] text-red-700 bg-red-50 border border-red-100 rounded-lg p-2">Gmail connection expired — reconnect to resume sending. <button onClick={handleConnectGmail} className="font-semibold underline">Reconnect</button></p>
                )}
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-1.5">Send days</label>
                  <div className="flex gap-1.5 flex-wrap">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d, i) => {
                      const on = (emailSettings?.send_days ?? [1, 2, 3, 4, 5]).includes(i);
                      return (
                        <button key={d} onClick={() => {
                          const cur = emailSettings?.send_days ?? [1, 2, 3, 4, 5];
                          handleSaveEmailSettings({ send_days: on ? cur.filter(x => x !== i) : [...cur, i].sort() });
                        }} className={`px-3 py-1 rounded-full text-[12px] font-semibold ring-1 ring-inset ${on ? 'bg-gray-900 text-white ring-gray-900' : 'bg-white text-gray-500 ring-gray-200 hover:ring-gray-400'}`}>{d}</button>
                      );
                    })}
                  </div>
                </div>
                <div className="flex flex-wrap gap-4">
                  <label className="text-[12px] text-gray-500 flex items-center gap-2">Window
                    <select value={emailSettings?.send_window_start ?? 9} onChange={e => handleSaveEmailSettings({ send_window_start: parseInt(e.target.value, 10) })} className="dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 px-2 py-1.5 border border-gray-200 dark:border-gray-700 rounded-lg bg-white focus:outline-none">
                      {[...Array(24)].map((_, h) => <option key={h} value={h}>{h}:00</option>)}
                    </select>
                    to
                    <select value={emailSettings?.send_window_end ?? 17} onChange={e => handleSaveEmailSettings({ send_window_end: parseInt(e.target.value, 10) })} className="dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 px-2 py-1.5 border border-gray-200 dark:border-gray-700 rounded-lg bg-white focus:outline-none">
                      {[...Array(24)].map((_, h) => <option key={h} value={h + 1}>{h + 1}:00</option>)}
                    </select>
                  </label>
                  <label className="text-[12px] text-gray-500 flex items-center gap-2">Timezone
                    <select value={emailSettings?.send_tz_offset ?? -new Date().getTimezoneOffset()} onChange={e => handleSaveEmailSettings({ send_tz_offset: parseInt(e.target.value, 10) })} className="dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 px-2 py-1.5 border border-gray-200 dark:border-gray-700 rounded-lg bg-white focus:outline-none">
                      {[-12, -11, -10, -9, -8, -7, -6, -5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 5.5, 6, 7, 8, 9, 10, 11, 12, 13, 14].map(h => (
                        <option key={h} value={Math.round(h * 60)}>UTC{h >= 0 ? '+' : ''}{h}</option>
                      ))}
                    </select>
                  </label>
                  <label className="text-[12px] text-gray-500 flex items-center gap-2">Daily email cap
                    <input type="number" min="1" defaultValue={emailSettings?.daily_send_cap ?? 50} onBlur={e => handleSaveEmailSettings({ daily_send_cap: Math.max(1, parseInt(e.target.value, 10) || 50) })} className="dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 w-20 px-2 py-1.5 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none" />
                  </label>
                  <label className="text-[12px] text-gray-500 flex items-center gap-2" title="Max LinkedIn connect/view tasks created per day — protects your account from looking automated">Daily LinkedIn cap
                    <input type="number" min="1" defaultValue={emailSettings?.linkedin_daily_cap ?? 20} onBlur={e => handleSaveEmailSettings({ linkedin_daily_cap: Math.max(1, parseInt(e.target.value, 10) || 20) })} className="dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 w-20 px-2 py-1.5 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none" />
                  </label>
                </div>
              </div>
            </div>

            {/* G1 — GMAIL SYNC */}
            <div className="bg-white p-6 sm:p-8 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
              <h2 className="text-[15px] font-bold text-gray-900 mb-2">Gmail Sync</h2>
              {!gmailConn ? (
                <>
                  <p className="text-[13px] text-gray-500 mb-4">Connect Gmail (read-only) to automatically log emails to and from your relationships as Email activities.</p>
                  <button onClick={handleConnectGmail} className="px-4 py-2 text-[13px] font-semibold text-white bg-gray-900 rounded-xl hover:opacity-90 shadow-sm">Connect Gmail for automatic activity sync</button>
                </>
              ) : (
                <>
                  <p className="text-[13px] text-gray-500 mb-4">
                    Connected{gmailConn.email_address ? <> as <span className="font-semibold text-gray-900">{gmailConn.email_address}</span></> : ''} · since {new Date(gmailConn.connected_at).toLocaleDateString()}
                    {gmailConn.last_synced_at ? <> · last synced {new Date(gmailConn.last_synced_at).toLocaleString()}</> : ' · never synced yet'}
                  </p>
                  {gmailConn.needs_reauth && (
                    <p className="text-[12px] text-red-700 bg-red-50 border border-red-100 rounded-lg p-2 mb-3">Gmail connection expired — reconnect to resume syncing and sending. <button onClick={handleConnectGmail} className="font-semibold underline">Reconnect</button></p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <button onClick={handleGmailSyncNow} disabled={gmailSyncing} className="px-4 py-2 text-[13px] font-semibold text-white bg-gray-900 rounded-xl hover:opacity-90 shadow-sm disabled:opacity-50 flex items-center gap-2">
                      {gmailSyncing && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                      {gmailSyncing ? 'Syncing…' : 'Sync now'}
                    </button>
                    <button onClick={handleDisconnectGmail} className="px-4 py-2 text-[13px] font-medium text-red-600 bg-red-50 border border-red-100 rounded-xl hover:bg-red-100">Disconnect</button>
                  </div>
                  <p className="text-[11px] text-gray-400 mt-3">Scans the last 7 days for messages to/from relationship emails; duplicates are skipped automatically. Scheduled background sync can be added with pg_cron once you want it.</p>
                </>
              )}
            </div>

            {/* Profile Information Block */}
            <div className="bg-white p-6 sm:p-8 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
              <h2 className="text-[15px] font-bold text-gray-900 mb-5">Profile Information</h2>
              <form onSubmit={handleUpdateProfile} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Full Name</label>
                    <input type="text" value={profile.username} onChange={e => setProfile({...profile, username: e.target.value})} className="dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 w-full px-3 py-2 text-[13px] bg-white border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:border-gray-400" />
                  </div>
                  <div>
                    <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Phone Number</label>
                    <input type="text" value={profile.phone_number} onChange={e => setProfile({...profile, phone_number: e.target.value})} className="dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 w-full px-3 py-2 text-[13px] bg-white border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:border-gray-400" />
                  </div>
                  <div>
                    <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Country / Region</label>
                    <input type="text" list="country-list" value={profile.country} onChange={e => setProfile({...profile, country: e.target.value})} className="dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 w-full px-3 py-2 text-[13px] bg-white border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:border-gray-400" />
                  </div>
                  <div>
                    <label className="block text-[12px] font-medium text-gray-700 mb-1.5">LinkedIn Profile</label>
                    <input type="url" value={profile.linkedin_profile} onChange={e => setProfile({...profile, linkedin_profile: e.target.value})} className="dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 w-full px-3 py-2 text-[13px] bg-white border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:border-gray-400" />
                  </div>
                </div>
                <div className="flex justify-end pt-2">
                  <button type="submit" className="px-4 py-2 text-[13px] font-semibold text-white bg-gray-900 rounded-xl hover:opacity-90 transition-colors shadow-sm">Save Profile Updates</button>
                </div>
              </form>
            </div>

            {/* NEW: Custom Fields Configuration */}
            <div className="bg-white p-6 sm:p-8 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start mb-5">
                <div>
                  <h2 className="text-[15px] font-bold text-gray-900">Custom Fields</h2>
                  <p className="text-[12px] text-gray-500 mt-1">Add education-specific tracking metrics (School, Major, Grad Year) or other personalized data fields for your relationships.</p>
                </div>
              </div>
              
              {/* Existing Fields List */}
              <div className="space-y-2 mb-6">
                {customFieldDefs.length === 0 ? (
                  <p className="text-[13px] text-gray-400 italic p-4 bg-gray-50 border border-gray-100 rounded-lg text-center">No custom fields defined yet.</p>
                ) : (
                  customFieldDefs.map((cf, idx) => (
                    <div key={cf.id} className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50/50 dark:bg-gray-800/40 group">
                      <div className="flex items-center gap-3">
                        <span className="text-[12px] font-bold text-gray-400 w-5 text-center">{idx + 1}</span>
                        <div>
                          <p className="text-[13px] font-semibold text-gray-900">{cf.field_name}</p>
                          <p className="text-[11px] text-gray-500 uppercase tracking-wider mt-0.5">{cf.field_type} {cf.field_type === 'select' ? `(${cf.select_options?.length} options)` : ''}</p>
                        </div>
                      </div>
                      <button onClick={() => handleDeleteCustomField(cf.id)} className="text-[12px] font-medium text-red-500 hover:text-red-700 px-2 py-1 bg-white border border-gray-200 rounded shadow-sm opacity-0 group-hover:opacity-100 transition-opacity">Delete Field</button>
                    </div>
                  ))
                )}
              </div>

              {/* Add New Field Form */}
              <form onSubmit={handleAddCustomField} className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                <h4 className="text-[12px] font-bold uppercase tracking-wider text-gray-500 mb-3">Create New Custom Field</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-gray-700 mb-1">Field Name (e.g. "Major")</label>
                    <input type="text" required value={newCfName} onChange={e => setNewCfName(e.target.value)} className="dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 w-full px-3 py-1.5 text-[13px] bg-white border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-gray-700 mb-1">Input Type</label>
                    <select value={newCfType} onChange={e => setNewCfType(e.target.value)} className="dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 w-full px-3 py-1.5 text-[13px] bg-white border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none">
                      <option value="text">Short Text</option>
                      <option value="number">Number</option>
                      <option value="date">Date</option>
                      <option value="select">Dropdown Select</option>
                    </select>
                  </div>
                  {newCfType === 'select' ? (
                    <div>
                      <label className="block text-[11px] font-medium text-gray-700 mb-1">Options (Comma separated)</label>
                      <input type="text" required placeholder="CS, Bio, Art" value={newCfOptions} onChange={e => setNewCfOptions(e.target.value)} className="dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 w-full px-3 py-1.5 text-[13px] bg-white border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none" />
                    </div>
                  ) : (
                    <div className="flex items-end justify-end">
                      <button type="submit" className="w-full sm:w-auto px-4 py-1.5 text-[12px] font-semibold text-white bg-gray-900 rounded-xl hover:opacity-90 transition-colors shadow-sm">Add Field</button>
                    </div>
                  )}
                </div>
                {newCfType === 'select' && (
                  <div className="flex justify-end mt-3">
                    <button type="submit" className="px-4 py-1.5 text-[12px] font-semibold text-white bg-gray-900 rounded-xl hover:opacity-90 transition-colors shadow-sm">Add Dropdown Field</button>
                  </div>
                )}
              </form>
            </div>

            {/* Data Admin Tools */}
            <div className="bg-white p-6 sm:p-8 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
              <h2 className="text-[15px] font-bold text-gray-900 mb-5">Data Tools</h2>
              <button onClick={runStatusMigration} className="px-4 py-2 text-[12px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition-colors shadow-sm">
                Migrate Legacy "Active/Inactive" Status to New Pipeline Stages
              </button>
              <p className="text-[11px] text-gray-500 mt-2">Use this utility once if you have old CRM entries showing raw "Active" or "Inactive" tags in the Pipeline column to port them cleanly to the new Kanban Board structure.</p>
            </div>

            {/* FEATURE 4 — Email Templates */}
            <div className="bg-white p-6 sm:p-8 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
              <h2 className="text-[15px] font-bold text-gray-900 mb-2">Email Templates</h2>
              <p className="text-[12px] text-gray-500 mb-4">Reusable templates for the email composer and N8N sequence steps. Merge tags: {'{{name}} {{email}} {{phone}} {{stage}} {{company}}'}.</p>
              <div className="space-y-2 mb-5">
                {emailTemplates.length === 0 ? (
                  <p className="text-[13px] text-gray-400 italic p-4 bg-gray-50 border border-gray-100 rounded-lg text-center">No templates yet.</p>
                ) : emailTemplates.map(t => (
                  <div key={t.id} className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50/50 dark:bg-gray-800/40">
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold text-gray-900">{t.name}</p>
                      <p className="text-[11px] text-gray-500 truncate">{t.subject}</p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button onClick={() => { setEditingTemplate(t); setTemplateName(t.name); setTemplateSubject(t.subject); setTemplateBody(t.body); }} className="text-[12px] font-medium text-gray-500 hover:text-gray-900">Edit</button>
                      <button onClick={() => handleDeleteEmailTemplate(t.id)} className="text-[12px] font-medium text-red-500 hover:text-red-700">Delete</button>
                    </div>
                  </div>
                ))}
              </div>
              <form onSubmit={handleSaveEmailTemplate} className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3">
                <h4 className="text-[12px] font-bold uppercase tracking-wider text-gray-500">{editingTemplate ? 'Edit Template' : 'New Template'}</h4>
                <input type="text" required placeholder="Template name" value={templateName} onChange={e => setTemplateName(e.target.value)} className="dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 w-full px-3 py-2 text-[13px] bg-white border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none" />
                <input type="text" required placeholder="Subject — supports {{name}} {{email}} {{phone}} {{stage}}" value={templateSubject} onChange={e => setTemplateSubject(e.target.value)} className="dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 w-full px-3 py-2 text-[13px] bg-white border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none" />
                <textarea rows={4} required placeholder="Body" value={templateBody} onChange={e => setTemplateBody(e.target.value)} className="dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 w-full px-3 py-2 text-[13px] bg-white border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none" />
                <div className="flex justify-end gap-2">
                  {editingTemplate && <button type="button" onClick={() => { setEditingTemplate(null); setTemplateName(''); setTemplateSubject(''); setTemplateBody(''); }} className="px-4 py-1.5 text-[12px] font-medium text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50">Cancel</button>}
                  <button type="submit" className="px-4 py-1.5 text-[12px] font-semibold text-white bg-gray-900 rounded-xl hover:opacity-90 shadow-sm">{editingTemplate ? 'Save Changes' : 'Add Template'}</button>
                </div>
              </form>
            </div>

            {/* FEATURE 5 — Automation Rules */}
            <div className="bg-white p-6 sm:p-8 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h2 className="text-[15px] font-bold text-gray-900">Automation Rules</h2>
                  <p className="text-[12px] text-gray-500 mt-1">When something happens in your CRM, do something automatically.</p>
                </div>
                <button onClick={() => setShowRuleForm(!showRuleForm)} className="px-3 py-1.5 text-[12px] font-semibold text-white bg-gray-900 rounded-xl hover:opacity-90 shadow-sm shrink-0">{showRuleForm ? 'Close' : 'Add Rule'}</button>
              </div>
              <div className="space-y-2 mb-4">
                {automationRules.length === 0 ? (
                  <p className="text-[13px] text-gray-400 italic p-4 bg-gray-50 border border-gray-100 rounded-lg text-center">No automation rules yet.</p>
                ) : automationRules.map(r => {
                  const triggerLabel = {
                    stage_change: `Relationship moves to "${r.trigger_value}"`,
                    deal_stage_change: `Deal moves to "${r.trigger_value}"`,
                    no_activity_days: `No activity for ${r.trigger_value} days`,
                    task_overdue: 'A task becomes overdue',
                  }[r.trigger_type] || r.trigger_type;
                  const actionLabel = {
                    create_task: `Create task "${r.action_value?.title || 'Follow up'}"`,
                    send_notification: 'Send a notification',
                    change_stage: `Move relationship to "${r.action_value?.stage}"`,
                    send_email: 'Send an email',
                  }[r.action_type] || r.action_type;
                  return (
                    <div key={r.id} className="flex items-center gap-3 p-3 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50/50 dark:bg-gray-800/40">
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-semibold text-gray-900">{r.name}</p>
                        <p className="text-[11px] text-gray-500 truncate">When: {triggerLabel} → Then: {actionLabel}</p>
                      </div>
                      {(r.run_count || 0) > 0 && <span className="text-[10px] font-bold bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full shrink-0">ran ×{r.run_count}</span>}
                      <button onClick={() => handleToggleRule(r)} className={`text-[11px] font-bold px-2.5 py-1 rounded-full shrink-0 transition-colors ${r.enabled ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'}`}>{r.enabled ? 'On' : 'Off'}</button>
                      <button onClick={() => handleDeleteRule(r.id)} className="text-[12px] font-medium text-red-500 hover:text-red-700 shrink-0">Delete</button>
                    </div>
                  );
                })}
              </div>
              {/* G11 — RECIPES GALLERY */}
              <div className="mb-4">
                <h4 className="text-[12px] font-bold uppercase tracking-wider text-gray-500 mb-2">Recipes — enable in one click</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {AUTOMATION_RECIPES.map(r => {
                    const enabled = automationRules.some(x => x.name === r.name);
                    return (
                      <div key={r.name} className="p-3 border border-gray-100 rounded-xl bg-gray-50/50 dark:bg-gray-800/40 flex flex-col gap-1.5">
                        <p className="text-[13px] font-semibold text-gray-900">{r.name}</p>
                        <p className="text-[11px] text-gray-500 flex-1">{r.desc}</p>
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-gray-400">{r.note}</span>
                          <button onClick={() => handleEnableRecipe(r)} disabled={enabled} className={`px-2.5 py-1 text-[11px] font-semibold rounded-full ${enabled ? 'bg-green-100 text-green-700' : 'bg-gray-900 text-white hover:opacity-90'}`}>
                            {enabled ? 'Enabled ✓' : 'Enable'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {showRuleForm && (
                <form onSubmit={handleCreateRule} className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3 text-[13px]">
                  <input type="text" required placeholder="Rule name (e.g. Follow up new engaged clients)" value={newRule.name} onChange={e => setNewRule({ ...newRule, name: e.target.value })} className="dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 w-full px-3 py-2 bg-white border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none" />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-medium text-gray-700 mb-1">When (trigger)</label>
                      <select value={newRule.triggerType} onChange={e => setNewRule({ ...newRule, triggerType: e.target.value, triggerValue: '' })} className="dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 w-full px-3 py-2 bg-white border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none text-gray-700">
                        <option value="stage_change">Relationship stage changes to...</option>
                        <option value="deal_stage_change">Deal stage changes to...</option>
                        <option value="no_activity_days">No activity for N days (daily check)</option>
                        <option value="task_overdue">Task becomes overdue (daily check)</option>
                      </select>
                      {newRule.triggerType === 'stage_change' && (
                        <select value={newRule.triggerValue} onChange={e => setNewRule({ ...newRule, triggerValue: e.target.value })} className="dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 w-full mt-2 px-3 py-2 bg-white border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none text-gray-700" required>
                          <option value="">-- Stage --</option>
                          {PIPELINE_STAGES.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      )}
                      {newRule.triggerType === 'deal_stage_change' && (
                        <select value={newRule.triggerValue} onChange={e => setNewRule({ ...newRule, triggerValue: e.target.value })} className="dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 w-full mt-2 px-3 py-2 bg-white border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none text-gray-700" required>
                          <option value="">-- Stage --</option>
                          {DEAL_STAGES.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      )}
                      {newRule.triggerType === 'no_activity_days' && (
                        <input type="number" min="1" placeholder="Days (e.g. 30)" value={newRule.triggerValue} onChange={e => setNewRule({ ...newRule, triggerValue: e.target.value })} className="dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 w-full mt-2 px-3 py-2 bg-white border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none" required />
                      )}
                      <p className="text-[11px] text-gray-400 mt-1.5">
                        {{
                          stage_change: 'Fires immediately when a relationship is dragged or edited into this stage.',
                          deal_stage_change: 'Fires immediately when a deal moves to this stage.',
                          no_activity_days: 'Evaluated by the daily notification job.',
                          task_overdue: 'Evaluated by the daily notification job.',
                        }[newRule.triggerType]}
                      </p>
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-gray-700 mb-1">Then (action)</label>
                      <select value={newRule.actionType} onChange={e => setNewRule({ ...newRule, actionType: e.target.value, actionValue: {} })} className="dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 w-full px-3 py-2 bg-white border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none text-gray-700">
                        <option value="create_task">Create a task</option>
                        <option value="send_notification">Send a notification</option>
                        <option value="change_stage">Change relationship stage</option>
                        <option value="send_email">Send an email</option>
                      </select>
                      {newRule.actionType === 'create_task' && (
                        <div className="mt-2 space-y-2">
                          <input type="text" placeholder="Task title" value={newRule.actionValue.title || ''} onChange={e => setNewRule({ ...newRule, actionValue: { ...newRule.actionValue, title: e.target.value } })} className="dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 w-full px-3 py-2 bg-white border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none" required />
                          <input type="number" min="0" placeholder="Due in N days (default 1)" value={newRule.actionValue.days_offset || ''} onChange={e => setNewRule({ ...newRule, actionValue: { ...newRule.actionValue, days_offset: e.target.value } })} className="dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 w-full px-3 py-2 bg-white border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none" />
                        </div>
                      )}
                      {newRule.actionType === 'send_notification' && (
                        <input type="text" placeholder="Notification message" value={newRule.actionValue.message || ''} onChange={e => setNewRule({ ...newRule, actionValue: { ...newRule.actionValue, message: e.target.value } })} className="dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 w-full mt-2 px-3 py-2 bg-white border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none" required />
                      )}
                      {newRule.actionType === 'change_stage' && (
                        <select value={newRule.actionValue.stage || ''} onChange={e => setNewRule({ ...newRule, actionValue: { ...newRule.actionValue, stage: e.target.value } })} className="dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 w-full mt-2 px-3 py-2 bg-white border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none text-gray-700" required>
                          <option value="">-- Stage --</option>
                          {PIPELINE_STAGES.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      )}
                      {newRule.actionType === 'send_email' && (
                        <div className="mt-2 space-y-2">
                          <input type="text" placeholder="Subject" value={newRule.actionValue.subject || ''} onChange={e => setNewRule({ ...newRule, actionValue: { ...newRule.actionValue, subject: e.target.value } })} className="dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 w-full px-3 py-2 bg-white border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none" required />
                          <textarea rows={2} placeholder="Body — supports {{name}} etc." value={newRule.actionValue.body || ''} onChange={e => setNewRule({ ...newRule, actionValue: { ...newRule.actionValue, body: e.target.value } })} className="dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 w-full px-3 py-2 bg-white border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none" required />
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <button type="submit" className="px-4 py-1.5 text-[12px] font-semibold text-white bg-gray-900 rounded-xl hover:opacity-90 shadow-sm">Create Rule</button>
                  </div>
                </form>
              )}
            </div>

            {/* FEATURE 9 — Tags */}
            <div className="bg-white p-6 sm:p-8 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
              <h2 className="text-[15px] font-bold text-gray-900 mb-4">Tags</h2>
              <div className="space-y-2 mb-5">
                {tags.length === 0 ? (
                  <p className="text-[13px] text-gray-400 italic p-4 bg-gray-50 border border-gray-100 rounded-lg text-center">No tags yet — create tags to segment your relationships.</p>
                ) : tags.map(t => {
                  const count = Object.values(clientTagMap).filter(ids => ids.includes(t.id)).length;
                  return (
                    <div key={t.id} className="flex items-center gap-3 p-3 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50/50 dark:bg-gray-800/40">
                      <span className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: t.color }} />
                      <span className="text-[13px] font-semibold text-gray-900 flex-1">{t.name}</span>
                      <span className="text-[11px] text-gray-400">{count} relationship{count === 1 ? '' : 's'}</span>
                      <button onClick={() => handleDeleteTag(t)} className="text-[12px] font-medium text-red-500 hover:text-red-700">Delete</button>
                    </div>
                  );
                })}
              </div>
              <form onSubmit={handleCreateTag} className="bg-gray-50 border border-gray-200 rounded-xl p-4 flex flex-wrap items-end gap-3">
                <div className="flex-1 min-w-[160px]">
                  <label className="block text-[11px] font-medium text-gray-700 mb-1">Tag name</label>
                  <input type="text" required value={newTagName} onChange={e => setNewTagName(e.target.value)} className="dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 w-full px-3 py-2 text-[13px] bg-white border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none" />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-gray-700 mb-1">Color</label>
                  <div className="flex gap-1.5">
                    {TAG_COLORS.map(c => (
                      <button key={c} type="button" onClick={() => setNewTagColor(c)} className={`w-6 h-6 rounded-full transition-transform ${newTagColor === c ? 'ring-2 ring-offset-1 ring-gray-400 scale-110' : ''}`} style={{ backgroundColor: c }} />
                    ))}
                  </div>
                </div>
                <button type="submit" className="px-4 py-2 text-[12px] font-semibold text-white bg-gray-900 rounded-xl hover:opacity-90 shadow-sm">Add Tag</button>
              </form>
            </div>

            {/* FEATURE 11 — Webhooks & Integrations */}
            <div className="bg-white p-6 sm:p-8 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h2 className="text-[15px] font-bold text-gray-900">Webhooks & Integrations</h2>
                  <p className="text-[12px] text-gray-500 mt-1">POST CRM events to any URL. Payloads are signed with HMAC-SHA256 (X-CRM-Signature) when a secret is set.</p>
                </div>
                <button onClick={() => setShowWebhookForm(!showWebhookForm)} className="px-3 py-1.5 text-[12px] font-semibold text-white bg-gray-900 rounded-xl hover:opacity-90 shadow-sm shrink-0">{showWebhookForm ? 'Close' : 'Add Webhook'}</button>
              </div>
              <div className="bg-orange-50 border border-orange-100 rounded-xl p-3 mb-4 text-[12px] text-orange-800">
                <strong>Zapier tip:</strong> create a Zap with a "Catch Hook" trigger, paste the hook URL here, and pick the events to forward. Every event arrives as JSON: <code className="font-mono text-[11px]">{'{ event, payload, timestamp }'}</code>.
              </div>
              <div className="space-y-2 mb-4">
                {webhooks.length === 0 ? (
                  <p className="text-[13px] text-gray-400 italic p-4 bg-gray-50 border border-gray-100 rounded-lg text-center">No webhooks configured.</p>
                ) : webhooks.map(w => (
                  <div key={w.id} className="p-3 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50/50 dark:bg-gray-800/40">
                    <div className="flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-semibold text-gray-900">{w.name}</p>
                        <p className="text-[11px] font-mono text-gray-400 truncate">{w.url}</p>
                      </div>
                      <button onClick={() => handleToggleWebhook(w)} className={`text-[11px] font-bold px-2.5 py-1 rounded-full shrink-0 ${w.enabled ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'}`}>{w.enabled ? 'On' : 'Off'}</button>
                      <button onClick={() => handleTestWebhook(w)} className="text-[12px] font-medium text-gray-500 hover:text-gray-900 shrink-0">Test</button>
                      <button onClick={() => handleDeleteWebhook(w.id)} className="text-[12px] font-medium text-red-500 hover:text-red-700 shrink-0">Delete</button>
                    </div>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {(w.events || []).map(ev => <span key={ev} className="text-[10px] font-bold bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">{ev}</span>)}
                      {w.last_triggered_at && <span className="text-[10px] text-gray-400 ml-auto">Last triggered {new Date(w.last_triggered_at).toLocaleString()}</span>}
                    </div>
                  </div>
                ))}
              </div>
              {showWebhookForm && (
                <form onSubmit={handleCreateWebhook} className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3 text-[13px]">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input type="text" required placeholder="Name (e.g. Zapier — new clients)" value={newWebhook.name} onChange={e => setNewWebhook({ ...newWebhook, name: e.target.value })} className="dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 px-3 py-2 bg-white border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none" />
                    <input type="url" required placeholder="https://hooks.zapier.com/..." value={newWebhook.url} onChange={e => setNewWebhook({ ...newWebhook, url: e.target.value })} className="dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 px-3 py-2 bg-white border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none" />
                  </div>
                  <input type="text" placeholder="Signing secret (optional)" value={newWebhook.secret} onChange={e => setNewWebhook({ ...newWebhook, secret: e.target.value })} className="dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 w-full px-3 py-2 bg-white border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none" />
                  <div className="flex flex-wrap gap-2">
                    {WEBHOOK_EVENTS.map(ev => (
                      <label key={ev.value} className={`text-[11px] font-semibold px-2 py-1 rounded-full border cursor-pointer transition-colors ${newWebhook.events.includes(ev.value) ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'}`}>
                        <input type="checkbox" className="dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 hidden" checked={newWebhook.events.includes(ev.value)} onChange={() => setNewWebhook(prev => ({ ...prev, events: prev.events.includes(ev.value) ? prev.events.filter(x => x !== ev.value) : [...prev.events, ev.value] }))} />
                        {ev.label}
                      </label>
                    ))}
                  </div>
                  <div className="flex justify-end">
                    <button type="submit" className="px-4 py-1.5 text-[12px] font-semibold text-white bg-gray-900 rounded-xl hover:opacity-90 shadow-sm">Add Webhook</button>
                  </div>
                </form>
              )}
            </div>

            {/* FEATURE 26 — Goals management */}
            <div className="bg-white p-6 sm:p-8 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start mb-4">
                <h2 className="text-[15px] font-bold text-gray-900">Monthly Goals</h2>
                <button onClick={() => setShowGoalForm(true)} className="px-3 py-1.5 text-[12px] font-semibold text-white bg-gray-900 rounded-xl hover:opacity-90 shadow-sm">Set Goal</button>
              </div>
              {goals.length === 0 ? (
                <p className="text-[13px] text-gray-400 italic p-4 bg-gray-50 border border-gray-100 rounded-lg text-center">No goals yet.</p>
              ) : (
                <div className="space-y-2">
                  {[...goals].sort((a, b) => (b.month || '').localeCompare(a.month || '')).map(g => (
                    <div key={g.id} className="flex items-center gap-3 p-3 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50/50 dark:bg-gray-800/40">
                      <div className="flex-1">
                        <p className="text-[13px] font-semibold text-gray-900">{{ new_clients: 'New Relationships', activities_logged: 'Activities Logged', deals_closed: 'Deals Closed', tasks_completed: 'Tasks Completed' }[g.goal_type]}</p>
                        <p className="text-[11px] text-gray-400">{new Date(g.month + 'T00:00:00').toLocaleDateString(undefined, { month: 'long', year: 'numeric' })} · Target: {g.target_value}</p>
                      </div>
                      <button onClick={() => handleDeleteGoal(g.id)} className="text-[12px] font-medium text-red-500 hover:text-red-700">Delete</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Password Security Block */}
            <div className="bg-white p-6 sm:p-8 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
              <h2 className="text-[15px] font-bold text-gray-900 mb-5">Security & Authentication</h2>
              <form onSubmit={handleUpdatePassword} className="space-y-4 max-w-md">
                <div>
                  <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Current Password</label>
                  <div className="relative">
                    <input type={showCurrentPassword ? 'text' : 'password'} required value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} className="dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 w-full px-3 py-2 pr-10 text-[13px] bg-white border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:border-gray-400" />
                    <button type="button" onClick={() => setShowCurrentPassword(!showCurrentPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none p-1 rounded">
                      {showCurrentPassword ? <EyeSlashIcon /> : <EyeIcon />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-gray-700 mb-1.5">New Password</label>
                  <div className="relative">
                    <input type={showNewPassword ? 'text' : 'password'} required value={newPassword} onChange={e => setNewPassword(e.target.value)} className="dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 w-full px-3 py-2 pr-10 text-[13px] bg-white border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:border-gray-400" />
                    <button type="button" onClick={() => setShowNewPassword(!showNewPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none p-1 rounded">
                      {showNewPassword ? <EyeSlashIcon /> : <EyeIcon />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Confirm New Password</label>
                  <div className="relative">
                    <input type={showConfirmNewPassword ? 'text' : 'password'} required value={confirmNewPassword} onChange={e => setConfirmNewPassword(e.target.value)} className="dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 w-full px-3 py-2 pr-10 text-[13px] bg-white border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:border-gray-400" />
                    <button type="button" onClick={() => setShowConfirmNewPassword(!showConfirmNewPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none p-1 rounded">
                      {showConfirmNewPassword ? <EyeSlashIcon /> : <EyeIcon />}
                    </button>
                  </div>
                </div>
                <div className="pt-2">
                  <button type="submit" className="px-4 py-2 text-[13px] font-medium text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors shadow-sm">Update Password</button>
                </div>
              </form>
            </div>

            {/* Data Management Block */}
            <div className="bg-white p-6 sm:p-8 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
              <h2 className="text-[15px] font-bold text-gray-900 mb-2">Data Management</h2>
              <p className="text-[13px] text-gray-500 mb-5">Manually trigger a sync to generate any pending notifications for tasks and birthdays.</p>
              <div className="space-y-3">
                <button 
                  onClick={handleResyncNotifications} 
                  disabled={notificationSyncLoading}
                  className="px-4 py-2 text-[13px] font-semibold text-white bg-gray-900 rounded-xl hover:opacity-90 transition-colors shadow-sm disabled:opacity-50 disabled:hover:bg-gray-900 flex items-center gap-2"
                >
                  {notificationSyncLoading && (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  )}
                  {notificationSyncLoading ? 'Syncing...' : 'Resync Notifications'}
                </button>
                {notificationSyncMessage && (
                  <p className={`text-[12px] font-medium ${notificationSyncMessage.includes('success') ? 'text-green-600' : 'text-red-600'}`}>
                    {notificationSyncMessage}
                  </p>
                )}
              </div>
            </div>

            {/* Danger Zone Block */}
            <div className="bg-red-50 p-6 sm:p-8 rounded-2xl border border-red-100">
              <h2 className="text-[15px] font-bold text-red-900 mb-2">Danger Zone</h2>
              <p className="text-[13px] text-red-700 mb-5">Permanently remove your account and all associated relationship data from the servers. This action is irreversible.</p>
              <button onClick={() => setShowDeleteModal(true)} className="px-4 py-2 text-[13px] font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors shadow-sm">Delete Account</button>
            </div>
          </div>
        )}

        </div>
      </main>

      {/* --- MODALS --- */}

      {/* RELATIONSHIP PROFILE — full-screen view (was a cramped max-w-2xl modal) */}
      {viewingClient && (
        <div className="fixed inset-0 bg-white dark:bg-gray-950 z-50 overflow-y-auto animate-in fade-in duration-200">
          {/* Sticky header — persistent Back affordance replaces the corner × */}
          <div className="sticky top-0 z-10 bg-white/95 dark:bg-gray-950/95 backdrop-blur-sm border-b border-gray-100 dark:border-gray-800 px-4 sm:px-8 py-4 flex items-center justify-between gap-3">
            <button onClick={() => { setViewingClient(null); setActivityFilterType('All'); setEditingActivityId(null); }} className="flex items-center gap-2 text-[13px] font-semibold text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 shrink-0">
              <span aria-hidden>←</span> Back to Relationships
            </button>
            <div className="flex items-center gap-2 shrink-0">
              <button type="button" onClick={() => { setEmailTo(viewingClient.email || ''); setShowEmailComposer(true); }} className="hidden sm:block px-4 py-2 text-[13px] font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 rounded-xl hover:bg-indigo-100 dark:hover:bg-indigo-950/70 transition-colors">Send Email</button>
              <button type="button" onClick={() => handleExportPDF(viewingClient)} className="hidden sm:block px-4 py-2 text-[13px] font-semibold text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">Export PDF</button>
              {canEdit && (
                <button type="button" onClick={() => {
                  setEditingClient(viewingClient);
                  setViewingClient(null);
                  const cfs = {};
                  customFieldDefs.forEach(def => {
                    const existing = customFieldValues.find(v => v.client_id === viewingClient.id && v.field_definition_id === def.id);
                    cfs[def.id] = existing ? existing.value : '';
                  });
                  setFormCustomValues(cfs);
                }} className="px-4 py-2 text-[13px] font-semibold text-white bg-gray-900 dark:bg-white dark:text-gray-900 rounded-xl hover:opacity-90 transition-opacity shadow-sm">Edit</button>
              )}
            </div>
          </div>

          <div className="max-w-6xl mx-auto px-4 sm:px-8 py-8 grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-8 items-start">
            {/* LEFT: contact/company sidebar — sticky on desktop, stacks above tabs on mobile */}
            <div className="lg:sticky lg:top-24 lg:self-start space-y-5">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-gray-900 dark:bg-white text-white dark:text-gray-900 flex items-center justify-center text-[20px] font-bold shrink-0">
                  {(viewingClient.name || '?').slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <h2 className="text-[18px] font-bold text-gray-900 dark:text-white truncate">{viewingClient.name}</h2>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-gray-900 dark:bg-white text-white dark:text-gray-900" title="Lead score">
                      {clientsWithScores.find(c => c.id === viewingClient.id)?.leadScore ?? 0}
                    </span>
                    <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">{viewingClient.status}</span>
                  </div>
                </div>
              </div>
              {/* FEATURE 9 — tags on profile */}
              <div className="flex flex-wrap items-center gap-1">
                {(clientTagMap[viewingClient.id] || []).map(tid => {
                  const t = tags.find(x => x.id === tid);
                  return t ? <TagPill key={tid} tag={t} onRemove={canEdit ? (id) => handleToggleClientTag(viewingClient.id, id) : undefined} /> : null;
                })}
                {canEdit && tags.length > 0 && (
                  <div className="relative group">
                    <button className="text-[11px] font-medium text-gray-400 border border-dashed border-gray-300 dark:border-gray-600 rounded-full px-2 py-0.5 hover:text-gray-700 dark:hover:text-gray-200">+ tag</button>
                    <div className="absolute left-0 top-full mt-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg p-2 z-20 hidden group-hover:block group-focus-within:block min-w-[140px]">
                      {tags.map(t => (
                        <label key={t.id} className="flex items-center gap-2 py-1 px-1 text-[12px] cursor-pointer hover:bg-gray-50 dark:bg-gray-800/40 dark:hover:bg-gray-800 rounded">
                          <input type="checkbox" checked={(clientTagMap[viewingClient.id] || []).includes(t.id)} onChange={() => handleToggleClientTag(viewingClient.id, t.id)} className="rounded border-gray-300 dark:border-gray-600 focus:ring-0" />
                          <span style={{ color: t.color }} className="font-semibold">{t.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="sm:hidden flex gap-2">
                <button type="button" onClick={() => { setEmailTo(viewingClient.email || ''); setShowEmailComposer(true); }} className="flex-1 px-4 py-2.5 text-[13px] font-semibold text-white bg-gray-900 dark:bg-white dark:text-gray-900 rounded-xl">Send Email</button>
                <button type="button" onClick={() => handleExportPDF(viewingClient)} className="px-4 py-2.5 text-[13px] font-semibold border border-gray-200 dark:border-gray-700 rounded-xl text-gray-700 dark:text-gray-200">PDF</button>
              </div>
              <div className="space-y-5 text-[13px]">

              {/* FEATURE 23 — SMART FOLLOW-UP SUGGESTION */}
              {followUpLoading && <div className="h-10 bg-green-50 dark:bg-green-950/30 border border-green-100 dark:border-green-900 rounded-xl animate-pulse" />}
              {!followUpLoading && followUpSuggestion && (
                <div className="bg-green-50 dark:bg-green-950/30 rounded-xl p-3 border border-green-100 dark:border-green-900">
                  <p className="text-[13px] text-green-900 dark:text-green-300">💡 <span className="font-semibold">Suggested:</span> {followUpSuggestion}</p>
                  <div className="flex gap-3 mt-2 text-[12px] font-medium">
                    <button onClick={() => { setActivityType('Note'); setActivityDesc(followUpSuggestion); setActiveProfileTab('activity'); }} className="text-green-700 hover:underline">Log this as a note</button>
                    <button onClick={() => { setNewTaskTitle(followUpSuggestion.slice(0, 100)); setActiveProfileTab('tasks'); }} className="text-green-700 hover:underline">Create task</button>
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-0.5">
                  <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">Email</span>
                  <span className="font-semibold text-gray-800 dark:text-gray-200 block break-all">{viewingClient.email}</span>
                </div>
                <div className="space-y-0.5">
                  <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">Country</span>
                  <span className="font-semibold text-gray-800 dark:text-gray-200 block">{viewingClient.country || 'Not specified'}</span>
                </div>
                <div className="space-y-0.5">
                  <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">Phone</span>
                  <span className="font-semibold text-gray-800 dark:text-gray-200 block">{viewingClient.phone_number || 'Not provided'}</span>
                </div>
                <div className="space-y-0.5">
                  <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">Birthday</span>
                  <span className="font-semibold text-gray-800 dark:text-gray-200 block">{viewingClient.birthday || 'Not specified'}</span>
                </div>
                <div className="space-y-0.5">
                  <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">Source</span>
                  <span className="font-semibold text-gray-800 dark:text-gray-200 block">{viewingClient.source || 'Unknown'}</span>
                </div>
                {/* PART 2 (v4) — company is always a real link (url or LinkedIn search) */}
                <div className="space-y-0.5">
                  <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">Company</span>
                  {viewingClient.company_name || viewingClient.company_url ? (
                    <span className="font-semibold flex items-center gap-2 flex-wrap">
                      {/* G17 — auto-fetched company logo */}
                      {companyFaviconUrl(viewingClient.company_url) && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={companyFaviconUrl(viewingClient.company_url)} alt="" className="w-5 h-5 rounded" loading="lazy" onError={e => { e.currentTarget.style.display = 'none'; }} />
                      )}
                      <CompanyLink client={viewingClient} />
                    </span>
                  ) : (
                    <span className="text-gray-400 font-normal italic">Not specified</span>
                  )}
                </div>
              </div>

              {/* DYNAMIC CUSTOM FIELDS RENDER IN PROFILE */}
              {customFieldDefs.length > 0 && (
                <div className="bg-gray-50/50 dark:bg-gray-800/40 p-4 rounded-xl border border-gray-100 dark:border-gray-800">
                  <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block mb-3">Custom Data Points</span>
                  <div className="grid grid-cols-2 gap-4">
                    {customFieldDefs.map(cf => {
                      const cv = customFieldValues.find(v => v.client_id === viewingClient.id && v.field_definition_id === cf.id);
                      return (
                        <div key={cf.id} className="space-y-0.5">
                          <span className="text-[11px] font-bold text-gray-500 block">{cf.field_name}</span>
                          <span className="font-semibold text-gray-900 dark:text-gray-100 block">{cv ? cv.value : '—'}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              <div className="space-y-1 bg-gray-50 dark:bg-gray-800/40 p-3 rounded-xl border border-gray-100 dark:border-gray-800">
                <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">LinkedIn</span>
                {viewingClient.linkedin_url ? (
                  <a href={viewingClient.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-gray-900 dark:text-gray-100 font-semibold hover:underline flex items-center gap-1 break-all">
                    {viewingClient.linkedin_url} <span className="text-[10px] font-normal text-gray-400">↗</span>
                  </a>
                ) : (
                  <span className="text-gray-400 font-normal italic">Not provided</span>
                )}
              </div>

              {/* G18 — referral network */}
              {(() => {
                const referrer = viewingClient.referred_by_client_id ? clients.find(c => c.id === viewingClient.referred_by_client_id) : null;
                const referrals = clients.filter(c => c.referred_by_client_id === viewingClient.id);
                if (!referrer && referrals.length === 0) return null;
                return (
                  <div className="bg-gray-50/50 dark:bg-gray-800/40 p-4 rounded-xl border border-gray-100 dark:border-gray-800 space-y-2">
                    <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">Referral Network</span>
                    {referrer && (
                      <p className="text-[13px]">
                        <span className="text-gray-400">Referred by:</span>{' '}
                        <button onClick={() => setViewingClient(referrer)} className="font-semibold text-indigo-600 hover:underline">{referrer.name}</button>
                      </p>
                    )}
                    {referrals.length > 0 && (
                      <div className="text-[13px]">
                        <span className="text-gray-400">Referrals made: {referrals.length}</span>
                        <div className="flex flex-wrap gap-1.5 mt-1">
                          {referrals.map(r => (
                            <button key={r.id} onClick={() => setViewingClient(r)} className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-600/10 text-[12px] font-semibold hover:bg-indigo-100">{r.name}</button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* FEATURE 15 — QUICK NOTE (always visible, auto-saves) */}
              <div className="pt-4 border-t border-gray-100 dark:border-gray-800">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-[12px] font-bold uppercase tracking-wider text-gray-400">Quick Note</h4>
                  <span className="text-[11px] font-medium text-gray-400">
                    {quickNoteSaving ? 'Saving...' : quickNoteSaved ? <span className="text-green-600">Saved ✓</span> : ''}
                  </span>
                </div>
                <textarea rows={3} value={quickNoteValue} onChange={e => setQuickNoteValue(e.target.value)} placeholder="Pinned scratch pad for this relationship — auto-saves as you type..." disabled={!canEdit} className="dark:text-gray-100 w-full px-3 py-2 text-[13px] border border-gray-200 dark:border-gray-700 rounded-xl bg-yellow-50/50 dark:bg-yellow-900/10 focus:outline-none focus:border-gray-400 disabled:opacity-60" />
              </div>

              </div>
            </div>

            {/* RIGHT: tab bar + content — the extra horizontal room is the point of this view */}
            <div className="min-w-0 text-[13px]">
              {/* FEATURE 7 — PROFILE TAB BAR */}
              <div className="flex gap-1 mb-6 border-b border-gray-100 dark:border-gray-800">
                {[['activity', 'Activity'], ['tasks', 'Tasks'], ['files', 'Files'], ['deals', 'Deals']].map(([key, label]) => (
                  <button key={key} onClick={() => setActiveProfileTab(key)} className={`px-4 py-2.5 text-[13px] font-semibold border-b-2 -mb-px transition-colors ${activeProfileTab === key ? 'border-gray-900 dark:border-white text-gray-900 dark:text-white' : 'border-transparent text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}>{label}</button>
                ))}
              </div>
              <div className="space-y-6">

              {/* TAB: FILES (Feature 7) */}
              {activeProfileTab === 'files' && (
                <div className="space-y-3">
                  {canEdit && (
                    <div
                      onDragOver={e => e.preventDefault()}
                      onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) handleFileUpload(f); }}
                      onClick={() => fileUploadRef.current?.click()}
                      className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center cursor-pointer hover:border-gray-400 transition-colors"
                    >
                      <input ref={fileUploadRef} type="file" className="dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFileUpload(f); e.target.value = null; }} />
                      <p className="text-[13px] font-medium text-gray-600">{uploadingFile ? 'Uploading...' : 'Drop file or click to upload'}</p>
                      <p className="text-[11px] text-gray-400 mt-1">Max 10MB</p>
                    </div>
                  )}
                  {clientFiles.filter(f => f.client_id === viewingClient.id).length === 0 ? (
                    <EmptyState title="No files yet" desc="Drop a file above or click to upload attachments for this relationship." />
                  ) : (
                    clientFiles.filter(f => f.client_id === viewingClient.id).map(f => (
                      <div key={f.id} className="flex items-center gap-3 p-3 border border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/40 rounded-xl">
                        <span className="text-lg shrink-0">
                          {(f.file_type || '').includes('pdf') ? '📄' : (f.file_type || '').startsWith('image') ? '🖼️' : '📎'}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-semibold text-gray-900 dark:text-gray-100 truncate">{f.file_name}</p>
                          <p className="text-[11px] text-gray-400">{formatFileSize(f.file_size)} · {new Date(f.created_at).toLocaleDateString()}</p>
                        </div>
                        <button onClick={() => handleDownloadFile(f)} className="text-[12px] font-medium text-gray-500 hover:text-gray-900 dark:text-gray-100">Download</button>
                        {canDelete && <button onClick={() => handleDeleteFile(f)} className="text-[12px] font-medium text-red-500 hover:text-red-700">Delete</button>}
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* TAB: DEALS (Feature 1) */}
              {activeProfileTab === 'deals' && (
                <div className="space-y-3">
                  {canEdit && (
                    <button onClick={() => { resetDealForm(); setDealClientId(String(viewingClient.id)); setShowDealForm(true); }} className="w-full px-3 py-2 text-[12px] font-medium text-gray-700 dark:text-gray-300 border border-dashed border-gray-300 rounded-xl hover:border-gray-400 hover:text-gray-900 dark:text-gray-100 transition-colors">+ Add Deal for {viewingClient.name}</button>
                  )}
                  {deals.filter(d => d.client_id === viewingClient.id).length === 0 ? (
                    <EmptyState title="No deals yet" desc="Create your first deal to start tracking your pipeline." />
                  ) : (
                    deals.filter(d => d.client_id === viewingClient.id).map(d => (
                      <div key={d.id} className="flex items-center gap-3 p-3 border border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/40 rounded-xl">
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-semibold text-gray-900 dark:text-gray-100 truncate">{d.title}</p>
                          <p className="text-[11px] text-gray-400">{d.stage} · {d.probability}%{d.close_date ? ` · Close ${d.close_date}` : ''}</p>
                        </div>
                        <span className="text-[13px] font-bold text-gray-900 dark:text-gray-100 shrink-0">{fmtMoney(d.value)}</span>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* TAB: TASKS */}
              {activeProfileTab === 'tasks' && (
              <div>
                <h4 className="text-[12px] font-bold uppercase tracking-wider text-gray-400 mb-3">Tasks for this Relationship</h4>

                <form onSubmit={(e) => handleCreateTask(e, viewingClient.id)} className="flex flex-wrap gap-2 mb-3">
                  <input type="text" placeholder="New task title..." value={newTaskTitle} onChange={(e) => setNewTaskTitle(e.target.value)} className="dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 flex-1 min-w-[140px] px-3 py-1.5 min-h-[44px] md:min-h-0 text-[13px] border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none" required />
                  <input type="date" value={newTaskDate} onChange={(e) => setNewTaskDate(e.target.value)} className="dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 px-2 py-1.5 min-h-[44px] md:min-h-0 text-[13px] border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none text-gray-600" required />
                  {/* FEATURE 20 — recurrence */}
                  <select value={newTaskRecurrence} onChange={e => setNewTaskRecurrence(e.target.value)} className="dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 px-2 py-1.5 min-h-[44px] md:min-h-0 text-[13px] border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none text-gray-600">
                    <option value="">No repeat</option>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                  </select>
                  {newTaskRecurrence && (
                    <input type="date" title="Repeat end date" value={newTaskRecurrenceEnd} onChange={e => setNewTaskRecurrenceEnd(e.target.value)} className="dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 px-2 py-1.5 min-h-[44px] md:min-h-0 text-[13px] border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none text-gray-600" />
                  )}
                  <button type="submit" className="px-3 py-1.5 min-h-[44px] md:min-h-0 text-[12px] font-semibold text-white bg-gray-900 rounded-xl hover:opacity-90 transition-colors shadow-sm">Add</button>
                </form>

                <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                  {tasks.filter(t => t.client_id === viewingClient.id).sort((a, b) => new Date(a.due_date) - new Date(b.due_date)).length === 0 && (
                    <p className="text-[12px] text-gray-400 italic">No tasks created for this relationship profile yet.</p>
                  )}
                  {tasks.filter(t => t.client_id === viewingClient.id).sort((a, b) => new Date(a.due_date) - new Date(b.due_date)).map(task => {
                    const isOverdue = task.status === 'pending' && new Date(task.due_date) < new Date(todayStr);
                    return (
                      <div key={task.id} className="flex items-center justify-between p-2.5 bg-gray-50/50 dark:bg-gray-800/40 border border-gray-100 dark:border-gray-800 rounded-xl">
                        <div className="flex items-center gap-3">
                          <input type="checkbox" checked={task.status === 'done'} onChange={() => handleToggleTask(task.id, task.status)} className="dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-gray-900 focus:ring-0 cursor-pointer" />
                          <div>
                            <span className={`text-[13px] ${task.status === 'done' ? 'line-through text-gray-400' : isOverdue ? 'text-red-600 font-semibold' : 'text-gray-900 dark:text-gray-100 font-medium'}`}>
                              {task.recurrence && <span title={`Repeats ${task.recurrence}${task.recurrence_end_date ? ` until ${task.recurrence_end_date}` : ''}`}>🔁 </span>}
                              {task.title}
                            </span>
                            <span className="text-[11px] text-gray-400 block mt-0.5">Due: <span className={isOverdue ? 'text-red-500 font-medium' : ''}>{task.due_date}</span>{task.recurrence ? ` · ${task.recurrence}` : ''}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              )}

              {/* TAB: ACTIVITY — ENHANCED ACTIVITY LOGGING */}
              {activeProfileTab === 'activity' && (
              <div id="activity-timeline" className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-bold text-gray-400 uppercase tracking-wider">Activity Timeline</span>
                  <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
                    {['All', 'Note', 'Call', 'Email', 'Meeting'].map(t => (
                      <button key={t} onClick={() => setActivityFilterType(t)} className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded ${activityFilterType === t ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>{t}</button>
                    ))}
                  </div>
                </div>

                {/* Legacy Fallback Render */}
                {viewingClient.note_conversation && activities.filter(a => a.client_id === viewingClient.id).length === 0 && (
                   <div className="p-3 bg-yellow-50 border border-yellow-100 rounded-xl text-yellow-800 text-[12px] whitespace-pre-wrap">
                    <span className="font-bold text-[10px] uppercase block mb-1 opacity-70">Legacy Notes</span>
                    {viewingClient.note_conversation}
                  </div>
                )}

                {/* Structured Activity List (Scrollable max-h-96) */}
                <div className="max-h-96 overflow-y-auto space-y-3 pr-2">
                  {activities.filter(a => a.client_id === viewingClient.id && (activityFilterType === 'All' || a.activity_type === activityFilterType)).length === 0 ? (
                    <div className="border border-dashed border-gray-200 dark:border-gray-700 rounded-xl">
                      <EmptyState title="No activity yet" desc="Log a call, email, meeting, or note below to build this timeline." />
                    </div>
                  ) : (
                    activities.filter(a => a.client_id === viewingClient.id && (activityFilterType === 'All' || a.activity_type === activityFilterType)).map(act => (
                      <div key={act.id} className="p-3 border border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/40 rounded-xl group relative">
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-gray-500 bg-gray-200 px-1.5 py-0.5 rounded uppercase">{act.activity_type}</span>
                            <span className="text-[11px] font-semibold text-gray-400">{act.activity_date}</span>
                          </div>
                          
                          {/* Inline Edit/Delete Actions */}
                          <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => {setEditingActivityId(act.id); setEditingActivityDesc(act.description);}} className="text-[10px] font-bold text-gray-400 hover:text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 px-1.5 py-0.5 rounded shadow-sm">Edit</button>
                            <button onClick={() => handleDeleteActivity(act.id)} className="text-[10px] font-bold text-red-400 hover:text-white hover:bg-red-500 border border-red-200 hover:border-red-500 px-1.5 py-0.5 rounded shadow-sm transition-colors">Del</button>
                          </div>
                        </div>

                        {editingActivityId === act.id ? (
                          <form onSubmit={handleUpdateActivity} className="flex gap-2 mt-2">
                            <textarea value={editingActivityDesc} onChange={e => setEditingActivityDesc(e.target.value)} className="dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 w-full text-[12px] p-2 border border-gray-200 dark:border-gray-700 rounded focus:outline-none" rows={2} required />
                            <div className="flex flex-col gap-1 shrink-0">
                              <button type="submit" className="bg-gray-900 text-white text-[10px] px-2 py-1 rounded">Save</button>
                              <button type="button" onClick={() => setEditingActivityId(null)} className="bg-gray-200 text-gray-600 text-[10px] px-2 py-1 rounded">Cancel</button>
                            </div>
                          </form>
                        ) : (
                          <p className="text-[13px] text-gray-800 dark:text-gray-200 leading-relaxed whitespace-pre-wrap">{act.description}</p>
                        )}
                      </div>
                    ))
                  )}
                </div>

                {/* Add New Activity Form */}
                <form onSubmit={handleAddActivityLog} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-3 shadow-sm flex flex-col gap-3 mt-4">
                  {/* FEATURE 22 — quick-log template pills */}
                  <div className="flex flex-wrap gap-1.5">
                    {activityTemplates.map((t, i) => (
                      <button key={i} type="button" onClick={() => {
                        setActivityType(t.type); setActivityDesc(t.desc);
                      }} className="text-[11px] px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded-full text-gray-600 transition-colors">
                        {t.type}: {t.desc.slice(0, 25)}...
                      </button>
                    ))}
                  </div>
                  {savingTemplateName !== null && (
                    <div className="flex items-center gap-2">
                      <input type="text" placeholder="Template name to save last entry..." value={savingTemplateName} onChange={e => setSavingTemplateName(e.target.value)} className="dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 flex-1 px-2 py-1 text-[12px] border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none" />
                      <button type="button" onClick={() => {
                        if (!savingTemplateName.trim()) return;
                        const lastAct = activities.find(a => a.client_id === viewingClient.id);
                        const tpl = { name: savingTemplateName.trim(), type: lastAct?.activity_type || activityType, desc: lastAct?.description || activityDesc || '' };
                        setActivityTemplates(prev => {
                          const next = [...prev.filter(t => t.name !== tpl.name), tpl];
                          localStorage.setItem('crm_activity_templates', JSON.stringify(next.filter(t => !DEFAULT_ACTIVITY_TEMPLATES.some(d => d.name === t.name))));
                          return next;
                        });
                        setSavingTemplateName(null);
                        showToast('Template saved.', 'success');
                      }} className="text-[11px] font-medium text-indigo-600 hover:underline">Save as template</button>
                      <button type="button" onClick={() => setSavingTemplateName(null)} className="text-gray-400 text-[12px]">×</button>
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2 items-center text-[12px]">
                    <select value={activityType} onChange={e => setActivityType(e.target.value)} className="dark:text-gray-100 p-1.5 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none bg-gray-50/50 dark:bg-gray-800/40 text-gray-700">
                      <option value="Note">Note</option>
                      <option value="Call">Call</option>
                      <option value="Email">Email</option>
                      <option value="Meeting">Meeting</option>
                    </select>
                    <input type="date" value={activityDate} onChange={e => setActivityDate(e.target.value)} className="dark:text-gray-100 p-1.5 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none bg-gray-50/50 dark:bg-gray-800/40 text-gray-600" />
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <textarea placeholder={voiceListening ? 'Listening... speak your note' : 'Record details, meeting minutes, or email content...'} value={activityDesc} onChange={e => setActivityDesc(e.target.value)} required rows={2} className={`flex-1 px-3 py-2 text-[13px] border rounded-lg focus:outline-none dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 ${voiceListening ? 'border-red-300 ring-1 ring-red-200' : 'border-gray-200 dark:border-gray-700 focus:border-gray-400'}`} />
                    {/* G3 — voice memo mic */}
                    <button type="button" onClick={toggleVoiceMemo} title={voiceListening ? 'Stop dictation' : 'Dictate with your voice'} className={`self-end sm:self-stretch px-3 min-h-[38px] rounded-xl border text-[16px] transition-all ${voiceListening ? 'bg-red-50 border-red-300 animate-pulse' : 'bg-white border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:bg-gray-800/40'}`}>
                      {voiceListening ? '🔴' : '🎤'}
                    </button>
                    <button type="submit" className="sm:w-24 font-medium text-[12px] text-white bg-gray-900 rounded-xl hover:opacity-90 transition-colors shadow-sm self-end sm:self-stretch min-h-[38px]">Log Entry</button>
                  </div>
                </form>
              </div>
              )}

              </div>
            </div>
          </div>
        </div>
      )}

      {/* EDITING MODAL */}
      {editingClient && (
        <div className="fixed inset-0 bg-white dark:bg-gray-950 z-50 overflow-y-auto animate-in fade-in duration-200">
          <div>
            <div className="sticky top-0 z-10 bg-white/95 dark:bg-gray-950/95 backdrop-blur-sm border-b border-gray-100 dark:border-gray-800 px-4 sm:px-8 py-4 flex items-center justify-between">
              <button onClick={() => setEditingClient(null)} className="flex items-center gap-2 text-[13px] font-semibold text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"><span aria-hidden>←</span> Back</button>
              <h3 className="text-[15px] font-bold text-gray-900 dark:text-white">Edit Relationship</h3>
              <div className="w-16" />
            </div>

            <form onSubmit={handleUpdateClient} className="max-w-2xl mx-auto w-full px-4 sm:px-6 py-8 space-y-4 text-[13px]">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Full Name *</label>
                  <input type="text" required value={editingClient.name || ''} onChange={e => setEditingClient({...editingClient, name: e.target.value})} className="dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white text-gray-900 focus:outline-none focus:border-gray-400" />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Email *</label>
                  <input type="email" required value={editingClient.email || ''} onChange={e => setEditingClient({...editingClient, email: e.target.value})} className="dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white text-gray-900 focus:outline-none focus:border-gray-400" />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Country</label>
                  <input type="text" list="country-list" value={editingClient.country || ''} onChange={e => setEditingClient({...editingClient, country: e.target.value})} className="dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white text-gray-900 focus:outline-none focus:border-gray-400" />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Phone</label>
                  <input type="text" value={editingClient.phone_number || ''} onChange={e => setEditingClient({...editingClient, phone_number: e.target.value})} className="dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white text-gray-900 focus:outline-none focus:border-gray-400" />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-gray-700 mb-1.5">LinkedIn URL</label>
                  <input type="url" value={editingClient.linkedin_url || ''} onChange={e => setEditingClient({...editingClient, linkedin_url: e.target.value})} className="dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white text-gray-900 focus:outline-none focus:border-gray-400" />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Birthday</label>
                  <input type="date" value={editingClient.birthday || ''} onChange={e => setEditingClient({...editingClient, birthday: e.target.value})} className="dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white text-gray-600 focus:outline-none" />
                </div>
                {/* PART F — company fields */}
                <div>
                  <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Company Name</label>
                  <input type="text" value={editingClient.company_name || ''} onChange={e => setEditingClient({...editingClient, company_name: e.target.value})} className="dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white text-gray-900 focus:outline-none focus:border-gray-400" />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Company Website</label>
                  <input type="text" value={editingClient.company_url || ''} onChange={e => setEditingClient({...editingClient, company_url: e.target.value})} className="dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white text-gray-900 focus:outline-none focus:border-gray-400" />
                </div>
                {/* G18 — referral chain */}
                <div>
                  <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Referred by</label>
                  <select value={editingClient.referred_by_client_id || ''} onChange={e => setEditingClient({...editingClient, referred_by_client_id: e.target.value ? parseInt(e.target.value, 10) : null})} className="dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white text-gray-700 focus:outline-none">
                    <option value="">— Nobody / unknown —</option>
                    {[...clients].filter(c => c.id !== editingClient.id).sort((a, b) => (a.name || '').localeCompare(b.name || '')).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Source</label>
                  <select value={editingClient.source || ''} onChange={e => setEditingClient({...editingClient, source: e.target.value})} className="dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white text-gray-700 focus:outline-none">
                    <option value="">Unknown</option>
                    {CLIENT_SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>

              {/* EDIT CUSTOM FIELDS RENDER */}
              {customFieldDefs.length > 0 && (
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mt-2">
                  <h4 className="text-[12px] font-bold uppercase tracking-wider text-gray-500 mb-3">Custom Data Points</h4>
                  <div className="grid grid-cols-2 gap-3">
                    {customFieldDefs.map(cf => (
                      <div key={cf.id} className="flex flex-col gap-1.5">
                        <label className="text-[11px] font-medium text-gray-700">{cf.field_name}</label>
                        {cf.field_type === 'select' ? (
                          <select value={formCustomValues[cf.id] || ''} onChange={e => setFormCustomValues({...formCustomValues, [cf.id]: e.target.value})} className="dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white focus:outline-none text-gray-700">
                            <option value="">-- Select --</option>
                            {(cf.select_options || []).map(opt => <option key={opt} value={opt}>{opt}</option>)}
                          </select>
                        ) : (
                          <input type={cf.field_type} value={formCustomValues[cf.id] || ''} onChange={e => setFormCustomValues({...formCustomValues, [cf.id]: e.target.value})} className="dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white focus:outline-none focus:border-gray-400 text-gray-900" />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Notes (Legacy)</label>
                <textarea rows={2} value={editingClient.note_conversation || ''} onChange={e => setEditingClient({...editingClient, note_conversation: e.target.value})} className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50/50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:bg-white dark:focus:bg-gray-800 font-normal dark:placeholder-gray-500" placeholder="Legacy text data..."></textarea>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Priority</label>
                  <select value={editingClient.relationship || 'Medium'} onChange={e => setEditingClient({...editingClient, relationship: e.target.value})} className="dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 w-full px-3 py-2 text-[13px] bg-white border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm text-gray-700 focus:outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-400 transition-colors appearance-none">
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Pipeline Stage</label>
                  <select value={editingClient.status || 'New'} onChange={e => setEditingClient({...editingClient, status: e.target.value})} className="dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 w-full px-3 py-2 text-[13px] bg-white border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm text-gray-700 focus:outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-400 transition-colors appearance-none">
                    {PIPELINE_STAGES.map(s => <option key={s} value={s}>{s}</option>)}
                    {/* Render legacy fallbacks if needed */}
                    {!PIPELINE_STAGES.includes(editingClient.status) && <option value={editingClient.status}>{editingClient.status} (Legacy)</option>}
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 mt-2">
                <button type="button" onClick={() => setEditingClient(null)} className="px-4 py-2 text-[13px] font-medium text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 text-[13px] font-semibold text-white bg-gray-900 border border-transparent rounded-xl hover:opacity-90 transition-colors shadow-sm">
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE ACCOUNT MODAL */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-gray-950/60 backdrop-blur-sm z-[150] flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md border border-gray-100 overflow-hidden animate-in zoom-in-95 duration-200 p-6 sm:p-8">
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">Delete Account Permanently</h3>
                <p className="text-[13px] text-gray-500 mt-2 leading-relaxed">You are about to permanently delete your account and all associated relationship data from our servers. This action cannot be undone.</p>
              </div>
              <div className="w-full bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-3 mt-4">
                <p className="text-[12px] font-medium text-gray-700 text-left">Please type your email address <strong className="text-gray-900 select-all">{user?.email}</strong> to confirm:</p>
                <input type="email" value={deleteAccountEmail} onChange={(e) => setDeleteAccountEmail(e.target.value)} placeholder={user?.email} className="dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 w-full px-3 py-2 text-[13px] bg-white border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:border-red-400 focus:ring-1 focus:ring-red-400" />
              </div>
              <div className="flex w-full gap-3 pt-2">
                <button onClick={() => {setShowDeleteModal(false); setDeleteAccountEmail('');}} className="flex-1 py-2.5 text-[13px] font-semibold text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">Cancel</button>
                <button onClick={handleDeleteAccount} disabled={deleteAccountEmail !== user?.email || authLoading} className="flex-1 py-2.5 text-[13px] font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:hover:bg-red-600 shadow-sm">
                  {authLoading ? 'Deleting...' : 'Delete Permanently'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DEAL FORM MODAL (Feature 1) */}
      {showDealForm && (
        <div className="fixed inset-0 bg-white dark:bg-gray-950 z-[90] overflow-y-auto animate-in fade-in duration-200">
          <div>
            <div className="sticky top-0 z-10 bg-white/95 dark:bg-gray-950/95 backdrop-blur-sm border-b border-gray-100 dark:border-gray-800 px-4 sm:px-8 py-4 flex items-center justify-between">
              <button onClick={() => setShowDealForm(false)} className="flex items-center gap-2 text-[13px] font-semibold text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"><span aria-hidden>←</span> Back</button>
              <h3 className="text-[15px] font-bold text-gray-900 dark:text-white">{editingDeal ? 'Edit Deal' : 'New Deal'}</h3>
              <div className="w-16" />
            </div>
            <form onSubmit={handleCreateDeal} className="max-w-2xl mx-auto w-full px-4 sm:px-6 py-8 space-y-4 text-[13px]">
              <div>
                <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Title *</label>
                <input type="text" required value={dealTitle} onChange={e => setDealTitle(e.target.value)} className="dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 w-full px-3 py-2 min-h-[44px] md:min-h-0 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:border-gray-400" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Relationship *</label>
                  <select required value={dealClientId} onChange={e => setDealClientId(e.target.value)} className="dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white text-gray-700 focus:outline-none">
                    <option value="">-- Select relationship --</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Value</label>
                  <div className="flex gap-1.5">
                    <input type="number" min="0" step="0.01" value={dealValue} onChange={e => setDealValue(e.target.value)} className="dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:border-gray-400" />
                    {/* G20 — currency */}
                    <select value={dealCurrency} onChange={e => setDealCurrency(e.target.value)} className="dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 px-2 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white text-gray-700 focus:outline-none shrink-0">
                      {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Stage</label>
                  <select value={dealStage} onChange={e => setDealStage(e.target.value)} className="dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white text-gray-700 focus:outline-none">
                    {DEAL_STAGES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Probability ({dealProbability}%)</label>
                  <input type="range" min="0" max="100" step="5" value={dealProbability} onChange={e => setDealProbability(e.target.value)} className="dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 w-full" />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Close Date</label>
                  <input type="date" value={dealCloseDate} onChange={e => setDealCloseDate(e.target.value)} className="dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-600 focus:outline-none" />
                </div>
              </div>
              {/* G19 — recurring revenue */}
              <div className="bg-gray-50 border border-gray-100 rounded-xl p-3 space-y-3">
                <label className="flex items-center gap-2 text-[13px] font-medium text-gray-700 cursor-pointer">
                  <input type="checkbox" checked={dealIsRecurring} onChange={e => setDealIsRecurring(e.target.checked)} className="dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 rounded border-gray-300 dark:border-gray-600 text-gray-900 focus:ring-0" />
                  Recurring revenue (subscription / retainer)
                </label>
                {dealIsRecurring && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Billing Cycle</label>
                      <select value={dealBillingCycle} onChange={e => setDealBillingCycle(e.target.value)} className="dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white text-gray-700 focus:outline-none">
                        <option value="monthly">Monthly</option>
                        <option value="quarterly">Quarterly</option>
                        <option value="annual">Annual</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Next Renewal</label>
                      <input type="date" value={dealRenewalDate} onChange={e => setDealRenewalDate(e.target.value)} className="dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-600 focus:outline-none" />
                    </div>
                  </div>
                )}
              </div>
              <div>
                <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Notes</label>
                <textarea rows={2} value={dealNotes} onChange={e => setDealNotes(e.target.value)} className="dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:border-gray-400" />
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                <button type="button" onClick={() => setShowDealForm(false)} className="px-4 py-2 text-[13px] font-medium text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50">Cancel</button>
                <button type="submit" disabled={dealSaving} className="px-4 py-2 text-[13px] font-semibold text-white bg-gray-900 rounded-xl hover:opacity-90 shadow-sm disabled:opacity-50 flex items-center gap-2">
                  {dealSaving && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                  {editingDeal ? 'Save Changes' : 'Create Deal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EMAIL COMPOSER MODAL (Feature 4) */}
      {showEmailComposer && (
        <div className="fixed inset-0 bg-white dark:bg-gray-950 z-[90] overflow-y-auto animate-in fade-in duration-200">
          <div>
            <div className="sticky top-0 z-10 bg-white/95 dark:bg-gray-950/95 backdrop-blur-sm border-b border-gray-100 dark:border-gray-800 px-4 sm:px-8 py-4 flex items-center justify-between">
              <button onClick={() => setShowEmailComposer(false)} className="flex items-center gap-2 text-[13px] font-semibold text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"><span aria-hidden>←</span> Cancel</button>
              <h3 className="text-[15px] font-bold text-gray-900 dark:text-white">New Email{viewingClient ? ` to ${viewingClient.name}` : ''}</h3>
              <div className="w-16" />
            </div>
            <form onSubmit={handleSendEmail} className="max-w-2xl mx-auto w-full px-4 sm:px-6 py-10 space-y-5 text-[13px]">
              {emailTemplates.length > 0 && (
                <div>
                  <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Template</label>
                  <select onChange={e => {
                    // email_templates.id is a uuid string — never parseInt it
                    const t = emailTemplates.find(x => String(x.id) === e.target.value);
                    if (t) { setEmailSubject(t.subject); setEmailBody(t.body); }
                  }} className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-100 focus:outline-none">
                    <option value="">-- Choose a template --</option>
                    {emailTemplates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-[12px] font-medium text-gray-700 mb-1.5">To</label>
                <input type="email" required value={emailTo} onChange={e => setEmailTo(e.target.value)} className="dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 w-full px-3 py-2 min-h-[44px] md:min-h-0 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:border-gray-400" />
              </div>
              <div>
                <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Subject</label>
                <input type="text" required value={emailSubject} onChange={e => setEmailSubject(e.target.value)} className="dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 w-full px-3 py-2 min-h-[44px] md:min-h-0 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:border-gray-400" />
              </div>
              <div>
                <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Body</label>
                <textarea rows={6} required value={emailBody} onChange={e => setEmailBody(e.target.value)} className="dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:border-gray-400" />
                <p className="text-[11px] text-gray-400 mt-1">Merge tags: {'{{name}}'} {'{{email}}'} {'{{phone}}'} {'{{stage}}'}</p>
              </div>
              {/* PART B — provider toggle (persisted to localStorage) */}
              <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Open with:</span>
                <div className="bg-gray-100 p-0.5 rounded-lg flex items-center gap-0.5">
                  <button type="button" onClick={() => setEmailProviderPersist('gmail')} className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-all ${emailProvider === 'gmail' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Gmail</button>
                  <button type="button" onClick={() => setEmailProviderPersist('mailto')} className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-all ${emailProvider === 'mailto' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Default Mail App</button>
                </div>
              </div>
              <div className="flex flex-wrap justify-end gap-3 pt-3 border-t border-gray-100">
                <button type="button" onClick={() => { setEditingTemplate(null); setTemplateName(''); setTemplateSubject(emailSubject); setTemplateBody(emailBody); setAppStep('SETTINGS'); setShowEmailComposer(false); showToast('Finish saving the template in Settings → Email Templates.', 'success'); }} className="px-3 py-2 text-[12px] font-medium text-gray-500 hover:text-gray-800 mr-auto">Save as template</button>
                <button type="button" onClick={() => setShowEmailComposer(false)} className="px-4 py-2 text-[13px] font-medium text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50">Cancel</button>
                <button type="submit" className="px-4 py-2 text-[13px] font-semibold text-white bg-gray-900 rounded-xl hover:opacity-90 shadow-sm">
                  Open Draft in New Tab
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* BULK EMAIL MODAL (Feature 18) */}
      {showBulkEmailModal && (
        <div className="fixed inset-0 bg-white dark:bg-gray-950 z-[90] overflow-y-auto animate-in fade-in duration-200">
          <div>
            <div className="sticky top-0 z-10 bg-white/95 dark:bg-gray-950/95 backdrop-blur-sm border-b border-gray-100 dark:border-gray-800 px-4 sm:px-8 py-4 flex items-center justify-between">
              <button onClick={() => !bulkEmailSending && setShowBulkEmailModal(false)} className="flex items-center gap-2 text-[13px] font-semibold text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"><span aria-hidden>←</span> Cancel</button>
              <h3 className="text-[15px] font-bold text-gray-900 dark:text-white">Email {selectedClientIds.length} relationships</h3>
              <div className="w-16" />
            </div>
            <form onSubmit={handleBulkSendEmail} className="max-w-2xl mx-auto w-full px-4 sm:px-6 py-10 space-y-5 text-[13px]">
              <div>
                <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Subject</label>
                <input type="text" required value={bulkEmailSubject} onChange={e => setBulkEmailSubject(e.target.value)} className="dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:border-gray-400" />
              </div>
              <div>
                <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Body</label>
                <textarea rows={8} required value={bulkEmailBody} onChange={e => setBulkEmailBody(e.target.value)} className="dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:border-gray-400" />
                <p className="text-[11px] text-gray-400 mt-1">Merge tags: {'{{name}}'} {'{{email}}'} — resolved per recipient.</p>
              </div>
              <div className="bg-gray-50 border border-gray-100 rounded-xl p-3">
                <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-1">Recipients preview</p>
                <p className="text-[12px] text-gray-600">
                  {clients.filter(c => selectedClientIds.includes(c.id)).slice(0, 3).map(c => c.name).join(', ')}
                  {selectedClientIds.length > 3 ? ` and ${selectedClientIds.length - 3} more...` : ''}
                </p>
              </div>
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-[12px] text-yellow-800">
                ⚠️ This will open {selectedClientIds.length} compose tab{selectedClientIds.length === 1 ? '' : 's'} ({emailProvider === 'mailto' ? 'default mail app' : 'Gmail'}) — you send each one yourself. Allow popups for this site.
              </div>
              {bulkEmailProgress && <p className="text-[12px] font-medium text-indigo-600">{bulkEmailProgress}</p>}
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                <button type="button" disabled={bulkEmailSending} onClick={() => setShowBulkEmailModal(false)} className="px-4 py-2 text-[13px] font-medium text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 disabled:opacity-50">Cancel</button>
                <button type="submit" disabled={bulkEmailSending} className="px-4 py-2 text-[13px] font-semibold text-white bg-gray-900 rounded-xl hover:opacity-90 shadow-sm disabled:opacity-50 flex items-center gap-2">
                  {bulkEmailSending && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                  Open {selectedClientIds.length} Draft{selectedClientIds.length === 1 ? '' : 's'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* IMPORT PREVIEW MODAL (Feature 16) */}
      {showImportPreview && (
        <div className="fixed inset-0 bg-white dark:bg-gray-950 z-[90] overflow-y-auto animate-in fade-in duration-200">
          <div>
            <div className="sticky top-0 z-10 bg-white/95 dark:bg-gray-950/95 backdrop-blur-sm border-b border-gray-100 dark:border-gray-800 px-4 sm:px-8 py-4 flex items-center gap-4">
              <button onClick={() => !importLoading && setShowImportPreview(false)} className="flex items-center gap-2 text-[13px] font-semibold text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 shrink-0"><span aria-hidden>←</span> Back</button>
              <h3 className="text-[15px] font-bold text-gray-900 dark:text-white">
                Import Preview — {importPreviewData.filter(r => !r.error).length} rows ready, {importPreviewData.filter(r => r.error).length} errors
              </h3>
            </div>
            <div className="max-w-5xl mx-auto w-full px-4 sm:px-6 py-8 overflow-x-auto">
              <table className="w-full text-left text-[12px]">
                <thead>
                  <tr className="text-[11px] font-bold uppercase tracking-wider text-gray-400 border-b border-gray-200">
                    <th className="p-2 w-8"></th>
                    <th className="p-2">Name</th>
                    <th className="p-2">Email</th>
                    <th className="p-2">Country</th>
                    <th className="p-2">Phone</th>
                    <th className="p-2">Status</th>
                    <th className="p-2">Issue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {importPreviewData.map(r => (
                    <tr key={r.key} className={r.error ? 'bg-red-50/60' : r.warning ? 'bg-yellow-50/60' : 'bg-green-50/40'}>
                      <td className="dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 p-2"><input type="checkbox" disabled={!!r.error} checked={r.checked} onChange={() => setImportPreviewData(prev => prev.map(x => x.key === r.key ? { ...x, checked: !x.checked } : x))} className="rounded border-gray-300 dark:border-gray-600 focus:ring-0" /></td>
                      <td className="p-2 font-semibold text-gray-900">{r.name || '—'}</td>
                      <td className="p-2 text-gray-600">{r.email || '—'}</td>
                      <td className="p-2 text-gray-500">{r.country || '—'}</td>
                      <td className="p-2 text-gray-500">{r.phone || '—'}</td>
                      <td className="p-2 text-gray-500">{r.status}</td>
                      <td className="p-2 font-medium">
                        {r.error ? <span className="text-red-600">{r.error}</span> : r.warning ? <span className="text-yellow-700">{r.warning}</span> : <span className="text-green-600">OK</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-4 bg-gray-50/80 border-t border-gray-100 flex justify-end gap-2">
              <button onClick={() => { setShowImportPreview(false); setImportPreviewData([]); }} disabled={importLoading} className="px-4 py-2 text-[13px] font-medium text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 disabled:opacity-50">Cancel</button>
              <button onClick={handleConfirmImport} disabled={importLoading || importPreviewData.filter(r => r.checked && !r.error).length === 0} className="px-4 py-2 text-[13px] font-semibold text-white bg-gray-900 rounded-xl hover:opacity-90 shadow-sm disabled:opacity-50 flex items-center gap-2">
                {importLoading && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                Import {importPreviewData.filter(r => r.checked && !r.error).length} selected rows
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CLIENT MERGE MODAL (Feature 27) */}
      {showMergeTool && mergeSource && (
        <div className="fixed inset-0 bg-white dark:bg-gray-950 z-[90] overflow-y-auto animate-in fade-in duration-200">
          <div>
            <div className="sticky top-0 z-10 bg-white/95 dark:bg-gray-950/95 backdrop-blur-sm border-b border-gray-100 dark:border-gray-800 px-4 sm:px-8 py-4 flex items-center justify-between">
              <button onClick={() => !mergeLoading && setShowMergeTool(false)} className="flex items-center gap-2 text-[13px] font-semibold text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"><span aria-hidden>←</span> Back</button>
              <h3 className="text-[15px] font-bold text-gray-900 dark:text-white">Merge Relationship — Step {mergeStep} of 2</h3>
              <div className="w-16" />
            </div>
            <div className="max-w-2xl mx-auto w-full px-4 sm:px-6 py-8 space-y-4 text-[13px]">
              {mergeStep === 1 && (
                <>
                  <p className="text-gray-600">Merging <span className="font-bold text-gray-900">{mergeSource.name}</span> into another relationship. Select the <span className="font-semibold">target</span> relationship to keep:</p>
                  <input type="text" autoFocus placeholder="Search relationships..." value={mergeSearch} onChange={e => setMergeSearch(e.target.value)} className="dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:border-gray-400" />
                  <div className="max-h-64 overflow-y-auto space-y-1.5">
                    {clients.filter(c => c.id !== mergeSource.id && ((c.name || '').toLowerCase().includes(mergeSearch.toLowerCase()) || (c.email || '').toLowerCase().includes(mergeSearch.toLowerCase()))).slice(0, 10).map(c => (
                      <button key={c.id} onClick={() => setMergeTarget(c)} className={`w-full flex items-center justify-between p-3 rounded-xl border text-left transition-colors ${mergeTarget?.id === c.id ? 'border-gray-900 bg-gray-50' : 'border-gray-100 hover:border-gray-300'}`}>
                        <div>
                          <p className="font-semibold text-gray-900">{c.name}</p>
                          <p className="text-[12px] text-gray-500">{c.email}</p>
                        </div>
                        <span className="text-[11px] text-gray-400">{activities.filter(a => a.client_id === c.id).length} activities</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
              {mergeStep === 2 && mergeTarget && (
                <>
                  <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-[12px] text-red-800">
                    ⚠️ All activities, tasks, deals, and files from <strong>{mergeSource.name}</strong> ({activities.filter(a => a.client_id === mergeSource.id).length} activities) will move to <strong>{mergeTarget.name}</strong> ({activities.filter(a => a.client_id === mergeTarget.id).length} activities). <strong>{mergeSource.name} will be permanently deleted.</strong>
                  </div>
                  <div className="space-y-2">
                    {['name', 'email', 'phone_number', 'country', 'status', 'relationship', 'linkedin_url', 'birthday', 'source'].filter(f => (mergeSource[f] || '') !== (mergeTarget[f] || '') && (mergeSource[f] || mergeTarget[f])).map(field => (
                      <div key={field} className="grid grid-cols-3 gap-2 items-center p-2 border border-gray-100 rounded-lg">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">{field.replace(/_/g, ' ')}</span>
                        <label className={`flex items-center gap-2 p-1.5 rounded cursor-pointer text-[12px] ${mergeFieldChoices[field] === 'source' ? 'bg-gray-100 font-semibold' : ''}`}>
                          <input type="radio" name={`merge-${field}`} checked={mergeFieldChoices[field] === 'source'} onChange={() => setMergeFieldChoices(prev => ({ ...prev, [field]: 'source' }))} />
                          <span className="truncate">{String(mergeSource[field] || '—')}</span>
                        </label>
                        <label className={`flex items-center gap-2 p-1.5 rounded cursor-pointer text-[12px] ${(mergeFieldChoices[field] || 'target') === 'target' ? 'bg-gray-100 font-semibold' : ''}`}>
                          <input type="radio" name={`merge-${field}`} checked={(mergeFieldChoices[field] || 'target') === 'target'} onChange={() => setMergeFieldChoices(prev => ({ ...prev, [field]: 'target' }))} />
                          <span className="truncate">{String(mergeTarget[field] || '—')}</span>
                        </label>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
            <div className="p-4 bg-gray-50/80 border-t border-gray-100 flex justify-end gap-2">
              {mergeStep === 2 && <button onClick={() => setMergeStep(1)} disabled={mergeLoading} className="px-4 py-2 text-[13px] font-medium text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 mr-auto disabled:opacity-50">&larr; Back</button>}
              <button onClick={() => setShowMergeTool(false)} disabled={mergeLoading} className="px-4 py-2 text-[13px] font-medium text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 disabled:opacity-50">Cancel</button>
              {mergeStep === 1 ? (
                <button onClick={() => setMergeStep(2)} disabled={!mergeTarget} className="px-4 py-2 text-[13px] font-semibold text-white bg-gray-900 rounded-xl hover:opacity-90 shadow-sm disabled:opacity-50">Next</button>
              ) : (
                <button onClick={handleExecuteMerge} disabled={mergeLoading} className="px-4 py-2 text-[13px] font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 shadow-sm disabled:opacity-50 flex items-center gap-2">
                  {mergeLoading && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                  Merge
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* GOAL FORM MODAL (Feature 26) */}
      {showGoalForm && (
        <div className="fixed inset-0 bg-white dark:bg-gray-950 z-[90] overflow-y-auto animate-in fade-in duration-200">
          <div>
            <div className="sticky top-0 z-10 bg-white/95 dark:bg-gray-950/95 backdrop-blur-sm border-b border-gray-100 dark:border-gray-800 px-4 sm:px-8 py-4 flex items-center justify-between">
              <button onClick={() => setShowGoalForm(false)} className="flex items-center gap-2 text-[13px] font-semibold text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"><span aria-hidden>←</span> Back</button>
              <h3 className="text-[15px] font-bold text-gray-900 dark:text-white">Set Monthly Goal</h3>
              <div className="w-16" />
            </div>
            <form onSubmit={handleSaveGoal} className="max-w-md mx-auto w-full px-4 sm:px-6 py-8 space-y-4 text-[13px]">
              <div>
                <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Goal Type</label>
                <select value={goalType} onChange={e => setGoalType(e.target.value)} className="dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white text-gray-700 focus:outline-none">
                  <option value="new_clients">New Relationships</option>
                  <option value="activities_logged">Activities Logged</option>
                  <option value="deals_closed">Deals Closed</option>
                  <option value="tasks_completed">Tasks Completed</option>
                </select>
              </div>
              <div>
                <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Target for {new Date().toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</label>
                <input type="number" min="1" required value={goalTarget} onChange={e => setGoalTarget(e.target.value)} className="dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:border-gray-400" />
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                <button type="button" onClick={() => setShowGoalForm(false)} className="px-4 py-2 text-[13px] font-medium text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50">Cancel</button>
                <button type="submit" className="px-4 py-2 text-[13px] font-semibold text-white bg-gray-900 rounded-xl hover:opacity-90 shadow-sm">Save Goal</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* V4 PART 3 — WHO HAS REPLIED? (cross-campaign full-screen view) */}
      {showWhoRepliedView && (
        <div className="fixed inset-0 bg-white dark:bg-gray-950 z-[95] overflow-y-auto animate-in fade-in duration-200">
          <div className="sticky top-0 z-10 bg-white/95 dark:bg-gray-950/95 backdrop-blur-sm border-b border-gray-100 dark:border-gray-800 px-4 sm:px-8 py-4 flex items-center justify-between gap-3">
            <button onClick={() => { setShowWhoRepliedView(false); setWhoRepliedSeqFilter(null); }} className="flex items-center gap-2 text-[13px] font-semibold text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 shrink-0"><span aria-hidden>←</span> Back to Email Automation</button>
            <h1 className="text-[15px] font-bold text-gray-900 dark:text-white">Who Has Replied?{whoRepliedSeqFilter ? ` — ${sequences.find(q => q.id === whoRepliedSeqFilter)?.name || ''}` : ''}</h1>
            {whoRepliedSeqFilter
              ? <button onClick={() => setWhoRepliedSeqFilter(null)} className="text-[12px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline shrink-0">Show all campaigns</button>
              : <div className="w-40" />}
          </div>
          <div className="max-w-4xl mx-auto px-4 sm:px-8 py-8 space-y-3">
            {repliesWithContact.length === 0 && (
              <p className="text-[13px] text-gray-400 text-center py-12">No replies yet{whoRepliedSeqFilter ? ' in this campaign' : ' across any campaign'}. Replies are detected by Gmail sync and stop the sequence automatically.</p>
            )}
            {repliesWithContact.map(r => (
              <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 p-4 bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-400 flex items-center justify-center text-[13px] font-bold shrink-0">
                    {(r.contact.name || r.contact.first_name || '?').slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-gray-900 dark:text-white truncate">
                      {r.contact.name || `${r.contact.first_name ?? ''} ${r.contact.last_name ?? ''}`.trim() || r.contact.email}
                      {r.isColdContact && <span className="ml-2 text-[10px] font-bold uppercase text-gray-400">Cold Contact</span>}
                    </p>
                    <CompanyLink client={r.contact} className="text-[12px]" />
                    <p className="text-[11px] text-gray-400 mt-0.5">Replied to {r.stepSubject ? `“${r.stepSubject}”` : 'an email'} in {r.seqName} · {new Date(r.replied_at).toLocaleDateString()}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {!r.isColdContact && r.contact && <button onClick={() => { setShowWhoRepliedView(false); setViewingClient(clients.find(c => c.id === r.contact.id) || r.contact); }} className="px-3 py-1.5 text-[12px] font-semibold border border-gray-200 dark:border-gray-700 rounded-lg text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800">View Relationship</button>}
                  {(() => {
                    const enr = sequenceEnrollments.find(e2 => e2.id === r.enrollment_id);
                    return enr && enr.status === 'active'
                      ? <button onClick={() => handleStopEnrollment(enr)} className="px-3 py-1.5 text-[12px] font-semibold text-red-600 border border-red-200 dark:border-red-900 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30">Stop Sequence</button>
                      : <span className="text-[11px] font-semibold text-gray-400 capitalize">{enr ? enr.status : 'stopped'}</span>;
                  })()}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* V4 PART 4 — ENROLL BY FILTER (full-screen panel, same predicate as the main table) */}
      {showEnrollPanel && (() => {
        const seq = sequences.find(s => s.id === showEnrollPanel);
        if (!seq) return null;
        return (
          <div className="fixed inset-0 bg-white dark:bg-gray-950 z-[95] overflow-y-auto animate-in fade-in duration-200">
            <div className="sticky top-0 z-10 bg-white/95 dark:bg-gray-950/95 backdrop-blur-sm border-b border-gray-100 dark:border-gray-800 px-4 sm:px-8 py-4 flex items-center justify-between gap-3">
              <button onClick={() => setShowEnrollPanel(null)} className="flex items-center gap-2 text-[13px] font-semibold text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 shrink-0"><span aria-hidden>←</span> Back</button>
              <h1 className="text-[15px] font-bold text-gray-900 dark:text-white truncate">Enroll in “{seq.name}”</h1>
              <div className="w-16" />
            </div>
            <div className="max-w-4xl mx-auto px-4 sm:px-8 py-8">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                <select value={enrollFilterStatus} onChange={e => setEnrollFilterStatus(e.target.value)} className="px-3 py-2 text-[13px] border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-lg focus:outline-none">
                  <option value="All">All Stages</option>
                  {PIPELINE_STAGES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <select value={enrollFilterPriority} onChange={e => setEnrollFilterPriority(e.target.value)} className="px-3 py-2 text-[13px] border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-lg focus:outline-none">
                  <option value="All">All Priorities</option>
                  {['High', 'Medium', 'Low'].map(p => <option key={p} value={p}>{p}</option>)}
                </select>
                <select value={enrollFilterSource} onChange={e => setEnrollFilterSource(e.target.value)} className="px-3 py-2 text-[13px] border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-lg focus:outline-none">
                  <option value="All">All Sources</option>
                  {CLIENT_SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <label className="flex items-center gap-2 px-3 py-2 text-[12px] text-gray-500 border border-gray-200 dark:border-gray-700 rounded-lg">
                  Score ≥
                  <input type="number" min="0" max="100" value={enrollFilterScoreMin} onChange={e => setEnrollFilterScoreMin(Math.max(0, parseInt(e.target.value, 10) || 0))} className="w-14 bg-transparent dark:text-white focus:outline-none" />
                </label>
                {tags.length > 0 && (
                  <div className="col-span-2 sm:col-span-4 flex flex-wrap items-center gap-1.5">
                    {tags.map(t => (
                      <button key={t.id} onClick={() => setEnrollFilterTags(prev => prev.includes(t.id) ? prev.filter(x => x !== t.id) : [...prev, t.id])}
                        className={`px-2.5 py-1 rounded-full text-[11px] font-semibold ring-1 ring-inset transition-all ${enrollFilterTags.includes(t.id) ? 'text-white ring-transparent' : 'text-gray-500 ring-gray-300 dark:ring-gray-600 hover:ring-gray-400'}`}
                        style={enrollFilterTags.includes(t.id) ? { backgroundColor: t.color } : {}}>
                        {t.name}
                      </button>
                    ))}
                  </div>
                )}
                <input type="text" placeholder="Search name, email, company..." value={enrollSearchTerm} onChange={e => setEnrollSearchTerm(e.target.value)} className="col-span-2 sm:col-span-4 px-3 py-2 text-[13px] border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:placeholder-gray-500 rounded-lg focus:outline-none" />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-indigo-50 dark:bg-indigo-950/30 rounded-xl mb-4">
                <span className="text-[13px] font-semibold text-indigo-700 dark:text-indigo-300">{enrollMatchingClients.length} relationships match these filters</span>
                <button disabled={enrollMatchingClients.length === 0} onClick={async () => {
                  const n = await bulkEnrollClientsInSequence(seq, enrollMatchingClients.map(c => c.id));
                  if (n > 0) setShowEnrollPanel(null);
                }} className="px-4 py-2 text-[13px] font-semibold text-white bg-indigo-600 rounded-xl hover:opacity-90 disabled:opacity-40">Enroll All Matching</button>
              </div>

              <div className="space-y-1.5">
                {enrollMatchingClients.slice(0, 100).map(c => {
                  const already = sequenceEnrollments.some(en => en.sequence_id === seq.id && en.client_id === c.id && en.status === 'active');
                  return (
                    <div key={c.id} className={`flex items-center gap-3 px-3 py-2 rounded-xl border border-gray-100 dark:border-gray-800 text-[13px] ${already ? 'opacity-50' : ''}`}>
                      <span className="font-semibold text-gray-900 dark:text-gray-100 truncate">{c.name}</span>
                      <span className="text-[11px] text-gray-400 truncate">{c.email}</span>
                      <CompanyLink client={c} className="text-[11px] hidden sm:inline-flex" />
                      <span className="ml-auto text-[11px] font-bold text-gray-500 shrink-0" title="Lead score">{c.leadScore ?? 0}</span>
                      {already && <span className="text-[10px] font-bold uppercase text-gray-400 shrink-0">Enrolled</span>}
                    </div>
                  );
                })}
                {enrollMatchingClients.length > 100 && <p className="text-[11px] text-gray-400 text-center py-2">…and {enrollMatchingClients.length - 100} more (all will be enrolled)</p>}
              </div>
            </div>
          </div>
        );
      })()}

      {/* KEYBOARD HELP MODAL (Feature 28) */}
      {showKeyboardHelp && (
        <div className="fixed inset-0 bg-gray-950/40 backdrop-blur-sm z-[140] flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => setShowKeyboardHelp(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl border border-gray-100 overflow-hidden animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-gray-100 bg-gray-50/50 dark:bg-gray-800/40 flex items-center justify-between">
              <h3 className="text-[15px] font-bold text-gray-900">Keyboard Shortcuts</h3>
              <button onClick={() => setShowKeyboardHelp(false)} className="font-bold text-gray-400 hover:text-gray-800 text-lg">&times;</button>
            </div>
            <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-6 text-[13px]">
              <div>
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-3">Navigation</h4>
                {[['Alt+1', 'Dashboard'], ['Alt+2', 'Relationships'], ['Alt+3', 'Tasks'], ['Alt+4', 'Reports'], ['Alt+5', 'Calendar']].map(([k, d]) => (
                  <div key={k} className="flex justify-between items-center py-1.5">
                    <span className="text-gray-600">{d}</span>
                    <kbd className="text-[11px] font-bold bg-gray-100 border border-gray-200 rounded px-1.5 py-0.5 text-gray-600">{k}</kbd>
                  </div>
                ))}
              </div>
              <div>
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-3">Actions</h4>
                {[['⌘K / Ctrl+K', 'Global search'], ['⌘N / Ctrl+N', 'New relationship (on Relationships page)'], ['?', 'Show shortcuts'], ['Esc', 'Close / dismiss']].map(([k, d]) => (
                  <div key={k} className="flex justify-between items-center py-1.5 gap-3">
                    <span className="text-gray-600">{d}</span>
                    <kbd className="text-[11px] font-bold bg-gray-100 border border-gray-200 rounded px-1.5 py-0.5 text-gray-600 whitespace-nowrap">{k}</kbd>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Fixed "?" shortcut hint button (Feature 28) */}
      {user && (
        <button onClick={() => setShowKeyboardHelp(true)} className="fixed bottom-6 left-4 md:bottom-8 md:left-[264px] z-40 w-9 h-9 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-full shadow-md text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 font-bold text-[14px] transition-colors" title="Keyboard shortcuts (?)">?</button>
      )}

      {/* Country combobox options (shared by all country fields) */}
      <datalist id="country-list">
        {COUNTRY_LIST.map(c => <option key={c} value={c} />)}
      </datalist>

      {/* CONFIRM DIALOG MODAL */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmLabel={confirmDialog.confirmLabel}
        confirmVariant={confirmDialog.confirmVariant}
        isLoading={confirmDialog.isLoading}
        onConfirm={handleConfirmDialogConfirm}
        onCancel={closeConfirm}
      />

      {/* TOAST NOTIFICATIONS */}
      {toasts.map(toast => (
        <Toast
          key={toast.id}
          id={toast.id}
          type={toast.type}
          message={toast.message}
          onClose={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
        />
      ))}

    </div>
  );
}
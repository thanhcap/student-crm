'use client';
// V4 PART 7 — public pricing page (marketing surface, real route).
// Self-contained on purpose: importing from the 8k-line app module would drag
// the whole authenticated bundle into a public page. Theme comes from the
// global `dark` class set by the layout's pre-paint script.
import { useState } from 'react';

const PRICING_TIERS = [
  {
    key: 'free', name: 'Free', price: 0, recommended: false,
    tagline: 'Everything you need to try it for real.',
    features: ['Up to 50 relationships', 'Manual email sending', 'Deals pipeline', 'Basic reporting'],
  },
  {
    key: 'pro', name: 'Pro', price: 19, recommended: true,
    tagline: 'For anyone doing real outreach at volume.',
    features: ['Unlimited relationships', 'Automatic multi-step sequences', 'Cold contacts + CSV import', 'AI relationship summaries', 'LinkedIn + Email multichannel campaigns'],
  },
  {
    key: 'team', name: 'Team', price: 39, recommended: false, perSeat: true,
    tagline: 'Shared pipeline for growing teams.',
    features: ['Everything in Pro', 'Shared workspace, roles & permissions', 'Webhooks & integrations', 'Priority support'],
  },
];

const COMPARISON_ROWS = [
  { category: 'Core CRM', rows: [
    { label: 'Relationships', free: '50', pro: 'Unlimited', team: 'Unlimited' },
    { label: 'Deals pipeline', free: true, pro: true, team: true },
    { label: 'Custom fields', free: true, pro: true, team: true },
    { label: 'Lead scoring', free: true, pro: true, team: true },
  ]},
  { category: 'Email Automation', rows: [
    { label: 'Manual email sending', free: true, pro: true, team: true },
    { label: 'Automatic multi-step sequences', free: false, pro: true, team: true },
    { label: 'Cold contacts / CSV import', free: false, pro: true, team: true },
    { label: 'LinkedIn + Email multichannel', free: false, pro: true, team: true },
    { label: 'Open / click / reply tracking', free: false, pro: true, team: true },
  ]},
  { category: 'AI Features', rows: [
    { label: 'AI relationship summaries', free: false, pro: true, team: true },
    { label: 'Smart follow-up suggestions', free: false, pro: true, team: true },
  ]},
  { category: 'Team & Security', rows: [
    { label: 'Shared workspace', free: false, pro: false, team: true },
    { label: 'Roles & permissions', free: false, pro: false, team: true },
    { label: 'Webhooks & API', free: false, pro: false, team: true },
    { label: 'Priority support', free: false, pro: false, team: true },
  ]},
];

const PRICING_FAQ = [
  { q: 'What counts toward my relationship limit?', a: 'Any contact saved as a Relationship in your pipeline. Cold contacts (prospects you haven’t engaged yet) are counted separately and don’t count against this limit.' },
  { q: 'What happens if I go over my plan’s limit?', a: 'You’ll get a heads-up in-app before you hit the limit. Existing data is never deleted — you’ll just need to upgrade to add more.' },
  { q: 'Does email sending have its own limits?', a: 'Sending goes through your own connected Gmail account, so you’re subject to Gmail’s own daily sending limits, not ours. We also let you set your own daily cap to protect your sender reputation.' },
  { q: 'Can I change plans anytime?', a: 'Yes — upgrade, downgrade, or cancel anytime from Settings. Changes take effect immediately and billing is prorated.' },
];

function Check() {
  return (
    <svg className="w-4 h-4 text-green-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

function CellValue({ v }) {
  if (v === true) return <svg className="w-4 h-4 text-green-500 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>;
  if (v === false) return <span className="text-gray-300 dark:text-gray-600">—</span>;
  return <span className="text-[12px] font-semibold text-gray-700 dark:text-gray-300">{v}</span>;
}

// Cinematic canvas visual — deliberately the largest, slowest-paced element on the page
function CinematicCanvas() {
  const node = (emoji, label, sub, border, extra = '') => (
    <div className={`w-52 sm:w-60 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 border-l-4 ${border} shadow-md px-3.5 py-2.5 text-left ${extra}`}>
      <p className="text-[12px] font-bold text-gray-900 dark:text-gray-100">{emoji} {label}</p>
      <p className="text-[10px] text-gray-400 truncate">{sub}</p>
    </div>
  );
  return (
    <div className="w-full rounded-2xl bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 shadow-2xl relative overflow-hidden py-10 flex items-center justify-center"
      style={{ backgroundImage: 'radial-gradient(circle, rgba(148,163,184,0.3) 1px, transparent 1px)', backgroundSize: '20px 20px' }}>
      <div className="flex flex-col items-center">
        {node('⚡', 'Trigger', 'Enroll 100 cold contacts', 'border-l-purple-500')}
        <div className="w-px h-5 bg-gray-300 dark:bg-gray-600" />
        {node('🔗', 'LinkedIn: View', 'Warm them up first', 'border-l-indigo-500')}
        <div className="w-px h-5 bg-gray-300 dark:bg-gray-600" />
        {node('⏱', 'Wait', '1 day', 'border-l-gray-400')}
        <div className="w-px h-5 bg-gray-300 dark:bg-gray-600" />
        {node('✉️', 'Email', '“Loved your work at {{company}}…”', 'border-l-blue-500')}
        <div className="w-px h-5 bg-gray-300 dark:bg-gray-600" />
        {node('🔀', 'Condition', 'If no reply in 3 days', 'border-l-amber-500')}
        <div className="flex gap-8 sm:gap-16 mt-4">
          <div className="flex flex-col items-center">
            <span className="text-[9px] font-bold text-white bg-green-500 rounded-full px-2 py-0.5 mb-1.5">Yes</span>
            {node('✉️', 'Follow-up', '“Quick follow-up, {{first_name}}”', 'border-l-blue-500')}
          </div>
          <div className="flex flex-col items-center">
            <span className="text-[9px] font-bold text-white bg-gray-400 rounded-full px-2 py-0.5 mb-1.5">No</span>
            {node('🎯', 'Goal', 'Replied — stop automatically', 'border-l-emerald-500')}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PricingPage() {
  const [annual, setAnnual] = useState(false);
  const [openCat, setOpenCat] = useState(COMPARISON_ROWS[0].category);
  const [openFaq, setOpenFaq] = useState(null);

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 text-gray-900 dark:text-white font-sans">
      {/* NAV */}
      <nav className="sticky top-0 z-20 bg-white/90 dark:bg-gray-950/90 backdrop-blur-sm border-b border-gray-100 dark:border-gray-800">
        <div className="max-w-5xl mx-auto px-6 py-3.5 flex items-center gap-4">
          <a href="/" className="text-[15px] font-bold tracking-tight">Student CRM</a>
          <span className="ml-auto text-[13px] font-semibold text-gray-900 dark:text-gray-100">Pricing</span>
          <a href="/?login=1" className="text-[13px] font-medium text-gray-500 hover:text-gray-900 dark:hover:text-gray-100">Log in</a>
          <a href="/?signup=1" className="px-4 py-2 text-[13px] font-semibold text-white bg-gray-900 dark:bg-white dark:text-gray-900 rounded-xl hover:opacity-90">Start Free</a>
        </div>
      </nav>

      {/* HEADER + TOGGLE */}
      <header className="max-w-5xl mx-auto px-6 pt-16 pb-10 text-center">
        <h1 className="text-[34px] sm:text-[44px] font-bold tracking-tight mb-3">Simple pricing. Serious automation.</h1>
        <p className="text-[15px] text-gray-500 dark:text-gray-400 max-w-lg mx-auto mb-8">Start free, upgrade when your outreach outgrows your clicking finger.</p>
        <div className="inline-flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1">
          {[['Monthly', false], ['Annual — save 10%', true]].map(([label, val]) => (
            <button key={label} onClick={() => setAnnual(val)}
              className={`px-4 py-2 text-[13px] font-semibold rounded-lg transition-all ${annual === val ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 shadow-sm' : 'text-gray-500'}`}>
              {label}
            </button>
          ))}
        </div>
      </header>

      {/* TIER CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-5xl mx-auto px-6 pb-8">
        {PRICING_TIERS.map(tier => (
          <div key={tier.key} className={`relative rounded-2xl p-6 border bg-white dark:bg-gray-900 ${tier.recommended ? 'border-gray-900 dark:border-white shadow-xl sm:scale-[1.03]' : 'border-gray-100 dark:border-gray-800'}`}>
            {tier.recommended && <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-white bg-indigo-600 rounded-full whitespace-nowrap">Recommended</span>}
            <h3 className="text-[16px] font-bold mb-1">{tier.name}</h3>
            <p className="text-[13px] text-gray-500 mb-4">{tier.tagline}</p>
            <p className="text-[36px] font-bold mb-1">
              ${annual ? Math.round(tier.price * 0.9) : tier.price}
              <span className="text-[14px] font-normal text-gray-400">{tier.perSeat ? '/seat/mo' : '/mo'}</span>
            </p>
            <ul className="space-y-2 my-6">
              {tier.features.map(f => (
                <li key={f} className="flex items-start gap-2 text-[13px] text-gray-600 dark:text-gray-300"><Check /> {f}</li>
              ))}
            </ul>
            <a href="/?signup=1" className={`block text-center px-4 py-2.5 text-[13px] font-semibold rounded-xl ${tier.recommended ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:opacity-90' : 'border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
              {tier.price === 0 ? 'Start Free' : 'Start Free Trial'}
            </a>
          </div>
        ))}
      </div>

      {/* CINEMATIC EMAIL AUTOMATION PITCH — deliberately more spacious than anything else here */}
      <section className="relative py-24 sm:py-28 my-12 overflow-hidden bg-gradient-to-b from-indigo-50 via-white to-white dark:from-indigo-950/30 dark:via-gray-950 dark:to-gray-950">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <p className="text-[12px] font-bold uppercase tracking-widest text-indigo-500 mb-4">Email Automation</p>
          <h2 className="text-[34px] sm:text-[48px] font-bold tracking-tight leading-[1.1] mb-6">
            Build the sequence once.<br />Never click “send” again.
          </h2>
          <p className="text-[16px] text-gray-500 dark:text-gray-400 max-w-xl mx-auto mb-12">
            Drag nodes onto a canvas — email, wait, condition, LinkedIn — connect them with arrows,
            and turn it on. It runs on its own schedule, stops the moment someone replies, and shows
            you exactly who’s engaging in real time.
          </p>
        </div>
        <div className="max-w-3xl mx-auto px-6">
          <CinematicCanvas />
        </div>
        <div className="max-w-3xl mx-auto px-6 mt-12 grid grid-cols-3 gap-6 text-center">
          <div><p className="text-[24px] font-bold">0</p><p className="text-[12px] text-gray-500">clicks after setup</p></div>
          <div><p className="text-[24px] font-bold">Auto</p><p className="text-[12px] text-gray-500">stop on reply</p></div>
          <div><p className="text-[24px] font-bold">2</p><p className="text-[12px] text-gray-500">channels, one canvas</p></div>
        </div>
      </section>

      {/* COMPARISON TABLE (accordion by category) */}
      <section className="max-w-4xl mx-auto px-6 pb-16">
        <h2 className="text-center text-[24px] font-bold tracking-tight mb-8">Compare plans in detail</h2>
        <div className="space-y-3">
          {COMPARISON_ROWS.map(group => {
            const open = openCat === group.category;
            return (
              <div key={group.category} className="rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden">
                <button onClick={() => setOpenCat(open ? null : group.category)} className="w-full flex items-center justify-between px-5 py-3.5 bg-gray-50/60 dark:bg-gray-900/60 text-left">
                  <span className="text-[14px] font-bold">{group.category}</span>
                  <span className={`text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden>▾</span>
                </button>
                {open && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-[13px]">
                      <thead>
                        <tr className="text-[11px] uppercase tracking-wider text-gray-400 border-b border-gray-100 dark:border-gray-800">
                          <th className="text-left font-semibold px-5 py-2.5">Feature</th>
                          <th className="font-semibold px-4 py-2.5 w-24">Free</th>
                          <th className="font-semibold px-4 py-2.5 w-24">Pro</th>
                          <th className="font-semibold px-4 py-2.5 w-24">Team</th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.rows.map(r => (
                          <tr key={r.label} className="border-b border-gray-50 dark:border-gray-900 last:border-0">
                            <td className="px-5 py-2.5 text-gray-700 dark:text-gray-300">{r.label}</td>
                            <td className="px-4 py-2.5 text-center"><CellValue v={r.free} /></td>
                            <td className="px-4 py-2.5 text-center"><CellValue v={r.pro} /></td>
                            <td className="px-4 py-2.5 text-center"><CellValue v={r.team} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* FAQ */}
      <section className="max-w-2xl mx-auto px-6 pb-20">
        <h2 className="text-center text-[24px] font-bold tracking-tight mb-8">Questions, answered</h2>
        <div className="space-y-3">
          {PRICING_FAQ.map((f, i) => (
            <div key={f.q} className="rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden">
              <button onClick={() => setOpenFaq(openFaq === i ? null : i)} className="w-full flex items-center justify-between px-5 py-3.5 text-left">
                <span className="text-[14px] font-semibold">{f.q}</span>
                <span className={`text-gray-400 transition-transform ${openFaq === i ? 'rotate-180' : ''}`} aria-hidden>▾</span>
              </button>
              {openFaq === i && <p className="px-5 pb-4 text-[13px] text-gray-500 dark:text-gray-400">{f.a}</p>}
            </div>
          ))}
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="bg-gray-900 dark:bg-white text-white dark:text-gray-900 py-16 text-center">
        <h2 className="text-[26px] sm:text-[30px] font-bold mb-6 px-6">Try the whole thing free. Upgrade when it pays for itself.</h2>
        <a href="/?signup=1" className="inline-block px-6 py-3 text-[14px] font-semibold bg-white dark:bg-gray-900 text-gray-900 dark:text-white rounded-xl hover:opacity-90">Start Free</a>
      </section>

      <footer className="border-t border-gray-100 dark:border-gray-800">
        <div className="max-w-5xl mx-auto px-6 py-8 flex flex-wrap items-center gap-4 text-[12px] text-gray-400">
          <a href="/" className="font-semibold text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100">Student CRM</a>
          <a href="/?login=1" className="hover:text-gray-900 dark:hover:text-gray-100">Log in</a>
          <span className="ml-auto">© {new Date().getFullYear()} Student CRM</span>
        </div>
      </footer>
    </div>
  );
}

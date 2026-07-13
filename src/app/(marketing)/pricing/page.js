'use client';
// V7 — pricing restyle: dark cinematic theme, shared header/footer (from the
// (marketing) route-group layout). ALL logic preserved: PRICING_TIERS, COMPARISON_ROWS,
// PRICING_FAQ, the annual/monthly math, and both accordions are unchanged.
import { useState, useRef, useEffect } from 'react';
import { GradientBorderButton, usePrefersReducedMotion } from '@/components/marketing/ui';

// V8 Part 7 — pricing motion helpers -----------------------------------------

// Fires once when `ref` first scrolls into view (for count-up + stagger triggers).
function useInView(ref, margin = '-60px') {
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    if (seen || !ref.current) return;
    const io = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setSeen(true); io.disconnect(); } },
      { rootMargin: margin }
    );
    io.observe(ref.current);
    return () => io.disconnect();
  }, [ref, seen, margin]);
  return seen;
}

// Whole-dollar count-up that re-animates whenever `target` changes (billing toggle).
// Holds at 0 until `active`, and snaps straight to the value under reduced motion.
function AnimatedPrice({ target, active, reduced }) {
  const [n, setN] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    if (!active) return;
    if (reduced) { setN(target); from.current = target; return; }
    const start = from.current, delta = target - start, t0 = performance.now(), dur = 750;
    let raf;
    const tick = (t) => {
      const k = Math.min(1, (t - t0) / dur);
      const eased = 1 - Math.pow(1 - k, 3);           // easeOutCubic
      setN(Math.round(start + delta * eased));
      if (k < 1) raf = requestAnimationFrame(tick); else from.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, active, reduced]);
  return <>{n}</>;
}

// 3D tilt toward the cursor + a light that follows the pointer across the surface.
// Reduced motion disables all transforms and the moving light.
function TiltCard({ children, recommended, reduced }) {
  const ref = useRef(null);
  const [style, setStyle] = useState({});
  function onMove(e) {
    if (reduced) return;
    const el = ref.current; if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    const rx = (0.5 - py) * 8;
    const ry = (px - 0.5) * 10;
    setStyle({
      transform: `perspective(1000px) rotateX(${rx}deg) rotateY(${ry}deg) translateY(-6px) scale(1.02)`,
      '--light': `radial-gradient(600px circle at ${px * 100}% ${py * 100}%, rgba(160,104,255,0.16), transparent 45%)`,
    });
  }
  function onLeave() {
    setStyle({ transform: 'perspective(1000px) rotateX(0deg) rotateY(0deg) translateY(0) scale(1)' });
  }
  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      style={{ ...style, transition: 'transform 400ms cubic-bezier(0.22,1,0.36,1)', transformStyle: 'preserve-3d' }}
      className={`group relative rounded-[20px] p-6 border backdrop-blur-sm will-change-transform ${recommended ? '' : 'border-white/10 bg-white/[0.03]'}`}
    >
      {recommended && <span className="absolute inset-0 rounded-[20px] pointer-events-none" style={{ borderColor: '#A068FF', border: '1px solid #A068FF', boxShadow: '0 0 40px rgba(160,104,255,0.25)', background: 'rgba(255,255,255,0.03)' }} aria-hidden />}
      {/* cursor-following light */}
      <span className="absolute inset-0 rounded-[20px] pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-200" style={{ background: 'var(--light, transparent)' }} aria-hidden />
      <div className="relative">{children}</div>
    </div>
  );
}

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
    <svg className="w-4 h-4 shrink-0 mt-0.5" style={{ color: '#A068FF' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

function CellValue({ v }) {
  if (v === true) return <svg className="w-4 h-4 mx-auto" style={{ color: '#A068FF' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>;
  if (v === false) return <span className="text-white/20">—</span>;
  return <span className="text-[12px] font-semibold text-white/75">{v}</span>;
}

// Dark-glass recolor of the flow mock (kept 2D so the site has one live WebGL canvas total)
function CinematicCanvas() {
  const node = (emoji, label, sub, glow, extra = '') => (
    <div className={`w-52 sm:w-60 rounded-xl border border-white/10 bg-white/[0.04] backdrop-blur-sm px-3.5 py-2.5 text-left ${extra}`}
      style={{ borderLeft: `3px solid ${glow}`, boxShadow: `0 0 20px ${glow}22` }}>
      <p className="text-[12px] font-bold text-white">{emoji} {label}</p>
      <p className="text-[10px] text-white/40 truncate">{sub}</p>
    </div>
  );
  return (
    <div className="w-full rounded-2xl border border-white/10 relative overflow-hidden py-10 flex items-center justify-center"
      style={{ backgroundImage: 'radial-gradient(circle, rgba(160,104,255,0.18) 1px, transparent 1px)', backgroundSize: '20px 20px', backgroundColor: 'rgba(7,3,25,0.6)' }}>
      <div className="flex flex-col items-center">
        {node('⚡', 'Trigger', 'Enroll 100 cold contacts', '#A068FF')}
        <div className="w-px h-5 bg-white/15" />
        {node('🔗', 'LinkedIn: View', 'Warm them up first', '#6366f1')}
        <div className="w-px h-5 bg-white/15" />
        {node('⏱', 'Wait', '1 day', '#a1a1aa')}
        <div className="w-px h-5 bg-white/15" />
        {node('✉️', 'Email', '“Loved your work at {{company}}…”', '#3b82f6')}
        <div className="w-px h-5 bg-white/15" />
        {node('🔀', 'Condition', 'If no reply in 3 days', '#f59e0b')}
        <div className="flex gap-8 sm:gap-16 mt-4">
          <div className="flex flex-col items-center">
            <span className="text-[9px] font-bold text-white rounded-full px-2 py-0.5 mb-1.5" style={{ background: '#22c55e' }}>Yes</span>
            {node('✉️', 'Follow-up', '“Quick follow-up, {{first_name}}”', '#3b82f6')}
          </div>
          <div className="flex flex-col items-center">
            <span className="text-[9px] font-bold text-white/80 rounded-full px-2 py-0.5 mb-1.5 bg-white/15">No</span>
            {node('🎯', 'Goal', 'Replied — stop automatically', '#14b8a6')}
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
  const reduced = usePrefersReducedMotion();
  const cardsRef = useRef(null);
  const cardsInView = useInView(cardsRef);

  return (
    <div className="text-white">
      {/* HEADER + TOGGLE */}
      <header className="max-w-5xl mx-auto px-6 pt-16 pb-10 text-center anim-fade-up">
        <h1 className="font-display text-[34px] sm:text-[48px] font-semibold tracking-[-0.02em] mb-3">Simple pricing. Serious automation.</h1>
        <p className="text-[15px] text-white/50 max-w-lg mx-auto mb-8">Start free, upgrade when your outreach outgrows your clicking finger.</p>
        {/* animated sliding-pill toggle: the white indicator slides between options */}
        <div className="relative inline-flex items-center bg-white/[0.06] rounded-xl p-1">
          <span
            className="absolute top-1 bottom-1 rounded-lg bg-white shadow-sm"
            style={{
              left: annual ? 'calc(50% + 2px)' : '4px',
              right: annual ? '4px' : 'calc(50% + 2px)',
              transition: reduced ? 'none' : 'left 350ms cubic-bezier(0.22,1,0.36,1), right 350ms cubic-bezier(0.22,1,0.36,1)',
            }}
            aria-hidden
          />
          {[['Monthly', false], ['Annual — save 10%', true]].map(([label, val]) => (
            <button key={label} onClick={() => setAnnual(val)}
              className={`relative z-10 px-4 py-2 text-[13px] font-semibold rounded-lg transition-colors duration-200 ${annual === val ? 'text-[#060218]' : 'text-white/55 hover:text-white'}`}>
              {label}
            </button>
          ))}
        </div>
      </header>

      {/* TIER CARDS */}
      <div ref={cardsRef} className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-5xl mx-auto px-6 pb-8">
        {PRICING_TIERS.map(tier => {
          const price = annual ? Math.round(tier.price * 0.9) : tier.price;
          return (
          <TiltCard key={tier.key} recommended={tier.recommended} reduced={reduced}>
            {tier.recommended && <span className="badge-shimmer absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-white rounded-full whitespace-nowrap">Recommended</span>}
            <h3 className="font-display text-[17px] font-bold mb-1">{tier.name}</h3>
            <p className="text-[13px] text-white/45 mb-4">{tier.tagline}</p>
            <p className="font-display text-[38px] font-semibold mb-1 tabular-nums">
              $<AnimatedPrice target={price} active={cardsInView} reduced={reduced} />
              <span className="text-[14px] font-normal text-white/40">{tier.perSeat ? '/seat/mo' : '/mo'}</span>
            </p>
            <ul className="space-y-2 my-6">
              {tier.features.map((f, i) => (
                <li key={f}
                  className={`flex items-start gap-2 text-[13px] text-white/70 ${cardsInView && !reduced ? 'feat-in' : ''}`}
                  style={cardsInView && !reduced ? { animationDelay: `${0.15 + i * 0.05}s` } : undefined}>
                  <Check /> {f}
                </li>
              ))}
            </ul>
            <div className="flex justify-center">
              <GradientBorderButton href="/?signup=1" dir={tier.recommended ? 'right' : 'left'}>
                {tier.price === 0 ? 'Start Free' : 'Start Free Trial'}
              </GradientBorderButton>
            </div>
          </TiltCard>
          );
        })}
      </div>

      {/* CINEMATIC EMAIL AUTOMATION PITCH */}
      <section className="relative py-24 sm:py-28 my-12 overflow-hidden">
        <div className="absolute inset-0 -z-10" style={{ background: 'radial-gradient(60% 50% at 50% 30%, rgba(160,104,255,0.12), transparent)' }} aria-hidden />
        <div className="max-w-4xl mx-auto px-6 text-center">
          <p className="text-[12px] font-bold uppercase tracking-widest mb-4" style={{ color: '#A068FF' }}>Email Automation</p>
          <h2 className="font-display text-[34px] sm:text-[48px] font-semibold tracking-[-0.02em] leading-[1.1] mb-6">
            Build the sequence once.<br />Never click “send” again.
          </h2>
          <p className="text-[16px] text-white/50 max-w-xl mx-auto mb-12">
            Drag nodes onto a canvas — email, wait, condition, LinkedIn — connect them with arrows,
            and turn it on. It runs on its own schedule, stops the moment someone replies, and shows
            you exactly who’s engaging in real time.
          </p>
        </div>
        <div className="max-w-3xl mx-auto px-6"><CinematicCanvas /></div>
        <div className="max-w-3xl mx-auto px-6 mt-12 grid grid-cols-3 gap-6 text-center">
          <div><p className="font-display text-[24px] font-semibold">0</p><p className="text-[12px] text-white/45">clicks after setup</p></div>
          <div><p className="font-display text-[24px] font-semibold">Auto</p><p className="text-[12px] text-white/45">stop on reply</p></div>
          <div><p className="font-display text-[24px] font-semibold">2</p><p className="text-[12px] text-white/45">channels, one canvas</p></div>
        </div>
      </section>

      {/* COMPARISON TABLE (accordion by category — logic unchanged) */}
      <section className="max-w-4xl mx-auto px-6 pb-16">
        <h2 className="font-display text-center text-[26px] font-semibold tracking-[-0.01em] mb-8">Compare plans in detail</h2>
        <div className="space-y-3">
          {COMPARISON_ROWS.map(group => {
            const open = openCat === group.category;
            return (
              <div key={group.category} className="rounded-[16px] border border-white/10 overflow-hidden">
                <button onClick={() => setOpenCat(open ? null : group.category)} className="w-full flex items-center justify-between px-5 py-3.5 bg-white/[0.04] text-left">
                  <span className="text-[14px] font-bold">{group.category}</span>
                  <span className={`text-white/40 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden>▾</span>
                </button>
                {open && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-[13px]">
                      <thead>
                        <tr className="text-[11px] uppercase tracking-wider text-white/40 border-b border-white/10">
                          <th className="text-left font-semibold px-5 py-2.5">Feature</th>
                          <th className="font-semibold px-4 py-2.5 w-24">Free</th>
                          <th className="font-semibold px-4 py-2.5 w-24">Pro</th>
                          <th className="font-semibold px-4 py-2.5 w-24">Team</th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.rows.map(r => (
                          <tr key={r.label} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02]">
                            <td className="px-5 py-2.5 text-white/70">{r.label}</td>
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

      {/* FAQ (logic unchanged) */}
      <section className="max-w-2xl mx-auto px-6 pb-20">
        <h2 className="font-display text-center text-[26px] font-semibold tracking-[-0.01em] mb-8">Questions, answered</h2>
        <div className="space-y-3">
          {PRICING_FAQ.map((f, i) => (
            <div key={f.q} className="rounded-[16px] border border-white/10 overflow-hidden">
              <button onClick={() => setOpenFaq(openFaq === i ? null : i)} className="w-full flex items-center justify-between px-5 py-3.5 text-left">
                <span className="text-[14px] font-semibold">{f.q}</span>
                <span className={`text-white/40 transition-transform ${openFaq === i ? 'rotate-180' : ''}`} aria-hidden>▾</span>
              </button>
              {openFaq === i && <p className="px-5 pb-4 text-[13px] text-white/50">{f.a}</p>}
            </div>
          ))}
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="py-20 text-center">
        <h2 className="font-display text-[28px] sm:text-[36px] font-semibold tracking-[-0.02em] mb-8 px-6">Try the whole thing free. Upgrade when it pays for itself.</h2>
        <div className="flex justify-center"><GradientBorderButton href="/?signup=1" size="lg" dir="right">Start Free</GradientBorderButton></div>
      </section>
    </div>
  );
}

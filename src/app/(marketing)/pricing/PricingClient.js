'use client';
// V9 — pricing: three tiers (Free / Pro / Max), 3D tilt cards with a
// cursor-following light, spring billing toggle (annual −15%), staggered
// feature rows, shimmering Recommended badge, comparison table, FAQ, and a
// cinematic Email Automation section reusing the globe at small scale.
import { useState, useRef, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'framer-motion';
// REAL PAYMENTS B-1 — Stripe / MoMo method selector
import { PricingCheckoutFlow } from '../../components/Billing';
import { supabase } from '../../../lib/supabase';

const EASE = [0.22, 1, 0.36, 1];
const GlobeScene = dynamic(() => import('@/components/marketing/GlobeScene'), { ssr: false, loading: () => null });

// Prices in USD. Annual = 2 months free (yearly total = monthly × 10):
// Pro $7/mo → $70/yr, Max $10/mo → $100/yr.
const TIERS = [
  {
    key: 'free', name: 'Free', price: 0, annualPrice: 0,
    tagline: 'For getting started.',
    features: ['Up to 25 contacts', 'Deal pipeline (5 deals)', 'Career suite', 'Basic tasks', 'Community templates'],
    cta: 'Get started free',
  },
  {
    key: 'pro', name: 'Pro', price: 7, annualPrice: 70, recommended: true,
    tagline: 'For serious networkers.',
    features: [
      'Unlimited contacts', 'Email automation & sequences', 'Email inbox',
      'Network graph', 'Lead generation', 'Birthday auto-send',
      'Calendar booking', 'Cold outreach', 'API access',
    ],
    cta: 'Start Pro',
  },
  {
    key: 'max', name: 'Max', price: 10, annualPrice: 100,
    tagline: 'For teams and power users.',
    features: [
      'Everything in Pro', 'Video messages', 'WebRTC calling',
      'Team workspace', 'White-label mode', 'Usage dashboard',
      'Referral program', 'Priority support',
    ],
    cta: 'Start Max',
  },
];

const COMPARISON = [
  { category: 'Relationships', rows: [
    ['Contacts', '25', 'Unlimited', 'Unlimited'],
    ['Custom fields', true, true, true],
    ['Lead scoring', false, true, true],
    ['AI summaries', false, true, true],
  ]},
  { category: 'Outreach', rows: [
    ['Manual email sending', true, true, true],
    ['Automatic sequences', false, true, true],
    ['Cold contacts + CSV import', false, true, true],
    ['LinkedIn + Email multichannel', false, true, true],
    ['Open & click tracking', false, true, true],
  ]},
  { category: 'Team & Platform', rows: [
    ['Team workspace with roles', false, false, true],
    ['Webhooks & API access', false, false, true],
    ['Automation rules engine', false, false, true],
    ['White-label branding', false, false, true],
    ['Priority support', false, false, true],
  ]},
];

const FAQ = [
  { q: 'Is the Free plan really free forever?', a: 'Yes. Up to 25 contacts, the deals pipeline, and the career suite are free with no time limit — it only asks for an upgrade when your network outgrows it.' },
  { q: 'What happens when a sequence gets a reply?', a: 'The enrollment stops immediately. Nobody gets a “just following up” email after they already answered you.' },
  { q: 'Do I need my own email server?', a: 'No. Connect Gmail and campaigns send from your own address, with open, click, and reply tracking handled for you.' },
  { q: 'Can I import my existing contacts?', a: 'Pro and Max include CSV import with validation — duplicates and malformed rows are flagged before anything is created.' },
  { q: 'How does annual billing work?', a: 'Pay for a year up front and get 2 months free (Pro is $70/year, Max is $100/year). You can switch between monthly and annual at any time.' },
  { q: 'Can I cancel anytime?', a: 'Yes — downgrades take effect at the end of the billing period and your data stays exportable on every plan.' },
];

function BillingToggle({ annual, onToggle }) {
  return (
    <div className="flex items-center justify-center gap-3 mb-12">
      <span className={`text-[13px] font-medium ${!annual ? 'text-white' : 'text-white/35'}`}>Monthly</span>
      <button onClick={() => onToggle(!annual)} aria-label="Toggle annual billing"
        className="relative w-12 h-6 rounded-full bg-white/10 border border-white/10 transition-colors">
        <motion.div className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow"
          animate={{ left: annual ? '24px' : '2px' }}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }} />
      </button>
      <span className={`text-[13px] font-medium ${annual ? 'text-white' : 'text-white/35'}`}>
        Annual <span className="text-emerald-400 text-[11px] font-semibold">2 months free</span>
      </span>
    </div>
  );
}

function PricingCard({ tier, annual, onChoose, owner }) {
  // Part C5 — Apple hover: a clean upward lift + precise shadow, no tilt.
  const [hovered, setHovered] = useState(false);
  // Annual = 2 months free. Show the per-month equivalent + the yearly total.
  const perMonth = annual ? (tier.annualPrice / 12) : tier.price;
  const priceLabel = tier.price === 0 ? '0' : (annual ? perMonth.toFixed(1).replace(/\.0$/, '') : String(tier.price));

  return (
    <motion.div
      onHoverStart={() => setHovered(true)} onHoverEnd={() => setHovered(false)}
      animate={hovered
        ? { y: -8, boxShadow: '0 24px 60px rgba(41,151,255,0.18)' }
        : { y: 0, boxShadow: '0 2px 16px rgba(0,0,0,0.35)' }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      className={`relative will-change-transform rounded-[24px] p-[1px] ${
        tier.recommended ? 'bg-gradient-to-br from-[#2997FF] to-[#0071E3]' : 'bg-white/[0.08]'
      }`}>
      <div className={`relative rounded-[23px] p-7 h-full ${tier.recommended ? 'bg-[#0A0A18]' : 'bg-[#0C0C16]'}`}>
        {tier.recommended && (
          <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 text-[10px] font-bold uppercase tracking-[0.12em]
                           bg-gradient-to-r from-[#2997FF] to-[#0071E3] text-white rounded-full whitespace-nowrap
                           shadow-[0_0_24px_-4px_rgba(41,151,255,0.5)] animate-[shimmer_3s_ease-in-out_infinite]"
                style={{ backgroundSize: '200% 100%' }}>
            Recommended
          </span>
        )}
        <h3 className="text-[18px] font-bold mb-1" style={{ fontFamily: 'var(--font-space-grotesk)' }}>{tier.name}</h3>
        <p className="text-[12px] text-white/40 mb-5">{tier.tagline}</p>

        <motion.p key={annual ? 'annual' : 'monthly'}
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: EASE }}
          className="text-[42px] font-bold tracking-[-0.03em] mb-1 tabular-nums" style={{ fontFamily: 'var(--font-space-grotesk)' }}>
          ${priceLabel}<span className="text-[14px] font-normal text-white/30">/mo</span>
        </motion.p>
        {tier.price > 0 ? (
          annual ? (
            <p className="text-[11px] text-emerald-400 mb-5">${tier.annualPrice}/year · 2 months free</p>
          ) : (
            <p className="text-[11px] text-white/35 mb-5">${tier.annualPrice}/year if billed annually</p>
          )
        ) : <div className="mb-5" />}

        <ul className="space-y-2.5 mb-7">
          {tier.features.map((f, i) => (
            <motion.li key={f}
              initial={{ opacity: 0, x: -10 }} whileInView={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.04, duration: 0.4, ease: EASE }} viewport={{ once: true }}
              className="flex items-start gap-2 text-[13px] text-white/55">
              <span className="mt-1.5 w-1 h-1 rounded-full bg-violet-500 shrink-0" />
              {f}
            </motion.li>
          ))}
        </ul>

        {/* A6/A9 — owner already has everything: no upgrade CTAs, ever. */}
        {owner ? (
          <div className="block text-center py-3 rounded-xl text-[13px] font-semibold border border-amber-400/30 text-amber-300 bg-amber-500/5">
            Included · Owner
          </div>
        ) : tier.price === 0 ? (
          <a href="/?signup=1"
            className="block text-center py-3 rounded-xl text-[13px] font-semibold transition-all border border-white/10 text-white hover:bg-white/[0.04] hover:border-white/20">
            {tier.cta}
          </a>
        ) : (
          <button type="button" onClick={() => onChoose(tier)}
            className={`block w-full text-center py-3 rounded-xl text-[13px] font-semibold transition-all ${
              tier.recommended
                ? 'bg-white text-black hover:shadow-[0_0_30px_-4px_rgba(255,255,255,0.35)]'
                : 'border border-white/10 text-white hover:bg-white/[0.04] hover:border-white/20'
            }`}>
            {tier.cta}
          </button>
        )}
      </div>
    </motion.div>
  );
}

function Cell({ v }) {
  if (v === true) return <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400" aria-label="Included" />;
  if (v === false) return <span className="text-white/20">—</span>;
  return <span className="text-white/70">{v}</span>;
}

export default function PricingClient() {
  const [annual, setAnnual] = useState(false);
  const [openCat, setOpenCat] = useState(COMPARISON[0].category);
  const [openFaq, setOpenFaq] = useState(null);
  const [hoverCol, setHoverCol] = useState(null);
  const [showGlobe, setShowGlobe] = useState(false);
  // B-1 — checkout state. Checkout needs a session (the routes derive the user
  // from the access token), so an anonymous visitor is sent to sign in first.
  const [checkoutTier, setCheckoutTier] = useState(null);
  const [checkoutMsg, setCheckoutMsg] = useState(null);
  // A6 — a logged-in visitor should see their account, not sign-up CTAs.
  const [account, setAccount] = useState(null); // { email, plan, provider } | null

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!alive || !user) return;
      const { data: sub } = await supabase.from('subscriptions')
        .select('plan, provider').eq('user_id', user.id).maybeSingle();
      if (alive) setAccount({ email: user.email, plan: sub?.plan || 'free', provider: sub?.provider || null });
    })();
    return () => { alive = false; };
  }, []);

  async function handleChoose(tier) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { window.location.href = '/?signup=1'; return; }
    setCheckoutMsg(null);
    setCheckoutTier(tier);
  }

  useEffect(() => {
    const wide = window.matchMedia('(min-width: 1024px)').matches;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    setShowGlobe(wide && !reduced);
  }, []);

  const isOwner = account?.provider === 'owner';

  return (
    <div className="pb-8">
      {/* A6 — logged-in account bar: show plan + a way back to the app, never a
          login form. Owner gets a distinct gold "Max · Owner" treatment. */}
      {account && (
        <div className="max-w-5xl mx-auto px-6 pt-6">
          <div className={`flex items-center justify-between gap-4 p-4 rounded-2xl border ${isOwner
            ? 'border-amber-400/40 bg-gradient-to-r from-amber-500/10 to-yellow-500/5'
            : 'border-white/10 bg-white/[0.04]'}`}>
            <div>
              <p className="text-[13px] font-semibold text-white">Signed in as {account.email}</p>
              <p className="text-[12px] text-white/50 mt-0.5">
                {isOwner ? (
                  <span className="font-semibold text-amber-300">Max · Owner account ∞</span>
                ) : (
                  <>Current plan: <span className="font-semibold capitalize text-white/80">{account.plan}</span></>
                )}
              </p>
            </div>
            <a href="/"
              className="shrink-0 px-4 py-2 rounded-xl text-[13px] font-semibold bg-white text-black hover:bg-white/90 transition-colors">
              Go to App
            </a>
          </div>
        </div>
      )}

      {/* HEADER */}
      <header className="max-w-4xl mx-auto px-6 pt-12 pb-8 text-center">
        <motion.h1 initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: EASE }}
          className="text-[40px] sm:text-[52px] font-semibold tracking-[-0.03em] mb-4" style={{ fontFamily: 'var(--font-space-grotesk)' }}>
          Pricing that scales<br />
          <span className="bg-gradient-to-r from-violet-400 via-cyan-400 to-amber-300 bg-clip-text text-transparent">with your ambition.</span>
        </motion.h1>
        <p className="text-[15px] text-white/50 max-w-md mx-auto mb-10">Free forever for small networks. Pro and Max when the outreach gets serious.</p>
        <BillingToggle annual={annual} onToggle={setAnnual} />
      </header>

      {/* TIER CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto px-6 pb-10 items-stretch">
        {TIERS.map(tier => <PricingCard key={tier.key} tier={tier} annual={annual} onChoose={handleChoose} owner={isOwner} />)}
      </div>

      {/* B-1 — payment method selector (Stripe card / MoMo wallet) */}
      {checkoutTier && (
        <div className="fixed inset-0 z-[200] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={e => { if (e.target === e.currentTarget) setCheckoutTier(null); }}>
          <div className="w-full max-w-sm">
            <PricingCheckoutFlow
              tier={checkoutTier}
              billingCycle={annual ? 'annual' : 'monthly'}
              showToast={(m, t) => setCheckoutMsg({ message: m, type: t })}
              onCancel={() => setCheckoutTier(null)}
              onActivated={() => { window.location.href = '/settings/billing'; }}
            />
            {checkoutMsg && (
              <p className={`mt-3 text-center text-[12px] font-semibold ${checkoutMsg.type === 'error' ? 'text-red-400' : 'text-emerald-400'}`}>
                {checkoutMsg.message}
              </p>
            )}
          </div>
        </div>
      )}

      {/* CINEMATIC EMAIL AUTOMATION — globe reprise + canvas mock */}
      <section className="relative py-32 my-8 overflow-hidden">
        <motion.div aria-hidden className="absolute inset-0 -z-[1]"
          initial={{ backgroundPosition: '0% 50%' }} whileInView={{ backgroundPosition: '100% 50%' }}
          transition={{ duration: 3, ease: 'easeInOut' }} viewport={{ once: true }}
          style={{ background: 'linear-gradient(110deg, rgba(139,92,246,0.07), rgba(6,182,212,0.06), rgba(245,158,11,0.05))', backgroundSize: '200% 100%' }} />
        <div className="max-w-6xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-[0.9fr_1.1fr] gap-12 items-center">
          <div className="relative h-[320px] pointer-events-none hidden lg:block">
            {showGlobe ? <GlobeScene interactive={false} small /> : null}
          </div>
          <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: EASE }} viewport={{ once: true }}>
            <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-violet-400 mb-3">Email Automation</p>
            <h2 className="text-[32px] sm:text-[40px] font-semibold tracking-[-0.02em] leading-[1.1] mb-5" style={{ fontFamily: 'var(--font-space-grotesk)' }}>
              Build the sequence once.<br />Never click “send” again.
            </h2>
            <p className="text-[15px] leading-relaxed text-white/50 mb-8 max-w-lg">
              Drag nodes onto a canvas — email, wait, condition, LinkedIn — connect them with arrows,
              and turn it on. It runs on its own schedule, stops the moment someone replies, and shows
              you exactly who’s engaging in real time.
            </p>
            {/* PLACEHOLDER: swap for a real campaign-canvas screenshot */}
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5 space-y-2.5 max-w-lg">
              {['Trigger — Deal marked Won', 'Email — “Welcome aboard, {{first_name}}”', 'Wait — 3 days', 'Condition — no reply yet?', 'Goal — replied, stop'].map((row, i) => (
                <div key={row} className="rounded-lg border-l-2 bg-white/[0.03] px-3.5 py-2.5"
                     style={{ borderLeftColor: ['#8B5CF6', '#06B6D4', '#71717A', '#F59E0B', '#10B981'][i] }}>
                  <p className="text-[12px] font-semibold text-white/70">{row}</p>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* COMPARISON TABLE */}
      <motion.section initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} transition={{ duration: 0.8 }} viewport={{ once: true }}
        className="max-w-4xl mx-auto px-6 pb-20">
        <h2 className="text-[26px] font-semibold tracking-[-0.02em] text-center mb-8" style={{ fontFamily: 'var(--font-space-grotesk)' }}>Compare plans</h2>
        <div className="rounded-2xl border border-white/[0.08] overflow-hidden">
          {COMPARISON.map(group => {
            const open = openCat === group.category;
            return (
              <div key={group.category} className="border-b border-white/[0.06] last:border-0">
                <button onClick={() => setOpenCat(open ? null : group.category)}
                  className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-white/[0.02] transition-colors">
                  <span className="text-[14px] font-semibold text-white">{group.category}</span>
                  <span className={`text-white/40 text-[12px] transition-transform ${open ? 'rotate-180' : ''}`}>▾</span>
                </button>
                {open && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-[13px]" onMouseLeave={() => setHoverCol(null)}>
                      <thead>
                        <tr className="text-white/35 text-[11px] uppercase tracking-wider">
                          <th className="text-left font-semibold px-5 py-2 w-[40%]"> </th>
                          {['Free', 'Pro', 'Max'].map((t, ci) => (
                            <th key={t} onMouseEnter={() => setHoverCol(ci)}
                                className={`font-semibold px-3 py-2 text-center transition-colors ${hoverCol === ci ? 'text-white bg-white/[0.03]' : ''}`}>{t}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {group.rows.map(([label, ...vals]) => (
                          <tr key={label} className="border-t border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                            <td className="px-5 py-3 text-white/60">{label}</td>
                            {vals.map((v, ci) => (
                              <td key={ci} onMouseEnter={() => setHoverCol(ci)}
                                  className={`px-3 py-3 text-center transition-colors ${hoverCol === ci ? 'bg-white/[0.03]' : ''}`}><Cell v={v} /></td>
                            ))}
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
      </motion.section>

      {/* FAQ */}
      <section className="max-w-2xl mx-auto px-6 pb-24">
        <h2 className="text-[26px] font-semibold tracking-[-0.02em] text-center mb-8" style={{ fontFamily: 'var(--font-space-grotesk)' }}>Questions, answered.</h2>
        <div className="space-y-2.5">
          {FAQ.map((f, i) => {
            const open = openFaq === i;
            return (
              <motion.div key={i}
                initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05, duration: 0.5, ease: EASE }} viewport={{ once: true }}
                className="rounded-xl border border-white/[0.08] bg-white/[0.02] overflow-hidden">
                <button onClick={() => setOpenFaq(open ? null : i)}
                  className="w-full flex items-center justify-between px-5 py-4 text-left">
                  <span className="text-[14px] font-semibold text-white/85">{f.q}</span>
                  <span className={`text-white/40 text-[12px] transition-transform duration-300 ${open ? 'rotate-180' : ''}`}>▾</span>
                </button>
                <AnimatePresence initial={false}>
                  {open && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.35, ease: EASE }}>
                      <p className="px-5 pb-4 text-[13.5px] leading-relaxed text-white/50">{f.a}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
        <div className="text-center mt-12">
          <a href="/?signup=1" className="inline-block px-7 py-3.5 text-[14px] font-semibold text-black bg-white rounded-xl hover:shadow-[0_0_30px_-4px_rgba(255,255,255,0.35)] transition-all">Start Free</a>
        </div>
      </section>
    </div>
  );
}

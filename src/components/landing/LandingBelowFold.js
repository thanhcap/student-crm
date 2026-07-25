'use client';
// Below-the-fold landing sections, split out so they lazy-load via dynamic()
// (Part 4.3) — the hero (OrbitSection + copy + CTA) ships in the initial bundle,
// everything here loads after. Light "orbit redesign" theme; no blur filters;
// every whileInView is once:true; snappy transitions.
import { motion } from 'framer-motion';

const EASE = [0.22, 1, 0.36, 1];
const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE } },
};

const FEATURES_STRIP = [
  { label: 'Relationships', desc: 'Full contact history, company links, and engagement scores in one view.' },
  { label: 'Deals Pipeline', desc: 'Drag deals across stages. Won deals trigger onboarding emails automatically.' },
  { label: 'Email Automation', desc: 'Build multichannel sequences that send themselves and stop on reply.' },
  { label: 'AI Summaries', desc: 'One click to understand any relationship — powered by Claude.' },
  { label: 'Lead Scoring', desc: 'Know who to call today, ranked by real engagement signals.' },
];
const HOW_STEPS = [
  { n: '01', t: 'Import your people', d: 'CSV, Gmail, or one at a time — every contact lands in a scored pipeline.' },
  { n: '02', t: 'Draw the sequence', d: 'Email, wait, condition, LinkedIn — drag the steps onto a canvas and connect the arrows.' },
  { n: '03', t: 'Turn it on', d: 'It sends on your schedule, inside your caps, and stops the second someone replies.' },
  { n: '04', t: 'Follow up like a human', d: 'Opens, clicks and replies surface in one inbox. You show up exactly when it matters.' },
];

export default function LandingBelowFold() {
  return (
    <>
      {/* FEATURES STRIP */}
      <section className="py-24 overflow-hidden">
        <div className="max-w-6xl mx-auto px-6 mb-10">
          <motion.p variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true }}
            className="text-[11px] font-bold uppercase tracking-[0.15em] mb-3" style={{ color: 'var(--land-accent)' }}>Everything you need</motion.p>
          <motion.h2 variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true }}
            className="text-[32px] font-semibold tracking-[-0.02em]" style={{ fontFamily: 'var(--font-space-grotesk)', color: 'var(--land-text)' }}>
            Not just a CRM. A networking engine.
          </motion.h2>
        </div>
        <div className="flex gap-5 px-6 overflow-x-auto pb-4 snap-x snap-mandatory">
          {FEATURES_STRIP.map((f, i) => (
            <motion.div key={f.label}
              initial={{ opacity: 0, x: 40 }} whileInView={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.06, duration: 0.5, ease: EASE }} viewport={{ once: true }}
              className="min-w-[280px] snap-start p-6 rounded-2xl transition-all group"
              style={{ background: 'var(--land-surface)', border: '1px solid var(--land-border)', boxShadow: '0 2px 14px rgba(0,0,0,0.04)' }}>
              <p className="text-[13px] font-bold mb-2 transition-colors" style={{ color: 'var(--land-text)' }}>{f.label}</p>
              <p className="text-[13px] leading-relaxed" style={{ color: 'var(--land-text-2)' }}>{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="py-24">
        <div className="max-w-6xl mx-auto px-6">
          <motion.h2 variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true }}
            className="text-[32px] font-semibold tracking-[-0.02em] mb-14 max-w-md" style={{ fontFamily: 'var(--font-space-grotesk)', color: 'var(--land-text)' }}>
            From cold list to warm pipeline in four moves.
          </motion.h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-16 gap-y-12">
            {HOW_STEPS.map((s, i) => (
              <motion.div key={s.n} variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true }}
                className={i % 2 === 1 ? 'md:mt-12' : ''}>
                <p className="text-[13px] font-bold mb-2" style={{ fontFamily: 'var(--font-space-grotesk)', color: 'var(--land-accent)' }}>{s.n}</p>
                <h3 className="text-[19px] font-semibold mb-2" style={{ color: 'var(--land-text)' }}>{s.t}</h3>
                <p className="text-[14px] leading-relaxed max-w-sm" style={{ color: 'var(--land-text-2)' }}>{s.d}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* AUTOMATION SHOWCASE */}
      <section className="py-32 relative overflow-hidden">
        <div className="absolute inset-0 -z-[1]" style={{ background: 'radial-gradient(50% 60% at 50% 40%, rgba(0,113,227,0.06), transparent)' }} aria-hidden />
        <div className="max-w-6xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-[0.8fr_1.2fr] gap-12 items-center">
          <motion.div variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true }}>
            <p className="text-[11px] font-bold uppercase tracking-[0.15em] mb-3" style={{ color: 'var(--land-accent)' }}>Email Automation</p>
            <h2 className="text-[32px] font-semibold tracking-[-0.02em] mb-4" style={{ fontFamily: 'var(--font-space-grotesk)', color: 'var(--land-text)' }}>
              Build the sequence once. Never click “send” again.
            </h2>
            <p className="text-[14.5px] leading-relaxed mb-6" style={{ color: 'var(--land-text-2)' }}>
              Drag nodes onto a canvas — email, wait, condition, LinkedIn — connect them with arrows,
              and turn it on. It runs on its own schedule, stops the moment someone replies, and shows
              you exactly who’s engaging.
            </p>
            <a href="/features" className="text-[13px] font-semibold transition-colors" style={{ color: 'var(--land-accent)' }}>Explore the canvas →</a>
          </motion.div>
          <motion.div initial={{ opacity: 0, scale: 0.96 }} whileInView={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, ease: EASE }} viewport={{ once: true, margin: '-80px' }}
            className="rounded-[24px] p-6 h-[380px] flex flex-col justify-center gap-3"
            style={{ background: 'var(--land-surface)', border: '1px solid var(--land-border)', boxShadow: '0 8px 40px rgba(0,0,0,0.06)' }}>
            {['Trigger — Deal marked Won', 'Email — “Welcome aboard”', 'Wait — 3 days', 'Condition — replied?', 'Goal — stop on reply'].map((row, i) => (
              <div key={row} className="rounded-xl border-l-2 px-4 py-3"
                style={{ borderLeftColor: ['#0071e3', '#34c759', '#5b8ff9', '#ff9f0a', '#34c759'][i], background: 'var(--land-bg-2)' }}>
                <p className="text-[12.5px] font-semibold" style={{ color: 'var(--land-text)' }}>{row}</p>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* TESTIMONIALS — placeholder structure, populate with real quotes later */}
      <section className="py-24">
        <div className="max-w-6xl mx-auto px-6">
          <motion.h2 variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true }}
            className="text-[32px] font-semibold tracking-[-0.02em] mb-12" style={{ fontFamily: 'var(--font-space-grotesk)', color: 'var(--land-text)' }}>
            People who network for a living.
          </motion.h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {[
              { q: 'Placeholder quote — how the pipeline changed a job search.', a: 'Student, placeholder' },
              { q: 'Placeholder quote — an agency running cold outreach on autopilot.', a: 'Founder, placeholder' },
              { q: 'Placeholder quote — a consultant who stopped losing follow-ups.', a: 'Consultant, placeholder' },
            ].map((t, i) => (
              <motion.blockquote key={i} variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true }}
                className={`p-6 rounded-2xl ${i === 1 ? 'md:-mt-6' : ''}`}
                style={{ background: 'var(--land-surface)', border: '1px solid var(--land-border)', boxShadow: '0 2px 14px rgba(0,0,0,0.04)' }}>
                <p className="text-[14px] leading-relaxed mb-4" style={{ color: 'var(--land-text)' }}>“{t.q}”</p>
                <footer className="text-[12px] font-semibold" style={{ color: 'var(--land-text-2)' }}>{t.a}</footer>
              </motion.blockquote>
            ))}
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="relative py-32 overflow-hidden">
        <div className="absolute inset-0 -z-[1]" style={{ background: 'linear-gradient(180deg, transparent, rgba(0,113,227,0.06) 40%, rgba(52,199,89,0.05))' }} aria-hidden />
        <div className="max-w-4xl mx-auto px-6 text-center">
          <motion.h2 variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true }}
            className="text-[36px] lg:text-[44px] font-semibold tracking-[-0.03em] mb-6"
            style={{ fontFamily: 'var(--font-space-grotesk)', color: 'var(--land-text)' }}>
            The people you know are the career you get.
          </motion.h2>
          <div className="flex items-center justify-center gap-3">
            <a href="/?signup=1" className="px-7 py-3.5 text-[14px] font-semibold text-white rounded-xl transition-all"
              style={{ background: 'var(--land-accent)' }}>Start Free</a>
            <a href="/pricing" className="px-7 py-3.5 text-[14px] font-semibold rounded-xl transition-all"
              style={{ color: 'var(--land-text)', border: '1px solid var(--land-border)' }}>See Pricing</a>
          </div>
        </div>
      </section>
    </>
  );
}

'use client';
// V9 — features deep-dive: 8 alternating scroll-revealed sections with a 3D
// breather (small auto-rotating globe) between sections 4 and 5. Screenshot
// slots are structured placeholders — real captures drop in later.
import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { motion } from 'framer-motion';

const EASE = [0.22, 1, 0.36, 1];
const GlobeScene = dynamic(() => import('@/components/marketing/GlobeScene'), { ssr: false, loading: () => null });

const SECTIONS = [
  { label: 'Relationships', color: '#8B5CF6', headline: 'Every person, remembered.',
    body: 'Full contact history, company links, engagement scores, and custom fields in one view. The next time you talk to someone, you know exactly where you left off.' },
  { label: 'Deals Pipeline', color: '#06B6D4', headline: 'Drag a card, move a deal.',
    body: 'A kanban that mirrors how you actually sell: stages you define, values that roll up per column, and Won deals that trigger onboarding sequences automatically.' },
  { label: 'Email Automation', color: '#F59E0B', headline: 'The sequence canvas.', big: true,
    body: 'This is the feature everything else orbits. Drag email, wait, condition, and LinkedIn steps onto a canvas, connect them with arrows, and turn it on. It sends inside your schedule and caps, tracks opens and clicks, and stops the moment someone replies. Cold contacts, CSV imports, and unsubscribe handling included.' },
  { label: 'AI Summaries', color: '#EC4899', headline: 'Understand anyone in one click.',
    body: 'Claude reads the history and gives you the story so far — what you talked about, what you promised, and what to say next.' },
  { label: 'Lead Scoring', color: '#10B981', headline: 'Know who to call today.',
    body: 'Engagement signals rank your pipeline continuously, so mornings start with a short list instead of a long scroll.' },
  { label: 'Calendar', color: '#3B82F6', headline: 'Deadlines, birthdays, follow-ups.',
    body: 'Everything with a date lands on one calendar — task due dates, deal closes, and the birthdays that turn contacts into friends.' },
  { label: 'Reporting', color: '#A855F7', headline: 'Proof it’s working.',
    body: 'Win rates, response times, activity trends, and pipeline value over time — with period comparison to show the compounding.' },
  { label: 'Team Workspace', color: '#14B8A6', headline: 'Share the pipeline, keep the roles.',
    body: 'Invite teammates with owner, editor, or viewer roles. Everyone sees the same truth; only the right people can change it.' },
];

function FeatureSection({ s, i }) {
  const reverse = i % 2 === 1;
  return (
    <section className={`py-16 ${s.big ? 'py-28' : ''}`}>
      <div className={`max-w-6xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center`}>
        <motion.div initial={{ opacity: 0, y: 28 }} whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: EASE }} viewport={{ once: true, margin: '-60px' }}
          className={reverse ? 'lg:order-2' : ''}>
          <p className="text-[11px] font-bold uppercase tracking-[0.15em] mb-3" style={{ color: s.color }}>{s.label}</p>
          <h2 className={`font-semibold tracking-[-0.02em] mb-4 ${s.big ? 'text-[34px] lg:text-[42px]' : 'text-[28px] lg:text-[32px]'}`}
              style={{ fontFamily: 'var(--font-space-grotesk)' }}>
            {s.headline}
          </h2>
          <p className="text-[14.5px] leading-relaxed text-white/50 max-w-md">{s.body}</p>
        </motion.div>
        {/* PLACEHOLDER screenshot slot — drop a real capture in later */}
        <motion.div initial={{ opacity: 0, scale: 0.96 }} whileInView={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, ease: EASE }} viewport={{ once: true, margin: '-60px' }}
          className={`rounded-[20px] border border-white/[0.08] bg-white/[0.02] ${s.big ? 'h-[380px]' : 'h-[300px]'} grid place-items-center ${reverse ? 'lg:order-1' : ''}`}
          style={{ boxShadow: `0 0 80px -30px ${s.color}55` }}>
          <span className="text-[12px] font-semibold uppercase tracking-wider text-white/25">{s.label} — screenshot</span>
        </motion.div>
      </div>
    </section>
  );
}

export default function FeaturesClient() {
  const [showGlobe, setShowGlobe] = useState(false);
  useEffect(() => {
    const wide = window.matchMedia('(min-width: 1024px)').matches;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    setShowGlobe(wide && !reduced);
  }, []);

  return (
    <div className="pb-12">
      <header className="max-w-3xl mx-auto px-6 pt-12 pb-10 text-center">
        <motion.h1 initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: EASE }}
          className="text-[40px] sm:text-[52px] font-semibold tracking-[-0.03em] mb-4" style={{ fontFamily: 'var(--font-space-grotesk)' }}>
          Everything you need to turn<br />
          <span className="bg-gradient-to-r from-violet-400 via-cyan-400 to-amber-300 bg-clip-text text-transparent">connections into opportunities.</span>
        </motion.h1>
      </header>

      {SECTIONS.slice(0, 4).map((s, i) => <FeatureSection key={s.label} s={s} i={i} />)}

      {/* 3D breather — auto-rotating globe, no interaction */}
      <section className="py-20 relative pointer-events-none" aria-hidden>
        <div className="max-w-4xl mx-auto h-[300px]">
          {showGlobe ? <GlobeScene interactive={false} small /> : (
            <div className="w-full h-full flex items-center justify-center">
              <div className="w-[220px] aspect-square rounded-full opacity-30"
                   style={{ background: 'radial-gradient(circle at 30% 30%, #1a1a4e, #06060F 70%)', boxShadow: '0 0 100px 30px rgba(139,92,246,0.08)' }} />
            </div>
          )}
        </div>
      </section>

      {SECTIONS.slice(4).map((s, i) => <FeatureSection key={s.label} s={s} i={i + 4} />)}

      <section className="max-w-3xl mx-auto px-6 py-20 text-center">
        <h2 className="text-[30px] font-semibold tracking-[-0.02em] mb-8" style={{ fontFamily: 'var(--font-space-grotesk)' }}>
          See it with your own pipeline.
        </h2>
        <a href="/?signup=1" className="inline-block px-7 py-3.5 text-[14px] font-semibold text-black bg-white rounded-xl hover:shadow-[0_0_30px_-4px_rgba(255,255,255,0.35)] transition-all">Start Free</a>
      </section>
    </div>
  );
}

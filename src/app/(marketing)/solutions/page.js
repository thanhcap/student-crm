'use client';
// V7 Solutions — the one live WebGL canvas of the whole site lives here (HeroScene),
// gated to desktop + no-reduced-motion. Feature copy is anchored to the pricing page's
// COMPARISON_ROWS categories so messaging matches what pricing actually promises.
import dynamic from 'next/dynamic';
import { GradientBorderButton, usePrefersReducedMotion } from '@/components/marketing/ui';
import { useState, useEffect } from 'react';

const HeroScene = dynamic(() => import('@/app/HeroScene'), { ssr: false, loading: () => null });

function useIsDesktop() {
  const [d, setD] = useState(false);
  useEffect(() => {
    const m = window.matchMedia('(min-width: 1024px)');
    const u = () => setD(m.matches);
    u(); m.addEventListener('change', u);
    return () => m.removeEventListener('change', u);
  }, []);
  return d;
}

const SECTIONS = [
  { id: 'pipeline', label: 'Relationship Pipeline', headline: 'Every relationship, in one pipeline.',
    points: ['Relationships & deals pipeline', 'Custom fields', 'Lead scoring'], reverse: false },
  { id: 'outreach', label: 'Automated Outreach', headline: 'Sequences that send themselves.',
    points: ['Manual + automatic multi-step sequences', 'Cold contacts & CSV import', 'LinkedIn + Email multichannel', 'Open / click / reply tracking'], reverse: true, live: true },
  { id: 'ai', label: 'AI Assist', headline: 'Know what to say, and when.',
    points: ['AI relationship summaries', 'Smart follow-up suggestions'], reverse: false },
  { id: 'team', label: 'Team & Security', headline: 'Built to share, built to trust.',
    points: ['Shared workspace', 'Roles & permissions', 'Webhooks & API', 'Priority support'], reverse: true },
];

function GlassMock({ live, show3d }) {
  if (live && show3d) {
    return (
      <div className="rounded-[24px] border border-white/10 overflow-hidden h-[340px]" style={{ background: 'radial-gradient(60% 60% at 50% 40%, rgba(160,104,255,0.14), transparent)' }}>
        <HeroScene />
      </div>
    );
  }
  return (
    <div className="rounded-[24px] border border-white/10 bg-white/[0.03] backdrop-blur-sm h-[340px] p-6 flex flex-col justify-center gap-3">
      {[0, 1, 2].map(i => (
        <div key={i} className="rounded-xl border-l-2 border-[#A068FF] bg-white/[0.04] px-4 py-3">
          <div className="h-2.5 w-24 rounded bg-white/25 mb-2" />
          <div className="h-2 w-40 rounded bg-white/10" />
        </div>
      ))}
    </div>
  );
}

export default function SolutionsPage() {
  const isDesktop = useIsDesktop();
  const reduced = usePrefersReducedMotion();
  const show3d = isDesktop && !reduced;

  return (
    <div>
      {/* hero-lite */}
      <section className="max-w-[1100px] mx-auto px-6 pt-16 pb-8 text-center anim-fade-up">
        <p className="text-[12px] uppercase tracking-[0.14em] text-[#A068FF] mb-4">Solutions</p>
        <h1 className="font-display text-white text-[40px] md:text-[56px] font-semibold tracking-[-0.02em] leading-[1.05] max-w-3xl mx-auto">
          One tool for the whole outreach loop.
        </h1>
        <p className="text-white/55 text-[16px] mt-5 max-w-xl mx-auto">
          Track relationships, run multichannel campaigns that send themselves, and see exactly who’s engaging — without leaving one app.
        </p>
      </section>

      {/* flagship live visual */}
      <section className="max-w-[1000px] mx-auto px-6 pb-12">
        <div className="rounded-[28px] border border-white/10 overflow-hidden h-[360px] anim-scale-in" style={{ background: 'radial-gradient(60% 60% at 50% 45%, rgba(160,104,255,0.16), transparent)' }}>
          {show3d ? <HeroScene /> : <div className="w-full h-full grid place-items-center text-white/40 text-[13px]">Your campaign, running.</div>}
        </div>
      </section>

      {/* feature sections */}
      <div className="max-w-[1100px] mx-auto px-6 pb-8 space-y-20">
        {SECTIONS.map(s => (
          <section key={s.id} id={s.id} className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center anim-fade-up anim-delay-6">
            <div className={s.reverse ? 'lg:order-2' : ''}>
              <p className="text-[12px] uppercase tracking-[0.14em] text-[#A068FF] mb-3">{s.label}</p>
              <h2 className="font-display text-white text-[28px] md:text-[34px] font-semibold tracking-[-0.01em] mb-5">{s.headline}</h2>
              <ul className="space-y-2.5">
                {s.points.map(p => (
                  <li key={p} className="flex items-start gap-3 text-white/65 text-[15px]">
                    <span className="mt-2 w-1.5 h-1.5 rounded-full bg-[#A068FF] shrink-0" />{p}
                  </li>
                ))}
              </ul>
            </div>
            <div className={s.reverse ? 'lg:order-1' : ''}>
              {/* only the hero canvas is live; feature mocks are static to keep one WebGL context */}
              <GlassMock live={false} show3d={false} />
            </div>
          </section>
        ))}
      </div>

      {/* CTA */}
      <section className="max-w-[900px] mx-auto px-6 py-20 text-center">
        <h2 className="font-display text-white text-[30px] md:text-[40px] font-semibold tracking-[-0.02em] mb-8">Start building relationships that don’t slip through.</h2>
        <div className="flex items-center justify-center gap-5">
          <GradientBorderButton href="/?signup=1" size="lg" dir="right">Start Free</GradientBorderButton>
          <a href="/pricing" className="text-[14px] font-semibold text-white/70 hover:text-white transition-colors">See pricing →</a>
        </div>
      </section>
    </div>
  );
}

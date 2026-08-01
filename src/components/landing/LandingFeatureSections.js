'use client';
// Below-the-fold feature sections for the floating-icon landing. Dark theme to
// match the hero. Reveal on scroll via IntersectionObserver (no framer-motion).
import { useEffect, useRef, useState } from 'react';

function useReveal(threshold = 0.15) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setVisible(true); obs.disconnect(); }
    }, { threshold });
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return [ref, visible];
}

function FeatureRow({ headline, body, side = 'left', icon, children, first }) {
  const [ref, visible] = useReveal(0.15);
  return (
    <section ref={ref} id={first ? 'features' : undefined} style={{
      display: 'flex', flexWrap: 'wrap',
      flexDirection: side === 'left' ? 'row' : 'row-reverse',
      alignItems: 'center', gap: 48, maxWidth: 1100, margin: '0 auto', padding: '72px 32px',
      opacity: visible ? 1 : 0,
      transform: visible ? 'translateY(0)' : 'translateY(40px)',
      transition: 'opacity 0.7s ease, transform 0.7s cubic-bezier(0.22,1,0.36,1)',
    }}>
      <div style={{ flex: '1 1 300px' }}>
        <div style={{ fontSize: 44, marginBottom: 16 }}>{icon}</div>
        <h2 style={{ fontSize: 34, fontWeight: 700, letterSpacing: '-0.5px', color: '#F0F0FF', margin: '0 0 16px' }}>{headline}</h2>
        <p style={{ fontSize: 17, color: 'rgba(255,255,255,0.55)', lineHeight: 1.7, margin: 0 }}>{body}</p>
      </div>
      <div style={{
        flex: '1 1 300px',
        opacity: visible ? 1 : 0, transform: visible ? 'scale(1)' : 'scale(0.93)',
        transition: 'opacity 0.8s ease 0.15s, transform 0.8s cubic-bezier(0.22,1,0.36,1) 0.15s',
      }}>
        {children}
      </div>
    </section>
  );
}

function MockCard({ children }) {
  return (
    <div style={{
      borderRadius: 20, padding: 20, minHeight: 220,
      background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
      boxShadow: '0 20px 60px rgba(0,0,0,0.35)', display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      {children}
    </div>
  );
}

function Pill({ color, children }) {
  return (
    <div style={{
      borderLeft: `3px solid ${color}`, background: 'rgba(255,255,255,0.03)',
      borderRadius: 10, padding: '10px 14px', color: 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: 600,
    }}>{children}</div>
  );
}

export default function LandingFeatureSections() {
  return (
    <div style={{ background: '#0E1117' }}>
      <FeatureRow first side="left" icon="✉️"
        headline="Outreach that sends itself"
        body="Build a sequence once — email, wait, condition, LinkedIn — and it runs on your schedule, stops the moment someone replies, and drops every response into one inbox.">
        <MockCard>
          <Pill color="#8B5CF6">Trigger — Deal marked Won</Pill>
          <Pill color="#6366F1">Email — “Welcome aboard”</Pill>
          <Pill color="#14B8A6">Wait — 3 days</Pill>
          <Pill color="#F59E0B">Condition — replied?</Pill>
          <Pill color="#10B981">Goal — stop on reply</Pill>
        </MockCard>
      </FeatureRow>

      <FeatureRow side="right" icon="🎂"
        headline="Never miss a moment that matters"
        body="Set the birthday automation once and everyone with a date gets a warm note on the day — no enrollment, no reminders to yourself. Upcoming birthdays surface on your dashboard.">
        <MockCard>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 34 }}>🎂</span>
            <div>
              <p style={{ color: '#F0F0FF', fontWeight: 700, fontSize: 15, margin: 0 }}>Happy Birthday (Auto)</p>
              <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12, margin: '2px 0 0' }}>Fires for everyone with a birthday set</p>
            </div>
          </div>
          <Pill color="#EC4899">Today — Sarah Chen 🎉</Pill>
          <Pill color="#8B5CF6">In 3 days — James Liu</Pill>
          <Pill color="#6366F1">In 6 days — Aiko Tanaka</Pill>
        </MockCard>
      </FeatureRow>

      <FeatureRow side="left" icon="🕸️"
        headline="See the network behind the names"
        body="Every contact, company and warm intro path on one living graph. Know who can introduce you to whom, and who deserves your attention this week — ranked by real engagement.">
        <MockCard>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, placeItems: 'center', padding: '10px 0' }}>
            {['👤', '🤝', '💼', '🔗', '📊', '⭐'].map((e, i) => (
              <div key={i} style={{
                width: 52, height: 52, borderRadius: 14, display: 'grid', placeItems: 'center', fontSize: 24,
                background: 'linear-gradient(135deg,#6366F1,#4338CA)', boxShadow: '0 8px 24px rgba(99,102,241,0.3)',
              }}>{e}</div>
            ))}
          </div>
          <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12, textAlign: 'center', margin: 0 }}>Your relationships, mapped</p>
        </MockCard>
      </FeatureRow>
    </div>
  );
}

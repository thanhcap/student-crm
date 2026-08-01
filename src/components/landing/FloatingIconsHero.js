'use client';
// Floating-icon hero (teamworkgraph.com-inspired). 14 CRM tool icons scattered
// across a full-viewport near-black canvas, each drifting on its own slow CSS
// keyframe with depth-of-field blur; centered headline + two CTAs; nav frosts
// on scroll. Pure CSS/JS — no WebGL, no Three.js, no framer-motion.
import { useEffect, useState } from 'react';

const FLOATING_ICONS = [
  { id: 'gmail',    bg: 'linear-gradient(135deg,#EA4335,#FBBC04)', emoji: '✉️',  label: 'Gmail',        size: 64, depth: 1.0 },
  { id: 'linkedin', bg: 'linear-gradient(135deg,#0077B5,#00A0DC)', emoji: '🔗',  label: 'LinkedIn',     size: 72, depth: 0.9 },
  { id: 'calendar', bg: 'linear-gradient(135deg,#34A853,#0D7A35)', emoji: '📅',  label: 'Calendar',     size: 56, depth: 0.7 },
  { id: 'contacts', bg: 'linear-gradient(135deg,#8B5CF6,#6D28D9)', emoji: '👤',  label: 'Contacts',     size: 80, depth: 1.0 },
  { id: 'deals',    bg: 'linear-gradient(135deg,#F59E0B,#D97706)', emoji: '💼',  label: 'Deals',        size: 60, depth: 0.8 },
  { id: 'notes',    bg: 'linear-gradient(135deg,#F97316,#EA580C)', emoji: '📝',  label: 'Notes',        size: 52, depth: 0.6 },
  { id: 'graph',    bg: 'linear-gradient(135deg,#06B6D4,#0284C7)', emoji: '🕸️', label: 'Network',      size: 68, depth: 0.9 },
  { id: 'phone',    bg: 'linear-gradient(135deg,#10B981,#059669)', emoji: '📱',  label: 'Calls',        size: 54, depth: 0.7 },
  { id: 'birthday', bg: 'linear-gradient(135deg,#EC4899,#BE185D)', emoji: '🎂',  label: 'Birthdays',    size: 58, depth: 0.8 },
  { id: 'tasks',    bg: 'linear-gradient(135deg,#14B8A6,#0F766E)', emoji: '✅',  label: 'Tasks',        size: 50, depth: 0.6 },
  { id: 'insights', bg: 'linear-gradient(135deg,#6366F1,#4338CA)', emoji: '📊',  label: 'Insights',     size: 62, depth: 1.0 },
  { id: 'star',     bg: 'linear-gradient(135deg,#EAB308,#CA8A04)', emoji: '⭐',  label: 'Priorities',   size: 46, depth: 0.5 },
  { id: 'handshake',bg: 'linear-gradient(135deg,#EC4899,#8B5CF6)', emoji: '🤝',  label: 'Networking',   size: 70, depth: 0.9 },
  { id: 'trophy',   bg: 'linear-gradient(135deg,#F59E0B,#10B981)', emoji: '🏆',  label: 'Achievements', size: 48, depth: 0.5 },
];

const ICON_POSITIONS = [
  { left: '8%',  top: '15%' }, // gmail
  { left: '85%', top: '12%' }, // linkedin
  { left: '5%',  top: '55%' }, // calendar
  { left: '88%', top: '45%' }, // contacts
  { left: '15%', top: '80%' }, // deals
  { left: '80%', top: '72%' }, // notes
  { left: '22%', top: '30%' }, // graph
  { left: '72%', top: '25%' }, // phone
  { left: '30%', top: '70%' }, // birthday
  { left: '65%', top: '68%' }, // tasks
  { left: '45%', top: '10%' }, // insights
  { left: '3%',  top: '35%' }, // star
  { left: '90%', top: '78%' }, // handshake
  { left: '55%', top: '82%' }, // trophy
];

function FloatingIcon({ icon, position, index }) {
  const duration = 8 + (index * 1.7) % 7;    // 8–15s, different per icon
  const delay    = -((index * 2.3) % duration); // negative = start mid-cycle
  // Each icon wanders around its own position on a small ellipse — different
  // radius, direction, and rotation per icon so they float AROUND (not all up).
  const rx  = 14 + (index * 3.1) % 16;   // 14–30px horizontal radius
  const ry  = 12 + (index * 2.7) % 14;   // 12–26px vertical radius
  const dir = index % 2 === 0 ? 1 : -1;  // half orbit clockwise, half counter
  const rot = ((index % 3) - 1) * 2;     // gentle -2°/0°/+2° sway
  // Quarter points of the ellipse. dir flips the vertical order to reverse spin.
  const q1 = `${rx}px, 0px`;
  const q2 = dir > 0 ? `0px, ${ry}px` : `0px, ${-ry}px`;
  const q3 = `${-rx}px, 0px`;
  const q4 = dir > 0 ? `0px, ${-ry}px` : `0px, ${ry}px`;

  const blurAmount = icon.depth < 0.7 ? 1.5 : icon.depth < 0.85 ? 0.5 : 0;
  const opacity    = 0.5 + icon.depth * 0.5;  // 0.5–1.0
  const animName   = `float-${icon.id}`;
  const restShadow = `0 ${icon.size * 0.12}px ${icon.size * 0.4}px rgba(0,0,0,${0.3 + (1 - icon.depth) * 0.2})`;

  return (
    <>
      <style>{`
        @keyframes ${animName} {
          0%   { transform: translate(${q1}) rotate(0deg); }
          25%  { transform: translate(${q2}) rotate(${rot}deg); }
          50%  { transform: translate(${q3}) rotate(0deg); }
          75%  { transform: translate(${q4}) rotate(${-rot}deg); }
          100% { transform: translate(${q1}) rotate(0deg); }
        }
        @media (prefers-reduced-motion: reduce) { .fih-${icon.id} { animation: none !important; } }
      `}</style>
      <div
        className={`fih-${icon.id}`}
        title={icon.label}
        style={{
          position: 'absolute',
          left: position.left,
          top: position.top,
          width: icon.size,
          height: icon.size,
          borderRadius: icon.size * 0.28,
          background: icon.bg,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: icon.size * 0.45,
          boxShadow: restShadow,
          opacity,
          filter: blurAmount > 0 ? `blur(${blurAmount}px)` : 'none',
          animation: `${animName} ${duration}s ease-in-out ${delay}s infinite`,
          willChange: 'transform',
          cursor: 'default', userSelect: 'none',
          transition: 'filter 0.3s ease, opacity 0.3s ease, box-shadow 0.3s ease',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.filter = 'blur(0px)';
          e.currentTarget.style.opacity = '1';
          e.currentTarget.style.boxShadow = `0 ${icon.size * 0.2}px ${icon.size * 0.6}px rgba(99,102,241,0.35)`;
        }}
        onMouseLeave={e => {
          e.currentTarget.style.filter = blurAmount > 0 ? `blur(${blurAmount}px)` : 'none';
          e.currentTarget.style.opacity = String(opacity);
          e.currentTarget.style.boxShadow = restShadow;
        }}
      >
        {icon.emoji}
      </div>
    </>
  );
}

export default function FloatingIconsHero({ onGetStarted, onSignIn }) {
  const [mounted, setMounted] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 100);
    const handler = () => setScrolled(window.scrollY > 48);
    window.addEventListener('scroll', handler, { passive: true });
    return () => { clearTimeout(t); window.removeEventListener('scroll', handler); };
  }, []);

  return (
    <div style={{
      position: 'relative', width: '100%', minHeight: '100vh', overflow: 'hidden',
      // Not pure black, not space — a subtle warm-indigo/green gradient.
      background: 'linear-gradient(160deg, #0E1117 0%, #12101F 40%, #0E1A14 100%)',
    }}>
      {/* Top nav — transparent, frosts on scroll */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, height: 56, zIndex: 100,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 32px',
        background: scrolled ? 'rgba(14,17,23,0.85)' : 'transparent',
        backdropFilter: scrolled ? 'blur(20px) saturate(180%)' : 'none',
        WebkitBackdropFilter: scrolled ? 'blur(20px) saturate(180%)' : 'none',
        borderBottom: scrolled ? '1px solid rgba(255,255,255,0.06)' : '1px solid transparent',
        transition: 'background 0.4s ease, backdrop-filter 0.4s ease, border-color 0.4s ease',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 20 }}>🤝</span>
          <span style={{ color: '#F0F0FF', fontWeight: 700, fontSize: 16, letterSpacing: '-0.3px' }}>Relationship CRM</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <a href="#features" style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14, textDecoration: 'none' }}>Features</a>
          <a href="/pricing" style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14, textDecoration: 'none' }}>Pricing</a>
          <button onClick={onSignIn} style={{ color: 'rgba(255,255,255,0.7)', background: 'none', border: 'none', fontSize: 14, cursor: 'pointer' }}>Sign in</button>
          <button onClick={onGetStarted} style={{
            background: '#6366F1', color: 'white', border: 'none', cursor: 'pointer',
            padding: '8px 18px', borderRadius: 8, fontSize: 14, fontWeight: 600,
            boxShadow: '0 0 20px rgba(99,102,241,0.4)',
          }}>Get started free</button>
        </div>
      </nav>

      {/* Floating icons — staggered spring-in on mount */}
      {FLOATING_ICONS.map((icon, i) => (
        <div key={icon.id} style={{
          opacity: mounted ? 1 : 0,
          transform: mounted ? 'scale(1)' : 'scale(0.4)',
          transition: `opacity 0.6s ease ${i * 60}ms, transform 0.6s cubic-bezier(0.34,1.56,0.64,1) ${i * 60}ms`,
        }}>
          <FloatingIcon icon={icon} position={ICON_POSITIONS[i]} index={i} />
        </div>
      ))}

      {/* Center content */}
      <div style={{
        position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '0 24px', zIndex: 10,
        pointerEvents: 'none',
      }}>
        <div style={{
          position: 'absolute', width: 600, height: 400, borderRadius: '50%',
          background: 'radial-gradient(ellipse, rgba(99,102,241,0.12) 0%, transparent 70%)', pointerEvents: 'none',
        }} />
        <h1 style={{
          fontSize: 'clamp(36px, 5vw, 64px)', fontWeight: 700, letterSpacing: '-1.5px',
          lineHeight: 1.1, color: '#F0F0FF', margin: '0 0 20px', maxWidth: 680, position: 'relative',
        }}>
          Build relationships that{' '}
          <span style={{
            background: 'linear-gradient(90deg, #818CF8, #A78BFA, #6EE7B7)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
          }}>actually open doors.</span>
        </h1>
        <p style={{
          fontSize: 'clamp(16px, 2vw, 20px)', color: 'rgba(255,255,255,0.55)',
          maxWidth: 520, lineHeight: 1.6, margin: '0 0 40px', position: 'relative',
        }}>
          The CRM that tracks birthdays, automates outreach, and maps your network —
          so no relationship ever slips through the cracks.
        </p>
        <div style={{ display: 'flex', gap: 12, position: 'relative', pointerEvents: 'auto', flexWrap: 'wrap', justifyContent: 'center' }}>
          <button onClick={onGetStarted} style={{
            background: '#6366F1', color: 'white', border: 'none', cursor: 'pointer',
            padding: '14px 32px', borderRadius: 12, fontSize: 16, fontWeight: 600,
            boxShadow: '0 0 40px rgba(99,102,241,0.5)', transition: 'transform 0.2s ease, box-shadow 0.2s ease',
          }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 0 60px rgba(99,102,241,0.7)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 0 40px rgba(99,102,241,0.5)'; }}>
            Start for free
          </button>
          <button onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })} style={{
            background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.8)',
            border: '1px solid rgba(255,255,255,0.12)', cursor: 'pointer',
            padding: '14px 24px', borderRadius: 12, fontSize: 16, fontWeight: 500, transition: 'background 0.2s ease',
          }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.12)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.07)'}>
            See features →
          </button>
        </div>
      </div>
    </div>
  );
}

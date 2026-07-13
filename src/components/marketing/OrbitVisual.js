'use client';
// V7 — orbiting relationship constellation. 4 concentric rotating rings + avatars of
// the people a student tracks (recruiter, mentor, alum, founder, professor…). CSS-only
// (no WebGL) so it can live on Home while the single live Three.js canvas stays on Solutions.
import { useCountUp } from './ui';

// Same orbit geometry as the reference; avatars are anonymous pravatar placeholders.
const AVATARS = [
  { angle: 270, radius: 177, size: 58, round: false, glow: '#A068FF', img: 12, role: 'Recruiter' },
  { angle: 60,  radius: 251, size: 58, round: true,  glow: '#F5C542', img: 5,  role: 'Hiring manager' },
  { angle: 180, radius: 251, size: 78, round: true,  glow: '#FF6FB5', img: 32, role: 'Mentor' },
  { angle: 300, radius: 251, size: 58, round: false, glow: '#5B8DEF', img: 15, role: 'Alum' },
  { angle: 130, radius: 325, size: 88, round: true,  glow: '#FF6FB5', img: 8,  role: 'Founder' },
  { angle: 30,  radius: 399, size: 58, round: true,  glow: '#A068FF', img: 3,  role: 'Professor' },
  { angle: 95,  radius: 399, size: 88, round: false, glow: '#FF9F45', img: 45, role: 'Client' },
  { angle: 220, radius: 399, size: 88, round: false, glow: '#FF6FB5', img: 60, role: 'Teammate' },
  { angle: 320, radius: 399, size: 58, round: true,  glow: '#A068FF', img: 25, role: 'Referral' },
];

const RINGS = [
  { d: 353, spin: 'spin-left-30' },
  { d: 501, spin: 'spin-right-40' },
  { d: 649, spin: 'spin-right-50' },
  { d: 797, spin: 'spin-left-60' },
];

export default function OrbitVisual({ scale = 1 }) {
  // TODO: replace with real, current number before launch
  const PLACEHOLDER_STAT = 240;
  const n = useCountUp(PLACEHOLDER_STAT, { duration: 2000, delay: 400 });

  return (
    <div className="relative mx-auto" style={{ width: 797 * scale, height: 797 * scale }} aria-hidden>
      <div className="absolute inset-0 origin-center" style={{ transform: `scale(${scale})`, top: '50%', left: '50%', translate: '-50% -50%', width: 797, height: 797 }}>
        {RINGS.map(r => (
          <div key={r.d} className={`orbit-ring ${r.spin}`} style={{ width: r.d, height: r.d }} />
        ))}

        {AVATARS.map((a, i) => (
          <div key={i} className="absolute top-1/2 left-1/2 avatar-in"
            style={{
              width: a.size, height: a.size,
              transform: `translate(-50%,-50%) rotate(${a.angle}deg) translate(${a.radius}px) rotate(-${a.angle}deg)`,
              animationDelay: `${0.6 + i * 0.19}s`,
            }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`https://i.pravatar.cc/150?img=${a.img}`} alt={a.role}
              width={a.size} height={a.size} loading="lazy"
              style={{
                width: '100%', height: '100%', objectFit: 'cover',
                borderRadius: a.round ? '9999px' : a.size >= 88 ? 24 : 20,
                boxShadow: `0 0 24px ${a.glow}66, 0 4px 20px rgba(0,0,0,0.4)`,
                border: '1px solid rgba(255,255,255,0.12)',
              }} />
          </div>
        ))}

        {/* Center count-up stat */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
          <div className="font-display text-white" style={{ fontSize: 64, fontWeight: 500, lineHeight: 1 }}>
            {Math.round(n)}
            {/* TODO: replace with real, current number before launch */}
          </div>
          <div className="font-display text-white/70 mt-1" style={{ fontSize: 16, fontWeight: 600 }}>Relationships Tracked</div>
        </div>
      </div>
    </div>
  );
}

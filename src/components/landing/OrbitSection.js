'use client';
// Pure CSS orbit animation — replaces the Three.js Earth hero. No WebGL, no
// requestAnimationFrame loop: the spin runs on the compositor thread, which is
// why it's smooth and cheap (the WebGL render loop was the landing's FPS sink).
import { useState, useEffect } from 'react';

const APPS = {
  email:    { bg: 'linear-gradient(180deg,#53c8f5,#147efb)', emoji: '✉️',  label: 'Email Automation' },
  calendar: { bg: 'linear-gradient(180deg,#ff6b6b,#ee0979)', emoji: '📅',  label: 'Meetings'         },
  contacts: { bg: 'linear-gradient(180deg,#a4a4a6,#8e8e93)', emoji: '👤',  label: 'Relationships'    },
  deals:    { bg: 'linear-gradient(180deg,#43e97b,#38f9d7)', emoji: '💼',  label: 'Deals'            },
  linkedin: { bg: 'linear-gradient(180deg,#0077b5,#005885)', emoji: '🔗',  label: 'LinkedIn'         },
  notes:    { bg: 'linear-gradient(180deg,#ffe03b,#ffc107)', emoji: '📝',  label: 'Notes'            },
  graph:    { bg: 'linear-gradient(180deg,#667eea,#764ba2)', emoji: '🕸️', label: 'Network Graph'    },
  ai:       { bg: 'linear-gradient(180deg,#f093fb,#f5576c)', emoji: '⚡',  label: 'Automation'       },
  birthday: { bg: 'linear-gradient(180deg,#fa709a,#fee140)', emoji: '🎂',  label: 'Birthdays'        },
};

const PROFILES = [
  { emoji: '🧑‍💼', color: '#dbeafe', label: 'Sales Pro',  apps: ['email', 'deals', 'contacts', 'calendar'] },
  { emoji: '🎓',   color: '#dcfce7', label: 'Student',    apps: ['contacts', 'linkedin', 'notes', 'birthday'] },
  { emoji: '🚀',   color: '#fce7f3', label: 'Founder',    apps: ['deals', 'email', 'graph', 'ai', 'calendar'] },
  { emoji: '🤝',   color: '#fff7ed', label: 'Networker',  apps: ['contacts', 'linkedin', 'graph', 'birthday', 'notes'] },
  { emoji: '📊',   color: '#f3e8ff', label: 'Consultant', apps: ['deals', 'email', 'calendar', 'contacts', 'ai'] },
];

const RADIUS = 160;
const CENTER = 250;
const CSS = `
  @keyframes crm-spin    { from{transform:rotate(0deg)}   to{transform:rotate(360deg)}  }
  @keyframes crm-counter { from{transform:rotate(0deg)}   to{transform:rotate(-360deg)} }
  .crm-orbit-track { animation: crm-spin    40s linear infinite; will-change: transform; }
  .crm-orbit-icon  { animation: crm-counter 40s linear infinite; will-change: transform; }
  @media (prefers-reduced-motion: reduce) {
    .crm-orbit-track, .crm-orbit-icon { animation: none; }
  }
`;

export default function OrbitSection() {
  const [profileIdx, setProfileIdx] = useState(0);
  const [emojiVisible, setEmojiVisible] = useState(true);
  const [positions, setPositions] = useState({});

  const profile = PROFILES[profileIdx];

  useEffect(() => {
    const active = profile.apps;
    const n = active.length;
    const pos = {};
    active.forEach((key, i) => {
      const angle = -Math.PI / 2 + (i * (2 * Math.PI / n));
      pos[key] = { x: CENTER + RADIUS * Math.cos(angle), y: CENTER + RADIUS * Math.sin(angle) };
    });
    setPositions(pos);
  }, [profileIdx]); // eslint-disable-line react-hooks/exhaustive-deps

  function cycleProfile() {
    setEmojiVisible(false);
    setTimeout(() => {
      setProfileIdx(i => (i + 1) % PROFILES.length);
      setEmojiVisible(true);
    }, 150);
  }

  const activeApps = profile.apps;

  return (
    <div style={{ position: 'relative', width: 500, height: 500, maxWidth: '100%', margin: '0 auto', flexShrink: 0 }}>
      <style>{CSS}</style>

      {/* Continuously rotating orbit track */}
      <div className="crm-orbit-track" style={{ position: 'absolute', width: '100%', height: '100%' }}>
        {Object.entries(APPS).map(([key, data]) => {
          const activeIdx = activeApps.indexOf(key);
          const isActive = activeIdx !== -1;
          const pos = positions[key];
          return (
            <div key={key} style={{
              position: 'absolute', width: 0, height: 0,
              left: isActive && pos ? pos.x : CENTER,
              top:  isActive && pos ? pos.y : CENTER,
              transition: 'left 0.8s cubic-bezier(0.34,1.56,0.64,1), top 0.8s cubic-bezier(0.34,1.56,0.64,1)',
            }}>
              <div className="crm-orbit-icon" title={data.label} style={{
                position: 'absolute', left: -32, top: -32,
                width: 64, height: 64, borderRadius: '50%',
                background: data.bg,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 28,
                boxShadow: '0 6px 20px rgba(0,0,0,0.15)',
                opacity: isActive ? 1 : 0,
                transform: isActive ? 'scale(1)' : 'scale(0.3)',
                transition: 'opacity 0.4s ease, transform 0.8s cubic-bezier(0.34,1.56,0.64,1)',
                transitionDelay: isActive ? `${activeIdx * 40}ms` : '0ms',
                pointerEvents: isActive ? 'auto' : 'none',
              }}>
                {data.emoji}
              </div>
            </div>
          );
        })}
      </div>

      {/* Central avatar — click to cycle */}
      <button onClick={cycleProfile} aria-label="Cycle profiles" style={{
        position: 'absolute', left: '50%', top: '50%',
        transform: 'translate(-50%,-50%)',
        width: 120, height: 120, borderRadius: '50%',
        background: profile.color,
        border: 'none', cursor: 'pointer', zIndex: 10,
        boxShadow: '0 12px 40px rgba(0,0,0,0.12)',
        fontSize: 60, display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'background 0.6s ease',
      }}>
        <span style={{
          display: 'inline-block',
          transform: emojiVisible ? 'scale(1)' : 'scale(0)',
          transition: 'transform 0.3s cubic-bezier(0.34,1.56,0.64,1)',
        }}>
          {profile.emoji}
        </span>
      </button>

      {/* Profile label */}
      <div style={{
        position: 'absolute', left: '50%', top: 'calc(50% + 72px)',
        transform: 'translateX(-50%)', textAlign: 'center', zIndex: 10,
      }}>
        <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--land-text)', margin: 0 }}>{profile.label}</p>
        <p style={{ fontSize: 11, color: 'var(--land-text-2)', margin: '2px 0 0' }}>Click to change</p>
      </div>
    </div>
  );
}

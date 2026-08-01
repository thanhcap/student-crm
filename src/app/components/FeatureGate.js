'use client';
// Feature gating UI. Adapted to this app's architecture: plan is passed as a
// prop (the app has no global useAppState hook). The owner account has
// plan='max', so hasFeature() returns true for everything and gates never show.
import { useState } from 'react';
import { hasFeature } from '../../constants/plans';

// UpgradeModal — shown from any lock. Prices match the pricing page ($7 / $10).
export function UpgradeModal({ onClose, requiredPlan = 'pro', message }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: '#1C1C28', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20,
        padding: 32, maxWidth: 440, width: '100%', boxShadow: '0 40px 80px rgba(0,0,0,0.5)',
        maxHeight: '90vh', overflowY: 'auto',
      }}>
        <h3 style={{ color: '#F0F0FF', fontSize: 22, fontWeight: 700, margin: '0 0 8px' }}>Upgrade your plan</h3>
        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, margin: '0 0 20px' }}>
          {message || 'Unlock this and every other premium feature.'}
        </p>
        <PlanCard plan="pro" price={7} features={['Unlimited contacts', 'Email sequences', 'Network graph', 'Lead generation', 'Birthday automation']} recommended={requiredPlan === 'pro'} />
        <div style={{ height: 12 }} />
        <PlanCard plan="max" price={10} features={['Everything in Pro', 'Video messages', 'Team workspace', 'White-label', 'Priority support']} recommended={requiredPlan === 'max'} />
        <a href="/pricing" style={{
          display: 'block', textAlign: 'center', marginTop: 16, padding: '10px',
          background: '#6366F1', color: 'white', borderRadius: 10, fontSize: 14, fontWeight: 600, textDecoration: 'none',
        }}>See full pricing →</a>
        <button onClick={onClose} style={{ marginTop: 12, color: 'rgba(255,255,255,0.4)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, width: '100%' }}>
          Maybe later
        </button>
      </div>
    </div>
  );
}

function PlanCard({ plan, price, features, recommended }) {
  return (
    <div style={{
      border: recommended ? '1px solid #6366F1' : '1px solid rgba(255,255,255,0.08)',
      background: recommended ? 'rgba(99,102,241,0.08)' : 'rgba(255,255,255,0.02)',
      borderRadius: 14, padding: 18,
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{ color: '#F0F0FF', fontWeight: 700, fontSize: 16, textTransform: 'capitalize' }}>{plan}</span>
        <span style={{ color: '#F0F0FF', fontWeight: 700, fontSize: 18 }}>${price}<span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, fontWeight: 400 }}>/mo</span></span>
      </div>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 5 }}>
        {features.map(f => (
          <li key={f} style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12.5, display: 'flex', gap: 6 }}>
            <span style={{ color: '#34D399' }}>✓</span>{f}
          </li>
        ))}
      </ul>
    </div>
  );
}

function UpgradeOverlay({ requiredPlan, onOpen }) {
  return (
    <div onClick={onOpen} style={{
      position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', cursor: 'pointer', borderRadius: 12,
      background: 'rgba(14,17,23,0.7)', backdropFilter: 'blur(2px)',
      border: '1px solid rgba(99,102,241,0.3)', transition: 'background 0.2s ease',
    }}
      onMouseEnter={e => e.currentTarget.style.background = 'rgba(14,17,23,0.85)'}
      onMouseLeave={e => e.currentTarget.style.background = 'rgba(14,17,23,0.7)'}>
      <div style={{ fontSize: 20, marginBottom: 6 }}>🔒</div>
      <p style={{ color: '#A5B4FC', fontSize: 13, fontWeight: 600, margin: 0 }}>{requiredPlan === 'max' ? 'Max plan' : 'Pro plan'}</p>
      <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, margin: '2px 0 0' }}>Click to upgrade</p>
    </div>
  );
}

function UpgradePrompt({ requiredPlan, onOpen }) {
  const label = requiredPlan === 'max' ? 'Max' : 'Pro';
  const price = requiredPlan === 'max' ? '10' : '7';
  return (
    <div style={{
      padding: '40px 24px', borderRadius: 16, textAlign: 'center',
      border: '1px dashed rgba(99,102,241,0.3)', background: 'rgba(99,102,241,0.04)',
      maxWidth: 480, margin: '40px auto',
    }}>
      <div style={{ fontSize: 32, marginBottom: 12 }}>🔒</div>
      <p style={{ color: '#4338CA', fontWeight: 700, fontSize: 16, marginBottom: 8 }} className="dark:!text-[#E0E7FF]">Available on {label}</p>
      <p style={{ color: 'rgba(120,120,140,0.9)', fontSize: 14, marginBottom: 20 }}>
        Upgrade to unlock this feature and everything else on {label}.
      </p>
      <button onClick={onOpen} style={{
        background: '#6366F1', color: 'white', border: 'none', cursor: 'pointer',
        padding: '10px 24px', borderRadius: 10, fontSize: 14, fontWeight: 600,
      }}>Upgrade to {label} — ${price}/mo</button>
    </div>
  );
}

// FeatureGate wraps a section. plan comes from the caller (App holds it).
// lockStyle='overlay' blurs children behind a lock; 'block' replaces them.
export default function FeatureGate({ plan, feature, requiredPlan = 'pro', children, lockStyle = 'overlay' }) {
  const [modal, setModal] = useState(false);
  const allowed = hasFeature(plan || 'free', feature);
  if (allowed) return children;

  return (
    <>
      {lockStyle === 'block' ? (
        <UpgradePrompt requiredPlan={requiredPlan} onOpen={() => setModal(true)} />
      ) : (
        <div style={{ position: 'relative', width: '100%' }}>
          <div style={{ pointerEvents: 'none', opacity: 0.4, userSelect: 'none', filter: 'blur(1px)' }}>
            {children}
          </div>
          <UpgradeOverlay requiredPlan={requiredPlan} onOpen={() => setModal(true)} />
        </div>
      )}
      {modal && <UpgradeModal requiredPlan={requiredPlan} onClose={() => setModal(false)} />}
    </>
  );
}

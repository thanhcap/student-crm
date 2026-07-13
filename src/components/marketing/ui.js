'use client';
// V7 marketing shared primitives (dark cinematic system).
import { useState, useEffect, useRef } from 'react';

export function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const m = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(m.matches);
    update();
    m.addEventListener('change', update);
    return () => m.removeEventListener('change', update);
  }, []);
  return reduced;
}

// Pill button with a rotating conic-gradient border + slide-in fill on hover.
// Renders an <a> when `href` is set, else a <button>. size: 'sm' | 'lg'; dir: 'left' | 'right'.
export function GradientBorderButton({ href, onClick, children, size = 'sm', dir = 'right', className = '' }) {
  const pad = size === 'lg' ? 'px-8 h-[52px] text-[15px]' : 'px-6 h-11 text-[14px]';
  const inner = (
    <span className={`grad-btn dir-${dir} inline-flex items-center justify-center gap-2 font-semibold ${pad} ${className}`}>
      {children}
    </span>
  );
  return (
    <span className="grad-btn-wrap">
      {href
        ? <a href={href} className="block">{inner}</a>
        : <button type="button" onClick={onClick} className="block">{inner}</button>}
    </span>
  );
}

// Char-by-char typewriter. `parts` = [{text, className}] so a clause can switch color at a pivot.
export function TypewriterHeading({ parts, speed = 35, startDelay = 400, className = '', style = {} }) {
  const reduced = usePrefersReducedMotion();
  const full = parts.map(p => p.text).join('');
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (reduced) { setCount(full.length); return; }
    let i = 0;
    let timer;
    const start = setTimeout(() => {
      timer = setInterval(() => {
        i += 1;
        setCount(i);
        if (i >= full.length) clearInterval(timer);
      }, speed);
    }, startDelay);
    return () => { clearTimeout(start); clearInterval(timer); };
  }, [full, speed, startDelay, reduced]);

  // Slice `count` chars across the colored parts.
  let remaining = count;
  const done = count >= full.length;
  return (
    <h1 className={`font-display ${className}`} style={style}>
      {parts.map((p, i) => {
        const take = Math.max(0, Math.min(p.text.length, remaining));
        remaining -= p.text.length;
        return <span key={i} className={p.className}>{p.text.slice(0, take)}</span>;
      })}
      {!done && <span className="tw-caret" style={{ height: '0.9em', verticalAlign: 'text-bottom' }} />}
    </h1>
  );
}

// 0 → target over ~2s, easeOutCubic, after `delay`ms; respects reduced-motion.
export function useCountUp(target, { duration = 2000, delay = 0 } = {}) {
  const reduced = usePrefersReducedMotion();
  const [val, setVal] = useState(0);
  const started = useRef(false);
  useEffect(() => {
    if (reduced) { setVal(target); return; }
    let raf;
    const begin = setTimeout(() => {
      const t0 = performance.now();
      const tick = (now) => {
        const p = Math.min(1, (now - t0) / duration);
        const eased = 1 - Math.pow(1 - p, 3);
        setVal(target * eased);
        if (p < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }, delay);
    return () => { clearTimeout(begin); cancelAnimationFrame(raf); };
  }, [target, duration, delay, reduced]);
  return val;
}

// "Works with the tools you already use" — Simple Icons CDN, 5 unique × 4 repeats.
export function LogoTicker() {
  // Only ship icons for integrations that are actually real/planned.
  const logos = ['gmail', 'linkedin', 'googlesheets', 'slack', 'zapier'];
  const row = Array.from({ length: 4 }).flatMap(() => logos);
  return (
    <div className="ticker-mask overflow-hidden py-6">
      <p className="text-center text-[12px] uppercase tracking-[0.14em] text-white/35 mb-5">Works with the tools you already use</p>
      <div className="ticker-track" style={{ gap: 64 }}>
        {row.map((name, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={i} src={`https://cdn.simpleicons.org/${name}/A068FF`} alt={name}
            width={137} height={40} loading="lazy"
            style={{ width: 137, height: 40, objectFit: 'contain', opacity: 0.55, flexShrink: 0 }} />
        ))}
      </div>
    </div>
  );
}

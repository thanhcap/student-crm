'use client';
// V9 — blog index card: same 3D tilt-toward-cursor + cursor light treatment
// as the pricing cards.
import { useRef, useState } from 'react';
import Link from 'next/link';

export default function BlogCard({ post }) {
  const ref = useRef(null);
  const [tilt, setTilt] = useState({ rx: 0, ry: 0, px: 50, py: 50 });
  function onMove(e) {
    const el = ref.current; if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    setTilt({ rx: (0.5 - py) * 8, ry: (px - 0.5) * 10, px: px * 100, py: py * 100 });
  }
  function onLeave() { setTilt({ rx: 0, ry: 0, px: 50, py: 50 }); }

  return (
    <Link href={`/blog/${post.slug}`} className="block break-inside-avoid">
      <div ref={ref} onMouseMove={onMove} onMouseLeave={onLeave}
        className="relative will-change-transform rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6 hover:border-white/[0.16] transition-colors"
        style={{
          transform: `perspective(800px) rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg)`,
          transition: 'transform 500ms cubic-bezier(0.22,1,0.36,1), border-color 200ms',
        }}>
        <div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none"
             style={{ background: `radial-gradient(400px circle at ${tilt.px}% ${tilt.py}%, rgba(255,255,255,0.05), transparent 50%)` }} />
        <div className="relative">
          <div className="flex items-center gap-2 text-[11px] text-white/35 mb-3">
            <span className="text-violet-400 font-semibold uppercase tracking-wider">{post.tag}</span>
            <span>·</span><span>{post.date}</span><span>·</span><span>{post.read}</span>
          </div>
          <h3 className="text-[17px] font-semibold leading-snug text-white mb-2" style={{ fontFamily: 'var(--font-space-grotesk)' }}>{post.title}</h3>
          <p className="text-[13px] leading-relaxed text-white/45 line-clamp-2">{post.excerpt}</p>
        </div>
      </div>
    </Link>
  );
}

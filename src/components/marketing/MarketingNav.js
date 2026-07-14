'use client';
// V9 — floating glass nav shared by every marketing page. Sits ON TOP of the
// 3D scene. Auth entry points use the live modal flow (/?login=1, /?signup=1).
import Link from 'next/link';
import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { LogoFull } from '../Logo';

const LINKS = [
  { href: '/', label: 'Home' },
  { href: '/features', label: 'Features' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/blog', label: 'Blog' },
];

export default function MarketingNav() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  return (
    <nav className="fixed top-0 inset-x-0 z-50">
      <div className="mx-auto max-w-6xl px-6 mt-4">
        <div className="flex items-center justify-between h-14 px-5 rounded-2xl
                        bg-white/[0.04] backdrop-blur-xl border border-white/[0.08]
                        shadow-[0_0_30px_-10px_rgba(139,92,246,0.15)]">
          <Link href="/" aria-label="Home"><LogoFull /></Link>

          <div className="hidden md:flex items-center gap-1">
            {LINKS.map(l => (
              <Link key={l.href} href={l.href}
                className={`px-3.5 py-1.5 text-[13px] font-medium rounded-lg transition-colors ${
                  path === l.href
                    ? 'text-white bg-white/[0.08]'
                    : 'text-white/50 hover:text-white hover:bg-white/[0.04]'
                }`}>
                {l.label}
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-2.5">
            <a href="/?login=1" className="hidden sm:block px-4 py-1.5 text-[13px] font-medium text-white/60 hover:text-white transition-colors">
              Log in
            </a>
            <a href="/?signup=1"
               className="px-4 py-2 text-[13px] font-semibold text-black bg-white rounded-xl
                          hover:bg-white/90 transition-colors shadow-[0_0_20px_-4px_rgba(255,255,255,0.3)]">
              Start Free
            </a>
            <button onClick={() => setOpen(!open)} className="md:hidden px-2 py-1.5 text-[13px] font-semibold text-white/70" aria-label="Menu">
              Menu
            </button>
          </div>
        </div>

        {open && (
          <div className="md:hidden mt-2 rounded-2xl bg-[#0A0A18]/95 backdrop-blur-xl border border-white/[0.08] p-3 flex flex-col gap-1">
            {LINKS.map(l => (
              <Link key={l.href} href={l.href} onClick={() => setOpen(false)}
                className={`px-3.5 py-2.5 text-[14px] font-medium rounded-lg ${path === l.href ? 'text-white bg-white/[0.08]' : 'text-white/60'}`}>
                {l.label}
              </Link>
            ))}
            <a href="/?login=1" className="px-3.5 py-2.5 text-[14px] font-medium text-white/60">Log in</a>
          </div>
        )}
      </div>
    </nav>
  );
}

'use client';
// V7 shared marketing header — dark, single light text color, underline-hover nav.
import { useState } from 'react';
import { GradientBorderButton } from './ui';

const NAV = [
  { label: 'Your Team', href: '/team' },
  { label: 'Solutions', href: '/solutions' },
  { label: 'Blog', href: '/blog' },
  { label: 'Pricing', href: '/pricing' },
];

export default function MarketingHeader() {
  const [open, setOpen] = useState(false);
  return (
    <header className="anim-fade-down relative z-30">
      <div className="max-w-[1200px] mx-auto px-6 h-20 flex items-center gap-8">
        {/* wordmark — TODO: swap for a real mark/SVG if one lands in /public */}
        <a href="/" className="font-display text-white text-[20px] font-bold tracking-[-0.01em]">Student CRM</a>

        <nav className="hidden md:flex items-center gap-8 ml-2">
          {NAV.map(n => (
            <a key={n.href} href={n.href} className="group relative text-[14px] text-white/70 hover:text-white transition-colors">
              {n.label}
              <span className="absolute -bottom-1 left-0 h-px w-full bg-[#A068FF] origin-left scale-x-0 group-hover:scale-x-100 transition-transform duration-300" />
            </a>
          ))}
        </nav>

        <div className="ml-auto hidden md:flex items-center gap-5">
          <a href="/?login=1" className="text-[14px] text-white/70 hover:text-white transition-colors">Log In</a>
          <GradientBorderButton href="/?signup=1" dir="right">Start Free</GradientBorderButton>
        </div>

        {/* mobile menu button */}
        <button onClick={() => setOpen(o => !o)} className="ml-auto md:hidden text-white text-[13px] font-semibold border border-white/20 rounded-lg px-3 h-9">
          {open ? 'Close' : 'Menu'}
        </button>
      </div>

      {open && (
        <div className="md:hidden px-6 pb-5 space-y-3 border-b border-white/10">
          {NAV.map(n => (
            <a key={n.href} href={n.href} className="block text-[15px] text-white/80 hover:text-white">{n.label}</a>
          ))}
          <a href="/?login=1" className="block text-[15px] text-white/80">Log In</a>
          <div className="pt-1"><GradientBorderButton href="/?signup=1">Start Free</GradientBorderButton></div>
        </div>
      )}
    </header>
  );
}

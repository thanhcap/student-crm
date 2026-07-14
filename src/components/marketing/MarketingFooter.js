'use client';
// V9 — space-theme footer: transparent over the star field, quiet columns.
import { LogoFull } from '../Logo';

const COLS = [
  { title: 'Product', links: [{ label: 'Features', href: '/features' }, { label: 'Pricing', href: '/pricing' }, { label: 'Solutions', href: '/solutions' }] },
  { title: 'Company', links: [{ label: 'Your Team', href: '/team' }, { label: 'Blog', href: '/blog' }] },
  { title: 'Legal', links: [{ label: 'Privacy', href: '#' }, { label: 'Terms', href: '#' }] },
];

export default function MarketingFooter() {
  return (
    <footer className="relative z-10 border-t border-white/[0.06]">
      <div className="max-w-6xl mx-auto px-6 py-14 grid grid-cols-2 md:grid-cols-4 gap-10">
        <div className="col-span-2 md:col-span-1">
          <a href="/" aria-label="Home"><LogoFull /></a>
          <p className="text-[13px] text-white/40 mt-4 max-w-[220px]">Your network, supercharged. Relationships that don’t slip through.</p>
        </div>
        {COLS.map(c => (
          <div key={c.title}>
            <p className="text-[11px] uppercase tracking-[0.15em] text-white/35 font-semibold mb-4">{c.title}</p>
            <ul className="space-y-2.5">
              {c.links.map(l => (
                <li key={l.label}>
                  <a href={l.href} className="text-[13px] text-white/55 hover:text-white transition-colors">{l.label}</a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-white/[0.06]">
        <div className="max-w-6xl mx-auto px-6 py-5 text-[12.5px] text-white/30">© {new Date().getFullYear()} Relationship CRM. All rights reserved.</div>
      </div>
    </footer>
  );
}

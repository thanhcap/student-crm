'use client';
// V7 shared marketing footer — dark (#070319), three columns + wordmark.
const COLS = [
  { title: 'Product', links: [{ label: 'Solutions', href: '/solutions' }, { label: 'Pricing', href: '/pricing' }] },
  { title: 'Company', links: [{ label: 'Your Team', href: '/team' }, { label: 'Blog', href: '/blog' }] },
  { title: 'Legal', links: [{ label: 'Privacy', href: '#' }, { label: 'Terms', href: '#' }] },
];

export default function MarketingFooter() {
  return (
    <footer className="relative z-10 border-t border-white/10" style={{ background: '#070319' }}>
      <div className="max-w-[1200px] mx-auto px-6 py-14 grid grid-cols-2 md:grid-cols-4 gap-10">
        <div className="col-span-2 md:col-span-1">
          <a href="/" className="font-display text-white text-[19px] font-bold">Student CRM</a>
          <p className="text-[13px] text-white/40 mt-3 max-w-[220px]">Outreach that runs itself. Relationships that don’t slip through.</p>
        </div>
        {COLS.map(c => (
          <div key={c.title}>
            <p className="text-[12px] uppercase tracking-[0.1em] text-white/40 font-semibold mb-4">{c.title}</p>
            <ul className="space-y-2.5">
              {c.links.map(l => (
                <li key={l.label}>
                  <a href={l.href} className="text-[14px] text-white/60 hover:text-[#A068FF] transition-colors">{l.label}</a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-white/10">
        <div className="max-w-[1200px] mx-auto px-6 py-5 text-[12.5px] text-white/35">© {new Date().getFullYear()} Student CRM. All rights reserved.</div>
      </div>
    </footer>
  );
}

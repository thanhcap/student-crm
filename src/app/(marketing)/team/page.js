'use client';
// V7 "Your Team" — read as an About/company page (mission + the humans behind it).
// All people are placeholders; no fabricated real names/photos/history.
import { GradientBorderButton } from '@/components/marketing/ui';

const VALUES = [
  { title: 'We automate the busywork, not the relationships', body: 'Software should handle the copy-paste and the follow-up reminders — so you can be present for the actual conversation.' },
  { title: 'Opinionated defaults, escape hatches everywhere', body: 'Sensible out of the box, but never a cage. Every automation can be paused, edited, or overridden.' },
  { title: 'Your data is yours', body: 'Export anytime. No lock-in, no dark patterns, no reselling your network.' },
  { title: 'Calm, not noisy', body: 'We measure success by the follow-ups you didn’t forget — not the notifications we sent.' },
];

/* TODO: replace with real founder/team names, roles, and photos before launch */
const TEAM = [
  { name: 'Placeholder Name', role: 'Founder', img: 68 },
  { name: 'Placeholder Name', role: 'Engineering', img: 51 },
  { name: 'Placeholder Name', role: 'Design', img: 47 },
  { name: 'Placeholder Name', role: 'Growth', img: 33 },
];

export default function TeamPage() {
  return (
    <div>
      <section className="max-w-[900px] mx-auto px-6 pt-16 pb-10 text-center anim-fade-up">
        <p className="text-[12px] uppercase tracking-[0.14em] text-[#A068FF] mb-4">Your Team</p>
        <h1 className="font-display text-white text-[40px] md:text-[56px] font-semibold tracking-[-0.02em] leading-[1.05]">
          Why we built Student CRM.
        </h1>
        {/* TODO: replace with the real founding story before launch */}
        <p className="text-white/55 text-[16px] mt-6 max-w-2xl mx-auto">
          Great opportunities come from relationships, and relationships die from neglect — not from lack of care, but from lack of a system. We’re building the system: a place where every conversation is remembered, every follow-up happens on time, and outreach runs itself so the people behind it don’t have to.
        </p>
      </section>

      {/* values */}
      <section className="max-w-[1100px] mx-auto px-6 py-8 grid grid-cols-1 md:grid-cols-2 gap-5 anim-fade-up anim-delay-6">
        {VALUES.map(v => (
          <div key={v.title} className="rounded-[20px] border border-white/10 bg-white/[0.03] p-7">
            <h3 className="font-display text-white text-[19px] font-semibold mb-3">{v.title}</h3>
            <p className="text-white/55 text-[14.5px] leading-relaxed">{v.body}</p>
          </div>
        ))}
      </section>

      {/* team grid — placeholders */}
      <section className="max-w-[1100px] mx-auto px-6 py-14">
        <h2 className="font-display text-white text-[26px] font-semibold text-center mb-10">The humans behind it</h2>
        {/* TODO: replace with real founder/team names, roles, and photos before launch */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {TEAM.map((m, i) => (
            <div key={i} className="text-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`https://i.pravatar.cc/200?img=${m.img}`} alt="" width={96} height={96}
                className="w-24 h-24 rounded-full mx-auto object-cover border border-white/10" style={{ boxShadow: '0 0 24px rgba(160,104,255,0.25)' }} />
              <p className="font-display text-white text-[15px] font-semibold mt-4">{m.name}</p>
              <p className="text-white/45 text-[13px]">{m.role}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-[900px] mx-auto px-6 py-20 text-center">
        <h2 className="font-display text-white text-[30px] md:text-[40px] font-semibold tracking-[-0.02em] mb-8">Come build with us.</h2>
        <GradientBorderButton href="/?signup=1" size="lg">Start Free</GradientBorderButton>
      </section>
    </div>
  );
}

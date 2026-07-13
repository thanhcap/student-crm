'use client';
// V7 Blog — static index. NOTE: this is static demo content, not a real CMS feed.
// Wiring MDX / a headless CMS + working /blog/[slug] pages is a follow-up outside this scope.
import { useState } from 'react';

/* TODO: replace with real posts from a CMS/MDX before launch */
const POSTS = [
  { title: 'How to Build a Cold Outreach Sequence That Doesn’t Feel Cold', excerpt: 'The three-touch cadence that gets replies without sounding like a robot.', date: 'Jul 2026', tag: 'Outreach', read: '6 min' },
  { title: 'Lead Scoring for People Who Hate Spreadsheets', excerpt: 'Let engagement signals rank your pipeline so you know who to call today.', date: 'Jul 2026', tag: 'Pipeline', read: '5 min' },
  { title: 'Turning a Cold Contact Into a Real Relationship', excerpt: 'When to convert, what to say, and how to keep the thread warm.', date: 'Jun 2026', tag: 'Relationships', read: '4 min' },
  { title: 'The Follow-Up System That Runs Itself', excerpt: 'Set the schedule once; let the campaign stop the moment someone replies.', date: 'Jun 2026', tag: 'Automation', read: '7 min' },
  { title: 'LinkedIn + Email: The Multichannel Warm-Up', excerpt: 'Why viewing a profile before the first email lifts reply rates.', date: 'Jun 2026', tag: 'Outreach', read: '5 min' },
  { title: 'Deals That Trigger Their Own Onboarding', excerpt: 'Mark a deal Won and let the welcome sequence fire automatically.', date: 'May 2026', tag: 'Automation', read: '4 min' },
];
const TAGS = ['All', 'Outreach', 'Pipeline', 'Relationships', 'Automation'];

export default function BlogPage() {
  const [tag, setTag] = useState('All');
  const posts = tag === 'All' ? POSTS : POSTS.filter(p => p.tag === tag);
  return (
    <div>
      <section className="max-w-[900px] mx-auto px-6 pt-16 pb-8 text-center anim-fade-up">
        <p className="text-[12px] uppercase tracking-[0.14em] text-[#A068FF] mb-4">Blog</p>
        <h1 className="font-display text-white text-[40px] md:text-[56px] font-semibold tracking-[-0.02em]">From the blog</h1>
        <p className="text-white/55 text-[16px] mt-5">Playbooks for outreach that runs itself.</p>
      </section>

      <section className="max-w-[1100px] mx-auto px-6 pb-16">
        <div className="flex flex-wrap justify-center gap-2 mb-10">
          {TAGS.map(t => (
            <button key={t} onClick={() => setTag(t)}
              className={`px-4 h-9 rounded-full text-[13px] font-semibold transition-colors ${tag === t ? 'bg-[#A068FF] text-white' : 'bg-white/[0.05] text-white/60 hover:text-white'}`}>{t}</button>
          ))}
        </div>

        {/* static demo cards — link to # until /blog/[slug] exists */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 anim-fade-up anim-delay-6">
          {posts.map(p => (
            <a key={p.title} href="#" className="group rounded-[20px] border border-white/10 bg-white/[0.03] p-6 hover:border-[#A068FF]/40 transition-colors block">
              <div className="flex items-center gap-2 text-[11px] text-white/40 mb-4">
                <span className="text-[#A068FF] font-semibold uppercase tracking-wider">{p.tag}</span><span>·</span><span>{p.date}</span><span>·</span><span>{p.read}</span>
              </div>
              <h3 className="font-display text-white text-[18px] font-semibold leading-snug mb-2 group-hover:text-[#A068FF] transition-colors">{p.title}</h3>
              <p className="text-white/50 text-[14px] leading-relaxed">{p.excerpt}</p>
            </a>
          ))}
        </div>
      </section>
    </div>
  );
}

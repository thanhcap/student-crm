// V9 — individual post: clean centered reading column, MDX rendered server-side
// via next-mdx-remote/rsc.
import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { MDXRemote } from 'next-mdx-remote/rsc';

const POSTS_DIR = path.join(process.cwd(), 'src/app/(marketing)/blog/posts');

export function generateStaticParams() {
  if (!fs.existsSync(POSTS_DIR)) return [];
  return fs.readdirSync(POSTS_DIR)
    .filter(f => f.endsWith('.mdx'))
    .map(f => ({ slug: f.replace(/\.mdx$/, '') }));
}

function getPost(slug) {
  const file = path.join(POSTS_DIR, `${slug}.mdx`);
  if (!fs.existsSync(file)) return null;
  const { data, content } = matter(fs.readFileSync(file, 'utf-8'));
  return { data, content };
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) return {};
  return { title: `${post.data.title} — Relationship CRM`, description: post.data.excerpt || '' };
}

// Space Grotesk headings, Inter body, JetBrains Mono code — via the reading column.
const components = {
  h1: (p) => <h1 {...p} className="text-[34px] font-semibold tracking-[-0.02em] mt-10 mb-5 text-white" style={{ fontFamily: 'var(--font-space-grotesk)' }} />,
  h2: (p) => <h2 {...p} className="text-[24px] font-semibold tracking-[-0.01em] mt-9 mb-4 text-white" style={{ fontFamily: 'var(--font-space-grotesk)' }} />,
  h3: (p) => <h3 {...p} className="text-[18px] font-semibold mt-7 mb-3 text-white" style={{ fontFamily: 'var(--font-space-grotesk)' }} />,
  p:  (p) => <p {...p} className="text-[15.5px] leading-relaxed text-white/65 mb-5" />,
  a:  (p) => <a {...p} className="text-cyan-400 hover:text-cyan-300 underline underline-offset-2" />,
  ul: (p) => <ul {...p} className="list-disc pl-5 space-y-2 text-[15px] text-white/65 mb-5" />,
  ol: (p) => <ol {...p} className="list-decimal pl-5 space-y-2 text-[15px] text-white/65 mb-5" />,
  blockquote: (p) => <blockquote {...p} className="border-l-2 border-violet-500 pl-4 text-white/50 italic my-6" />,
  code: (p) => <code {...p} className="px-1.5 py-0.5 rounded bg-white/[0.06] text-[13px] text-amber-200" style={{ fontFamily: 'var(--font-jetbrains-mono)' }} />,
  pre: (p) => <pre {...p} className="rounded-xl bg-[#0A0A18] border border-white/[0.08] p-4 overflow-x-auto text-[13px] leading-relaxed my-6" style={{ fontFamily: 'var(--font-jetbrains-mono)' }} />,
};

export default async function BlogPost({ params }) {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) notFound();

  return (
    <article className="max-w-2xl mx-auto px-6 pt-10 pb-24">
      <Link href="/blog" className="text-[13px] font-medium text-white/40 hover:text-white transition-colors">← All posts</Link>
      <header className="mt-8 mb-10">
        <p className="text-[12px] text-white/35 mb-3">{post.data.date}{post.data.tag ? ` · ${post.data.tag}` : ''}</p>
        <h1 className="text-[36px] font-semibold tracking-[-0.02em] leading-[1.15] text-white" style={{ fontFamily: 'var(--font-space-grotesk)' }}>
          {post.data.title}
        </h1>
      </header>
      {/* strip a leading H1 if the post repeats its own title */}
      <MDXRemote source={post.content.replace(/^\s*#\s.+\n/, '')} components={components} />
    </article>
  );
}

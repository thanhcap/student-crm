// V9 — blog index (server): posts are .mdx files in ./posts, parsed with
// gray-matter. Structure only — the founder writes real posts later.
import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import BlogCard from './BlogCard';

export const metadata = {
  title: 'Blog — Relationship CRM',
  description: 'Networking strategies, product updates, and outreach playbooks.',
};

function getPosts() {
  const dir = path.join(process.cwd(), 'src/app/(marketing)/blog/posts');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.mdx'))
    .map(f => {
      const raw = fs.readFileSync(path.join(dir, f), 'utf-8');
      const { data, content } = matter(raw);
      const words = content.trim().split(/\s+/).length;
      return {
        slug: f.replace(/\.mdx$/, ''),
        title: data.title || f,
        date: data.date || '',
        excerpt: data.excerpt || '',
        tag: data.tag || 'Notes',
        read: `${Math.max(1, Math.round(words / 200))} min`,
      };
    })
    .sort((a, b) => (a.date < b.date ? 1 : -1));
}

export default function BlogIndex() {
  const posts = getPosts();
  return (
    <div className="pb-24">
      <header className="max-w-3xl mx-auto px-6 pt-12 pb-12 text-center">
        <h1 className="text-[40px] sm:text-[52px] font-semibold tracking-[-0.03em] mb-4" style={{ fontFamily: 'var(--font-space-grotesk)' }}>
          From the <span className="bg-gradient-to-r from-violet-400 via-cyan-400 to-amber-300 bg-clip-text text-transparent">launchpad.</span>
        </h1>
        <p className="text-[15px] text-white/50">Networking strategies, product updates, and outreach playbooks.</p>
      </header>

      {/* masonry-style columns; cards carry the shared 3D tilt treatment */}
      <div className="max-w-5xl mx-auto px-6 columns-1 md:columns-2 lg:columns-3 gap-5 [&>*]:mb-5">
        {posts.map(p => <BlogCard key={p.slug} post={p} />)}
      </div>

      {posts.length <= 1 && (
        <p className="text-center text-[13px] text-white/30 mt-10">More posts are on the way.</p>
      )}
    </div>
  );
}

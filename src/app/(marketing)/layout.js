// V9 marketing route group — outer-space shell (star field + glass nav + footer)
// for /features, /pricing, /blog, /solutions, /team. Root /page.js stays outside
// this group (it has its own auth branching) but composes the same pieces.
import './marketing.css';
import SpaceBackground from '@/components/marketing/SpaceBackground';
import MarketingNav from '@/components/marketing/MarketingNav';
import MarketingFooter from '@/components/marketing/MarketingFooter';

export default function MarketingLayout({ children }) {
  return (
    <div className="min-h-screen flex flex-col text-white">
      <SpaceBackground />
      <MarketingNav />
      <main className="relative z-10 flex-1 pt-24">{children}</main>
      <MarketingFooter />
    </div>
  );
}

// V7 marketing route group — shared dark cinematic shell (header + footer) for
// /solutions, /team, /blog, /pricing. Root /page.js stays outside this group
// (it has its own auth branching) but imports the same Header/Footer directly.
import './marketing.css';
import MarketingHeader from '@/components/marketing/MarketingHeader';
import MarketingFooter from '@/components/marketing/MarketingFooter';

export default function MarketingLayout({ children }) {
  return (
    <div className="cinematic-bg min-h-screen flex flex-col">
      <MarketingHeader />
      <main className="relative z-10 flex-1">{children}</main>
      <MarketingFooter />
    </div>
  );
}

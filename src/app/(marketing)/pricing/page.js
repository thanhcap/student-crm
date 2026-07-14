// V9 — server wrapper so per-page metadata works (the UI is a client component).
import PricingClient from './PricingClient';

export const metadata = {
  title: 'Pricing — Relationship CRM',
  description: 'Free forever for small networks. Pro and Max for serious outreach.',
};

export default function PricingPage() {
  return <PricingClient />;
}

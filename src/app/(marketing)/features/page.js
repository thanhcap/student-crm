// V9 — server wrapper for metadata; UI in the client component.
import FeaturesClient from './FeaturesClient';

export const metadata = {
  title: 'Features — Relationship CRM',
  description: 'Everything you need to turn connections into opportunities.',
};

export default function FeaturesPage() {
  return <FeaturesClient />;
}

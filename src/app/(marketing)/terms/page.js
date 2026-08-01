// Minimal but real Terms of Service — required for Google OAuth verification.
export const metadata = {
  title: 'Terms of Service — Relationship CRM',
  robots: { index: true, follow: true },
};

export default function TermsOfService() {
  return (
    <div style={{ minHeight: '100vh', background: '#0E1117' }}>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '80px 24px', color: '#F0F0FF', lineHeight: 1.8 }}>
        <a href="/" style={{ color: '#818CF8', fontSize: 14, textDecoration: 'none' }}>← Back to home</a>
        <h1 style={{ fontSize: 34, fontWeight: 700, margin: '24px 0 8px' }}>Terms of Service</h1>
        <p style={{ color: 'rgba(255,255,255,0.5)' }}><em>Last updated: {new Date().toISOString().split('T')[0]}</em></p>

        <h2 style={{ fontSize: 20, fontWeight: 700, marginTop: 32 }}>Using the service</h2>
        <p style={{ color: 'rgba(255,255,255,0.7)' }}>Relationship CRM is a tool for tracking and nurturing professional relationships. You agree to use it lawfully and not to send spam, harass anyone, or violate the terms of any connected service such as Gmail or LinkedIn.</p>

        <h2 style={{ fontSize: 20, fontWeight: 700, marginTop: 24 }}>Your account</h2>
        <p style={{ color: 'rgba(255,255,255,0.7)' }}>You are responsible for the activity under your account and for the accuracy and legality of the data you enter. You must have permission to contact the people you add.</p>

        <h2 style={{ fontSize: 20, fontWeight: 700, marginTop: 24 }}>Plans and billing</h2>
        <p style={{ color: 'rgba(255,255,255,0.7)' }}>Paid plans are billed in advance. You can cancel at any time; downgrades take effect at the end of the current billing period. Your data stays exportable on every plan.</p>

        <h2 style={{ fontSize: 20, fontWeight: 700, marginTop: 24 }}>No warranty</h2>
        <p style={{ color: 'rgba(255,255,255,0.7)' }}>The service is provided “as is” without warranties of any kind. We are not liable for indirect or consequential damages arising from your use of the service.</p>

        <h2 style={{ fontSize: 20, fontWeight: 700, marginTop: 24 }}>Contact</h2>
        <p style={{ color: 'rgba(255,255,255,0.7)' }}>Questions: thanhcapvan09@gmail.com</p>
      </div>
    </div>
  );
}

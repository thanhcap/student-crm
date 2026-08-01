// Minimal but real Privacy Policy — required for Google OAuth verification.
export const metadata = {
  title: 'Privacy Policy — Relationship CRM',
  robots: { index: true, follow: true },
};

export default function PrivacyPolicy() {
  return (
    <div style={{ minHeight: '100vh', background: '#0E1117' }}>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '80px 24px', color: '#F0F0FF', lineHeight: 1.8 }}>
        <a href="/" style={{ color: '#818CF8', fontSize: 14, textDecoration: 'none' }}>← Back to home</a>
        <h1 style={{ fontSize: 34, fontWeight: 700, margin: '24px 0 8px' }}>Privacy Policy</h1>
        <p style={{ color: 'rgba(255,255,255,0.5)' }}><em>Last updated: {new Date().toISOString().split('T')[0]}</em></p>

        <h2 style={{ fontSize: 20, fontWeight: 700, marginTop: 32 }}>What we collect</h2>
        <p style={{ color: 'rgba(255,255,255,0.7)' }}>We collect your email address, name, and the relationship data you enter into the app. When you connect Gmail, we access your email to send sequences on your behalf and sync replies into your inbox.</p>

        <h2 style={{ fontSize: 20, fontWeight: 700, marginTop: 24 }}>How we use it</h2>
        <p style={{ color: 'rgba(255,255,255,0.7)' }}>Your data is used solely to provide the CRM service. We do not sell your data, show you ads, or share your information with third parties except where required by law.</p>

        <h2 style={{ fontSize: 20, fontWeight: 700, marginTop: 24 }}>Gmail data</h2>
        <p style={{ color: 'rgba(255,255,255,0.7)' }}>Our use of Gmail data is limited to sending emails you authorize through sequences, and reading replies to those emails for inbox sync. We do not read your general inbox or store email content beyond what you initiate through the app. Our use complies with the Google API Services User Data Policy, including the Limited Use requirements.</p>

        <h2 style={{ fontSize: 20, fontWeight: 700, marginTop: 24 }}>Data deletion</h2>
        <p style={{ color: 'rgba(255,255,255,0.7)' }}>You can delete your account and all associated data at any time from Settings → Account → Delete account.</p>

        <h2 style={{ fontSize: 20, fontWeight: 700, marginTop: 24 }}>Contact</h2>
        <p style={{ color: 'rgba(255,255,255,0.7)' }}>Questions: thanhcapvan09@gmail.com</p>
      </div>
    </div>
  );
}

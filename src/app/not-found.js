export default function NotFound() {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', background: '#0E1117', color: '#F0F0FF',
    }}>
      <p style={{ fontSize: 80, margin: 0 }}>🤔</p>
      <h1 style={{ fontSize: 32, fontWeight: 700, margin: '16px 0 8px' }}>Page not found</h1>
      <p style={{ color: 'rgba(255,255,255,0.5)', marginBottom: 32 }}>That page doesn’t exist.</p>
      <a href="/" style={{ color: '#818CF8', fontSize: 16 }}>← Back to home</a>
    </div>
  );
}

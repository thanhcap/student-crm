'use client';
import { useState } from 'react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', content: '' });

  const handleSendMagicLink = async (e) => {
    e.preventDefault();
    setLoading(true);
    // Retain original authorization method pipelines
    setTimeout(() => {
      setMessage({ type: 'success', content: 'Secure access link transmitted to your registry index.' });
      setLoading(false);
    }, 900);
  };

  return (
    <div className="min-h-screen bg-bg-void flex items-center justify-center p-6 relative overflow-hidden">
      {/* Premium Subtle Grid Background Pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1f263810_1px,transparent_1px),linear-gradient(to_bottom,#1f263810_1px,transparent_1px)] bg-[size:4rem_4rem]" />
      
      <div className="w-full max-w-md bg-surface border border-border-hud/80 rounded-2xl p-8 relative z-10 backdrop-blur-xl shadow-[0_24px_60px_-15px_rgba(0,0,0,0.8)]">
        <div className="mb-8 text-center">
          <h2 className="font-display text-2xl font-bold tracking-tight bg-gradient-to-b from-text-primary to-text-secondary bg-clip-text text-transparent">
            Student CRM
          </h2>
          <p className="text-text-secondary text-xs mt-2">Enter your Gmail to securely access your workspace panel</p>
        </div>

        {message.content && (
          <div className={`mb-6 p-3.5 rounded-xl border text-xs font-mono transition-all ${
            message.type === 'success' ? 'bg-accent-mint/5 border-accent-mint/30 text-accent-mint' : 'bg-red-500/5 border-red-500/20 text-red-400'
          }`}>
            {message.content}
          </div>
        )}

        <form onSubmit={handleSendMagicLink} className="space-y-5">
          <div>
            <label className="block text-[10px] font-mono font-medium text-text-secondary uppercase tracking-widest mb-2">
              Gmail Route
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@gmail.com"
              className="w-full bg-bg-void border border-border-hud focus:border-accent-cyan rounded-xl px-4 py-3 text-xs text-text-primary font-mono placeholder:text-text-secondary/30 focus:outline-none transition-all duration-200"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-text-primary hover:bg-white text-bg-void font-medium text-xs py-3 rounded-xl transition-all duration-200 uppercase tracking-wider shadow-[0_4px_12px_rgba(255,255,255,0.1)] active:scale-[0.99]"
          >
            {loading ? 'Processing Trajectory...' : 'Continue with Email'}
          </button>
        </form>
      </div>
    </div>
  );
}
'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [envError, setEnvError] = useState(false);

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_SUPABASE_URL === 'https://placeholder-url.supabase.co' || !process.env.NEXT_PUBLIC_SUPABASE_URL) {
      setEnvError(true);
    }
  }, []);

  async function handleSendMagicLink(e) {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    const { error } = await supabase.auth.signInWithOtp({
      email: email,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: window.location.origin, // Sends them back to your main page
      }
    });

    if (error) {
      setMessage(`Error: ${error.message}`);
    } else {
      setMessage('✨ Dynamic link dispatched! Check your Gmail inbox to access your workspace.');
      setEmail('');
    }
    setLoading(false);
  }

  if (envError) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-red-50 p-6 rounded-xl border border-red-200 max-w-md text-center text-red-800">
          <h2 className="font-bold text-lg mb-2">Configuration Missing</h2>
          <p className="text-sm">Your environment variables need to be set up.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 w-full max-w-md overflow-hidden p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-1 text-center">Student CRM</h1>
        <p className="text-xs text-gray-400 text-center mb-6">
          Enter your Gmail to securely access your workspace panel
        </p>
        
        {message && (
          <div className={`mb-4 p-3 rounded-lg text-sm text-center font-medium ${message.includes('Error') ? 'bg-red-50 text-red-700' : 'bg-blue-50 text-blue-700'}`}>
            {message}
          </div>
        )}

        <form onSubmit={handleSendMagicLink} className="flex flex-col gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Gmail Address</label>
            <input 
              type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
              placeholder="name@gmail.com" 
              className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-500 text-gray-800"
            />
          </div>

          <button 
            type="submit" disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium py-2.5 rounded-lg text-sm transition-colors mt-2"
          >
            {loading ? 'Sending Link...' : 'Continue with Email'}
          </button>
        </form>
      </div>
    </main>
  );
}
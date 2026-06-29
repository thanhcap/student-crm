'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useRouter } from 'next/navigation';

export default function App() {
  const router = useRouter();
  
  // Navigation State
  const [appStep, setAppStep] = useState('LOADING');
  const [user, setUser] = useState(null);
  const [isNewUserSignUp, setIsNewUserSignUp] = useState(false);

  // Auth & Profile Form States
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [phone, setPhone] = useState('');
  const [country, setCountry] = useState('');
  const [linkedin, setLinkedin] = useState('');
  
  // Visibility States for Passwords
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  
  const [otpToken, setOtpToken] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authMessage, setAuthMessage] = useState('');

  // CRM States
  const [clients, setClients] = useState([]);
  const [loadingClients, setLoadingClients] = useState(true);
  const [name, setName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [status, setStatus] = useState('Active');
  const [notes, setNotes] = useState('');
  
  // NEW CRM FIELD STATES
  const [clientCountry, setClientCountry] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientConversation, setClientConversation] = useState('');
  const [clientLinkedin, setClientLinkedin] = useState('');
  const [clientBirthday, setClientBirthday] = useState('');
  const [clientRelationship, setClientRelationship] = useState('Medium');
  const [crmErrorMessage, setCrmErrorMessage] = useState('');

  // 1. CHECK SESSION
  useEffect(() => {
    checkSession();
  }, []);

  async function checkSession() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setAppStep('LOG_IN');
      return;
    }
    setUser(session.user);
    setAppStep('DASHBOARD');
    fetchClients(session.user.id);
  }

  // ==========================================
  // AUTHENTICATION LOGIC (PASSWORD + OTP)
  // ==========================================
  
  async function handleLoginWithPassword(e) {
    e.preventDefault();
    setAuthLoading(true);
    setAuthMessage('');

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email,
      password: password,
    });

    if (error) {
      setAuthMessage(`Login Error: ${error.message}`);
    } else if (data.session) {
      setUser(data.session.user);
      setAppStep('DASHBOARD');
      fetchClients(data.session.user.id);
    }
    setAuthLoading(false);
  }

  async function handleSignUp(e) {
    e.preventDefault();
    setAuthLoading(true);
    setAuthMessage('');
    setIsNewUserSignUp(true);

    const { data, error } = await supabase.auth.signUp({
      email: email,
      password: password,
      options: {
        emailRedirectTo: window.location.origin
      }
    });

    if (error) {
      setAuthMessage(`Sign Up Error: ${error.message}`);
      setAuthLoading(false);
      return;
    }

    const { error: otpError } = await supabase.auth.signInWithOtp({
      email: email,
      options: {
        shouldCreateUser: false
      }
    });

    if (otpError) {
      console.warn("OTP Delivery Note:", otpError.message);
    }

    setAuthMessage('Account configuration initiated! Check your email for the verification code.');
    setAppStep('VERIFY_OTP');
    setAuthLoading(false);
  }

  async function handleVerifyOtp(e) {
    e.preventDefault();
    setAuthLoading(true);
    setAuthMessage('');

    let { data: { session }, error } = await supabase.auth.verifyOtp({
      email: email,
      token: otpToken,
      type: 'signup'
    });

    if (error) {
      const fallback = await supabase.auth.verifyOtp({
        email: email,
        token: otpToken,
        type: 'email'
      });
      session = fallback.data.session;
      error = fallback.error;
    }

    if (error) {
      setAuthMessage(`Verification Error: ${error.message}`);
      setAuthLoading(false);
    } else if (session) {
      if (isNewUserSignUp) {
        const { error: profileError } = await supabase.from('profiles').upsert([
          { id: session.user.id, username, phone_number: phone, country, linkedin_profile: linkedin || null }
        ]);
        if (profileError) console.error(`Profile save error: ${profileError.message}`);
      }
      
      setUser(session.user);
      setAppStep('DASHBOARD');
      fetchClients(session.user.id);
      setAuthLoading(false);
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    setUser(null);
    setEmail('');
    setPassword('');
    setOtpToken('');
    setShowLoginPassword(false);
    setShowSignupPassword(false);
    setAppStep('LOG_IN');
  }

  // ==========================================
  // CRM LOGIC
  // ==========================================

  async function fetchClients(userId) {
    setLoadingClients(true);
    const { data, error } = await supabase.from('clients').select('*').eq('user_id', userId).order('created_at', { ascending: false });
    if (!error && data) setClients(data);
    setLoadingClients(false);
  }

  async function handleAddClient(e) {
    e.preventDefault();
    if (!name || !clientEmail) return;
    setCrmErrorMessage('');

    const { data, error } = await supabase.from('clients').insert([
      { 
        name, 
        email: clientEmail, 
        status, 
        notes, 
        user_id: user.id,
        country: clientCountry || null,
        phone_number: clientPhone || null,
        note_conversation: clientConversation || null,
        linkedin_url: clientLinkedin || null,
        birthday: clientBirthday || null,
        relationship: clientRelationship
      }
    ]).select();

    if (!error && data) {
      setClients([data[0], ...clients]);
      
      setName(''); 
      setClientEmail(''); 
      setNotes(''); 
      setStatus('Active');
      setClientCountry('');
      setClientPhone('');
      setClientConversation('');
      setClientLinkedin('');
      setClientBirthday('');
      setClientRelationship('Medium');
    } else if (error) {
      setCrmErrorMessage(`Database Sync Error: ${error.message}`);
      console.error("Error adding client to database:", error.message);
    }
  }

  async function handleDeleteClient(clientId) {
    if (!window.confirm('Are you sure you want to delete this client?')) return;

    const { error } = await supabase.from('clients').delete().eq('id', clientId);
    
    if (error) {
      setCrmErrorMessage(`Delete Error: ${error.message}`);
      console.error("Error deleting client:", error.message);
    } else {
      setClients(clients.filter(client => client.id !== clientId));
    }
  }

  if (appStep === 'LOADING') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F9FAFB] text-gray-900 font-sans">
        <div className="flex flex-col items-center gap-4">
          <div className="w-5 h-5 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" />
          <span className="text-[13px] font-medium tracking-wide text-gray-500">Initializing workspace...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F9FAFB] text-gray-900 font-sans flex flex-col selection:bg-gray-900 selection:text-white">
      
      {/* PREMIUM TOP NAVIGATION BAR */}
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-14 items-center">
            <div className="flex items-center gap-8">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 bg-gray-900 rounded-sm" />
                <span className="text-[15px] font-semibold tracking-tight">Student CRM</span>
              </div>
              
              {user && (
                <div className="hidden sm:flex items-center gap-1">
                  <button onClick={() => setAppStep('DASHBOARD')} className={`px-3 py-1.5 rounded-md text-[13px] font-medium transition-all ${appStep === 'DASHBOARD' ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'}`}>Dashboard</button>
                  <button onClick={() => setAppStep('CLIENTS')} className={`px-3 py-1.5 rounded-md text-[13px] font-medium transition-all ${appStep === 'CLIENTS' ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'}`}>Clients</button>
                </div>
              )}
            </div>
            
            {user ? (
              <div className="flex items-center gap-4">
                <span className="text-[13px] text-gray-500 hidden sm:block">{user.email}</span>
                <div className="h-4 w-px bg-gray-200 hidden sm:block" />
                <button onClick={handleLogout} className="text-[13px] font-medium text-gray-500 hover:text-gray-900 transition-colors">Log Out</button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button onClick={() => { setAppStep('LOG_IN'); setAuthMessage(''); }} className={`px-3 py-1.5 rounded-md text-[13px] font-medium transition-all ${appStep === 'LOG_IN' ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'}`}>Log In</button>
                <button onClick={() => { setAppStep('SIGN_UP'); setAuthMessage(''); }} className="px-3 py-1.5 rounded-md text-[13px] font-medium bg-gray-900 text-white hover:bg-gray-800 transition-all shadow-sm">Sign Up</button>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        
        {/* LOG IN */}
        {appStep === 'LOG_IN' && (
          <div className="max-w-[400px] mx-auto mt-10 sm:mt-20">
            <div className="bg-white rounded-2xl shadow-[0_1px_3px_0_rgba(0,0,0,0.1),0_1px_2px_-1px_rgba(0,0,0,0.1)] border border-gray-200 p-8 sm:p-10">
              <h2 className="text-xl font-semibold text-gray-900 mb-1">Welcome back</h2>
              <p className="text-[13px] text-gray-500 mb-6">Enter your credentials to access your workspace.</p>
              
              {authMessage && (
                <div className="mb-6 p-3 rounded-lg text-[13px] font-medium bg-red-50 text-red-700 border border-red-100 flex items-start gap-2">
                  <svg className="w-4 h-4 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" /></svg>
                  {authMessage}
                </div>
              )}
              
              <form onSubmit={handleLoginWithPassword} className="space-y-4">
                <div>
                  <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Email address</label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="name@company.com" className="w-full px-3 py-2 text-[13px] bg-white border border-gray-200 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-400 transition-colors" />
                </div>
                
                <div>
                  <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Password</label>
                  <div className="relative">
                    <input type={showLoginPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="••••••••" className="w-full px-3 py-2 pr-10 text-[13px] bg-white border border-gray-200 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-400 transition-colors" />
                    <button type="button" onClick={() => setShowLoginPassword(!showLoginPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none p-1 rounded">
                      {showLoginPassword ? (
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 1-4.243-4.243m4.242 4.242L9.88 9.88" /></svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /></svg>
                      )}
                    </button>
                  </div>
                </div>
                
                <button type="submit" disabled={authLoading} className="w-full mt-2 bg-gray-900 hover:bg-gray-800 text-white text-[13px] font-medium py-2 px-4 rounded-lg shadow-sm transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed">
                  {authLoading ? 'Authenticating...' : 'Sign In'}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* SIGN UP */}
        {appStep === 'SIGN_UP' && (
          <div className="max-w-[480px] mx-auto mt-10">
            <div className="bg-white rounded-2xl shadow-[0_1px_3px_0_rgba(0,0,0,0.1),0_1px_2px_-1px_rgba(0,0,0,0.1)] border border-gray-200 p-8 sm:p-10">
              <h2 className="text-xl font-semibold text-gray-900 mb-1">Create an account</h2>
              <p className="text-[13px] text-gray-500 mb-6">Enter your details to configure your workspace.</p>
              
              {authMessage && (
                <div className="mb-6 p-3 rounded-lg text-[13px] font-medium bg-red-50 text-red-700 border border-red-100 flex items-start gap-2">
                  <svg className="w-4 h-4 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" /></svg>
                  {authMessage}
                </div>
              )}

              <form onSubmit={handleSignUp} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Email address</label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="name@company.com" className="w-full px-3 py-2 text-[13px] bg-white border border-gray-200 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-400 transition-colors" />
                </div>
                
                <div className="md:col-span-2">
                  <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Password</label>
                  <div className="relative">
                    <input type={showSignupPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="Create a strong password" className="w-full px-3 py-2 pr-10 text-[13px] bg-white border border-gray-200 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-400 transition-colors" />
                    <button type="button" onClick={() => setShowSignupPassword(!showSignupPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none p-1 rounded">
                      {showSignupPassword ? (
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 1-4.243-4.243m4.242 4.242L9.88 9.88" /></svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /></svg>
                      )}
                    </button>
                  </div>
                </div>
                
                <div>
                  <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Full name</label>
                  <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} required placeholder="Jane Doe" className="w-full px-3 py-2 text-[13px] bg-white border border-gray-200 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-400 transition-colors" />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Phone number</label>
                  <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} required placeholder="+1 (555) 000-0000" className="w-full px-3 py-2 text-[13px] bg-white border border-gray-200 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-400 transition-colors" />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Country</label>
                  <input type="text" value={country} onChange={(e) => setCountry(e.target.value)} required placeholder="United States" className="w-full px-3 py-2 text-[13px] bg-white border border-gray-200 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-400 transition-colors" />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-gray-700 mb-1.5">LinkedIn <span className="text-gray-400 font-normal">(Optional)</span></label>
                  <input type="url" value={linkedin} onChange={(e) => setLinkedin(e.target.value)} placeholder="https://linkedin.com/in/..." className="w-full px-3 py-2 text-[13px] bg-white border border-gray-200 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-400 transition-colors" />
                </div>
                
                <div className="md:col-span-2 mt-4">
                  <button type="submit" disabled={authLoading} className="w-full bg-gray-900 hover:bg-gray-800 text-white text-[13px] font-medium py-2 px-4 rounded-lg shadow-sm transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed">
                    {authLoading ? 'Processing request...' : 'Continue'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* VERIFY OTP */}
        {appStep === 'VERIFY_OTP' && (
          <div className="max-w-[400px] mx-auto mt-10 sm:mt-20">
            <div className="bg-white rounded-2xl shadow-[0_1px_3px_0_rgba(0,0,0,0.1),0_1px_2px_-1px_rgba(0,0,0,0.1)] border border-gray-200 p-8 sm:p-10">
              <div className="w-10 h-10 bg-gray-50 border border-gray-200 rounded-lg flex items-center justify-center mb-5">
                <svg className="w-5 h-5 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" /></svg>
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mb-1">Check your email</h2>
              <p className="text-[13px] text-gray-500 mb-6">We sent a verification code to your email address.</p>
              
              {authMessage && !authMessage.includes('initiated') && (
                <div className="mb-6 p-3 rounded-lg text-[13px] font-medium bg-red-50 text-red-700 border border-red-100 flex items-start gap-2">
                  <svg className="w-4 h-4 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" /></svg>
                  {authMessage}
                </div>
              )}

              <form onSubmit={handleVerifyOtp} className="space-y-4">
                <div>
                  <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Verification code</label>
                  <input type="text" value={otpToken} onChange={(e) => setOtpToken(e.target.value)} required placeholder="000000" className="w-full px-3 py-3 text-center text-xl font-medium tracking-widest bg-gray-50 border border-gray-200 rounded-lg shadow-sm placeholder-gray-300 focus:outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-400 focus:bg-white transition-colors" />
                </div>
                <button type="submit" disabled={authLoading} className="w-full mt-2 bg-gray-900 hover:bg-gray-800 text-white text-[13px] font-medium py-2.5 px-4 rounded-lg shadow-sm transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed">
                  {authLoading ? 'Verifying...' : 'Verify and continue'}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* DASHBOARD */}
        {appStep === 'DASHBOARD' && (
          <div className="space-y-8 animate-in fade-in duration-500">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">Overview</h1>
              <p className="text-[14px] text-gray-500 mt-1">Monitor your workspace activity and client directories.</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
              {/* Quick Stats Card */}
              <div className="md:col-span-1 bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-between min-h-[160px]">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-full bg-gray-50 border border-gray-100 flex items-center justify-center">
                    <svg className="w-4 h-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                  </div>
                  <h3 className="text-[13px] font-medium text-gray-600">Client Directory</h3>
                </div>
                <div>
                  <div className="flex justify-between items-end">
                    <div>
                      <p className="text-[12px] font-medium text-gray-500 uppercase tracking-wider mb-1">Total</p>
                      <span className="text-3xl font-semibold text-gray-900">{clients.length}</span>
                    </div>
                    <div className="text-right">
                      <p className="text-[12px] font-medium text-gray-500 uppercase tracking-wider mb-1">Active</p>
                      <span className="text-3xl font-semibold text-gray-900">{clients.filter(c => c.status === 'Active').length}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Placeholder Analytics Card */}
              <div className="md:col-span-2 bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex flex-col items-center justify-center min-h-[160px] bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px]">
                 <div className="bg-white/80 backdrop-blur-sm px-4 py-2 rounded-full border border-gray-200 shadow-sm">
                   <p className="text-gray-500 text-[13px] font-medium flex items-center gap-2">
                     <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" /></svg>
                     Analytics Module Active
                   </p>
                 </div>
              </div>
            </div>
          </div>
        )}

        {/* CLIENTS */}
        {appStep === 'CLIENTS' && (
          <div className="space-y-8 animate-in fade-in duration-500">
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">Clients</h1>
                <p className="text-[14px] text-gray-500 mt-1">Manage and organize your professional network.</p>
              </div>
            </div>

            {crmErrorMessage && (
              <div className="p-4 rounded-xl text-[13px] bg-red-50 text-red-800 font-medium border border-red-100 flex items-start gap-3 shadow-sm">
                <svg className="w-5 h-5 mt-0.5 shrink-0 text-red-600" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" /></svg>
                <div>
                  <span className="block mb-1">{crmErrorMessage}</span>
                  <span className="text-[12px] font-normal text-red-600/80">Tip: Make sure you run the ALTER TABLE script in your Supabase SQL Editor workspace to add these custom metadata columns.</span>
                </div>
              </div>
            )}
            
            {/* NEW CLIENT CREATION CARD */}
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
                <h3 className="text-[14px] font-semibold text-gray-900">Add new client</h3>
              </div>
              <form onSubmit={handleAddClient} className="p-6 flex flex-col gap-5">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  <div>
                    <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Full name <span className="text-red-500">*</span></label>
                    <input type="text" placeholder="e.g. John Doe" value={name} onChange={e=>setName(e.target.value)} required className="w-full px-3 py-2 text-[13px] bg-white border border-gray-200 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-400 transition-colors" />
                  </div>
                  <div>
                    <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Email address <span className="text-red-500">*</span></label>
                    <input type="email" placeholder="john@example.com" value={clientEmail} onChange={e=>setClientEmail(e.target.value)} required className="w-full px-3 py-2 text-[13px] bg-white border border-gray-200 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-400 transition-colors" />
                  </div>
                  <div>
                    <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Phone number</label>
                    <input type="tel" placeholder="+1 (555) 000-0000" value={clientPhone} onChange={e=>setClientPhone(e.target.value)} className="w-full px-3 py-2 text-[13px] bg-white border border-gray-200 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-400 transition-colors" />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  <div>
                    <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Country</label>
                    <select value={clientCountry} onChange={e=>setClientCountry(e.target.value)} className="w-full px-3 py-2 text-[13px] bg-white border border-gray-200 rounded-lg shadow-sm text-gray-700 focus:outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-400 transition-colors appearance-none">
                      <option value="">Select Region</option>
                      <option value="United States">United States</option>
                      <option value="United Kingdom">United Kingdom</option>
                      <option value="Vietnam">Vietnam</option>
                      <option value="Canada">Canada</option>
                      <option value="Australia">Australia</option>
                      <option value="Singapore">Singapore</option>
                      <option value="Japan">Japan</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[12px] font-medium text-gray-700 mb-1.5">LinkedIn profile</label>
                    <input type="url" placeholder="https://linkedin.com/in/..." value={clientLinkedin} onChange={e=>setClientLinkedin(e.target.value)} className="w-full px-3 py-2 text-[13px] bg-white border border-gray-200 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-400 transition-colors" />
                  </div>
                  <div>
                    <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Birthday</label>
                    <input type="date" value={clientBirthday} onChange={e=>setClientBirthday(e.target.value)} className="w-full px-3 py-2 text-[13px] bg-white border border-gray-200 rounded-lg shadow-sm text-gray-700 focus:outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-400 transition-colors" />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  <div>
                    <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Priority level</label>
                    <select value={clientRelationship} onChange={e=>setClientRelationship(e.target.value)} className="w-full px-3 py-2 text-[13px] bg-white border border-gray-200 rounded-lg shadow-sm text-gray-700 focus:outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-400 transition-colors appearance-none">
                      <option value="Low">Low</option>
                      <option value="Medium">Medium</option>
                      <option value="High">High</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Current status</label>
                    <select value={status} onChange={e=>setStatus(e.target.value)} className="w-full px-3 py-2 text-[13px] bg-white border border-gray-200 rounded-lg shadow-sm text-gray-700 focus:outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-400 transition-colors appearance-none">
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                    </select>
                  </div>
                  <div className="flex items-end">
                    <button type="submit" className="w-full bg-gray-900 hover:bg-gray-800 text-white text-[13px] font-medium py-2 px-4 rounded-lg shadow-sm transition-all active:scale-[0.98]">
                      Create Record
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Internal notes</label>
                  <textarea rows="2" placeholder="Document recent interactions or important details..." value={clientConversation} onChange={e=>setClientConversation(e.target.value)} className="w-full px-3 py-2 text-[13px] bg-white border border-gray-200 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-400 transition-colors resize-none" />
                </div>
              </form>
            </div>

            {/* EXPANDED TABLE VIEW */}
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
              {loadingClients ? (
                <div className="p-12 flex justify-center">
                  <div className="w-5 h-5 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[900px]">
                    <thead>
                      <tr className="border-b border-gray-200 bg-gray-50/50">
                        <th className="px-6 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Client Identity</th>
                        <th className="px-6 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Contact Details</th>
                        <th className="px-6 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Demographics</th>
                        <th className="px-6 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Latest Notes</th>
                        <th className="px-6 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Priority</th>
                        <th className="px-6 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider text-right">Status</th>
                        <th className="px-6 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {clients.map(client => (
                        <tr key={client.id} className="hover:bg-gray-50/50 transition-colors group">
                          <td className="px-6 py-4 align-top">
                            <div className="text-[13px] font-medium text-gray-900">{client.name}</div>
                            {client.linkedin_url && (
                              <a href={client.linkedin_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[12px] text-gray-500 hover:text-gray-900 mt-1 transition-colors">
                                LinkedIn
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                              </a>
                            )}
                          </td>
                          <td className="px-6 py-4 align-top">
                            <div className="text-[13px] text-gray-600">{client.email}</div>
                            {client.phone_number && <div className="text-[12px] text-gray-500 mt-1">{client.phone_number}</div>}
                          </td>
                          <td className="px-6 py-4 align-top">
                            {client.country && <div className="text-[13px] text-gray-600">{client.country}</div>}
                            {client.birthday && <div className="text-[12px] text-gray-400 mt-1">Born {client.birthday}</div>}
                          </td>
                          <td className="px-6 py-4 align-top max-w-[240px]">
                            {client.note_conversation ? (
                              <p className="text-[12px] leading-relaxed text-gray-600 line-clamp-3 group-hover:line-clamp-none transition-all">{client.note_conversation}</p>
                            ) : (
                              <span className="text-[12px] text-gray-400 italic">No notes recorded</span>
                            )}
                          </td>
                          <td className="px-6 py-4 align-top">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border ${
                              client.relationship === 'High' ? 'bg-indigo-50 text-indigo-700 border-indigo-200/60' :
                              client.relationship === 'Low' ? 'bg-orange-50 text-orange-700 border-orange-200/60' : 'bg-gray-100 text-gray-700 border-gray-200'
                            }`}>
                              {client.relationship || 'Medium'}
                            </span>
                          </td>
                          <td className="px-6 py-4 align-top text-right">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border ${
                              client.status === 'Active' ? 'bg-emerald-50 text-emerald-700 border-emerald-200/60' : 'bg-gray-50 text-gray-600 border-gray-200'
                            }`}>
                              <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${client.status === 'Active' ? 'bg-emerald-500' : 'bg-gray-400'}`} />
                              {client.status || 'Active'}
                            </span>
                          </td>
                          <td className="px-6 py-4 align-top text-right">
                            <button 
                              onClick={() => handleDeleteClient(client.id)}
                              className="text-[12px] font-medium text-red-500 hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded transition-colors"
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                      {clients.length === 0 && (
                        <tr>
                          <td colSpan="7" className="px-6 py-12 text-center">
                            <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-3">
                              <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                            </div>
                            <h3 className="text-[14px] font-medium text-gray-900 mb-1">No clients yet</h3>
                            <p className="text-[13px] text-gray-500">Add your first client to the registry above.</p>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
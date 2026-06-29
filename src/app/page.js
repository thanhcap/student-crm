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
  
  // Log In with Password
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

  // Sign Up with Password -> Forces OTP Request Generation
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

  // Verify OTP to fully unlock account
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
      
      // Reset fields
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

  if (appStep === 'LOADING') return <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a] text-white">Loading...</div>;

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col">
      
      {/* TOP NAVIGATION BAR */}
      <nav className="bg-[#2563eb] text-white px-6 py-4 flex items-center font-semibold text-sm">
        <div className="text-lg font-bold mr-6 tracking-wide">CRM</div>
        
        {user ? (
          <>
            <div className="flex gap-6">
              <button onClick={() => setAppStep('DASHBOARD')} className={`hover:text-blue-200 transition-colors ${appStep === 'DASHBOARD' ? 'underline underline-offset-4' : ''}`}>Dashboard</button>
              <button onClick={() => setAppStep('CLIENTS')} className={`hover:text-blue-200 transition-colors ${appStep === 'CLIENTS' ? 'underline underline-offset-4' : ''}`}>Clients</button>
            </div>
            <div className="ml-auto flex items-center gap-4">
              <span className="text-xs font-normal opacity-80">{user.email}</span>
              <button onClick={handleLogout} className="bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded transition-colors">Log Out</button>
            </div>
          </>
        ) : (
          <div className="ml-auto flex items-center gap-6">
            <button onClick={() => { setAppStep('LOG_IN'); setAuthMessage(''); }} className={`hover:text-blue-200 transition-colors ${appStep === 'LOG_IN' ? 'underline underline-offset-4' : ''}`}>Log In</button>
            <button onClick={() => { setAppStep('SIGN_UP'); setAuthMessage(''); }} className={`hover:text-blue-200 transition-colors ${appStep === 'SIGN_UP' ? 'underline underline-offset-4' : ''}`}>Sign Up</button>
          </div>
        )}
      </nav>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 p-8 flex items-center justify-center">
        
        {/* LOG IN */}
        {appStep === 'LOG_IN' && (
          <div className="bg-white rounded-xl shadow-lg w-full max-w-md p-8">
            <h2 className="text-2xl font-bold text-gray-900 text-center mb-2">Welcome Back</h2>
            <p className="text-xs text-gray-400 text-center mb-6">Enter your email and password to securely access your workspace panel</p>
            {authMessage && <div className="mb-4 p-3 rounded-lg text-sm text-center font-medium bg-red-50 text-red-700">{authMessage}</div>}
            
            <form onSubmit={handleLoginWithPassword} className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Email Address</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="w-full px-4 py-2 border rounded-lg text-sm text-black" />
              </div>
              
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Password</label>
                <div className="relative">
                  <input 
                    type={showLoginPassword ? 'text' : 'password'} 
                    value={password} 
                    onChange={(e) => setPassword(e.target.value)} 
                    required 
                    className="w-full px-4 py-2 pr-10 border rounded-lg text-sm text-black" 
                  />
                  <button 
                    type="button" 
                    onClick={() => setShowLoginPassword(!showLoginPassword)} 
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
                  >
                    {showLoginPassword ? (
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 1-4.243-4.243m4.242 4.242L9.88 9.88" />
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
              
              <button type="submit" disabled={authLoading} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-lg mt-2">
                {authLoading ? 'Logging in...' : 'Log In'}
              </button>
            </form>
          </div>
        )}

        {/* SIGN UP */}
        {appStep === 'SIGN_UP' && (
          <div className="bg-white rounded-xl shadow-lg w-full max-w-lg p-8">
            <h2 className="text-2xl font-bold text-gray-900 text-center mb-2">Create Account</h2>
            <p className="text-xs text-gray-400 text-center mb-6">Fill out your details to register</p>
            {authMessage && <div className="mb-4 p-3 rounded-lg text-sm text-center font-medium bg-red-50 text-red-700">{authMessage}</div>}

            <form onSubmit={handleSignUp} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Email Address</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="w-full px-4 py-2 border rounded-lg text-sm text-black" />
              </div>
              
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Password</label>
                <div className="relative">
                  <input 
                    type={showSignupPassword ? 'text' : 'password'} 
                    value={password} 
                    onChange={(e) => setPassword(e.target.value)} 
                    required 
                    className="w-full px-4 py-2 pr-10 border rounded-lg text-sm text-black" 
                  />
                  <button 
                    type="button" 
                    onClick={() => setShowSignupPassword(!showSignupPassword)} 
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
                  >
                    {showSignupPassword ? (
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 1-4.243-4.243m4.242 4.242L9.88 9.88" />
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
              
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Name / Username</label>
                <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} required className="w-full px-4 py-2 border rounded-lg text-sm text-black" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Phone Number</label>
                <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} required className="w-full px-4 py-2 border rounded-lg text-sm text-black" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Country</label>
                <input type="text" value={country} onChange={(e) => setCountry(e.target.value)} required className="w-full px-4 py-2 border rounded-lg text-sm text-black" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">LinkedIn (Optional)</label>
                <input type="url" value={linkedin} onChange={(e) => setLinkedin(e.target.value)} className="w-full px-4 py-2 border rounded-lg text-sm text-black" />
              </div>
              <div className="md:col-span-2 mt-2">
                <button type="submit" disabled={authLoading} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-lg">
                  {authLoading ? 'Processing...' : 'Send Verification Code'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* VERIFY OTP */}
        {appStep === 'VERIFY_OTP' && (
          <div className="bg-white rounded-xl shadow-lg w-full max-w-md p-8">
            <h2 className="text-2xl font-bold text-gray-900 text-center mb-2">Verify Email</h2>
            <p className="text-xs text-gray-400 text-center mb-6">Enter the code sent to your email to complete registration</p>
            {authMessage && <div className="mb-4 p-3 rounded-lg text-sm text-center font-medium bg-blue-50 text-blue-700">{authMessage}</div>}

            <form onSubmit={handleVerifyOtp} className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase text-center mb-2">Verification Code</label>
                <input type="text" value={otpToken} onChange={(e) => setOtpToken(e.target.value)} required className="w-full text-center tracking-widest text-xl font-bold px-4 py-3 border rounded-lg bg-gray-50 text-black" />
              </div>
              <button type="submit" disabled={authLoading} className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-2.5 rounded-lg mt-2">
                {authLoading ? 'Verifying...' : 'Verify & Complete Account'}
              </button>
            </form>
          </div>
        )}

        {/* DASHBOARD */}
        {appStep === 'DASHBOARD' && (
          <div className="bg-white rounded-xl shadow-sm w-full max-w-5xl p-8 text-black">
            <h1 className="text-3xl font-bold mb-2">Student CRM Workspace</h1>
            <p className="text-gray-500 mb-6">Welcome back! Your client directories are completely ready.</p>
            <hr className="mb-6"/>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-1 bg-gray-50 p-6 rounded-xl border">
                <h3 className="font-bold mb-4">Quick Stats</h3>
                <p className="text-sm text-gray-600 mb-2">Total Clients: <strong>{clients.length}</strong></p>
                <p className="text-sm text-gray-600">Active Clients: <strong>{clients.filter(c => c.status === 'Active').length}</strong></p>
              </div>
              <div className="md:col-span-2 bg-gray-50 p-6 rounded-xl border flex items-center justify-center">
                 <p className="text-gray-400 text-sm">Dashboard Analytics Area</p>
              </div>
            </div>
          </div>
        )}

        {/* CLIENTS */}
        {appStep === 'CLIENTS' && (
          <div className="bg-white rounded-xl shadow-sm w-full max-w-6xl p-8 text-black">
            <h2 className="text-2xl font-bold mb-6">Client Management</h2>
            
            {crmErrorMessage && (
              <div className="mb-4 p-4 rounded-lg text-sm bg-red-50 text-red-800 font-medium border border-red-200">
                {crmErrorMessage}
                <div className="text-xs font-normal text-red-600 mt-1">
                  Tip: Make sure you run the ALTER TABLE script in your Supabase SQL Editor workspace to add these custom metadata columns.
                </div>
              </div>
            )}
            
            {/* EXPANDED NEW CLIENT CREATION FORM */}
            <form onSubmit={handleAddClient} className="flex flex-col gap-4 mb-8 bg-gray-50 p-6 rounded-lg border">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Full Name *</label>
                  <input type="text" placeholder="John Doe" value={name} onChange={e=>setName(e.target.value)} required className="w-full px-3 py-2 border rounded text-black bg-white text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Email Address *</label>
                  <input type="email" placeholder="john@example.com" value={clientEmail} onChange={e=>setClientEmail(e.target.value)} required className="w-full px-3 py-2 border rounded text-black bg-white text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Phone Number</label>
                  <input type="tel" placeholder="+123456789" value={clientPhone} onChange={e=>setClientPhone(e.target.value)} className="w-full px-3 py-2 border rounded text-black bg-white text-sm" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Country</label>
                  <select value={clientCountry} onChange={e=>setClientCountry(e.target.value)} className="w-full px-3 py-2 border rounded text-black bg-white text-sm h-[38px]">
                    <option value="">Select Country</option>
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
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">LinkedIn URL</label>
                  <input type="url" placeholder="https://linkedin.com/in/..." value={clientLinkedin} onChange={e=>setClientLinkedin(e.target.value)} className="w-full px-3 py-2 border rounded text-black bg-white text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Birthday</label>
                  <input type="date" value={clientBirthday} onChange={e=>setClientBirthday(e.target.value)} className="w-full px-3 py-2 border rounded text-black bg-white text-sm" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Relationship level</label>
                  <select value={clientRelationship} onChange={e=>setClientRelationship(e.target.value)} className="w-full px-3 py-2 border rounded text-black bg-white text-sm h-[38px]">
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Status</label>
                  <select value={status} onChange={e=>setStatus(e.target.value)} className="w-full px-3 py-2 border rounded text-black bg-white text-sm h-[38px]">
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
                <div className="flex items-end">
                  <button type="submit" className="w-full bg-blue-600 text-white px-4 py-2 rounded font-medium text-sm hover:bg-blue-700 h-[38px]">Add Client</button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Note Conversation</label>
                <textarea rows="2" placeholder="Write logs about your interactions here..." value={clientConversation} onChange={e=>setClientConversation(e.target.value)} className="w-full px-3 py-2 border rounded text-black bg-white text-sm" />
              </div>
            </form>

            {/* EXPANDED TABLE VIEW */}
            {loadingClients ? <p>Loading...</p> : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[900px]">
                  <thead>
                    <tr className="border-b bg-gray-50 text-gray-700">
                      <th className="p-3 text-sm font-semibold">Name</th>
                      <th className="p-3 text-sm font-semibold">Contact Info</th>
                      <th className="p-3 text-sm font-semibold">Location & Bio</th>
                      <th className="p-3 text-sm font-semibold">Conversation Notes</th>
                      <th className="p-3 text-sm font-semibold text-center">Relationship</th>
                      <th className="p-3 text-sm font-semibold text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clients.map(client => (
                      <tr key={client.id} className="border-b hover:bg-gray-50 tracking-normal">
                        <td className="p-3 text-sm font-medium vertical-top align-top">
                          <div className="font-semibold text-gray-900">{client.name}</div>
                          {client.linkedin_url && (
                            <a href={client.linkedin_url} target="_blank" rel="noreferrer" className="text-xs text-blue-500 hover:underline block mt-0.5">LinkedIn Profile ↗</a>
                          )}
                        </td>
                        <td className="p-3 text-sm text-gray-600 align-top">
                          <div className="text-xs text-gray-500">{client.email}</div>
                          {client.phone_number && <div className="text-xs text-gray-700 mt-0.5">📞 {client.phone_number}</div>}
                        </td>
                        <td className="p-3 text-sm text-gray-600 align-top">
                          {client.country && <div className="text-xs text-gray-800">📍 {client.country}</div>}
                          {client.birthday && <div className="text-xs text-gray-500 mt-0.5">🎂 Bday: {client.birthday}</div>}
                        </td>
                        <td className="p-3 text-sm text-gray-600 max-w-xs align-top">
                          {client.note_conversation ? (
                            <p className="text-xs italic text-gray-700 bg-gray-100 p-2 rounded whitespace-pre-wrap">{client.note_conversation}</p>
                          ) : (
                            <span className="text-xs text-gray-300">No notes yet</span>
                          )}
                        </td>
                        <td className="p-3 text-sm text-center align-top">
                          <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                            client.relationship === 'High' ? 'bg-purple-100 text-purple-800' :
                            client.relationship === 'Low' ? 'bg-orange-100 text-orange-800' : 'bg-gray-100 text-gray-800'
                          }`}>
                            {client.relationship || 'Medium'}
                          </span>
                        </td>
                        <td className="p-3 text-sm text-center align-top">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${client.status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                            {client.status || 'Active'}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {clients.length === 0 && (
                      <tr>
                        <td colSpan="6" className="p-4 text-center text-gray-500 text-sm">No clients found. Add one above!</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

      </main>
    </div>
  );
}
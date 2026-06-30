'use client';

import React, { useState, useEffect, useRef } from 'react';
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
  const [confirmPassword, setConfirmPassword] = useState(''); // NEW: Confirm Password
  const [username, setUsername] = useState('');
  const [phone, setPhone] = useState('');
  const [country, setCountry] = useState('');
  const [linkedin, setLinkedin] = useState('');
  
  // Visibility States for Passwords
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
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
  
  // CRM FIELD STATES
  const [clientCountry, setClientCountry] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientConversation, setClientConversation] = useState('');
  const [clientLinkedin, setClientLinkedin] = useState('');
  const [clientBirthday, setClientBirthday] = useState('');
  const [clientRelationship, setClientRelationship] = useState('Medium');
  const [crmErrorMessage, setCrmErrorMessage] = useState('');

  // FEATURE STATES (Search, Filters, Sort, Editing)
  const [searchTerm, setSearchTerm] = useState('');
  const [filterPriority, setFilterPriority] = useState('All');
  const [filterStatus, setFilterStatus] = useState('All');
  const [sortBy, setSortBy] = useState('created_at_desc');
  const [editingClient, setEditingClient] = useState(null); 

  // ADVANCED FEATURE STATES (Pagination, Detail View, Import/Export, Bulk Actions)
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [viewingClient, setViewingClient] = useState(null);
  const fileInputRef = useRef(null);
  const [selectedClientIds, setSelectedClientIds] = useState([]); // NEW: Bulk Selection

  // ACTIVITY LOG STATES (Detail View)
  const [activityType, setActivityType] = useState('Note');
  const [activityDesc, setActivityDesc] = useState('');
  const [activityDate, setActivityDate] = useState(new Date().toISOString().split('T')[0]);

  // USER MANAGEMENT & SETTINGS STATES
  const [profile, setProfile] = useState({ username: '', phone_number: '', country: '', linkedin_profile: '' });
  const [settingsMessage, setSettingsMessage] = useState({ type: '', text: '' });
  const [currentPassword, setCurrentPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState(''); // NEW: Confirm New Password
  const [resetEmailSent, setResetEmailSent] = useState(false);
  
  // DANGER ZONE STATES
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteAccountEmail, setDeleteAccountEmail] = useState('');

  // 1. CHECK SESSION
  useEffect(() => {
    checkSession();
  }, []);

  // Reset pagination to page 1 whenever filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterPriority, filterStatus, sortBy]);

  async function checkSession() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setAppStep('LOG_IN');
      return;
    }
    setUser(session.user);
    setAppStep('DASHBOARD');
    fetchClients(session.user.id);
    fetchProfile(session.user.id);
  }

  // ==========================================
  // AUTHENTICATION LOGIC
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
      fetchProfile(data.session.user.id);
    }
    setAuthLoading(false);
  }

  async function handleGoogleSignIn() {
    setAuthLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin }
    });
    if (error) setAuthMessage(`Google Auth Error: ${error.message}`);
    setAuthLoading(false);
  }

  async function handleSignUp(e) {
    e.preventDefault();
    if (password !== confirmPassword) return; // Prevent submission if passwords don't match
    
    setAuthLoading(true);
    setAuthMessage('');
    setIsNewUserSignUp(true);

    const { data, error } = await supabase.auth.signUp({
      email: email,
      password: password,
      options: { emailRedirectTo: window.location.origin }
    });

    if (error) {
      setAuthMessage(`Sign Up Error: ${error.message}`);
      setAuthLoading(false);
      return;
    }

    const { error: otpError } = await supabase.auth.signInWithOtp({
      email: email,
      options: { shouldCreateUser: false }
    });

    if (otpError) console.warn("OTP Delivery Note:", otpError.message);

    setAuthMessage('Account configuration initiated! Check your email for the verification code.');
    setAppStep('VERIFY_OTP');
    setAuthLoading(false);
  }

  async function handleVerifyOtp(e) {
    e.preventDefault();
    setAuthLoading(true);
    setAuthMessage('');

    let { data: { session }, error } = await supabase.auth.verifyOtp({
      email: email, token: otpToken, type: 'signup'
    });

    if (error) {
      const fallback = await supabase.auth.verifyOtp({
        email: email, token: otpToken, type: 'email'
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
      fetchProfile(session.user.id);
      setAuthLoading(false);
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    setUser(null);
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setOtpToken('');
    setShowLoginPassword(false);
    setShowSignupPassword(false);
    setShowConfirmPassword(false);
    setAppStep('LOG_IN');
  }

  // ==========================================
  // USER PROFILE & ACCOUNT SETTINGS LOGIC
  // ==========================================

  async function handleForgotPassword(e) {
    e.preventDefault();
    setAuthLoading(true);
    setAuthMessage('');
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin
    });
    if (error) {
      setAuthMessage(error.message);
    } else {
      setResetEmailSent(true);
    }
    setAuthLoading(false);
  }

  async function fetchProfile(userId) {
    const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
    if (data && !error) {
      setProfile({
        username: data.username || '',
        phone_number: data.phone_number || '',
        country: data.country || '',
        linkedin_profile: data.linkedin_profile || ''
      });
    }
  }

  async function handleUpdateProfile(e) {
    e.preventDefault();
    setSettingsMessage({ type: '', text: '' });
    const { error } = await supabase.from('profiles').upsert([
      { id: user.id, username: profile.username, phone_number: profile.phone_number, country: profile.country, linkedin_profile: profile.linkedin_profile }
    ]);

    if (error) {
      setSettingsMessage({ type: 'error', text: `Error updating profile: ${error.message}` });
    } else {
      setSettingsMessage({ type: 'success', text: 'Profile information updated successfully.' });
    }
  }

  async function handleUpdatePassword(e) {
    e.preventDefault();
    if (!currentPassword) {
      setSettingsMessage({ type: 'error', text: 'Please enter your current password.' });
      return;
    }
    if (!newPassword || newPassword !== confirmNewPassword) {
      setSettingsMessage({ type: 'error', text: 'New passwords do not match.' });
      return;
    }
    setSettingsMessage({ type: '', text: '' });
    
    // This updates the password instantly without asking for an OTP token code
    const { error: updateError } = await supabase.auth.updateUser({ 
      current_password: currentPassword,
      password: newPassword 
    });

    if (updateError) {
      setSettingsMessage({ type: 'error', text: `Error updating password: ${updateError.message}` });
    } else {
      setSettingsMessage({ type: 'success', text: 'Password successfully updated.' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
    }
  }

  async function handleDeleteAccount() {
    if (deleteAccountEmail !== user.email) return;
    
    setAuthLoading(true);
    
    // Call the secure database function we just created
    const { error } = await supabase.rpc('delete_own_user');
    
    if (error) {
      alert(`Error deleting account: ${error.message}`);
      setAuthLoading(true);
      return;
    }
  
    // If successful, log them out locally and return to login screen
    await supabase.auth.signOut();
    setUser(null);
    setShowDeleteModal(false);
    setAppStep('LOG_IN');
    setAuthLoading(false);
    
    alert('Your account and all data have been completely and permanently deleted.');
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
        name, email: clientEmail, status, notes, user_id: user.id,
        country: clientCountry || null, phone_number: clientPhone || null,
        note_conversation: clientConversation || null, linkedin_url: clientLinkedin || null,
        birthday: clientBirthday || null, relationship: clientRelationship
      }
    ]).select();

    if (!error && data) {
      setClients([data[0], ...clients]);
      setName(''); setClientEmail(''); setNotes(''); setStatus('Active');
      setClientCountry(''); setClientPhone(''); setClientConversation('');
      setClientLinkedin(''); setClientBirthday(''); setClientRelationship('Medium');
    } else if (error) {
      setCrmErrorMessage(`Database Sync Error: ${error.message}`);
    }
  }

  async function handleUpdateClient(e) {
    e.preventDefault();
    if (!editingClient.name || !editingClient.email) return;
    setCrmErrorMessage('');
  
    const { data, error } = await supabase
      .from('clients').update({
        name: editingClient.name, email: editingClient.email, status: editingClient.status,
        country: editingClient.country || null, phone_number: editingClient.phone_number || null,
        note_conversation: editingClient.note_conversation || null, linkedin_url: editingClient.linkedin_url || null,
        birthday: editingClient.birthday || null, relationship: editingClient.relationship
      })
      .eq('id', editingClient.id).select();
  
    if (!error && data && data.length > 0) {
      // 1. Normal behavior: database returned the updated row nicely
      setClients(clients.map(client => client.id === editingClient.id ? data[0] : client));
      setEditingClient(null);
    } else if (error) {
      setCrmErrorMessage(`Database Update Error: ${error.message}`);
    } else {
      // 2. Fallback behavior: Database updated successfully, but RLS blocked the select return value
      // Update local state manually with the editing data so it doesn't inject undefined!
      setClients(clients.map(client => client.id === editingClient.id ? { ...client, ...editingClient } : client));
      setEditingClient(null);
      console.warn("Row updated in database, but Row Level Security (RLS) select policy blocked reading it back into state.");
    }
  }

  async function handleDeleteClient(clientId) {
    if (!window.confirm('Are you sure you want to delete this client?')) return;
    const { error } = await supabase.from('clients').delete().eq('id', clientId);
    if (error) {
      setCrmErrorMessage(`Delete Error: ${error.message}`);
    } else {
      setClients(clients.filter(client => client.id !== clientId));
      setSelectedClientIds(prev => prev.filter(id => id !== clientId)); // Clean up bulk select
    }
  }

  // ACTIVITY LOG APPEND FUNCTION
  async function handleAddActivityLog(e) {
    e.preventDefault();
    if (!activityDesc.trim() || !viewingClient) return;

    const newLogEntry = `[${activityType}] ${activityDate} - ${activityDesc}\n`;
    const updatedConversation = newLogEntry + (viewingClient.note_conversation ? `\n${viewingClient.note_conversation}` : '');

    const { data, error } = await supabase
      .from('clients')
      .update({ note_conversation: updatedConversation })
      .eq('id', viewingClient.id)
      .select();

    if (!error) {
      // FIX: Ensure we never inject 'undefined' into the clients array if data[0] is missing
      const updatedClient = (data && data.length > 0 && data[0]) 
        ? data[0] 
        : { ...viewingClient, note_conversation: updatedConversation }; // Safe local fallback
      
      setClients(clients.map(client => client?.id === viewingClient.id ? updatedClient : client));
      setViewingClient(updatedClient);
      setActivityDesc('');
    } else {
      alert(`Error logging activity: ${error?.message}`);
    }
  }

  // ==========================================
  // BULK ACTIONS LOGIC
  // ==========================================
  
  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedClientIds(paginatedClients.map(c => c.id));
    } else {
      setSelectedClientIds([]);
    }
  };

  const handleSelectRow = (id) => {
    if (selectedClientIds.includes(id)) {
      setSelectedClientIds(selectedClientIds.filter(selectedId => selectedId !== id));
    } else {
      setSelectedClientIds([...selectedClientIds, id]);
    }
  };

  const handleBulkDelete = async () => {
    if (!window.confirm(`Delete ${selectedClientIds.length} clients permanently?`)) return;
    
    const { error } = await supabase.from('clients').delete().in('id', selectedClientIds);
    if (!error) {
      setClients(clients.filter(c => !selectedClientIds.includes(c.id)));
      setSelectedClientIds([]);
    } else {
      alert(`Bulk Delete Error: ${error.message}`);
    }
  };

  const handleBulkStatusUpdate = async (newStatus) => {
    const { error } = await supabase.from('clients').update({ status: newStatus }).in('id', selectedClientIds);
    if (!error) {
      setClients(clients.map(c => selectedClientIds.includes(c.id) ? { ...c, status: newStatus } : c));
      setSelectedClientIds([]);
    } else {
      alert(`Bulk Status Error: ${error.message}`);
    }
  };

  // ==========================================
  // ADVANCED IMPORT / EXPORT LOGIC
  // ==========================================

  const handleExportCSV = () => {
    if (clients.length === 0) return;
    const headers = ['Name', 'Email', 'Phone', 'Country', 'Status', 'Priority', 'LinkedIn', 'Birthday', 'Notes'];
    const csvContent = [
      headers.join(','),
      ...clients.map(c => [
        `"${(c.name || '').replace(/"/g, '""')}"`, `"${(c.email || '').replace(/"/g, '""')}"`,
        `"${(c.phone_number || '').replace(/"/g, '""')}"`, `"${(c.country || '').replace(/"/g, '""')}"`,
        `"${(c.status || '').replace(/"/g, '""')}"`, `"${(c.relationship || '').replace(/"/g, '""')}"`,
        `"${(c.linkedin_url || '').replace(/"/g, '""')}"`, `"${(c.birthday || '').replace(/"/g, '""')}"`,
        `"${(c.note_conversation || '').replace(/"/g, '""')}"`
      ].join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'crm_clients_export.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImportCSV = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target.result;
      const rows = text.split('\n').filter(row => row.trim().length > 0);
      if (rows.length < 2) {
        alert('CSV file must contain headers and at least one row of data.');
        return;
      }
      
      const newClients = [];
      for (let i = 1; i < rows.length; i++) {
        const cols = rows[i].match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || rows[i].split(',');
        if (cols.length >= 2) {
          newClients.push({
            user_id: user.id,
            name: cols[0]?.replace(/"/g, '') || 'Imported User',
            email: cols[1]?.replace(/"/g, '') || `imported${i}@example.com`,
            status: 'Active',
            relationship: 'Medium'
          });
        }
      }
      
      if (newClients.length > 0) {
        const { data, error } = await supabase.from('clients').insert(newClients).select();
        if (data && !error) {
          setClients([...data, ...clients]);
          alert(`Successfully imported ${data.length} clients!`);
        } else {
          alert(`Import error: ${error?.message}`);
        }
      }
    };
    reader.readAsText(file);
    e.target.value = null; 
  };


  // ==========================================
  // COMPUTED DATA & PAGINATION LOGIC
  // ==========================================
  const filteredAndSortedClients = (clients || [])
    .filter(Boolean) // Instantly removes any null/undefined ghosts
    .filter(client => {
      // EXTRA GUARD: Skip evaluation if client is corrupted
      if (!client || typeof client !== 'object') return false;

      // FIX: Added the country check right here!
      const matchesSearch = 
        (client.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
        (client.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (client.country || '').toLowerCase().includes(searchTerm.toLowerCase()); 
      
      const matchesPriority = filterPriority === 'All' || client.relationship === filterPriority;
      const matchesStatus = filterStatus === 'All' || client.status === filterStatus;

      return matchesSearch && matchesPriority && matchesStatus;
    }).sort((a, b) => {
      if (!a || !b) return 0;
      if (sortBy === 'created_at_desc') return new Date(b.created_at || 0) - new Date(a.created_at || 0);
      if (sortBy === 'created_at_asc') return new Date(a.created_at || 0) - new Date(b.created_at || 0);
      if (sortBy === 'name_asc') return (a.name || '').localeCompare(b.name || '');
      if (sortBy === 'name_desc') return (b.name || '').localeCompare(a.name || '');
      return 0;
    });

  const totalPages = Math.ceil(filteredAndSortedClients.length / itemsPerPage) || 1;
  const paginatedClients = filteredAndSortedClients.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Computed Widgets Data
  const currentMonth = new Date().getMonth();
  const upcomingBirthdays = (clients || [])
    .filter(c => c && c.birthday && new Date(c.birthday).getMonth() === currentMonth)
    .sort((a, b) => new Date(a.birthday).getDate() - new Date(b.birthday).getDate());
  const recentActivity = [...clients].filter(Boolean).sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 4);
  const topCountriesObj = clients.reduce((acc, c) => { if(c && c.country) acc[c.country] = (acc[c.country] || 0) + 1; return acc; }, {});
  const topCountries = Object.entries(topCountriesObj).sort((a, b) => b[1] - a[1]).slice(0, 3);


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
    <div className="min-h-screen bg-[#F9FAFB] text-gray-900 font-sans flex flex-col selection:bg-gray-900 selection:text-white relative">
      
      {/* PREMIUM TOP NAVIGATION BAR */}
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-40 shadow-sm">
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
                  <button onClick={() => setAppStep('SETTINGS')} className={`px-3 py-1.5 rounded-md text-[13px] font-medium transition-all ${appStep === 'SETTINGS' ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'}`}>Settings</button>
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
                <button onClick={() => { setAppStep('LOG_IN'); setAuthMessage(''); }} className={`px-3 py-1.5 rounded-md text-[13px] font-medium transition-all ${appStep === 'LOG_IN' || appStep === 'FORGOT_PASSWORD' ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'}`}>Log In</button>
                <button onClick={() => { setAppStep('SIGN_UP'); setAuthMessage(''); }} className="px-3 py-1.5 rounded-md text-[13px] font-medium bg-gray-900 text-white hover:bg-gray-800 transition-all shadow-sm">Sign Up</button>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* GLOBAL FLOATING ACTION BUTTON (Dashboard only) */}
      {user && appStep === 'DASHBOARD' && (
        <button 
          onClick={() => { setAppStep('CLIENTS'); setTimeout(() => document.getElementById('add-client-form')?.scrollIntoView({behavior: 'smooth'}), 100); }}
          className="fixed bottom-8 right-8 z-50 bg-gray-900 text-white p-4 rounded-full shadow-xl hover:bg-gray-800 hover:scale-105 transition-all active:scale-95 group flex items-center justify-center"
          title="Add New Client"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
        </button>
      )}

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        
        {/* LOG IN */}
        {appStep === 'LOG_IN' && (
          <div className="max-w-[400px] mx-auto mt-10 sm:mt-20">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 sm:p-10">
              <h2 className="text-xl font-semibold text-gray-900 mb-1">Welcome back</h2>
              <p className="text-[13px] text-gray-500 mb-6">Enter your credentials to access your workspace.</p>
              
              {authMessage && (
                <div className="mb-6 p-3 rounded-lg text-[13px] font-medium bg-red-50 text-red-700 border border-red-100 flex items-start gap-2">
                  <svg className="w-4 h-4 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" /></svg>
                  {authMessage}
                </div>
              )}

              <button 
                onClick={handleGoogleSignIn}
                type="button" 
                className="w-full flex items-center justify-center gap-3 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 text-[13px] font-medium py-2.5 px-4 rounded-lg shadow-sm transition-all active:scale-[0.98] mb-4"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                Sign in with Google
              </button>

              <div className="relative mb-4">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200"></div></div>
                <div className="relative flex justify-center text-sm"><span className="px-2 bg-white text-[11px] text-gray-500 uppercase tracking-widest">Or continue with</span></div>
              </div>
              
              <form onSubmit={handleLoginWithPassword} className="space-y-4">
                <div>
                  <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Email address</label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="name@company.com" className="w-full px-3 py-2 text-[13px] bg-white border border-gray-200 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-400 transition-colors" />
                </div>
                
                <div>
                  <label className="block text-[12px] font-medium text-gray-700 mb-1.5 flex justify-between">
                    Password
                    <button type="button" onClick={() => {setAppStep('FORGOT_PASSWORD'); setAuthMessage('');}} className="text-gray-500 hover:text-gray-800 focus:outline-none transition-colors">Forgot password?</button>
                  </label>
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
                
                <button type="submit" disabled={authLoading} className="w-full mt-2 bg-gray-900 hover:bg-gray-800 text-white text-[13px] font-medium py-2.5 px-4 rounded-lg shadow-sm transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed">
                  {authLoading ? 'Authenticating...' : 'Sign In with Email'}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* FORGOT PASSWORD */}
        {appStep === 'FORGOT_PASSWORD' && (
          <div className="max-w-[400px] mx-auto mt-10 sm:mt-20">
            <div className="bg-white rounded-2xl shadow-[0_1px_3px_0_rgba(0,0,0,0.1),0_1px_2px_-1px_rgba(0,0,0,0.1)] border border-gray-200 p-8 sm:p-10">
              <h2 className="text-xl font-semibold text-gray-900 mb-1">Reset Password</h2>
              <p className="text-[13px] text-gray-500 mb-6">Enter your email and we'll send you a recovery link.</p>
              
              {authMessage && !resetEmailSent && (
                <div className="mb-6 p-3 rounded-lg text-[13px] font-medium bg-red-50 text-red-700 border border-red-100 flex items-start gap-2">
                  <svg className="w-4 h-4 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" /></svg>
                  {authMessage}
                </div>
              )}

              {resetEmailSent ? (
                <div className="text-center">
                   <div className="w-10 h-10 bg-emerald-50 border border-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                     <svg className="w-5 h-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                   </div>
                   <p className="text-[13px] font-medium text-gray-900 mb-4">Recovery email sent successfully. Please check your inbox.</p>
                   <button onClick={() => {setAppStep('LOG_IN'); setResetEmailSent(false);}} className="w-full bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 text-[13px] font-medium py-2 px-4 rounded-lg shadow-sm transition-all active:scale-[0.98]">
                     Return to Login
                   </button>
                </div>
              ) : (
                <form onSubmit={handleForgotPassword} className="space-y-4">
                  <div>
                    <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Email address <span className="text-red-500">*</span></label>
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="name@company.com" className="w-full px-3 py-2 text-[13px] bg-white border border-gray-200 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-400 transition-colors" />
                  </div>
                  
                  <div className="pt-2 flex flex-col gap-2">
                    <button type="submit" disabled={authLoading} className="w-full bg-gray-900 hover:bg-gray-800 text-white text-[13px] font-medium py-2 px-4 rounded-lg shadow-sm transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed">
                      {authLoading ? 'Processing...' : 'Send Reset Link'}
                    </button>
                    <button type="button" onClick={() => {setAppStep('LOG_IN'); setAuthMessage('');}} className="w-full bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 text-[13px] font-medium py-2 px-4 rounded-lg shadow-sm transition-all active:scale-[0.98]">
                      Back to Login
                    </button>
                  </div>
                </form>
              )}
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
                  <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Email address <span className="text-red-500">*</span></label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="name@company.com" className="w-full px-3 py-2 text-[13px] bg-white border border-gray-200 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-400 transition-colors" />
                </div>
                
                <div>
                  <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Password <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <input type={showSignupPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="Strong password" className="w-full px-3 py-2 pr-10 text-[13px] bg-white border border-gray-200 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-400 transition-colors" />
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
                  <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Confirm Password <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <input type={showConfirmPassword ? 'text' : 'password'} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required placeholder="Repeat password" className={`w-full px-3 py-2 pr-10 text-[13px] bg-white border ${confirmPassword && password !== confirmPassword ? 'border-red-400 focus:ring-red-400' : 'border-gray-200 focus:border-gray-400 focus:ring-gray-400'} rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-1 transition-colors`} />
                    <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none p-1 rounded">
                      {showConfirmPassword ? (
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 1-4.243-4.243m4.242 4.242L9.88 9.88" /></svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /></svg>
                      )}
                    </button>
                  </div>
                  {confirmPassword && password !== confirmPassword && (
                    <p className="text-red-500 text-[11px] mt-1">Passwords do not match</p>
                  )}
                </div>
                
                <div>
                  <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Full name <span className="text-red-500">*</span></label>
                  <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} required placeholder="Jane Doe" className="w-full px-3 py-2 text-[13px] bg-white border border-gray-200 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-400 transition-colors" />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Phone number <span className="text-red-500">*</span></label>
                  <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} required placeholder="+1 (555) 000-0000" className="w-full px-3 py-2 text-[13px] bg-white border border-gray-200 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-400 transition-colors" />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Country <span className="text-red-500">*</span></label>
                  <input type="text" value={country} onChange={(e) => setCountry(e.target.value)} required placeholder="United States" className="w-full px-3 py-2 text-[13px] bg-white border border-gray-200 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-400 transition-colors" />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-gray-700 mb-1.5">LinkedIn <span className="text-gray-400 font-normal">(Optional)</span></label>
                  <input type="url" value={linkedin} onChange={(e) => setLinkedin(e.target.value)} placeholder="https://linkedin.com/in/..." className="w-full px-3 py-2 text-[13px] bg-white border border-gray-200 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-400 transition-colors" />
                </div>
                
                <div className="md:col-span-2 mt-4">
                  <button type="submit" disabled={authLoading || (password !== confirmPassword)} className="w-full bg-gray-900 hover:bg-gray-800 text-white text-[13px] font-medium py-2 px-4 rounded-lg shadow-sm transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed">
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

        {/* SETTINGS VIEW */}
        {appStep === 'SETTINGS' && (
          <div className="space-y-8 animate-in fade-in duration-500">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">Account Settings</h1>
              <p className="text-[14px] text-gray-500 mt-1">Manage your profile details and security preferences.</p>
            </div>

            {settingsMessage.text && (
              <div className={`p-4 rounded-xl text-[13px] font-medium border shadow-sm flex items-start gap-3 ${settingsMessage.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-100' : 'bg-red-50 text-red-800 border-red-100'}`}>
                {settingsMessage.type === 'success' ? (
                  <svg className="w-5 h-5 mt-0.5 shrink-0 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                ) : (
                  <svg className="w-5 h-5 mt-0.5 shrink-0 text-red-600" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" /></svg>
                )}
                <span>{settingsMessage.text}</span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Profile Settings Card */}
              <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden h-fit">
                <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
                  <h3 className="text-[14px] font-semibold text-gray-900">Profile Information</h3>
                </div>
                <form onSubmit={handleUpdateProfile} className="p-6 flex flex-col gap-5">
                  <div>
                    <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Full name <span className="text-red-500">*</span></label>
                    <input type="text" value={profile.username} onChange={(e) => setProfile({...profile, username: e.target.value})} required className="w-full px-3 py-2 text-[13px] bg-white border border-gray-200 rounded-lg shadow-sm focus:outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-400 transition-colors" />
                  </div>
                  <div>
                    <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Phone number <span className="text-red-500">*</span></label>
                    <input type="tel" value={profile.phone_number} onChange={(e) => setProfile({...profile, phone_number: e.target.value})} required className="w-full px-3 py-2 text-[13px] bg-white border border-gray-200 rounded-lg shadow-sm focus:outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-400 transition-colors" />
                  </div>
                  <div>
                    <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Country <span className="text-red-500">*</span></label>
                    <input type="text" value={profile.country} onChange={(e) => setProfile({...profile, country: e.target.value})} required className="w-full px-3 py-2 text-[13px] bg-white border border-gray-200 rounded-lg shadow-sm focus:outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-400 transition-colors" />
                  </div>
                  <div>
                    <label className="block text-[12px] font-medium text-gray-700 mb-1.5">LinkedIn Profile <span className="text-gray-400 font-normal">(Optional)</span></label>
                    <input type="url" value={profile.linkedin_profile} onChange={(e) => setProfile({...profile, linkedin_profile: e.target.value})} className="w-full px-3 py-2 text-[13px] bg-white border border-gray-200 rounded-lg shadow-sm focus:outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-400 transition-colors" />
                  </div>
                  <div className="flex justify-end pt-2">
                    <button type="submit" className="bg-gray-900 hover:bg-gray-800 text-white text-[13px] font-medium py-2 px-4 rounded-lg shadow-sm transition-all active:scale-[0.98]">
                      Save Profile
                    </button>
                  </div>
                </form>
              </div>

              <div className="space-y-8">
                {/* Security / Password Card */}
                <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden h-fit">
                  <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
                    <h3 className="text-[14px] font-semibold text-gray-900">Security / Change Password</h3>
                  </div>
                  <form onSubmit={handleUpdatePassword} className="space-y-4">
                {/* NEW: Current Password Field */}
                <div>
                  <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Current Password</label>
                  <div className="relative">
                    <input 
                      type={showCurrentPassword ? 'text' : 'password'} 
                      value={currentPassword} 
                      onChange={(e) => setCurrentPassword(e.target.value)} 
                      required 
                      placeholder="Enter current password" 
                      className="w-full px-3 py-2 pr-10 text-[13px] bg-white border border-gray-200 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-400 transition-colors" 
                    />
                    <button type="button" onClick={() => setShowCurrentPassword(!showCurrentPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-[11px] font-medium focus:outline-none p-1 rounded">
                      {showCurrentPassword ? "Hide" : "Show"}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[12px] font-medium text-gray-700 mb-1.5">New Password</label>
                  <div className="relative">
                    <input type={showSignupPassword ? 'text' : 'password'} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required placeholder="••••••••" className="w-full px-3 py-2 pr-10 text-[13px] bg-white border border-gray-200 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-400 transition-colors" />
                    <button type="button" onClick={() => setShowSignupPassword(!showSignupPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-[11px] font-medium focus:outline-none p-1 rounded">
                      {showSignupPassword ? "Hide" : "Show"}
                    </button>
                  </div>
                </div>
                
                <div>
                  <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Confirm New Password</label>
                  <div className="relative">
                    <input type={showConfirmPassword ? 'text' : 'password'} value={confirmNewPassword} onChange={(e) => setConfirmNewPassword(e.target.value)} required placeholder="••••••••" className="w-full px-3 py-2 pr-10 text-[13px] bg-white border border-gray-200 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-400 transition-colors" />
                    <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-[11px] font-medium focus:outline-none p-1 rounded">
                      {showConfirmPassword ? "Hide" : "Show"}
                    </button>
                  </div>
                </div>

                <button type="submit" className="bg-gray-900 hover:bg-gray-800 text-white text-[13px] font-medium py-2 px-4 rounded-lg shadow-sm transition-all active:scale-[0.98]">
                  Update Password
                </button>
              </form>
                </div>

                {/* Danger Zone Card */}
                <div className="bg-white border border-red-200 rounded-xl shadow-sm overflow-hidden h-fit relative">
                  <div className="absolute top-0 left-0 right-0 h-1 bg-red-500"></div>
                  <div className="px-6 py-4 border-b border-gray-100 bg-red-50/30">
                    <h3 className="text-[14px] font-semibold text-red-800">Danger Zone</h3>
                  </div>
                  <div className="p-6">
                    <p className="text-[13px] text-gray-600 mb-4">Permanently delete your account and all associated client data. This action cannot be undone.</p>
                    <button onClick={() => setShowDeleteModal(true)} className="bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 text-[13px] font-medium py-2 px-4 rounded-lg transition-colors active:scale-[0.98]">
                      Delete Account
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* DELETE ACCOUNT CONFIRMATION MODAL */}
        {showDeleteModal && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-xl shadow-2xl border border-red-200 w-full max-w-md m-4 animate-in zoom-in-95 duration-200 overflow-hidden">
              <div className="p-6">
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4">
                  <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">Delete Account</h3>
                <p className="text-[13px] text-gray-600 mb-4">You are about to permanently delete your account and all client directories. To confirm, please type your email (<strong className="text-gray-900">{user?.email}</strong>) below.</p>
                <input 
                  type="email" 
                  value={deleteAccountEmail} 
                  onChange={(e) => setDeleteAccountEmail(e.target.value)} 
                  placeholder={user?.email} 
                  className="w-full px-3 py-2 text-[13px] bg-white border border-gray-300 rounded-lg focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 mb-6" 
                />
                <div className="flex justify-end gap-3">
                  <button onClick={() => { setShowDeleteModal(false); setDeleteAccountEmail(''); }} className="px-4 py-2 text-[13px] font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                    Cancel
                  </button>
                  <button 
                    onClick={handleDeleteAccount} 
                    disabled={deleteAccountEmail !== user?.email || authLoading}
                    className="px-4 py-2 text-[13px] font-medium text-white bg-red-600 border border-transparent rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {authLoading ? 'Deleting...' : 'Permanently Delete'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* DASHBOARD */}
        {appStep === 'DASHBOARD' && (
          <div className="space-y-6 animate-in fade-in duration-500">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">Overview</h1>
              <p className="text-[14px] text-gray-500 mt-1">Monitor your workspace activity and client directories.</p>
            </div>
            
            {/* TOP ROW GRID: Directory Stats & Priority Analytics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
              
              {/* Directory Stats Card (Clickable to /clients) */}
              <div className="md:col-span-1 bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-between min-h-[160px]">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-full bg-gray-50 border border-gray-100 flex items-center justify-center">
                    <svg className="w-4 h-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                  </div>
                  <h3 className="text-[13px] font-medium text-gray-600">Client Directory</h3>
                </div>
                <div>
                  <div className="flex justify-between items-end">
                    <div 
                      className="cursor-pointer group hover:opacity-80 transition-opacity" 
                      onClick={() => { setFilterStatus('All'); setAppStep('CLIENTS'); }}
                    >
                      <p className="text-[12px] font-medium text-gray-500 uppercase tracking-wider mb-1 group-hover:text-indigo-600 transition-colors">Total</p>
                      <span className="text-3xl font-semibold text-gray-900">{clients.length}</span>
                    </div>
                    <div 
                      className="text-right cursor-pointer group hover:opacity-80 transition-opacity"
                      onClick={() => { setFilterStatus('Active'); setAppStep('CLIENTS'); }}
                    >
                      <p className="text-[12px] font-medium text-gray-500 uppercase tracking-wider mb-1 group-hover:text-emerald-600 transition-colors">Active</p>
                      <span className="text-3xl font-semibold text-gray-900">{clients.filter(c => c.status === 'Active').length}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Priority Analytics Module */}
              <div className="md:col-span-2 bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex flex-col min-h-[160px]">
                <h3 className="text-[13px] font-medium text-gray-600 mb-4 flex items-center gap-2">
                  <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                  Client Priority Split
                </h3>
                {clients.length === 0 ? (
                   <div className="flex-1 flex flex-col items-center justify-center text-center">
                     <p className="text-[12px] text-gray-400">No data available to display.</p>
                   </div>
                ) : (
                   <div className="space-y-4 flex-1 flex flex-col justify-center">
                     <div>
                       <div className="flex justify-between text-[11px] font-semibold text-gray-500 mb-1 uppercase tracking-wider">
                         <span>High Priority</span>
                         <span className="text-gray-900">{clients.filter(c => c.relationship === 'High').length}</span>
                       </div>
                       <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden border border-gray-200">
                         <div className="bg-indigo-500 h-full rounded-full transition-all duration-1000 ease-out" style={{ width: `${(clients.filter(c => c.relationship === 'High').length / clients.length) * 100}%` }}></div>
                       </div>
                     </div>
                     <div>
                       <div className="flex justify-between text-[11px] font-semibold text-gray-500 mb-1 uppercase tracking-wider">
                         <span>Medium Priority</span>
                         <span className="text-gray-900">{clients.filter(c => c.relationship === 'Medium' || !c.relationship).length}</span>
                       </div>
                       <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden border border-gray-200">
                         <div className="bg-gray-400 h-full rounded-full transition-all duration-1000 ease-out" style={{ width: `${(clients.filter(c => c.relationship === 'Medium' || !c.relationship).length / clients.length) * 100}%` }}></div>
                       </div>
                     </div>
                     <div>
                       <div className="flex justify-between text-[11px] font-semibold text-gray-500 mb-1 uppercase tracking-wider">
                         <span>Low Priority</span>
                         <span className="text-gray-900">{clients.filter(c => c.relationship === 'Low').length}</span>
                       </div>
                       <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden border border-gray-200">
                         <div className="bg-orange-400 h-full rounded-full transition-all duration-1000 ease-out" style={{ width: `${(clients.filter(c => c.relationship === 'Low').length / clients.length) * 100}%` }}></div>
                       </div>
                     </div>
                   </div>
                )}
              </div>
            </div>

            {/* BOTTOM ROW GRID: Recent Activity, Birthdays, Top Countries */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
              
              {/* Recent Activity */}
              <div className="md:col-span-1 bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                <h3 className="text-[13px] font-medium text-gray-600 mb-4 flex items-center gap-2">
                  <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  Recent Activity
                </h3>
                {recentActivity.length === 0 ? (
                  <p className="text-[12px] text-gray-400">No recent client activity.</p>
                ) : (
                  <ul className="space-y-3">
                    {recentActivity.map(c => (
                      <li key={`recent-${c.id}`} className="flex items-start gap-3">
                        <div className="w-2 h-2 rounded-full bg-indigo-500 mt-1.5 shrink-0"></div>
                        <div>
                          <p className="text-[13px] text-gray-900 font-medium">Added {c.name}</p>
                          <p className="text-[11px] text-gray-500">{new Date(c.created_at).toLocaleDateString()}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Upcoming Birthdays */}
              <div className="md:col-span-1 bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                <h3 className="text-[13px] font-medium text-gray-600 mb-4 flex items-center gap-2">
                  <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 15.546c-.523 0-1.046.151-1.5.454a2.704 2.704 0 01-3 0 2.704 2.704 0 00-3 0 2.704 2.704 0 01-3 0 2.704 2.704 0 00-3 0 2.704 2.704 0 01-3 0 2.701 2.701 0 00-1.5-.454M9 6v2m3-2v2m3-2v2M9 3h.01M12 3h.01M15 3h.01M21 21v-7a2 2 0 00-2-2H5a2 2 0 00-2 2v7h18zm-3-9v-2a2 2 0 00-2-2H8a2 2 0 00-2 2v2h12z" /></svg>
                  Upcoming Birthdays
                </h3>
                {upcomingBirthdays.length === 0 ? (
                  <p className="text-[12px] text-gray-400">No client birthdays this month.</p>
                ) : (
                  <ul className="space-y-3">
                    {upcomingBirthdays.map(c => (
                      <li key={`bday-${c.id}`} className="flex items-center justify-between border-b border-gray-50 pb-2 last:border-0">
                        <span className="text-[13px] text-gray-900 font-medium">{c.name}</span>
                        <span className="text-[12px] text-gray-500 bg-gray-100 px-2 py-0.5 rounded">{new Date(c.birthday).toLocaleDateString(undefined, {month: 'short', day: 'numeric'})}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Top Countries */}
              <div className="md:col-span-1 bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                <h3 className="text-[13px] font-medium text-gray-600 mb-4 flex items-center gap-2">
                  <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  Top Countries
                </h3>
                {topCountries.length === 0 ? (
                  <p className="text-[12px] text-gray-400">No location data mapped yet.</p>
                ) : (
                  <ul className="space-y-3">
                    {topCountries.map(([country, count], idx) => (
                      <li key={`country-${idx}`} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-mono text-gray-400">#{idx + 1}</span>
                          <span className="text-[13px] text-gray-900 font-medium">{country}</span>
                        </div>
                        <span className="text-[12px] text-gray-500 bg-gray-100 px-2 py-0.5 rounded">{count} clients</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        )}

        {/* CLIENTS VIEW */}
        {appStep === 'CLIENTS' && (
          <div className="space-y-8 animate-in fade-in duration-500">
            
            {/* Header + Import/Export Controls */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">Clients</h1>
                <p className="text-[14px] text-gray-500 mt-1">Manage and organize your professional network.</p>
              </div>
              
              <div className="flex items-center gap-2">
                <input type="file" accept=".csv" ref={fileInputRef} onChange={handleImportCSV} className="hidden" />
                <button onClick={() => fileInputRef.current.click()} className="px-3 py-1.5 rounded-md text-[13px] font-medium bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 transition-all shadow-sm flex items-center gap-2">
                  <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                  Import CSV
                </button>
                <button onClick={handleExportCSV} className="px-3 py-1.5 rounded-md text-[13px] font-medium bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 transition-all shadow-sm flex items-center gap-2">
                  <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                  Export CSV
                </button>
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
            <div id="add-client-form" className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden scroll-mt-20">
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
              </form>
            </div>

            {/* SEARCH, FILTER & SORT CONTROLS BAR */}
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 flex flex-col md:flex-row gap-4 items-center justify-between">
              <div className="relative w-full md:max-w-xs">
                <input 
                  type="text" 
                  placeholder="Search by name, email, or country..." 
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-[13px] bg-white border border-gray-200 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-400 transition-colors"
                />
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                </div>
              </div>
              
              <div className="flex flex-wrap items-center gap-4 w-full md:w-auto justify-end">
                <div className="flex items-center gap-1.5">
                  <span className="text-[12px] text-gray-500 font-medium">Priority:</span>
                  <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)} className="px-2.5 py-1.5 text-[12px] bg-white border border-gray-200 rounded-lg text-gray-700 focus:outline-none focus:border-gray-400 transition-colors">
                    <option value="All">All</option>
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-[12px] text-gray-500 font-medium">Status:</span>
                  <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="px-2.5 py-1.5 text-[12px] bg-white border border-gray-200 rounded-lg text-gray-700 focus:outline-none focus:border-gray-400 transition-colors">
                    <option value="All">All</option>
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-[12px] text-gray-500 font-medium">Sort:</span>
                  <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="px-2.5 py-1.5 text-[12px] bg-white border border-gray-200 rounded-lg text-gray-700 focus:outline-none focus:border-gray-400 transition-colors">
                    <option value="created_at_desc">Newest Added</option>
                    <option value="created_at_asc">Oldest Added</option>
                    <option value="name_asc">Name (A-Z)</option>
                    <option value="name_desc">Name (Z-A)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* BULK ACTIONS BAR (Appears when items are selected) */}
            {selectedClientIds.length > 0 && (
              <div className="bg-indigo-50 border border-indigo-100 rounded-xl shadow-sm p-3 flex items-center justify-between animate-in fade-in slide-in-from-bottom-2 duration-300">
                <span className="text-[13px] font-medium text-indigo-800 ml-2">
                  {selectedClientIds.length} client{selectedClientIds.length > 1 ? 's' : ''} selected
                </span>
                <div className="flex items-center gap-2">
                  <select 
                    onChange={(e) => {if(e.target.value) handleBulkStatusUpdate(e.target.value); e.target.value='';}} 
                    className="px-3 py-1.5 text-[12px] font-medium bg-white border border-indigo-200 rounded-lg text-indigo-700 hover:bg-indigo-50 focus:outline-none cursor-pointer"
                  >
                    <option value="">Set Status...</option>
                    <option value="Active">Set Active</option>
                    <option value="Inactive">Set Inactive</option>
                  </select>
                  <button onClick={handleBulkDelete} className="px-3 py-1.5 rounded-lg text-[12px] font-medium bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 transition-colors">
                    Delete Selected
                  </button>
                </div>
              </div>
            )}

            {/* PAGINATED TABLE VIEW */}
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm flex flex-col overflow-hidden">
              {loadingClients ? (
                <div className="p-12 flex justify-center">
                  <div className="w-5 h-5 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[900px]">
                      <thead>
                        <tr className="border-b border-gray-200 bg-gray-50/50">
                          <th className="pl-6 pr-2 py-3 w-10">
                            <input 
                              type="checkbox" 
                              checked={paginatedClients.length > 0 && selectedClientIds.length === paginatedClients.length}
                              onChange={handleSelectAll}
                              className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                            />
                          </th>
                          <th className="px-6 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Client Identity</th>
                          <th className="px-6 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Contact Details</th>
                          <th className="px-6 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Demographics</th>
                          <th className="px-6 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Priority</th>
                          <th className="px-6 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider text-right">Status</th>
                          <th className="px-6 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {paginatedClients.map(client => (
                          <tr key={client.id} className={`hover:bg-gray-50/50 transition-colors group ${selectedClientIds.includes(client.id) ? 'bg-indigo-50/30' : ''}`}>
                            <td className="pl-6 pr-2 py-4 align-top">
                              <input 
                                type="checkbox" 
                                checked={selectedClientIds.includes(client.id)}
                                onChange={() => handleSelectRow(client.id)}
                                className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                              />
                            </td>
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
                            <td className="px-6 py-4 align-top text-right whitespace-nowrap">
                              <button 
                                onClick={() => setViewingClient(client)}
                                className="text-[12px] font-medium text-indigo-600 hover:text-indigo-900 hover:bg-indigo-50 px-2.5 py-1 rounded transition-colors mr-1"
                              >
                                View
                              </button>
                              <button 
                                onClick={() => setEditingClient({ ...client })}
                                className="text-[12px] font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 px-2.5 py-1 rounded transition-colors mr-1"
                              >
                                Edit
                              </button>
                              <button 
                                onClick={() => handleDeleteClient(client.id)}
                                className="text-[12px] font-medium text-red-500 hover:text-red-700 hover:bg-red-50 px-2.5 py-1 rounded transition-colors"
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
                        
                        {clients.length > 0 && paginatedClients.length === 0 && (
                          <tr>
                            <td colSpan="7" className="px-6 py-12 text-center text-gray-500 text-[13px]">
                              No clients match your selected search criteria or filter configurations.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* PAGINATION FOOTER */}
                  {filteredAndSortedClients.length > 0 && (
                    <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/50 flex flex-col sm:flex-row items-center justify-between gap-4">
                      <p className="text-[12px] text-gray-500 font-medium">
                        Showing <span className="font-semibold text-gray-900">{((currentPage - 1) * itemsPerPage) + 1}</span> to <span className="font-semibold text-gray-900">{Math.min(currentPage * itemsPerPage, filteredAndSortedClients.length)}</span> of <span className="font-semibold text-gray-900">{filteredAndSortedClients.length}</span> clients
                      </p>
                      
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                          disabled={currentPage === 1}
                          className="px-3 py-1.5 border border-gray-200 bg-white rounded-md text-[12px] font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                        >
                          Previous
                        </button>
                        <span className="text-[12px] font-medium text-gray-500 px-2">
                          Page {currentPage} of {totalPages}
                        </span>
                        <button 
                          onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                          disabled={currentPage === totalPages}
                          className="px-3 py-1.5 border border-gray-200 bg-white rounded-md text-[12px] font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

      </main>

      {/* CLIENT DETAIL VIEW OVERLAY WITH TIMELINE */}
      {viewingClient && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200 p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-gray-200 w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/80 flex justify-between items-center shrink-0">
              <h3 className="text-[15px] font-semibold text-gray-900">Client Profile</h3>
              <button onClick={() => setViewingClient(null)} className="text-gray-400 hover:text-gray-600 transition-colors bg-white hover:bg-gray-100 p-1.5 rounded-md border border-transparent hover:border-gray-200">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 sm:p-8 flex flex-col lg:flex-row gap-8">
              
              {/* Left Column: Client Details */}
              <div className="w-full lg:w-1/3 shrink-0">
                <div className="flex flex-col items-center text-center mb-6">
                  <div className="w-20 h-20 bg-gradient-to-br from-indigo-50 to-indigo-100 border border-indigo-200 rounded-full flex items-center justify-center text-3xl font-semibold text-indigo-700 shadow-sm mb-4">
                    {viewingClient.name?.charAt(0).toUpperCase()}
                  </div>
                  <h2 className="text-xl font-bold text-gray-900 tracking-tight">{viewingClient.name}</h2>
                  <p className="text-[13px] text-gray-500 mt-1">{viewingClient.email}</p>
                </div>

                <div className="space-y-5 bg-gray-50/50 p-5 rounded-xl border border-gray-100">
                  <div>
                    <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Status & Priority</p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-[12px] font-medium border ${viewingClient.status === 'Active' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-white text-gray-700 border-gray-200'}`}>
                        {viewingClient.status}
                      </span>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-[12px] font-medium border ${viewingClient.relationship === 'High' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : viewingClient.relationship === 'Low' ? 'bg-orange-50 text-orange-700 border-orange-200' : 'bg-white text-gray-700 border-gray-200'}`}>
                        {viewingClient.relationship} Priority
                      </span>
                    </div>
                  </div>
                  <hr className="border-gray-200" />
                  <div>
                    <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Phone Number</p>
                    <p className="text-[13px] text-gray-900 font-medium">{viewingClient.phone_number || 'Not provided'}</p>
                  </div>
                  <hr className="border-gray-200" />
                  <div>
                    <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Location</p>
                    <p className="text-[13px] text-gray-900 font-medium">{viewingClient.country || 'Not provided'}</p>
                  </div>
                  <hr className="border-gray-200" />
                  <div>
                    <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">LinkedIn</p>
                    {viewingClient.linkedin_url ? (
                      <a href={viewingClient.linkedin_url} target="_blank" rel="noreferrer" className="text-[13px] text-indigo-600 font-medium hover:underline break-all">{viewingClient.linkedin_url}</a>
                    ) : <p className="text-[13px] text-gray-500 italic">Not provided</p>}
                  </div>
                </div>
              </div>

              {/* Right Column: Activity Timeline */}
              <div className="w-full lg:w-2/3 flex flex-col h-full border-l-0 lg:border-l border-gray-100 lg:pl-8">
                
                {/* Add New Activity Form */}
                <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm mb-6 shrink-0">
                  <h4 className="text-[13px] font-semibold text-gray-900 mb-3">Log New Activity</h4>
                  <form onSubmit={handleAddActivityLog} className="space-y-3">
                    <div className="flex gap-3">
                      <select value={activityType} onChange={e => setActivityType(e.target.value)} className="w-1/3 px-3 py-2 text-[12px] bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400 focus:bg-white transition-colors">
                        <option value="Note">Note</option>
                        <option value="Call">Call</option>
                        <option value="Email">Email</option>
                        <option value="Meeting">Meeting</option>
                      </select>
                      <input type="date" value={activityDate} onChange={e => setActivityDate(e.target.value)} className="w-2/3 px-3 py-2 text-[12px] bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400 focus:bg-white transition-colors" />
                    </div>
                    <textarea 
                      value={activityDesc} 
                      onChange={e => setActivityDesc(e.target.value)} 
                      placeholder="Describe the interaction..." 
                      className="w-full px-3 py-2 text-[13px] bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400 focus:bg-white transition-colors resize-none h-20" 
                      required
                    />
                    <div className="flex justify-end">
                      <button type="submit" className="bg-gray-900 hover:bg-gray-800 text-white text-[12px] font-medium py-2 px-4 rounded-lg shadow-sm transition-all active:scale-[0.98]">
                        Log Activity
                      </button>
                    </div>
                  </form>
                </div>

                {/* Timeline Render */}
                <div className="flex-1 overflow-y-auto pr-2">
                  <h4 className="text-[13px] font-semibold text-gray-900 mb-4">Activity Timeline</h4>
                  {!viewingClient.note_conversation ? (
                    <div className="text-center py-8 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                      <p className="text-[13px] text-gray-500">No activities logged yet.</p>
                    </div>
                  ) : (
                    <div className="relative border-l border-gray-200 ml-3 space-y-6 pb-4">
                      {viewingClient.note_conversation.split('\n').filter(line => line.trim().length > 0).map((log, idx) => {
                        // Very simple parsing of the structured string we append: "[Type] Date - Desc"
                        const match = log.match(/^\[(.*?)\] (.*?) - (.*)$/);
                        if (match) {
                          const [_, type, date, desc] = match;
                          return (
                            <div key={idx} className="relative pl-6">
                              <span className="absolute -left-[5px] top-1.5 w-2.5 h-2.5 rounded-full bg-white border-2 border-indigo-500 ring-4 ring-white" />
                              <div className="bg-white border border-gray-100 rounded-lg p-3 shadow-sm hover:shadow-md transition-shadow">
                                <div className="flex items-center justify-between mb-1.5">
                                  <span className={`text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${type==='Call'?'bg-blue-50 text-blue-700':type==='Meeting'?'bg-purple-50 text-purple-700':type==='Email'?'bg-emerald-50 text-emerald-700':'bg-gray-100 text-gray-700'}`}>{type}</span>
                                  <span className="text-[11px] text-gray-400 font-medium">{date}</span>
                                </div>
                                <p className="text-[13px] text-gray-700">{desc}</p>
                              </div>
                            </div>
                          );
                        } else {
                          // Fallback for older unstructured notes
                          return (
                            <div key={idx} className="relative pl-6">
                              <span className="absolute -left-[5px] top-1.5 w-2.5 h-2.5 rounded-full bg-white border-2 border-gray-400 ring-4 ring-white" />
                              <div className="bg-gray-50 border border-gray-100 rounded-lg p-3">
                                <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-gray-200 text-gray-700 mb-2 inline-block">Legacy Note</span>
                                <p className="text-[13px] text-gray-700">{log}</p>
                              </div>
                            </div>
                          );
                        }
                      })}
                    </div>
                  )}
                </div>

              </div>
            </div>
          </div>
        </div>
      )}

      {/* EDIT MODAL DIALOG OVERLAY */}
      {editingClient && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-xl border border-gray-200 w-full max-w-2xl max-h-[90vh] overflow-y-auto m-4 animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center sticky top-0 z-10">
              <h3 className="text-[15px] font-semibold text-gray-900">Edit Client Details</h3>
              <button onClick={() => setEditingClient(null)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            
            <form onSubmit={handleUpdateClient} className="p-6 flex flex-col gap-5">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div>
                  <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Full name <span className="text-red-500">*</span></label>
                  <input type="text" value={editingClient.name || ''} onChange={e => setEditingClient({...editingClient, name: e.target.value})} required className="w-full px-3 py-2 text-[13px] bg-white border border-gray-200 rounded-lg shadow-sm focus:outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-400 transition-colors" />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Email address <span className="text-red-500">*</span></label>
                  <input type="email" value={editingClient.email || ''} onChange={e => setEditingClient({...editingClient, email: e.target.value})} required className="w-full px-3 py-2 text-[13px] bg-white border border-gray-200 rounded-lg shadow-sm focus:outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-400 transition-colors" />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Phone number</label>
                  <input type="tel" value={editingClient.phone_number || ''} onChange={e => setEditingClient({...editingClient, phone_number: e.target.value})} className="w-full px-3 py-2 text-[13px] bg-white border border-gray-200 rounded-lg shadow-sm focus:outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-400 transition-colors" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div>
                  <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Country</label>
                  <select value={editingClient.country || ''} onChange={e => setEditingClient({...editingClient, country: e.target.value})} className="w-full px-3 py-2 text-[13px] bg-white border border-gray-200 rounded-lg shadow-sm text-gray-700 focus:outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-400 transition-colors appearance-none">
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
                  <input type="url" value={editingClient.linkedin_url || ''} onChange={e => setEditingClient({...editingClient, linkedin_url: e.target.value})} className="w-full px-3 py-2 text-[13px] bg-white border border-gray-200 rounded-lg shadow-sm focus:outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-400 transition-colors" />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Birthday</label>
                  <input type="date" value={editingClient.birthday || ''} onChange={e => setEditingClient({...editingClient, birthday: e.target.value})} className="w-full px-3 py-2 text-[13px] bg-white border border-gray-200 rounded-lg shadow-sm text-gray-700 focus:outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-400 transition-colors" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Priority level</label>
                  <select value={editingClient.relationship || 'Medium'} onChange={e => setEditingClient({...editingClient, relationship: e.target.value})} className="w-full px-3 py-2 text-[13px] bg-white border border-gray-200 rounded-lg shadow-sm text-gray-700 focus:outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-400 transition-colors appearance-none">
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Current status</label>
                  <select value={editingClient.status || 'Active'} onChange={e => setEditingClient({...editingClient, status: e.target.value})} className="w-full px-3 py-2 text-[13px] bg-white border border-gray-200 rounded-lg shadow-sm text-gray-700 focus:outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-400 transition-colors appearance-none">
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                <button type="button" onClick={() => setEditingClient(null)} className="px-4 py-2 text-[13px] font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 text-[13px] font-medium text-white bg-gray-900 border border-transparent rounded-lg hover:bg-gray-800 transition-colors shadow-sm">
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useRouter } from 'next/navigation';

// ==========================================
// REUSABLE CONFIRM DIALOG COMPONENT
// ==========================================
function ConfirmDialog({ isOpen, title, message, confirmLabel, confirmVariant = 'primary', onConfirm, onCancel, isLoading }) {
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape' && isOpen && !isLoading) onCancel();
    };
    if (isOpen) window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, isLoading, onCancel]);

  if (!isOpen) return null;

  const isPrimary = confirmVariant === 'primary';
  const isDanger = confirmVariant === 'danger';

  return (
    <div className="fixed inset-0 bg-gray-950/60 backdrop-blur-sm z-[150] flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md border border-gray-100 overflow-hidden animate-in zoom-in-95 duration-200 p-6 sm:p-8">
        <h3 className="text-[15px] font-bold text-gray-900">{title}</h3>
        <p className="text-[13px] text-gray-500 mt-2 leading-relaxed">{message}</p>
        <div className="flex gap-3 pt-6 mt-6 border-t border-gray-100">
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="flex-1 py-2.5 text-[13px] font-semibold text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className={`flex-1 py-2.5 px-4 text-[13px] font-semibold rounded-lg transition-colors shadow-sm flex items-center justify-center gap-2 ${
              isDanger
                ? 'bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 disabled:hover:bg-red-600'
                : 'bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-50 disabled:hover:bg-gray-900'
            }`}
          >
            {isLoading && (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            )}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// TOAST NOTIFICATION SYSTEM
// ==========================================
function Toast({ id, type, message, onClose }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const bgColor = type === 'success' ? 'bg-green-50 border-green-100 text-green-800' : 'bg-red-50 border-red-100 text-red-800';
  const icon = type === 'success' ? (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
    </svg>
  ) : (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
    </svg>
  );

  return (
    <div className={`fixed bottom-6 right-6 flex items-center gap-3 px-4 py-3 rounded-xl border ${bgColor} shadow-lg animate-in slide-in-from-bottom-2 fade-in z-[200]`}>
      {icon}
      <span className="text-[13px] font-medium">{message}</span>
    </div>
  );
}

// ==========================================
// MODULE-SCOPE CONSTANTS
// ==========================================
const PIPELINE_STAGES = ['New', 'Contacted', 'Engaged', 'Active', 'Inactive'];

export default function App() {
  const router = useRouter();
  
  // Navigation State
  const [appStep, setAppStep] = useState('LOADING');
  const [user, setUser] = useState(null);
  const [isNewUserSignUp, setIsNewUserSignUp] = useState(false);

  // Auth & Profile Form States
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
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
  
  // PIPELINE UPDATE: Status is now a multi-stage pipeline instead of just Active/Inactive
  const [status, setStatus] = useState('New'); 
  const [notes, setNotes] = useState('');
  
  // CRM FIELD STATES
  const [clientCountry, setClientCountry] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientConversation, setClientConversation] = useState(''); // Legacy fallback
  const [clientLinkedin, setClientLinkedin] = useState('');
  const [clientBirthday, setClientBirthday] = useState('');
  const [clientRelationship, setClientRelationship] = useState('Medium');
  const [crmErrorMessage, setCrmErrorMessage] = useState('');

  // TASK STATES
  const [tasks, setTasks] = useState([]);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDate, setNewTaskDate] = useState('');
  const [tasksFilter, setTasksFilter] = useState('pending');

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
  const [selectedClientIds, setSelectedClientIds] = useState([]);

  // KANBAN VIEW STATE
  const [viewMode, setViewMode] = useState('table'); // 'table' or 'board'

  // NOTIFICATIONS STATES
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notificationSyncLoading, setNotificationSyncLoading] = useState(false);
  const [notificationSyncMessage, setNotificationSyncMessage] = useState('');

  // GLOBAL SEARCH STATES
  const [showGlobalSearch, setShowGlobalSearch] = useState(false);
  const [globalSearchTerm, setGlobalSearchTerm] = useState('');
  const [globalSearchResults, setGlobalSearchResults] = useState({ clients: [], activities: [] });

  // CUSTOM FIELDS STATES
  const [customFieldDefs, setCustomFieldDefs] = useState([]);
  const [customFieldValues, setCustomFieldValues] = useState([]); // Array of all values from DB
  const [newCfName, setNewCfName] = useState('');
  const [newCfType, setNewCfType] = useState('text');
  const [newCfOptions, setNewCfOptions] = useState(''); // comma separated
  const [formCustomValues, setFormCustomValues] = useState({}); // For Add/Edit client forms

  // ACTIVITY LOG STATES (Detail View)
  const [activities, setActivities] = useState([]); // New structured activities
  const [activityType, setActivityType] = useState('Note');
  const [activityDesc, setActivityDesc] = useState('');
  const [activityDate, setActivityDate] = useState(new Date().toISOString().split('T')[0]);
  const [activityOutcome, setActivityOutcome] = useState('Neutral');
  
  const [activityFilterType, setActivityFilterType] = useState('All');
  const [editingActivityId, setEditingActivityId] = useState(null);
  const [editingActivityDesc, setEditingActivityDesc] = useState('');

  // USER MANAGEMENT & SETTINGS STATES
  const [profile, setProfile] = useState({ username: '', phone_number: '', country: '', linkedin_profile: '' });
  const [settingsMessage, setSettingsMessage] = useState({ type: '', text: '' });
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);
  
  // DANGER ZONE STATES
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteAccountEmail, setDeleteAccountEmail] = useState('');

  // CONFIRM DIALOG & TOAST STATES
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, title: '', message: '', confirmLabel: '', confirmVariant: 'primary', isLoading: false, onConfirm: null });
  const [toasts, setToasts] = useState([]);

  // HELPER: Show Toast Notification
  function showToast(message, type = 'success') {
    const id = Date.now();
    setToasts(prev => [...prev, { id, type, message }]);
  }

  // HELPER: Show Confirm Dialog
  function showConfirm(title, message, confirmLabel, confirmVariant = 'primary', onConfirmCallback) {
    setConfirmDialog({
      isOpen: true,
      title,
      message,
      confirmLabel,
      confirmVariant,
      isLoading: false,
      onConfirm: onConfirmCallback
    });
  }

  // HELPER: Close Confirm Dialog
  function closeConfirm() {
    setConfirmDialog(prev => ({ ...prev, isOpen: false }));
  }

  // HELPER: Handle Confirm Dialog Confirm Button
  function handleConfirmDialogConfirm() {
    if (confirmDialog.onConfirm) {
      const result = confirmDialog.onConfirm();
      if (result instanceof Promise) {
        setConfirmDialog(prev => ({ ...prev, isLoading: true }));
        result.finally(() => {
          setConfirmDialog(prev => ({ ...prev, isLoading: false, isOpen: false }));
        });
      } else {
        closeConfirm();
      }
    }
  }

  // STUB: Email Sending primitive
  function sendEmail(to, subject, body) {
    // TODO: Wire this up to Resend, SendGrid, or Supabase Edge Functions
    console.log(`[STUB EMAIL] To: ${to} | Subject: ${subject} | Body: ${body}`);
  }

  // ==========================================
  // INITIALIZATION & EVENT LISTENERS
  // ==========================================
  
  useEffect(() => {
    checkSession();
    // Load preferred view mode
    const savedMode = localStorage.getItem('crm_view_mode');
    if (savedMode) setViewMode(savedMode);

    // Global Search CMD+K Shortcut
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowGlobalSearch(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Global Search Debounce
  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      if (globalSearchTerm.length > 1) {
        performGlobalSearch(globalSearchTerm);
      } else {
        setGlobalSearchResults({ clients: [], activities: [] });
      }
    }, 300);
    return () => clearTimeout(delayDebounce);
  }, [globalSearchTerm, clients, activities]);

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
    
    // Parallel fetching for performance
    await Promise.all([
      fetchClients(session.user.id),
      fetchTasks(session.user.id),
      fetchProfile(session.user.id),
      fetchCustomFields(session.user.id),
      fetchActivities(session.user.id),
      fetchNotifications(session.user.id)
    ]);
  }

  // ==========================================
  // DATA FETCHING LOGIC
  // ==========================================

  async function fetchClients(userId) {
    setLoadingClients(true);
    const { data, error } = await supabase.from('clients').select('*').eq('user_id', userId).order('created_at', { ascending: false });
    if (!error && data) setClients(data);
    setLoadingClients(false);
  }

  async function fetchTasks(userId) {
    const { data, error } = await supabase.from('tasks').select('*').eq('user_id', userId).order('due_date', { ascending: true });
    if (!error && data) setTasks(data);
  }

  async function fetchCustomFields(userId) {
    const { data: defs } = await supabase.from('custom_field_definitions').select('*').eq('user_id', userId).order('display_order', { ascending: true });
    if (defs) setCustomFieldDefs(defs);
    
    const { data: vals } = await supabase.from('custom_field_values').select('id, client_id, field_definition_id, value');
    if (vals) setCustomFieldValues(vals);
  }

  async function fetchActivities(userId) {
    const { data } = await supabase.from('activities').select('*').eq('user_id', userId).order('created_at', { ascending: false });
    if (data) setActivities(data);
  }

  async function fetchNotifications(userId) {
    const { data } = await supabase.from('notifications').select('*').eq('user_id', userId).order('created_at', { ascending: false });
    if (data) {
      setNotifications(data);
      // Notifications are now generated server-side via Edge Function (daily-notifications)
      // which runs on pg_cron schedule at 8:00 AM UTC
    }
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

  // ==========================================
  // NOTIFICATIONS — Server-side via Edge Function
  // ==========================================
  // Notifications are now generated server-side by the Supabase Edge Function
  // (daily-notifications) which runs on pg_cron schedule at 8:00 AM UTC.
  // This eliminates race conditions and ensures consistency across devices.

  async function handleMarkNotificationRead(id, referenceId, type) {
    await supabase.from('notifications').update({ read: true }).eq('id', id);
    setNotifications(notifications.map(n => n.id === id ? { ...n, read: true } : n));
    setShowNotifications(false);

    // Route logic based on type
    if (type === 'task_due') {
      setAppStep('GLOBAL_TASKS');
    } else if (type === 'birthday') {
      const client = clients.find(c => c.id === referenceId);
      if (client) {
        setViewingClient(client);
        setAppStep('CLIENTS');
      }
    }
  }

  async function handleResyncNotifications() {
    setNotificationSyncLoading(true);
    setNotificationSyncMessage('');
    
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/daily-notifications`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${user?.session?.access_token || ''}`,
            'x-notification-sync-secret': process.env.NEXT_PUBLIC_NOTIFICATION_SYNC_SECRET || 'dev-secret'
          },
          body: JSON.stringify({ action: 'manual_sync' })
        }
      );

      if (response.ok) {
        setNotificationSyncMessage('Notifications synced successfully!');
        // Refresh notifications from database
        await fetchNotifications(user.id);
        setTimeout(() => setNotificationSyncMessage(''), 3000);
      } else {
        const errorData = await response.json();
        setNotificationSyncMessage(errorData.error || 'Failed to sync notifications');
      }
    } catch (error) {
      console.error('Notification sync error:', error);
      setNotificationSyncMessage('Error syncing notifications');
    } finally {
      setNotificationSyncLoading(false);
    }
  }

  // ==========================================
  // GLOBAL SEARCH ENGINE
  // ==========================================
  
  function performGlobalSearch(term) {
    const lowerTerm = term.toLowerCase();
    
    // Search Clients
    const matchedClients = clients.filter(c => 
      (c.name || '').toLowerCase().includes(lowerTerm) || 
      (c.email || '').toLowerCase().includes(lowerTerm) ||
      (c.phone_number || '').toLowerCase().includes(lowerTerm)
    ).slice(0, 5);

    // Search Activities
    const matchedActivities = activities.filter(a => 
      (a.description || '').toLowerCase().includes(lowerTerm)
    ).slice(0, 5);

    setGlobalSearchResults({ clients: matchedClients, activities: matchedActivities });
  }

  function handleSearchSelection(type, item) {
    setShowGlobalSearch(false);
    setGlobalSearchTerm('');
    if (type === 'client') {
      setViewingClient(item);
      setAppStep('CLIENTS');
    } else if (type === 'activity') {
      const parentClient = clients.find(c => c.id === item.client_id);
      if (parentClient) {
        setViewingClient(parentClient);
        setAppStep('CLIENTS');
        // Hacky but effective: scroll to activities section after short delay
        setTimeout(() => document.getElementById('activity-timeline')?.scrollIntoView({ behavior: 'smooth' }), 300);
      }
    }
  }


  // ==========================================
  // AUTHENTICATION LOGIC
  // ==========================================
  
  async function handleLoginWithPassword(e) {
    e.preventDefault();
    setAuthLoading(true);
    setAuthMessage('');
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setAuthMessage(`Login Error: ${error.message}`);
    else if (data.session) checkSession(); // trigger bulk fetch
    setAuthLoading(false);
  }

  async function handleGoogleSignIn() {
    setAuthLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } });
    if (error) setAuthMessage(`Google Auth Error: ${error.message}`);
    setAuthLoading(false);
  }

  async function handleSignUp(e) {
    e.preventDefault();
    if (password !== confirmPassword) {
      setAuthMessage('Passwords do not match. Please try again.');
      return;
    }
    if (password.length < 6) {
      setAuthMessage('Password must be at least 6 characters.');
      return;
    }
    setAuthLoading(true);
    setAuthMessage('');
    setIsNewUserSignUp(true);
    const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin }});
    if (error) { setAuthMessage(`Sign Up Error: ${error.message}`); setAuthLoading(false); return; }
    setAuthMessage('Account configuration initiated! Check your email for the verification code.');
    setAppStep('VERIFY_OTP');
    setAuthLoading(false);
  }

  async function handleVerifyOtp(e) {
    e.preventDefault();
    setAuthLoading(true);
    setAuthMessage('');
    let { data: { session }, error } = await supabase.auth.verifyOtp({ email, token: otpToken, type: 'signup' });
    if (error) {
      const fallback = await supabase.auth.verifyOtp({ email, token: otpToken, type: 'email' });
      session = fallback.data?.session;
      error = fallback.error;
    }
    if (error) { setAuthMessage(`Verification Error: ${error.message}`); setAuthLoading(false); }
    else if (session) {
      if (isNewUserSignUp) await supabase.from('profiles').upsert([{ id: session.user.id, username, phone_number: phone, country, linkedin_profile: linkedin || null }]);
      checkSession();
      setAuthLoading(false);
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    setUser(null);
    setAppStep('LOG_IN');
  }

  async function handleForgotPassword(e) {
    e.preventDefault();
    setAuthLoading(true);
    setAuthMessage('');
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
    if (error) setAuthMessage(error.message);
    else setResetEmailSent(true);
    setAuthLoading(false);
  }

  // ==========================================
  // SYSTEM SETTINGS & CUSTOM FIELDS LOGIC
  // ==========================================

  async function handleUpdateProfile(e) {
    e.preventDefault();
    setSettingsMessage({ type: '', text: '' });
    const { error } = await supabase.from('profiles').upsert([{ id: user.id, username: profile.username, phone_number: profile.phone_number, country: profile.country, linkedin_profile: profile.linkedin_profile }]);
    if (error) setSettingsMessage({ type: 'error', text: `Error updating profile: ${error.message}` });
    else setSettingsMessage({ type: 'success', text: 'Profile information updated successfully.' });
  }

  async function handleUpdatePassword(e) {
    e.preventDefault();
    if (!currentPassword) return setSettingsMessage({ type: 'error', text: 'Please enter your current password.' });
    if (!newPassword || newPassword !== confirmNewPassword) return setSettingsMessage({ type: 'error', text: 'New passwords do not match.' });
    const { error: updateError } = await supabase.auth.updateUser({ current_password: currentPassword, password: newPassword });
    if (updateError) setSettingsMessage({ type: 'error', text: `Error updating password: ${updateError.message}` });
    else {
      setSettingsMessage({ type: 'success', text: 'Password successfully updated.' });
      setCurrentPassword(''); setNewPassword(''); setConfirmNewPassword('');
    }
  }

  async function handleDeleteAccount() {
    if (deleteAccountEmail !== user.email) return;
    setAuthLoading(true);
    const { error } = await supabase.rpc('delete_own_user');
    if (error) {
      showToast(`Error deleting account: ${error.message}`, 'error');
      setAuthLoading(false);
      return;
    }
    await supabase.auth.signOut();
    setUser(null);
    setShowDeleteModal(false);
    setAppStep('LOG_IN');
    setAuthLoading(false);
    showToast('Account and all data have been permanently deleted.', 'success');
  }

  async function handleAddCustomField(e) {
    e.preventDefault();
    if (!newCfName) return;
    let optionsJson = [];
    if (newCfType === 'select' && newCfOptions) {
      optionsJson = newCfOptions.split(',').map(s => s.trim()).filter(s => s);
    }
    const { data, error } = await supabase.from('custom_field_definitions').insert([{
      user_id: user.id, field_name: newCfName, field_type: newCfType, select_options: optionsJson, display_order: customFieldDefs.length
    }]).select();
    if (data && !error) {
      setCustomFieldDefs([...customFieldDefs, data[0]]);
      setNewCfName(''); setNewCfOptions('');
    }
  }

  function handleDeleteCustomField(id) {
    const fieldName = customFieldDefs.find(f => f.id === id)?.field_name || 'Field';
    showConfirm(
      'Delete Custom Field',
      `WARNING: Deleting the field "${fieldName}" will permanently delete all data stored in it for all clients. This action cannot be undone.`,
      'Delete Field',
      'danger',
      async () => {
        await supabase.from('custom_field_definitions').delete().eq('id', id);
        setCustomFieldDefs(customFieldDefs.filter(f => f.id !== id));
        setCustomFieldValues(customFieldValues.filter(v => v.field_definition_id !== id));
      }
    );
  }

  function runStatusMigration() {
    showConfirm(
      'Migrate Legacy Statuses',
      "This will convert old 'Active/Inactive' statuses to the new Pipeline stages ('Active' → 'Engaged', 'Inactive' → 'Inactive'). This may take a moment.",
      'Start Migration',
      'primary',
      async () => {
        const toUpdate = clients.filter(c => c.status === 'Active' || c.status === 'Inactive');
        
        let updatedCount = 0;
        for (const client of toUpdate) {
          const newStatus = client.status === 'Active' ? 'Engaged' : 'Inactive';
          const { error } = await supabase.from('clients').update({ status: newStatus }).eq('id', client.id);
          if (!error) updatedCount++;
        }
        showToast(`Successfully migrated ${updatedCount} legacy statuses.`, 'success');
        fetchClients(user.id);
      }
    );
  }


  // ==========================================
  // CRM CORE LOGIC
  // ==========================================

  async function handleAddClient(e) {
    e.preventDefault();
    if (!name || !clientEmail) return;
    setCrmErrorMessage('');

    const { data, error } = await supabase.from('clients').insert([{ 
      name, email: clientEmail, status, notes, user_id: user.id,
      country: clientCountry || null, phone_number: clientPhone || null,
      note_conversation: clientConversation || null, linkedin_url: clientLinkedin || null,
      birthday: clientBirthday || null, relationship: clientRelationship
    }]).select();

    if (!error && data) {
      const newClient = data[0];
      setClients([newClient, ...clients]);
      
      // Save Custom Fields
      const cfInserts = [];
      Object.keys(formCustomValues).forEach(defId => {
        if (formCustomValues[defId]) {
          cfInserts.push({ client_id: newClient.id, field_definition_id: defId, value: formCustomValues[defId] });
        }
      });
      if (cfInserts.length > 0) {
        const { data: cfData } = await supabase.from('custom_field_values').insert(cfInserts).select();
        if (cfData) setCustomFieldValues([...customFieldValues, ...cfData]);
      }

      // Reset form
      setName(''); setClientEmail(''); setNotes(''); setStatus('New');
      setClientCountry(''); setClientPhone(''); setClientConversation('');
      setClientLinkedin(''); setClientBirthday(''); setClientRelationship('Medium');
      setFormCustomValues({});
    } else if (error) {
      setCrmErrorMessage(`Database Sync Error: ${error.message}`);
    }
  }

  async function handleUpdateClient(e) {
    e.preventDefault();
    if (!editingClient.name || !editingClient.email) return;
    setCrmErrorMessage('');
  
    const { data, error } = await supabase.from('clients').update({
      name: editingClient.name, email: editingClient.email, status: editingClient.status,
      country: editingClient.country || null, phone_number: editingClient.phone_number || null,
      note_conversation: editingClient.note_conversation || null, linkedin_url: editingClient.linkedin_url || null,
      birthday: editingClient.birthday || null, relationship: editingClient.relationship
    }).eq('id', editingClient.id).select();

    // Update custom fields via upsert emulation
    for (const defId of Object.keys(formCustomValues)) {
      const val = formCustomValues[defId];
      const existing = customFieldValues.find(v => v.client_id === editingClient.id && v.field_definition_id === defId);
      if (existing) {
        if (val) {
          const { data: ud } = await supabase.from('custom_field_values').update({ value: val }).eq('id', existing.id).select();
          if (ud) setCustomFieldValues(prev => prev.map(v => v.id === existing.id ? ud[0] : v));
        } else {
          await supabase.from('custom_field_values').delete().eq('id', existing.id);
          setCustomFieldValues(prev => prev.filter(v => v.id !== existing.id));
        }
      } else if (val) {
        const { data: ind } = await supabase.from('custom_field_values').insert([{ client_id: editingClient.id, field_definition_id: defId, value: val }]).select();
        if (ind) setCustomFieldValues([...customFieldValues, ind[0]]);
      }
    }
  
    if (!error && data && data.length > 0) {
      setClients(clients.map(client => client.id === editingClient.id ? data[0] : client));
      setEditingClient(null);
    } else if (error) {
      setCrmErrorMessage(`Database Update Error: ${error.message}`);
    } else {
      setClients(clients.map(client => client.id === editingClient.id ? { ...client, ...editingClient } : client));
      setEditingClient(null);
    }
  }

  function handleDeleteClient(clientId) {
    const clientName = clients.find(c => c.id === clientId)?.name || 'Client';
    showConfirm(
      'Delete Client',
      `Are you sure you want to delete "${clientName}"? This action cannot be undone.`,
      'Delete',
      'danger',
      async () => {
        const { error } = await supabase.from('clients').delete().eq('id', clientId);
        if (!error) {
          setClients(clients.filter(client => client.id !== clientId));
          setSelectedClientIds(prev => prev.filter(id => id !== clientId));
        }
      }
    );
  }

  // ==========================================
  // KANBAN DRAG AND DROP HANDLERS
  // ==========================================
  
  const handleDragStart = (e, clientId) => {
    e.dataTransfer.setData("text/plain", clientId.toString());
  };

  const handleDragOver = (e) => {
    e.preventDefault(); // CRITICAL: allows the drop event to fire
  };

  const handleDrop = async (e, targetStatus) => {
    e.preventDefault();
    
    const clientIdStr = e.dataTransfer.getData("text/plain");
    if (!clientIdStr) return;
    
    // Convert string ID back to BigInt for safe database updating
    const clientId = parseInt(clientIdStr, 10);

    // Optimistic UI Update
    const originalClients = [...clients];
    setClients(prevClients => 
      prevClients.map(client => 
        client.id === clientId ? { ...client, status: targetStatus } : client
      )
    );

    if (viewingClient && viewingClient.id === clientId) {
      setViewingClient(prev => ({ ...prev, status: targetStatus }));
    }

    const { error } = await supabase
      .from('clients')
      .update({ status: targetStatus })
      .eq('id', clientId);

    if (error) {
      console.error("Error updating status via drag and drop:", error);
      alert(`Failed to save status: ${error.message}`);
      setClients(originalClients); // Rollback on failure
    }
  };


  // ==========================================
  // ADVANCED ACTIVITY LOG LOGIC
  // ==========================================

  async function handleAddActivityLog(e) {
    e.preventDefault();
    if (!activityDesc.trim() || !viewingClient) return;

    // Use the activities table as configured via Option B
    const { data, error } = await supabase.from('activities').insert([{
      client_id: viewingClient.id,
      user_id: user.id,
      activity_type: activityType,
      activity_date: activityDate,
      description: activityDesc
    }]).select();

    if (!error && data) {
      setActivities([data[0], ...activities]);
      setActivityDesc('');
      setActivityOutcome('Neutral');
      setActivityDate(new Date().toISOString().split('T')[0]);
    } else {
      showToast(`Error logging activity: ${error?.message}`, 'error');
    }
  }

  function handleDeleteActivity(id) {
    showConfirm(
      'Delete Activity Entry',
      'Are you sure you want to permanently delete this activity entry? This cannot be undone.',
      'Delete',
      'danger',
      async () => {
        const { error } = await supabase.from('activities').delete().eq('id', id);
        if (!error) {
          setActivities(activities.filter(a => a.id !== id));
        }
      }
    );
  }

  async function handleUpdateActivity(e) {
    e.preventDefault();
    const { data, error } = await supabase.from('activities').update({ description: editingActivityDesc }).eq('id', editingActivityId).select();
    if (!error && data) {
      setActivities(activities.map(a => a.id === editingActivityId ? data[0] : a));
      setEditingActivityId(null);
      setEditingActivityDesc('');
    }
  }

  // ==========================================
  // TASK ACTIONS LOGIC
  // ==========================================

  async function handleCreateTask(e, clientId) {
    e.preventDefault();
    if (!newTaskTitle || !newTaskDate) return;
    
    const { data, error } = await supabase.from('tasks').insert([{ client_id: clientId, user_id: user.id, title: newTaskTitle, due_date: newTaskDate, status: 'pending' }]).select();
    if (!error && data) {
      setTasks([...tasks, data[0]]);
      setNewTaskTitle('');
      setNewTaskDate('');
    } else {
      showToast(`Error creating task: ${error?.message}`, 'error');
    }
  }

  async function handleToggleTask(taskId, currentStatus) {
    const newStatus = currentStatus === 'pending' ? 'done' : 'pending';
    const { error } = await supabase.from('tasks').update({ status: newStatus }).eq('id', taskId);
    if (!error) setTasks(tasks.map(t => t.id === taskId ? { ...t, status: newStatus } : t));
  }

  // ==========================================
  // BULK ACTIONS LOGIC
  // ==========================================
  
  const handleSelectAll = (e, targetClients) => {
    if (e.target.checked) setSelectedClientIds(targetClients.map(c => c.id));
    else setSelectedClientIds([]);
  };

  const handleSelectRow = (id) => {
    if (selectedClientIds.includes(id)) setSelectedClientIds(selectedClientIds.filter(selectedId => selectedId !== id));
    else setSelectedClientIds([...selectedClientIds, id]);
  };

  const handleBulkDelete = () => {
    showConfirm(
      'Delete Multiple Clients',
      `You are about to delete ${selectedClientIds.length} client(s). This action cannot be undone.`,
      'Delete All',
      'danger',
      async () => {
        const { error } = await supabase.from('clients').delete().in('id', selectedClientIds);
        if (!error) {
          setClients(clients.filter(c => !selectedClientIds.includes(c.id)));
          setSelectedClientIds([]);
        } else {
          showToast(`Bulk Delete Error: ${error.message}`, 'error');
        }
      }
    );
  };

  const handleBulkStatusUpdate = async (newStatus) => {
    const { error } = await supabase.from('clients').update({ status: newStatus }).in('id', selectedClientIds);
    if (!error) {
      setClients(clients.map(c => selectedClientIds.includes(c.id) ? { ...c, status: newStatus } : c));
      setSelectedClientIds([]);
    } else {
      showToast(`Bulk Status Error: ${error.message}`, 'error');
    }
  };

  // ==========================================
  // CSV IMPORT / EXPORT LOGIC
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
    const link = document.createElement('a'); link.href = url; link.setAttribute('download', 'crm_clients_export.csv');
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  const handleImportCSV = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target.result;
      const rows = text.split('\n').filter(row => row.trim().length > 0);
      if (rows.length < 2) {
        showToast('CSV file must contain headers and at least one row of data.', 'error');
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
            status: 'New',
            relationship: 'Medium'
          });
        }
      }
      if (newClients.length > 0) {
        const { data, error } = await supabase.from('clients').insert(newClients).select();
        if (data && !error) {
          setClients([...data, ...clients]);
          showToast(`Successfully imported ${data.length} clients!`, 'success');
        } else {
          showToast(`Import error: ${error?.message}`, 'error');
        }
      }
    };
    reader.readAsText(file);
    e.target.value = null;
  };


  // ==========================================
  // COMPUTED DATA ENGINE
  // ==========================================
  
  const filteredAndSortedClients = useMemo(() => (clients || [])
    .filter(Boolean)
    .filter(client => {
      if (!client || typeof client !== 'object') return false;
      const matchesSearch = (client.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || (client.email || '').toLowerCase().includes(searchTerm.toLowerCase()) || (client.country || '').toLowerCase().includes(searchTerm.toLowerCase()); 
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
    }), [clients, searchTerm, filterPriority, filterStatus, sortBy]);

  const totalPages = useMemo(() => Math.ceil(filteredAndSortedClients.length / itemsPerPage) || 1, [filteredAndSortedClients, itemsPerPage]);
  const paginatedClients = useMemo(() => filteredAndSortedClients.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage), [filteredAndSortedClients, currentPage, itemsPerPage]);

  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  const upcomingBirthdays = useMemo(() => clients.filter(c => {
    if (!c.birthday) return false;
    const bdate = new Date(c.birthday);
    const today = new Date();
    bdate.setFullYear(today.getFullYear());
    if (bdate < today && bdate.toDateString() !== today.toDateString()) bdate.setFullYear(today.getFullYear() + 1);
    const diffTime = bdate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays >= 0 && diffDays <= 30;
  }).sort((a, b) => {
    const getNextOcc = (d) => {
      const dt = new Date(d);
      const today = new Date();
      dt.setFullYear(today.getFullYear());
      if (dt < today && dt.toDateString() !== today.toDateString()) dt.setFullYear(today.getFullYear() + 1);
      return dt;
    };
    return getNextOcc(a.birthday) - getNextOcc(b.birthday);
  }), [clients]);

  const recentActivity = useMemo(() => [...clients].filter(Boolean).sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 4), [clients]);

  const staleClients = useMemo(() => {
    const today = new Date();
    return clients.map(client => {
      const clientActivities = activities.filter(a => a.client_id === client.id);
      let lastDate = new Date(client.created_at);
      if (clientActivities.length > 0) {
        lastDate = new Date(Math.max(...clientActivities.map(a => new Date(a.created_at))));
      }
      const daysStale = Math.ceil((today - lastDate) / (1000 * 60 * 60 * 24));
      return { ...client, daysStale };
    }).filter(c => c.daysStale > 30).sort((a, b) => b.daysStale - a.daysStale).slice(0, 5);
  }, [clients, activities]);

  const chartData = useMemo(() => [...Array(7)].map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const ds = d.toISOString().split('T')[0];
    const count = activities.filter(a => a.activity_date === ds).length;
    return { date: ds, label: d.toLocaleDateString(undefined, { weekday: 'short' }), count };
  }), [activities]);
  const maxChartVal = Math.max(...chartData.map(d => d.count), 1); 

  // REUSABLE ICONS
  const EyeIcon = () => (<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>);
  const EyeSlashIcon = () => (<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" /></svg>);
  const BellIcon = () => (<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0018 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" /></svg>);
  const SearchIcon = () => (<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" /></svg>);

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
      
      {/* GLOBAL SEARCH COMMAND PALETTE */}
      {showGlobalSearch && (
        <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm z-[100] flex justify-center pt-[10vh] px-4 animate-in fade-in" onClick={() => setShowGlobalSearch(false)}>
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh] border border-gray-100" onClick={e => e.stopPropagation()}>
            <div className="flex items-center px-4 py-3 border-b border-gray-100 bg-gray-50/50">
              <SearchIcon className="text-gray-400" />
              <input type="text" autoFocus placeholder="Search clients, emails, activity notes... (Cmd+K)" value={globalSearchTerm} onChange={e => setGlobalSearchTerm(e.target.value)} className="w-full bg-transparent border-none focus:ring-0 px-3 py-1 text-[15px] outline-none placeholder-gray-400" />
              <button onClick={() => setShowGlobalSearch(false)} className="text-[10px] font-bold text-gray-400 bg-gray-200 px-2 py-1 rounded hover:bg-gray-300">ESC</button>
            </div>
            
            <div className="overflow-y-auto flex-1 p-2">
              {globalSearchTerm.length < 2 ? (
                <p className="text-[13px] text-gray-400 p-4 text-center">Type at least 2 characters to search.</p>
              ) : (
                <div className="space-y-4 p-2">
                  {/* CLIENT MATCHES */}
                  {globalSearchResults.clients.length > 0 && (
                    <div>
                      <h4 className="text-[11px] font-bold uppercase tracking-wider text-gray-400 px-3 mb-2">Clients</h4>
                      {globalSearchResults.clients.map(c => (
                        <button key={c.id} onClick={() => handleSearchSelection('client', c)} className="w-full flex items-center justify-between p-3 hover:bg-gray-50 rounded-xl transition-colors text-left group">
                          <div>
                            <p className="text-[14px] font-semibold text-gray-900">{c.name}</p>
                            <p className="text-[12px] text-gray-500">{c.email} {c.phone_number ? `• ${c.phone_number}` : ''}</p>
                          </div>
                          <span className="text-[12px] text-gray-400 group-hover:text-gray-900 transition-colors">View Profile &rarr;</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* ACTIVITY MATCHES */}
                  {globalSearchResults.activities.length > 0 && (
                    <div>
                      <h4 className="text-[11px] font-bold uppercase tracking-wider text-gray-400 px-3 mb-2 mt-4">Activity Notes</h4>
                      {globalSearchResults.activities.map(a => {
                        const parentClient = clients.find(c => c.id === a.client_id);
                        return (
                          <button key={a.id} onClick={() => handleSearchSelection('activity', a)} className="w-full flex flex-col p-3 hover:bg-gray-50 rounded-xl transition-colors text-left group gap-1">
                            <div className="flex justify-between w-full items-center">
                              <span className="text-[12px] font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">{parentClient?.name || 'Unknown Client'}</span>
                              <span className="text-[11px] text-gray-400">{a.activity_date}</span>
                            </div>
                            <p className="text-[13px] text-gray-800 line-clamp-2 leading-snug">{a.description}</p>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {globalSearchResults.clients.length === 0 && globalSearchResults.activities.length === 0 && (
                    <p className="text-[13px] text-gray-400 p-4 text-center">No results found for "{globalSearchTerm}"</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      
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
                <div className="hidden md:flex items-center gap-1">
                  <button onClick={() => setAppStep('DASHBOARD')} className={`px-3 py-1.5 rounded-md text-[13px] font-medium transition-all ${appStep === 'DASHBOARD' ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'}`}>Dashboard</button>
                  <button onClick={() => setAppStep('CLIENTS')} className={`px-3 py-1.5 rounded-md text-[13px] font-medium transition-all ${appStep === 'CLIENTS' ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'}`}>Clients Pipeline</button>
                  <button onClick={() => setAppStep('GLOBAL_TASKS')} className={`px-3 py-1.5 rounded-md text-[13px] font-medium transition-all ${appStep === 'GLOBAL_TASKS' ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'}`}>Tasks</button>
                  <button onClick={() => setAppStep('SETTINGS')} className={`px-3 py-1.5 rounded-md text-[13px] font-medium transition-all ${appStep === 'SETTINGS' ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'}`}>Settings</button>
                </div>
              )}
            </div>
            
            {user ? (
              <div className="flex items-center gap-4">
                {/* Search Trigger */}
                <button onClick={() => setShowGlobalSearch(true)} className="text-gray-500 hover:text-gray-900 p-1 rounded-full transition-colors hidden sm:flex items-center gap-2 group" title="Search (Cmd+K)">
                  <SearchIcon />
                  <span className="text-[11px] font-medium border border-gray-200 px-1.5 py-0.5 rounded text-gray-400 group-hover:bg-gray-100 transition-colors">⌘K</span>
                </button>

                {/* Notifications Bell */}
                <div className="relative">
                  <button onClick={() => setShowNotifications(!showNotifications)} className="text-gray-500 hover:text-gray-900 p-1 relative transition-colors">
                    <BellIcon />
                    {notifications.filter(n => !n.read).length > 0 && (
                      <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white"></span>
                    )}
                  </button>

                  {/* Notifications Dropdown */}
                  {showNotifications && (
                    <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden z-50">
                      <div className="p-3 bg-gray-50/80 border-b border-gray-100 flex justify-between items-center">
                        <span className="text-[13px] font-bold text-gray-900">Notifications</span>
                        {notifications.filter(n => !n.read).length > 0 && (
                          <button onClick={() => notifications.forEach(n => !n.read && handleMarkNotificationRead(n.id, n.reference_id, n.type))} className="text-[11px] text-blue-600 font-medium hover:underline">Mark all read</button>
                        )}
                      </div>
                      <div className="max-h-80 overflow-y-auto">
                        {notifications.length === 0 ? (
                          <p className="text-[13px] text-gray-400 p-6 text-center">No notifications yet.</p>
                        ) : (
                          notifications.slice(0, 10).map(n => (
                            <div key={n.id} onClick={() => handleMarkNotificationRead(n.id, n.reference_id, n.type)} className={`p-3 border-b border-gray-50 last:border-0 cursor-pointer transition-colors ${n.read ? 'bg-white opacity-60' : 'bg-blue-50/30 hover:bg-blue-50/50'}`}>
                              <p className="text-[12px] font-medium text-gray-900 leading-snug">{n.message}</p>
                              <p className="text-[10px] text-gray-400 mt-1">{new Date(n.created_at).toLocaleDateString()}</p>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>

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

      {/* GLOBAL FLOATING ACTION BUTTON */}
      {user && (appStep === 'DASHBOARD' || appStep === 'CLIENTS') && (
        <button 
          onClick={() => { 
            if (appStep === 'DASHBOARD') {
              setAppStep('CLIENTS'); 
              setTimeout(() => document.getElementById('add-client-form')?.scrollIntoView({behavior: 'smooth'}), 100);
            } else {
              // Already on CLIENTS, just scroll to form
              setTimeout(() => document.getElementById('add-client-form')?.scrollIntoView({behavior: 'smooth'}), 100);
            }
          }}
          className="fixed bottom-8 right-8 z-50 bg-gray-900 text-white p-4 rounded-full shadow-xl hover:bg-gray-800 hover:scale-105 transition-all active:scale-95 group flex items-center justify-center"
          title="Add New Client"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
        </button>
      )}

      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        
        {/* VIEW: LOG IN */}
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

              <button onClick={handleGoogleSignIn} type="button" className="w-full flex items-center justify-center gap-3 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 text-[13px] font-medium py-2.5 px-4 rounded-lg shadow-sm transition-all active:scale-[0.98] mb-4">
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
                      {showLoginPassword ? <EyeSlashIcon /> : <EyeIcon />}
                    </button>
                  </div>
                </div>
                <button type="submit" disabled={authLoading} className="w-full py-2.5 px-4 text-[13px] font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 shadow-sm transition-all active:scale-[0.98] mt-2 flex justify-center items-center">
                  {authLoading ? 'Signing in...' : 'Sign In'}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* VIEW: SIGN UP */}
        {appStep === 'SIGN_UP' && (
          <div className="max-w-[400px] mx-auto mt-10 sm:mt-20">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 sm:p-10">
              <h2 className="text-xl font-semibold text-gray-900 mb-1">Create an account</h2>
              <p className="text-[13px] text-gray-500 mb-6">Enter your details below to get started.</p>

              {authMessage && (
                <div className="mb-6 p-3 rounded-lg text-[13px] font-medium bg-red-50 text-red-700 border border-red-100 flex items-start gap-2">
                  <svg className="w-4 h-4 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" /></svg>
                  {authMessage}
                </div>
              )}

              <form onSubmit={handleSignUp} className="space-y-4">
                <div>
                  <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Email address</label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="name@company.com" className="w-full px-3 py-2 text-[13px] bg-white border border-gray-200 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-400 transition-colors" />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Password</label>
                  <div className="relative">
                    <input type={showSignupPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="••••••••" className="w-full px-3 py-2 pr-10 text-[13px] bg-white border border-gray-200 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-400 transition-colors" />
                    <button type="button" onClick={() => setShowSignupPassword(!showSignupPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none p-1 rounded">
                      {showSignupPassword ? <EyeSlashIcon /> : <EyeIcon />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Confirm Password</label>
                  <div className="relative">
                    <input type={showConfirmPassword ? 'text' : 'password'} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required placeholder="••••••••" className="w-full px-3 py-2 pr-10 text-[13px] bg-white border border-gray-200 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-400 transition-colors" />
                    <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none p-1 rounded">
                      {showConfirmPassword ? <EyeSlashIcon /> : <EyeIcon />}
                    </button>
                  </div>
                  {confirmPassword.length > 0 && password !== confirmPassword && (
                    <p className="text-[11px] text-red-500 mt-1">Passwords do not match</p>
                  )}
                </div>
                <button type="submit" disabled={authLoading || (confirmPassword.length > 0 && password !== confirmPassword)} className="w-full py-2.5 px-4 text-[13px] font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 shadow-sm transition-all active:scale-[0.98] mt-2 flex justify-center items-center disabled:opacity-50 disabled:hover:bg-gray-900">
                  {authLoading ? 'Creating Account...' : 'Sign Up'}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* VIEW: VERIFY OTP */}
        {appStep === 'VERIFY_OTP' && (
          <div className="max-w-[400px] mx-auto mt-10 sm:mt-20">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 sm:p-10">
              <h2 className="text-xl font-semibold text-gray-900 mb-1">Check your email</h2>
              <p className="text-[13px] text-gray-500 mb-6">We sent a verification code to {email}.</p>
              
              {authMessage && !authMessage.includes('initiated') && (
                <div className="mb-6 p-3 rounded-lg text-[13px] font-medium bg-red-50 text-red-700 border border-red-100 flex items-start gap-2">
                  {authMessage}
                </div>
              )}

              <form onSubmit={handleVerifyOtp} className="space-y-4">
                <div>
                  <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Verification Code</label>
                  <input type="text" value={otpToken} onChange={(e) => setOtpToken(e.target.value)} required placeholder="123456" className="w-full px-3 py-2 text-[13px] bg-white border border-gray-200 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-400 transition-colors tracking-widest text-center" />
                </div>
                <button type="submit" disabled={authLoading} className="w-full py-2.5 px-4 text-[13px] font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 shadow-sm transition-all active:scale-[0.98] mt-2 flex justify-center items-center">
                  {authLoading ? 'Verifying...' : 'Verify Email'}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* VIEW: FORGOT PASSWORD */}
        {appStep === 'FORGOT_PASSWORD' && (
          <div className="max-w-[400px] mx-auto mt-10 sm:mt-20">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 sm:p-10">
              <h2 className="text-xl font-semibold text-gray-900 mb-1">Reset Password</h2>
              <p className="text-[13px] text-gray-500 mb-6">Enter your email and we'll send you a reset link.</p>
              
              {resetEmailSent ? (
                <div className="p-4 rounded-lg bg-green-50 border border-green-100 text-green-800 text-[13px] font-medium text-center">
                  Check your email for the password reset link!
                </div>
              ) : (
                <form onSubmit={handleForgotPassword} className="space-y-4">
                  {authMessage && (
                    <div className="p-3 rounded-lg text-[13px] font-medium bg-red-50 text-red-700 border border-red-100">
                      {authMessage}
                    </div>
                  )}
                  <div>
                    <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Email address</label>
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="name@company.com" className="w-full px-3 py-2 text-[13px] bg-white border border-gray-200 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-400 transition-colors" />
                  </div>
                  <button type="submit" disabled={authLoading} className="w-full py-2.5 px-4 text-[13px] font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 shadow-sm transition-all active:scale-[0.98] mt-2 flex justify-center items-center">
                    {authLoading ? 'Sending...' : 'Send Reset Link'}
                  </button>
                </form>
              )}
            </div>
          </div>
        )}

        {/* VIEW: DASHBOARD */}
        {appStep === 'DASHBOARD' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-gray-900 mb-1">Overview</h1>
              <p className="text-[13px] text-gray-500">Monitor your workspace activity and client directory.</p>
            </div>

            {/* DASHBOARD TOP ROW: Charts and Tasks */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Activity Chart */}
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 lg:col-span-1 flex flex-col">
                <h3 className="text-[14px] font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-indigo-500"></span> Activity This Week
                </h3>
                <div className="flex-1 flex items-end gap-2 h-32 mt-auto pb-2">
                  {chartData.map(d => (
                    <div key={d.date} className="flex-1 flex flex-col items-center gap-2 group relative">
                      <div className="w-full bg-indigo-100 rounded-sm relative overflow-hidden" style={{ height: '100px' }}>
                        <div className="absolute bottom-0 w-full bg-indigo-500 transition-all duration-500" style={{ height: `${(d.count / maxChartVal) * 100}%` }}></div>
                      </div>
                      <span className="text-[10px] text-gray-400">{d.label}</span>
                      {/* Tooltip */}
                      <div className="absolute -top-8 bg-gray-900 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                        {d.count}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Tasks Widgets */}
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-[14px] font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-red-500"></span> Overdue Tasks
                  </h3>
                  <div className="space-y-3">
                    {tasks.filter(t => t.status === 'pending' && new Date(t.due_date) < new Date(todayStr)).length === 0 && <p className="text-[13px] text-gray-500">No overdue tasks!</p>}
                    {tasks.filter(t => t.status === 'pending' && new Date(t.due_date) < new Date(todayStr)).slice(0,4).map(task => (
                      <div key={task.id} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0">
                        <div>
                          <p className="text-[13px] font-medium text-red-600 truncate max-w-[150px]">{task.title}</p>
                          <p className="text-[11px] text-gray-500">Due: {task.due_date}</p>
                        </div>
                        <button onClick={() => { setViewingClient(clients.find(c => c.id === task.client_id)); setAppStep('CLIENTS'); }} className="text-[12px] text-gray-900 font-medium hover:underline shrink-0">View Client</button>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="text-[14px] font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-500"></span> Due Today
                  </h3>
                  <div className="space-y-3">
                    {tasks.filter(t => t.status === 'pending' && t.due_date === todayStr).length === 0 && <p className="text-[13px] text-gray-500">Nothing due today!</p>}
                    {tasks.filter(t => t.status === 'pending' && t.due_date === todayStr).slice(0,4).map(task => (
                      <div key={task.id} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0">
                        <p className="text-[13px] font-medium text-gray-900 truncate max-w-[150px]">{task.title}</p>
                        <button onClick={() => { setViewingClient(clients.find(c => c.id === task.client_id)); setAppStep('CLIENTS'); }} className="text-[12px] text-gray-900 font-medium hover:underline shrink-0">View Client</button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-white p-5 rounded-2xl border border-gray-200/80 shadow-sm">
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Total records</p>
                <p className="text-2xl font-bold tracking-tight text-gray-900 mt-1">{clients.length}</p>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-gray-200/80 shadow-sm">
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">High Priority</p>
                <p className="text-2xl font-bold tracking-tight text-gray-900 mt-1">{clients.filter(c => c.relationship === 'High').length}</p>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-gray-200/80 shadow-sm">
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Active Stage</p>
                <p className="text-2xl font-bold tracking-tight text-gray-900 mt-1">{clients.filter(c => c.status === 'Active').length}</p>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-gray-200/80 shadow-sm">
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">New Stage</p>
                <p className="text-2xl font-bold tracking-tight text-gray-900 mt-1">{clients.filter(c => c.status === 'New').length}</p>
              </div>
            </div>

            {/* DASHBOARD BOTTOM ROW: Lists */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              {/* Birthdays */}
              <div className="bg-white p-6 rounded-2xl border border-gray-200/80 shadow-sm space-y-4 flex flex-col">
                <h3 className="font-bold text-[14px] text-gray-900 flex items-center gap-1.5">
                  <span>🎂</span> Birthdays (Next 30 Days)
                </h3>
                <div className="space-y-2.5 overflow-y-auto flex-1">
                  {upcomingBirthdays.length === 0 ? (
                    <p className="text-[13px] text-gray-400 py-2">No student birthdays in the next 30 days.</p>
                  ) : (
                    upcomingBirthdays.map(c => (
                      <button key={c.id} onClick={() => {setViewingClient(c); setAppStep('CLIENTS');}} className="w-full flex justify-between items-center p-2.5 rounded-lg border border-gray-100 bg-gray-50/40 hover:bg-gray-100 transition-colors text-left group">
                        <span className="font-medium text-[13px] text-gray-800 group-hover:text-gray-900">{c.name}</span>
                        <span className="text-gray-500 font-medium text-[12px]">{new Date(c.birthday).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</span>
                      </button>
                    ))
                  )}
                </div>
              </div>

              {/* Recent Activity */}
              <div className="bg-white p-6 rounded-2xl border border-gray-200/80 shadow-sm space-y-4 flex flex-col">
                <h3 className="font-bold text-[14px] text-gray-900 flex items-center gap-1.5">
                  <span>⚡</span> Recently Added Profiles
                </h3>
                <div className="space-y-2.5 flex-1">
                  {recentActivity.length === 0 ? (
                    <p className="text-[13px] text-gray-400 py-2">No entries logged yet.</p>
                  ) : (
                    recentActivity.map(c => (
                      <button key={c.id} onClick={() => {setViewingClient(c); setAppStep('CLIENTS');}} className="w-full flex items-center justify-between p-2.5 rounded-lg border border-gray-100 bg-gray-50/40 hover:bg-gray-100 transition-colors text-left group">
                        <div>
                          <p className="text-[13px] font-medium text-gray-800 group-hover:text-gray-900">{c.name}</p>
                          <p className="text-[11px] text-gray-400">{c.email}</p>
                        </div>
                        <span className="text-[11px] bg-white border px-2 py-0.5 rounded-full text-gray-500">
                          {c.created_at ? new Date(c.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'N/A'}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              </div>

              {/* Stale Clients */}
              <div className="bg-white p-6 rounded-2xl border border-gray-200/80 shadow-sm space-y-4 flex flex-col">
                <h3 className="font-bold text-[14px] text-gray-900 flex items-center gap-1.5">
                  <span>❄️</span> Stale Clients (&gt;30 Days)
                </h3>
                <div className="space-y-2.5 flex-1">
                  {staleClients.length === 0 ? (
                    <p className="text-[13px] text-gray-400 py-2">All active clients have recent activity. Great job!</p>
                  ) : (
                    staleClients.map(c => (
                      <button key={c.id} onClick={() => {setViewingClient(c); setAppStep('CLIENTS');}} className="w-full flex items-center justify-between p-2.5 rounded-lg border border-red-50 bg-red-50/40 hover:bg-red-50 transition-colors text-left group">
                        <div>
                          <p className="text-[13px] font-medium text-gray-800 group-hover:text-gray-900">{c.name}</p>
                          <p className="text-[11px] text-gray-500">Stale for {c.daysStale} days</p>
                        </div>
                        <span className="text-[12px] text-red-600 font-medium">&rarr; Log</span>
                      </button>
                    ))
                  )}
                </div>
              </div>

            </div>
          </div>
        )}

        {/* VIEW: CLIENTS */}
        {appStep === 'CLIENTS' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-gray-900 mb-1">CRM Pipeline</h1>
                <p className="text-[13px] text-gray-500">Manage client data, pipeline stages, custom fields, and records.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {/* Kanban Toggle */}
                <div className="bg-gray-200/50 p-1 rounded-lg flex items-center gap-1 mr-2">
                  <button onClick={() => { setViewMode('table'); localStorage.setItem('crm_view_mode', 'table'); }} className={`px-3 py-1.5 text-[12px] font-medium rounded-md transition-all ${viewMode === 'table' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Table</button>
                  <button onClick={() => { setViewMode('board'); localStorage.setItem('crm_view_mode', 'board'); }} className={`px-3 py-1.5 text-[12px] font-medium rounded-md transition-all ${viewMode === 'board' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Board</button>
                </div>

                <input type="file" ref={fileInputRef} accept=".csv" onChange={handleImportCSV} className="hidden" />
                <button onClick={() => fileInputRef.current?.click()} className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-[12px] font-medium text-gray-700 hover:bg-gray-50 transition-colors shadow-sm">Import CSV</button>
                <button onClick={handleExportCSV} className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-[12px] font-medium text-gray-700 hover:bg-gray-50 transition-colors shadow-sm">Export CSV</button>
              </div>
            </div>

            {/* ADD CLIENT FORM */}
            <div id="add-client-form" className="bg-white p-5 rounded-2xl border border-gray-200/80 shadow-sm space-y-4">
              <h3 className="text-[13px] font-bold uppercase tracking-wider text-gray-400">Add New Student Profile Card</h3>
              {crmErrorMessage && <div className="p-2 bg-red-50 text-red-700 text-[12px] rounded-lg border border-red-100">{crmErrorMessage}</div>}
              
              <form onSubmit={handleAddClient} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-[13px]">
                <input type="text" required placeholder="Name *" value={name} onChange={e => setName(e.target.value)} className="px-3 py-2 border border-gray-200 rounded-lg bg-gray-50/50 focus:bg-white focus:outline-none focus:border-gray-400" />
                <input type="email" required placeholder="Email *" value={clientEmail} onChange={e => setClientEmail(e.target.value)} className="px-3 py-2 border border-gray-200 rounded-lg bg-gray-50/50 focus:bg-white focus:outline-none focus:border-gray-400" />
                <input type="text" placeholder="Country" value={clientCountry} onChange={e => setClientCountry(e.target.value)} className="px-3 py-2 border border-gray-200 rounded-lg bg-gray-50/50 focus:bg-white focus:outline-none focus:border-gray-400" />
                <input type="text" placeholder="Phone Number" value={clientPhone} onChange={e => setClientPhone(e.target.value)} className="px-3 py-2 border border-gray-200 rounded-lg bg-gray-50/50 focus:bg-white focus:outline-none focus:border-gray-400" />
                <input type="url" placeholder="LinkedIn URL" value={clientLinkedin} onChange={e => setClientLinkedin(e.target.value)} className="px-3 py-2 border border-gray-200 rounded-lg bg-gray-50/50 focus:bg-white focus:outline-none focus:border-gray-400" />
                
                <div className="flex items-center gap-1">
                  <label className="text-[11px] font-medium text-gray-400 px-1 whitespace-nowrap">Birth:</label>
                  <input type="date" value={clientBirthday} onChange={e => setClientBirthday(e.target.value)} className="w-full px-2 py-2 border border-gray-200 rounded-lg bg-gray-50/50 focus:bg-white text-gray-600 focus:outline-none" />
                </div>

                <select value={clientRelationship} onChange={e => setClientRelationship(e.target.value)} className="px-3 py-2 border border-gray-200 rounded-lg bg-gray-50/50 focus:bg-white text-gray-700 focus:outline-none">
                  <option value="Low">Low Priority</option>
                  <option value="Medium">Medium Priority</option>
                  <option value="High">High Priority</option>
                </select>

                <select value={status} onChange={e => setStatus(e.target.value)} className="px-3 py-2 border border-gray-200 rounded-lg bg-gray-50/50 focus:bg-white text-gray-700 focus:outline-none">
                  {PIPELINE_STAGES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>

                {/* DYNAMIC CUSTOM FIELDS RENDER */}
                {customFieldDefs.length > 0 && (
                  <div className="sm:col-span-2 lg:col-span-4 border-t border-gray-100 pt-3 mt-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {customFieldDefs.map(cf => (
                      <div key={cf.id} className="flex flex-col gap-1">
                        <label className="text-[11px] font-medium text-gray-500">{cf.field_name}</label>
                        {cf.field_type === 'select' ? (
                          <select value={formCustomValues[cf.id] || ''} onChange={e => setFormCustomValues({...formCustomValues, [cf.id]: e.target.value})} className="px-3 py-2 border border-gray-200 rounded-lg bg-gray-50/50 focus:bg-white text-gray-700 focus:outline-none">
                            <option value="">-- Select --</option>
                            {(cf.select_options || []).map(opt => <option key={opt} value={opt}>{opt}</option>)}
                          </select>
                        ) : (
                          <input type={cf.field_type} value={formCustomValues[cf.id] || ''} onChange={e => setFormCustomValues({...formCustomValues, [cf.id]: e.target.value})} className="px-3 py-2 border border-gray-200 rounded-lg bg-gray-50/50 focus:bg-white focus:outline-none focus:border-gray-400" />
                        )}
                      </div>
                    ))}
                  </div>
                )}

                <div className="sm:col-span-2 lg:col-span-4 flex items-center gap-2 pt-2 border-t border-gray-100">
                  <input type="text" placeholder="Legacy Note: Add conversation details log note remarks..." value={clientConversation} onChange={e => setClientConversation(e.target.value)} className="flex-1 px-3 py-2 border border-gray-200 rounded-lg bg-gray-50/50 focus:bg-white focus:outline-none" />
                  <button type="submit" className="px-5 py-2 font-medium text-white bg-gray-900 hover:bg-gray-800 rounded-lg shadow-sm transition-all whitespace-nowrap">Save Client</button>
                </div>
              </form>
            </div>

            {/* FILTER CONTROLS */}
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between text-[13px]">
              <div className="w-full md:w-auto flex-1 max-w-md">
                <input type="text" placeholder="Search profiles dynamically by name, email, country..." value={searchTerm} onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }} className="w-full px-3 py-1.5 border border-gray-200 bg-gray-50/30 rounded-lg focus:outline-none focus:bg-white text-gray-900" />
              </div>
              <div className="w-full md:w-auto flex flex-wrap items-center gap-2.5">
                <div className="flex items-center gap-1">
                  <span className="text-gray-400 text-[11px] font-semibold uppercase">Priority:</span>
                  <select value={filterPriority} onChange={e => { setFilterPriority(e.target.value); setCurrentPage(1); }} className="border border-gray-200 rounded-md bg-white p-1 text-gray-700 focus:outline-none">
                    <option value="All">All Categories</option>
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                  </select>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-gray-400 text-[11px] font-semibold uppercase">Status:</span>
                  <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setCurrentPage(1); }} className="border border-gray-200 rounded-md bg-white p-1 text-gray-700 focus:outline-none">
                    <option value="All">All Statuses</option>
                    {PIPELINE_STAGES.map(s => <option key={s} value={s}>{s}</option>)}
                    {/* Fallbacks for unmigrated data */}
                    <option value="Active">Legacy Active</option>
                    <option value="Inactive">Legacy Inactive</option>
                  </select>
                </div>
                {viewMode === 'table' && (
                  <div className="flex items-center gap-1">
                    <span className="text-gray-400 text-[11px] font-semibold uppercase">Sort:</span>
                    <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="border border-gray-200 rounded-md bg-white p-1 text-gray-700 focus:outline-none">
                      <option value="created_at_desc">Newest Added</option>
                      <option value="created_at_asc">Oldest Added</option>
                      <option value="name_asc">Name (A-Z)</option>
                      <option value="name_desc">Name (Z-A)</option>
                    </select>
                  </div>
                )}
              </div>
            </div>

            {/* BULK ACTIONS BAR (Table mode only) */}
            {viewMode === 'table' && selectedClientIds.length > 0 && (
              <div className="bg-blue-50 border border-blue-100 p-3 rounded-lg flex items-center justify-between animate-in fade-in">
                <span className="text-[13px] font-medium text-blue-800">{selectedClientIds.length} clients selected</span>
                <div className="flex flex-wrap items-center gap-2">
                  <select onChange={e => {if(e.target.value) handleBulkStatusUpdate(e.target.value); e.target.value='';}} className="px-3 py-1.5 bg-white border border-gray-200 text-gray-700 rounded-md text-[12px] font-medium hover:bg-gray-50 outline-none">
                    <option value="">Change Status...</option>
                    {PIPELINE_STAGES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <button onClick={handleBulkDelete} className="px-3 py-1.5 bg-red-600 text-white rounded-md text-[12px] font-medium hover:bg-red-700 shadow-sm">Delete Selected</button>
                </div>
              </div>
            )}

            {/* DATA VIEW CONTAINER */}
            {loadingClients ? (
              <div className="p-12 text-center text-[13px] text-gray-400 bg-white rounded-2xl border border-gray-200">Loading records...</div>
            ) : filteredAndSortedClients.length === 0 ? (
              <div className="p-12 text-center text-[13px] text-gray-400 bg-white rounded-2xl border border-gray-200">No matching records found.</div>
            ) : (
              viewMode === 'table' ? (
                /* ------------------- TABLE VIEW ------------------- */
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden animate-in fade-in">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-gray-50/70 border-b border-gray-200 text-[11px] font-bold uppercase tracking-wider text-gray-400 select-none">
                          <th className="p-4 w-10 text-center">
                            <input type="checkbox" checked={paginatedClients.length > 0 && paginatedClients.every(c => selectedClientIds.includes(c.id))} onChange={(e) => handleSelectAll(e, paginatedClients)} className="rounded border-gray-300 text-gray-900 focus:ring-0" />
                          </th>
                          <th className="p-4">Client</th>
                          <th className="p-4">Country</th>
                          <th className="p-4">Priority</th>
                          <th className="p-4">Pipeline Stage</th>
                          <th className="p-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 text-[13px] font-medium text-gray-800">
                        {paginatedClients.map(client => {
                          const isSelected = selectedClientIds.includes(client.id);
                          return (
                            <tr key={client.id} className={`hover:bg-gray-50/60 transition-colors ${isSelected ? 'bg-gray-50/80' : ''}`}>
                              <td className="p-4 text-center">
                                <input type="checkbox" checked={isSelected} onChange={() => handleSelectRow(client.id)} className="rounded border-gray-300 text-gray-900 focus:ring-0" />
                              </td>
                              <td className="p-4">
                                <div>
                                  <span className="font-semibold text-gray-900 text-[14px] block">{client.name}</span>
                                  <span className="text-[11px] text-gray-400 block font-normal mt-0.5">{client.email}</span>
                                </div>
                              </td>
                              <td className="p-4 text-gray-500 font-normal">{client.country || '—'}</td>
                              <td className="p-4">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
                                  client.relationship === 'High' ? 'bg-red-50 text-red-700 border-red-100' :
                                  client.relationship === 'Medium' ? 'bg-orange-50 text-orange-700 border-orange-100' :
                                  'bg-blue-50 text-blue-700 border-blue-100'
                                }`}>
                                  {client.relationship || 'Low'}
                                </span>
                              </td>
                              <td className="p-4">
                                <span className={`inline-flex items-center gap-1 text-[12px] font-bold ${
                                  client.status === 'New' ? 'text-blue-600' : 
                                  client.status === 'Contacted' ? 'text-orange-500' :
                                  client.status === 'Engaged' ? 'text-indigo-500' :
                                  client.status === 'Active' ? 'text-green-600' : 'text-gray-400'
                                }`}>
                                  <span className={`w-1.5 h-1.5 rounded-full ${
                                    client.status === 'New' ? 'bg-blue-500' : 
                                    client.status === 'Contacted' ? 'bg-orange-500' :
                                    client.status === 'Engaged' ? 'bg-indigo-500' :
                                    client.status === 'Active' ? 'bg-green-500' : 'bg-gray-400'
                                  }`}></span>
                                  {client.status}
                                </span>
                              </td>
                              <td className="p-4 text-right font-normal">
                                <div className="flex justify-end gap-3 text-[12px] font-medium">
                                  <button onClick={() => setViewingClient(client)} className="text-gray-500 hover:text-gray-900 transition-colors">View</button>
                                  <button onClick={() => {
                                    setEditingClient(client);
                                    // Preload custom fields into form
                                    const cfs = {};
                                    customFieldDefs.forEach(def => {
                                      const existing = customFieldValues.find(v => v.client_id === client.id && v.field_definition_id === def.id);
                                      cfs[def.id] = existing ? existing.value : '';
                                    });
                                    setFormCustomValues(cfs);
                                  }} className="text-gray-900 hover:underline">Edit</button>
                                  <button onClick={() => handleDeleteClient(client.id)} className="text-red-600 hover:text-red-900 transition-colors">Delete</button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  {totalPages > 1 && (
                    <div className="p-4 border-t border-gray-100 bg-gray-50/50 flex items-center justify-between text-[12px] font-semibold text-gray-500">
                      <span>Displaying page {currentPage} of {totalPages}</span>
                      <div className="flex items-center gap-1.5">
                        <button disabled={currentPage === 1} onClick={() => setCurrentPage(currentPage - 1)} className="px-3 py-1.5 border border-gray-200 rounded-md bg-white hover:bg-gray-50 disabled:opacity-40 transition-colors">Prev</button>
                        <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(currentPage + 1)} className="px-3 py-1.5 border border-gray-200 rounded-md bg-white hover:bg-gray-50 disabled:opacity-40 transition-colors">Next</button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* ------------------- BOARD VIEW (KANBAN) ------------------- */
                <div className="flex gap-4 overflow-x-auto pb-4 h-[70vh] animate-in fade-in" style={{ scrollSnapType: 'x mandatory' }}>
                  {PIPELINE_STAGES.map(stage => {
                    const columnClients = filteredAndSortedClients.filter(c => c.status === stage);
                    return (
                      <div 
                        key={stage} 
                        className="flex-shrink-0 w-80 bg-gray-200/50 rounded-2xl flex flex-col border border-gray-200"
                        onDragOver={handleDragOver}
                        onDrop={e => handleDrop(e, stage)}
                      >
                        <div className="p-4 border-b border-gray-200 bg-gray-100/50 rounded-t-2xl flex justify-between items-center">
                          <h4 className="text-[14px] font-bold text-gray-800">{stage}</h4>
                          <span className="text-[12px] font-semibold text-gray-500 bg-white border border-gray-200 px-2 py-0.5 rounded-full">{columnClients.length}</span>
                        </div>
                        <div className="p-3 flex-1 overflow-y-auto space-y-3">
                          {columnClients.map(client => {
                            const clActs = activities.filter(a => a.client_id === client.id);
                            const lastAct = clActs.length > 0 ? clActs[0].date : (client.created_at ? new Date(client.created_at).toISOString().split('T')[0] : 'N/A');
                            
                            return (
                              <div 
                                key={client.id}
                                draggable
                                onDragStart={e => handleDragStart(e, client.id)}
                                onClick={() => setViewingClient(client)}
                                className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-sm hover:shadow transition-shadow cursor-grab active:cursor-grabbing flex flex-col gap-2 relative group"
                              >
                                <div className="flex justify-between items-start">
                                  <p className="text-[13px] font-bold text-gray-900 leading-tight pr-4">{client.name}</p>
                                  <span className={`shrink-0 text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${
                                    client.relationship === 'High' ? 'bg-red-50 text-red-700 border-red-100' :
                                    client.relationship === 'Medium' ? 'bg-orange-50 text-orange-700 border-orange-100' :
                                    'bg-blue-50 text-blue-700 border-blue-100'
                                  }`}>{client.relationship}</span>
                                </div>
                                <div className="text-[11px] text-gray-500 truncate">{client.email}</div>
                                <div className="text-[10px] font-medium text-gray-400 mt-2 flex items-center justify-between">
                                  <span>Activity: {lastAct}</span>
                                  {tasks.filter(t => t.client_id === client.id && t.status === 'pending').length > 0 && (
                                    <span className="text-red-500 font-bold flex items-center gap-1"><BellIcon /> Task</span>
                                  )}
                                </div>
                              </div>
                            )
                          })}
                          {columnClients.length === 0 && (
                            <div className="border-2 border-dashed border-gray-300 rounded-xl h-24 flex items-center justify-center text-[12px] text-gray-400 font-medium">Drop here</div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            )}
          </div>
        )}

        {/* VIEW: GLOBAL TASKS */}
        {appStep === 'GLOBAL_TASKS' && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-gray-900 mb-1">Task Management</h1>
                <p className="text-[13px] text-gray-500">Track and manage all client action items.</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setTasksFilter('pending')} className={`px-4 py-2 text-[13px] font-medium rounded-lg transition-all ${tasksFilter === 'pending' ? 'bg-gray-900 text-white shadow-sm' : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'}`}>Pending</button>
                <button onClick={() => setTasksFilter('done')} className={`px-4 py-2 text-[13px] font-medium rounded-lg transition-all ${tasksFilter === 'done' ? 'bg-gray-900 text-white shadow-sm' : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'}`}>Completed</button>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-4">
              {tasks.filter(t => t.status === tasksFilter).sort((a, b) => new Date(a.due_date) - new Date(b.due_date)).length === 0 && (
                <p className="text-center text-[13px] text-gray-500 py-8">No {tasksFilter} tasks found.</p>
              )}
              {tasks.filter(t => t.status === tasksFilter).sort((a, b) => new Date(a.due_date) - new Date(b.due_date)).map(task => {
                const client = clients.find(c => c.id === task.client_id);
                const isOverdue = task.status === 'pending' && new Date(task.due_date) < new Date(todayStr);
                
                return (
                  <div key={task.id} className="flex items-center justify-between p-4 border border-gray-100 rounded-xl hover:border-gray-300 transition-colors bg-gray-50/50">
                    <div className="flex items-center gap-4">
                      <input type="checkbox" checked={task.status === 'done'} onChange={() => handleToggleTask(task.id, task.status)} className="w-5 h-5 rounded border-gray-300 text-gray-900 focus:ring-gray-900 cursor-pointer" />
                      <div>
                        <div className={`text-[14px] ${task.status === 'done' ? 'line-through text-gray-400' : isOverdue ? 'text-red-600 font-semibold' : 'text-gray-900 font-medium'}`}>
                          {task.title}
                        </div>
                        <div className="text-[12px] text-gray-500 mt-0.5">
                          Due: <span className={isOverdue ? 'text-red-500 font-medium' : ''}>{task.due_date}</span> 
                          &nbsp;•&nbsp; 
                          Client: <button onClick={() => { setViewingClient(client); setAppStep('CLIENTS'); }} className="text-gray-900 font-medium hover:underline">{client?.name || 'Unknown'}</button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* VIEW: SETTINGS */}
        {appStep === 'SETTINGS' && (
          <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300 pb-12">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-gray-900 mb-1">Account Settings</h1>
              <p className="text-[13px] text-gray-500">Manage your profile, security preferences, system configuration, and custom CRM fields.</p>
            </div>

            {settingsMessage.text && (
              <div className={`p-4 rounded-xl text-[13px] font-medium border ${settingsMessage.type === 'error' ? 'bg-red-50 text-red-700 border-red-100' : 'bg-green-50 text-green-700 border-green-100'}`}>
                {settingsMessage.text}
              </div>
            )}

            {/* Profile Information Block */}
            <div className="bg-white p-6 sm:p-8 rounded-2xl border border-gray-200 shadow-sm">
              <h2 className="text-[15px] font-bold text-gray-900 mb-5">Profile Information</h2>
              <form onSubmit={handleUpdateProfile} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Full Name</label>
                    <input type="text" value={profile.username} onChange={e => setProfile({...profile, username: e.target.value})} className="w-full px-3 py-2 text-[13px] bg-white border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400" />
                  </div>
                  <div>
                    <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Phone Number</label>
                    <input type="text" value={profile.phone_number} onChange={e => setProfile({...profile, phone_number: e.target.value})} className="w-full px-3 py-2 text-[13px] bg-white border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400" />
                  </div>
                  <div>
                    <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Country / Region</label>
                    <input type="text" value={profile.country} onChange={e => setProfile({...profile, country: e.target.value})} className="w-full px-3 py-2 text-[13px] bg-white border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400" />
                  </div>
                  <div>
                    <label className="block text-[12px] font-medium text-gray-700 mb-1.5">LinkedIn Profile</label>
                    <input type="url" value={profile.linkedin_profile} onChange={e => setProfile({...profile, linkedin_profile: e.target.value})} className="w-full px-3 py-2 text-[13px] bg-white border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400" />
                  </div>
                </div>
                <div className="flex justify-end pt-2">
                  <button type="submit" className="px-4 py-2 text-[13px] font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 transition-colors shadow-sm">Save Profile Updates</button>
                </div>
              </form>
            </div>

            {/* NEW: Custom Fields Configuration */}
            <div className="bg-white p-6 sm:p-8 rounded-2xl border border-gray-200 shadow-sm">
              <div className="flex justify-between items-start mb-5">
                <div>
                  <h2 className="text-[15px] font-bold text-gray-900">Custom Fields</h2>
                  <p className="text-[12px] text-gray-500 mt-1">Add education-specific tracking metrics (School, Major, Grad Year) or other personalized data fields for your clients.</p>
                </div>
              </div>
              
              {/* Existing Fields List */}
              <div className="space-y-2 mb-6">
                {customFieldDefs.length === 0 ? (
                  <p className="text-[13px] text-gray-400 italic p-4 bg-gray-50 border border-gray-100 rounded-lg text-center">No custom fields defined yet.</p>
                ) : (
                  customFieldDefs.map((cf, idx) => (
                    <div key={cf.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg bg-gray-50/50 group">
                      <div className="flex items-center gap-3">
                        <span className="text-[12px] font-bold text-gray-400 w-5 text-center">{idx + 1}</span>
                        <div>
                          <p className="text-[13px] font-semibold text-gray-900">{cf.field_name}</p>
                          <p className="text-[11px] text-gray-500 uppercase tracking-wider mt-0.5">{cf.field_type} {cf.field_type === 'select' ? `(${cf.select_options?.length} options)` : ''}</p>
                        </div>
                      </div>
                      <button onClick={() => handleDeleteCustomField(cf.id)} className="text-[12px] font-medium text-red-500 hover:text-red-700 px-2 py-1 bg-white border border-gray-200 rounded shadow-sm opacity-0 group-hover:opacity-100 transition-opacity">Delete Field</button>
                    </div>
                  ))
                )}
              </div>

              {/* Add New Field Form */}
              <form onSubmit={handleAddCustomField} className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                <h4 className="text-[12px] font-bold uppercase tracking-wider text-gray-500 mb-3">Create New Custom Field</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-gray-700 mb-1">Field Name (e.g. "Major")</label>
                    <input type="text" required value={newCfName} onChange={e => setNewCfName(e.target.value)} className="w-full px-3 py-1.5 text-[13px] bg-white border border-gray-200 rounded-lg focus:outline-none" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-gray-700 mb-1">Input Type</label>
                    <select value={newCfType} onChange={e => setNewCfType(e.target.value)} className="w-full px-3 py-1.5 text-[13px] bg-white border border-gray-200 rounded-lg focus:outline-none">
                      <option value="text">Short Text</option>
                      <option value="number">Number</option>
                      <option value="date">Date</option>
                      <option value="select">Dropdown Select</option>
                    </select>
                  </div>
                  {newCfType === 'select' ? (
                    <div>
                      <label className="block text-[11px] font-medium text-gray-700 mb-1">Options (Comma separated)</label>
                      <input type="text" required placeholder="CS, Bio, Art" value={newCfOptions} onChange={e => setNewCfOptions(e.target.value)} className="w-full px-3 py-1.5 text-[13px] bg-white border border-gray-200 rounded-lg focus:outline-none" />
                    </div>
                  ) : (
                    <div className="flex items-end justify-end">
                      <button type="submit" className="w-full sm:w-auto px-4 py-1.5 text-[12px] font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 transition-colors shadow-sm">Add Field</button>
                    </div>
                  )}
                </div>
                {newCfType === 'select' && (
                  <div className="flex justify-end mt-3">
                    <button type="submit" className="px-4 py-1.5 text-[12px] font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 transition-colors shadow-sm">Add Dropdown Field</button>
                  </div>
                )}
              </form>
            </div>

            {/* Data Admin Tools */}
            <div className="bg-white p-6 sm:p-8 rounded-2xl border border-gray-200 shadow-sm">
              <h2 className="text-[15px] font-bold text-gray-900 mb-5">Data Tools</h2>
              <button onClick={runStatusMigration} className="px-4 py-2 text-[12px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition-colors shadow-sm">
                Migrate Legacy "Active/Inactive" Status to New Pipeline Stages
              </button>
              <p className="text-[11px] text-gray-500 mt-2">Use this utility once if you have old CRM entries showing raw "Active" or "Inactive" tags in the Pipeline column to port them cleanly to the new Kanban Board structure.</p>
            </div>

            {/* Password Security Block */}
            <div className="bg-white p-6 sm:p-8 rounded-2xl border border-gray-200 shadow-sm">
              <h2 className="text-[15px] font-bold text-gray-900 mb-5">Security & Authentication</h2>
              <form onSubmit={handleUpdatePassword} className="space-y-4 max-w-md">
                <div>
                  <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Current Password</label>
                  <div className="relative">
                    <input type={showCurrentPassword ? 'text' : 'password'} required value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} className="w-full px-3 py-2 pr-10 text-[13px] bg-white border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400" />
                    <button type="button" onClick={() => setShowCurrentPassword(!showCurrentPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none p-1 rounded">
                      {showCurrentPassword ? <EyeSlashIcon /> : <EyeIcon />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-gray-700 mb-1.5">New Password</label>
                  <div className="relative">
                    <input type={showNewPassword ? 'text' : 'password'} required value={newPassword} onChange={e => setNewPassword(e.target.value)} className="w-full px-3 py-2 pr-10 text-[13px] bg-white border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400" />
                    <button type="button" onClick={() => setShowNewPassword(!showNewPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none p-1 rounded">
                      {showNewPassword ? <EyeSlashIcon /> : <EyeIcon />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Confirm New Password</label>
                  <div className="relative">
                    <input type={showConfirmNewPassword ? 'text' : 'password'} required value={confirmNewPassword} onChange={e => setConfirmNewPassword(e.target.value)} className="w-full px-3 py-2 pr-10 text-[13px] bg-white border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400" />
                    <button type="button" onClick={() => setShowConfirmNewPassword(!showConfirmNewPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none p-1 rounded">
                      {showConfirmNewPassword ? <EyeSlashIcon /> : <EyeIcon />}
                    </button>
                  </div>
                </div>
                <div className="pt-2">
                  <button type="submit" className="px-4 py-2 text-[13px] font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors shadow-sm">Update Password</button>
                </div>
              </form>
            </div>

            {/* Data Management Block */}
            <div className="bg-white p-6 sm:p-8 rounded-2xl border border-gray-200 shadow-sm">
              <h2 className="text-[15px] font-bold text-gray-900 mb-2">Data Management</h2>
              <p className="text-[13px] text-gray-500 mb-5">Manually trigger a sync to generate any pending notifications for tasks and birthdays.</p>
              <div className="space-y-3">
                <button 
                  onClick={handleResyncNotifications} 
                  disabled={notificationSyncLoading}
                  className="px-4 py-2 text-[13px] font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 transition-colors shadow-sm disabled:opacity-50 disabled:hover:bg-gray-900 flex items-center gap-2"
                >
                  {notificationSyncLoading && (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  )}
                  {notificationSyncLoading ? 'Syncing...' : 'Resync Notifications'}
                </button>
                {notificationSyncMessage && (
                  <p className={`text-[12px] font-medium ${notificationSyncMessage.includes('success') ? 'text-green-600' : 'text-red-600'}`}>
                    {notificationSyncMessage}
                  </p>
                )}
              </div>
            </div>

            {/* Danger Zone Block */}
            <div className="bg-red-50 p-6 sm:p-8 rounded-2xl border border-red-100">
              <h2 className="text-[15px] font-bold text-red-900 mb-2">Danger Zone</h2>
              <p className="text-[13px] text-red-700 mb-5">Permanently remove your account and all associated client data from the servers. This action is irreversible.</p>
              <button onClick={() => setShowDeleteModal(true)} className="px-4 py-2 text-[13px] font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors shadow-sm">Delete Account</button>
            </div>
          </div>
        )}

      </main>

      {/* --- MODALS --- */}

      {/* VIEWING MODAL (Enhanced) */}
      {viewingClient && (
        <div className="fixed inset-0 bg-gray-950/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl border border-gray-100 overflow-hidden max-h-[90vh] flex flex-col animate-in slide-in-from-bottom-4 duration-300">
            
            <div className="p-5 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-gray-900">{viewingClient.name}</h3>
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mt-0.5">Client Profile</p>
              </div>
              <button onClick={() => {setViewingClient(null); setActivityFilterType('All'); setEditingActivityId(null);}} className="w-7 h-7 rounded-full bg-white border border-gray-200 flex items-center justify-center font-bold text-gray-400 hover:text-gray-800 hover:shadow-sm transition-all">&times;</button>
            </div>

            <div className="p-6 space-y-6 text-[13px] overflow-y-auto flex-1">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-0.5">
                  <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">Email</span>
                  <span className="font-semibold text-gray-800 block break-all">{viewingClient.email}</span>
                </div>
                <div className="space-y-0.5">
                  <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">Country</span>
                  <span className="font-semibold text-gray-800 block">{viewingClient.country || 'Not specified'}</span>
                </div>
                <div className="space-y-0.5">
                  <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">Phone</span>
                  <span className="font-semibold text-gray-800 block">{viewingClient.phone_number || 'Not provided'}</span>
                </div>
                <div className="space-y-0.5">
                  <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">Birthday</span>
                  <span className="font-semibold text-gray-800 block">{viewingClient.birthday || 'Not specified'}</span>
                </div>
              </div>

              {/* DYNAMIC CUSTOM FIELDS RENDER IN PROFILE */}
              {customFieldDefs.length > 0 && (
                <div className="bg-gray-50/50 p-4 rounded-xl border border-gray-100">
                  <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block mb-3">Custom Data Points</span>
                  <div className="grid grid-cols-2 gap-4">
                    {customFieldDefs.map(cf => {
                      const cv = customFieldValues.find(v => v.client_id === viewingClient.id && v.field_definition_id === cf.id);
                      return (
                        <div key={cf.id} className="space-y-0.5">
                          <span className="text-[11px] font-bold text-gray-500 block">{cf.field_name}</span>
                          <span className="font-semibold text-gray-900 block">{cv ? cv.value : '—'}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              <div className="space-y-1 bg-gray-50 p-3 rounded-xl border border-gray-100">
                <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">LinkedIn</span>
                {viewingClient.linkedin_url ? (
                  <a href={viewingClient.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-gray-900 font-semibold hover:underline flex items-center gap-1 break-all">
                    {viewingClient.linkedin_url} <span className="text-[10px] font-normal text-gray-400">↗</span>
                  </a>
                ) : (
                  <span className="text-gray-400 font-normal italic">Not provided</span>
                )}
              </div>

              {/* CLIENT TASKS SECTION */}
              <div className="pt-4 border-t border-gray-100">
                <h4 className="text-[12px] font-bold uppercase tracking-wider text-gray-400 mb-3">Tasks for this Client</h4>
                
                <form onSubmit={(e) => handleCreateTask(e, viewingClient.id)} className="flex gap-2 mb-3">
                  <input type="text" placeholder="New task title..." value={newTaskTitle} onChange={(e) => setNewTaskTitle(e.target.value)} className="flex-1 px-3 py-1.5 text-[13px] border border-gray-200 rounded-lg focus:outline-none" required />
                  <input type="date" value={newTaskDate} onChange={(e) => setNewTaskDate(e.target.value)} className="px-2 py-1.5 text-[13px] border border-gray-200 rounded-lg focus:outline-none text-gray-600" required />
                  <button type="submit" className="px-3 py-1.5 text-[12px] font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 transition-colors shadow-sm">Add</button>
                </form>

                <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                  {tasks.filter(t => t.client_id === viewingClient.id).sort((a, b) => new Date(a.due_date) - new Date(b.due_date)).length === 0 && (
                    <p className="text-[12px] text-gray-400 italic">No tasks created for this client profile yet.</p>
                  )}
                  {tasks.filter(t => t.client_id === viewingClient.id).sort((a, b) => new Date(a.due_date) - new Date(b.due_date)).map(task => {
                    const isOverdue = task.status === 'pending' && new Date(task.due_date) < new Date(todayStr);
                    return (
                      <div key={task.id} className="flex items-center justify-between p-2.5 bg-gray-50/50 border border-gray-100 rounded-xl">
                        <div className="flex items-center gap-3">
                          <input type="checkbox" checked={task.status === 'done'} onChange={() => handleToggleTask(task.id, task.status)} className="w-4 h-4 rounded border-gray-300 text-gray-900 focus:ring-0 cursor-pointer" />
                          <div>
                            <span className={`text-[13px] ${task.status === 'done' ? 'line-through text-gray-400' : isOverdue ? 'text-red-600 font-semibold' : 'text-gray-900 font-medium'}`}>
                              {task.title}
                            </span>
                            <span className="text-[11px] text-gray-400 block mt-0.5">Due: <span className={isOverdue ? 'text-red-500 font-medium' : ''}>{task.due_date}</span></span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* ENHANCED ACTIVITY LOGGING */}
              <div id="activity-timeline" className="pt-4 border-t border-gray-100 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-bold text-gray-400 uppercase tracking-wider">Activity Timeline</span>
                  <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
                    {['All', 'Note', 'Call', 'Email', 'Meeting'].map(t => (
                      <button key={t} onClick={() => setActivityFilterType(t)} className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded ${activityFilterType === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>{t}</button>
                    ))}
                  </div>
                </div>

                {/* Legacy Fallback Render */}
                {viewingClient.note_conversation && activities.filter(a => a.client_id === viewingClient.id).length === 0 && (
                   <div className="p-3 bg-yellow-50 border border-yellow-100 rounded-xl text-yellow-800 text-[12px] whitespace-pre-wrap">
                    <span className="font-bold text-[10px] uppercase block mb-1 opacity-70">Legacy Notes</span>
                    {viewingClient.note_conversation}
                  </div>
                )}

                {/* Structured Activity List (Scrollable max-h-96) */}
                <div className="max-h-96 overflow-y-auto space-y-3 pr-2">
                  {activities.filter(a => a.client_id === viewingClient.id && (activityFilterType === 'All' || a.activity_type === activityFilterType)).length === 0 ? (
                    <p className="text-[12px] text-gray-400 italic text-center py-4 border border-dashed border-gray-200 rounded-xl">No structured activity entries matching filter.</p>
                  ) : (
                    activities.filter(a => a.client_id === viewingClient.id && (activityFilterType === 'All' || a.activity_type === activityFilterType)).map(act => (
                      <div key={act.id} className="p-3 border border-gray-100 bg-gray-50/50 rounded-xl group relative">
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-gray-500 bg-gray-200 px-1.5 py-0.5 rounded uppercase">{act.activity_type}</span>
                            <span className="text-[11px] font-semibold text-gray-400">{act.date}</span>
                            {act.outcome && act.outcome !== 'Neutral' && (
                              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                                act.outcome === 'Positive' ? 'bg-green-50 text-green-700 border-green-200' :
                                act.outcome === 'Negative' ? 'bg-red-50 text-red-700 border-red-200' :
                                'bg-gray-100 text-gray-600 border-gray-200' // No response
                              }`}>{act.outcome}</span>
                            )}
                          </div>
                          
                          {/* Inline Edit/Delete Actions */}
                          <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => {setEditingActivityId(act.id); setEditingActivityDesc(act.description);}} className="text-[10px] font-bold text-gray-400 hover:text-gray-900 bg-white border border-gray-200 px-1.5 py-0.5 rounded shadow-sm">Edit</button>
                            <button onClick={() => handleDeleteActivity(act.id)} className="text-[10px] font-bold text-red-400 hover:text-white hover:bg-red-500 border border-red-200 hover:border-red-500 px-1.5 py-0.5 rounded shadow-sm transition-colors">Del</button>
                          </div>
                        </div>

                        {editingActivityId === act.id ? (
                          <form onSubmit={handleUpdateActivity} className="flex gap-2 mt-2">
                            <textarea value={editingActivityDesc} onChange={e => setEditingActivityDesc(e.target.value)} className="w-full text-[12px] p-2 border border-gray-200 rounded focus:outline-none" rows={2} required />
                            <div className="flex flex-col gap-1 shrink-0">
                              <button type="submit" className="bg-gray-900 text-white text-[10px] px-2 py-1 rounded">Save</button>
                              <button type="button" onClick={() => setEditingActivityId(null)} className="bg-gray-200 text-gray-600 text-[10px] px-2 py-1 rounded">Cancel</button>
                            </div>
                          </form>
                        ) : (
                          <p className="text-[13px] text-gray-800 leading-relaxed whitespace-pre-wrap">{act.description}</p>
                        )}
                      </div>
                    ))
                  )}
                </div>

                {/* Add New Activity Form */}
                <form onSubmit={handleAddActivityLog} className="bg-white border border-gray-200 rounded-xl p-3 shadow-sm flex flex-col gap-3 mt-4">
                  <div className="flex flex-wrap gap-2 items-center text-[12px]">
                    <select value={activityType} onChange={e => setActivityType(e.target.value)} className="p-1.5 border border-gray-200 rounded-lg focus:outline-none bg-gray-50/50 text-gray-700">
                      <option value="Note">Note</option>
                      <option value="Call">Call</option>
                      <option value="Email">Email</option>
                      <option value="Meeting">Meeting</option>
                    </select>
                    <select value={activityOutcome} onChange={e => setActivityOutcome(e.target.value)} className="p-1.5 border border-gray-200 rounded-lg focus:outline-none bg-gray-50/50 text-gray-700">
                      <option value="Neutral">Neutral</option>
                      <option value="Positive">Positive</option>
                      <option value="Negative">Negative</option>
                      <option value="No response">No response</option>
                    </select>
                    <input type="date" value={activityDate} onChange={e => setActivityDate(e.target.value)} className="p-1.5 border border-gray-200 rounded-lg focus:outline-none bg-gray-50/50 text-gray-600" />
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <textarea placeholder="Record details, meeting minutes, or email content..." value={activityDesc} onChange={e => setActivityDesc(e.target.value)} required rows={2} className="flex-1 px-3 py-2 text-[13px] border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400" />
                    <button type="submit" className="sm:w-24 font-medium text-[12px] text-white bg-gray-900 rounded-lg hover:bg-gray-800 transition-colors shadow-sm self-end sm:self-stretch">Log Entry</button>
                  </div>
                </form>
              </div>

            </div>

            <div className="p-4 bg-gray-50/80 border-t border-gray-100 flex justify-end gap-2">
              <button type="button" onClick={() => { 
                setEditingClient(viewingClient); 
                setViewingClient(null);
                const cfs = {};
                customFieldDefs.forEach(def => {
                  const existing = customFieldValues.find(v => v.client_id === viewingClient.id && v.field_definition_id === def.id);
                  cfs[def.id] = existing ? existing.value : '';
                });
                setFormCustomValues(cfs);
              }} className="px-4 py-1.5 text-[12px] font-semibold text-white bg-gray-900 hover:bg-gray-800 rounded-lg transition-colors shadow-sm">Edit Client</button>
              <button type="button" onClick={() => {setViewingClient(null); setActivityFilterType('All'); setEditingActivityId(null);}} className="px-4 py-1.5 text-[12px] font-semibold text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">Close</button>
            </div>

          </div>
        </div>
      )}

      {/* EDITING MODAL */}
      {editingClient && (
        <div className="fixed inset-0 bg-gray-950/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg border border-gray-100 overflow-hidden animate-in scale-in-from-95 duration-200 max-h-[90vh] flex flex-col">
            
            <div className="p-5 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
              <h3 className="text-[15px] font-bold text-gray-900">Edit Client</h3>
              <button onClick={() => setEditingClient(null)} className="font-bold text-gray-400 hover:text-gray-800 text-lg">&times;</button>
            </div>

            <form onSubmit={handleUpdateClient} className="p-6 space-y-4 text-[13px] overflow-y-auto flex-1">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Full Name *</label>
                  <input type="text" required value={editingClient.name || ''} onChange={e => setEditingClient({...editingClient, name: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-white text-gray-900 focus:outline-none focus:border-gray-400" />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Email *</label>
                  <input type="email" required value={editingClient.email || ''} onChange={e => setEditingClient({...editingClient, email: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-white text-gray-900 focus:outline-none focus:border-gray-400" />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Country</label>
                  <input type="text" value={editingClient.country || ''} onChange={e => setEditingClient({...editingClient, country: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-white text-gray-900 focus:outline-none focus:border-gray-400" />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Phone</label>
                  <input type="text" value={editingClient.phone_number || ''} onChange={e => setEditingClient({...editingClient, phone_number: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-white text-gray-900 focus:outline-none focus:border-gray-400" />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-gray-700 mb-1.5">LinkedIn URL</label>
                  <input type="url" value={editingClient.linkedin_url || ''} onChange={e => setEditingClient({...editingClient, linkedin_url: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-white text-gray-900 focus:outline-none focus:border-gray-400" />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Birthday</label>
                  <input type="date" value={editingClient.birthday || ''} onChange={e => setEditingClient({...editingClient, birthday: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-white text-gray-600 focus:outline-none" />
                </div>
              </div>

              {/* EDIT CUSTOM FIELDS RENDER */}
              {customFieldDefs.length > 0 && (
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mt-2">
                  <h4 className="text-[12px] font-bold uppercase tracking-wider text-gray-500 mb-3">Custom Data Points</h4>
                  <div className="grid grid-cols-2 gap-3">
                    {customFieldDefs.map(cf => (
                      <div key={cf.id} className="flex flex-col gap-1.5">
                        <label className="text-[11px] font-medium text-gray-700">{cf.field_name}</label>
                        {cf.field_type === 'select' ? (
                          <select value={formCustomValues[cf.id] || ''} onChange={e => setFormCustomValues({...formCustomValues, [cf.id]: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-white focus:outline-none text-gray-700">
                            <option value="">-- Select --</option>
                            {(cf.select_options || []).map(opt => <option key={opt} value={opt}>{opt}</option>)}
                          </select>
                        ) : (
                          <input type={cf.field_type} value={formCustomValues[cf.id] || ''} onChange={e => setFormCustomValues({...formCustomValues, [cf.id]: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-gray-400 text-gray-900" />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Notes (Legacy)</label>
                <textarea rows={2} value={editingClient.note_conversation || ''} onChange={e => setEditingClient({...editingClient, note_conversation: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50/50 text-gray-900 focus:outline-none focus:bg-white font-normal" placeholder="Legacy text data..."></textarea>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Priority</label>
                  <select value={editingClient.relationship || 'Medium'} onChange={e => setEditingClient({...editingClient, relationship: e.target.value})} className="w-full px-3 py-2 text-[13px] bg-white border border-gray-200 rounded-lg shadow-sm text-gray-700 focus:outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-400 transition-colors appearance-none">
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Pipeline Stage</label>
                  <select value={editingClient.status || 'New'} onChange={e => setEditingClient({...editingClient, status: e.target.value})} className="w-full px-3 py-2 text-[13px] bg-white border border-gray-200 rounded-lg shadow-sm text-gray-700 focus:outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-400 transition-colors appearance-none">
                    {PIPELINE_STAGES.map(s => <option key={s} value={s}>{s}</option>)}
                    {/* Render legacy fallbacks if needed */}
                    {!PIPELINE_STAGES.includes(editingClient.status) && <option value={editingClient.status}>{editingClient.status} (Legacy)</option>}
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 mt-2">
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

      {/* DELETE ACCOUNT MODAL */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-gray-950/60 backdrop-blur-sm z-[150] flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md border border-gray-100 overflow-hidden animate-in zoom-in-95 duration-200 p-6 sm:p-8">
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">Delete Account Permanently</h3>
                <p className="text-[13px] text-gray-500 mt-2 leading-relaxed">You are about to permanently delete your account and all associated client data from our servers. This action cannot be undone.</p>
              </div>
              <div className="w-full bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-3 mt-4">
                <p className="text-[12px] font-medium text-gray-700 text-left">Please type your email address <strong className="text-gray-900 select-all">{user?.email}</strong> to confirm:</p>
                <input type="email" value={deleteAccountEmail} onChange={(e) => setDeleteAccountEmail(e.target.value)} placeholder={user?.email} className="w-full px-3 py-2 text-[13px] bg-white border border-gray-200 rounded-lg focus:outline-none focus:border-red-400 focus:ring-1 focus:ring-red-400" />
              </div>
              <div className="flex w-full gap-3 pt-2">
                <button onClick={() => {setShowDeleteModal(false); setDeleteAccountEmail('');}} className="flex-1 py-2.5 text-[13px] font-semibold text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">Cancel</button>
                <button onClick={handleDeleteAccount} disabled={deleteAccountEmail !== user?.email || authLoading} className="flex-1 py-2.5 text-[13px] font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:hover:bg-red-600 shadow-sm">
                  {authLoading ? 'Deleting...' : 'Delete Permanently'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM DIALOG MODAL */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmLabel={confirmDialog.confirmLabel}
        confirmVariant={confirmDialog.confirmVariant}
        isLoading={confirmDialog.isLoading}
        onConfirm={handleConfirmDialogConfirm}
        onCancel={closeConfirm}
      />

      {/* TOAST NOTIFICATIONS */}
      {toasts.map(toast => (
        <Toast
          key={toast.id}
          id={toast.id}
          type={toast.type}
          message={toast.message}
          onClose={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
        />
      ))}

    </div>
  );
}
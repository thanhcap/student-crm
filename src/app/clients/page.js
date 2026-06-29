'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';

export default function ClientsPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  // Form states
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [serviceType, setServiceType] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 1. Verify Authentication Session
  useEffect(() => {
    async function checkAuth() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
      } else {
        setUser(user);
        fetchUserClients(user.id);
      }
    }
    checkAuth();
  }, [router]);

  async function fetchUserClients(userId) {
    setLoading(true);
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .eq('user_id', userId) // MULTI-USER ISOLATION: Only get your data!
      .order('created_at', { ascending: false });

    if (error) {
      setErrorMessage(error.message);
    } else {
      setClients(data || []);
    }
    setLoading(false);
  }

  // 2. Handle Submit Form with User Assignment
  async function handleAddClient(e) {
    e.preventDefault();
    if (!name || !user) return;
    setIsSubmitting(true);

    const { data, error } = await supabase
      .from('clients')
      .insert([{ 
        name, 
        contact, 
        service_type: serviceType,
        user_id: user.id // MULTI-USER ISOLATION: Tag data with current user
      }])
      .select(); 

    if (error) {
      alert(`Error saving to database: ${error.message}`);
    } else {
      setName('');
      setContact('');
      setServiceType('');
      if (data) {
        setClients([data[0], ...clients]);
      }
    }
    setIsSubmitting(false);
  }

  // 3. Handle Delete Client
  async function handleDeleteClient(id) {
    const { error } = await supabase
      .from('clients')
      .delete()
      .eq('id', id);

    if (error) {
      alert(`Error deleting: ${error.message}`);
    } else {
      setClients(clients.filter(client => client.id !== id));
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/login');
  }

  if (!user) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-400">Verifying security credentials...</div>;
  }

  return (
    <main className="min-h-screen bg-gray-50 p-8 text-gray-800">
      <header className="flex justify-between items-center mb-8">
        <div>
          <Link href="/" className="text-sm text-blue-600 hover:underline">← Back to Dashboard</Link>
          <h1 className="text-3xl font-bold text-gray-900 mt-2">Manage Clients</h1>
          <p className="text-xs text-gray-400 mt-0.5">Account: {user.email}</p>
        </div>
        <button 
          onClick={handleLogout}
          className="text-xs font-semibold text-gray-500 hover:text-red-600 bg-white border border-gray-200 px-3 py-1.5 rounded-lg transition-colors shadow-sm"
        >
          Sign Out
        </button>
      </header>

      {errorMessage && (
        <div className="p-4 mb-6 bg-red-50 text-red-700 border border-red-200 rounded-xl text-sm">
          <strong>Database Error:</strong> {errorMessage}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <section className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-fit">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Add New Client</h2>
          <form onSubmit={handleAddClient} className="flex flex-col gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Client Name *</label>
              <input 
                type="text" value={name} onChange={(e) => setName(e.target.value)} required placeholder="e.g. Sarah Jenkins" 
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-500 text-gray-800"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Contact</label>
              <input 
                type="text" value={contact} onChange={(e) => setContact(e.target.value)} placeholder="e.g. sarah@example.com" 
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-500 text-gray-800"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Service Type</label>
              <input 
                type="text" value={serviceType} onChange={(e) => setServiceType(e.target.value)} placeholder="e.g. Web Design" 
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-500 text-gray-800"
              />
            </div>
            <button 
              type="submit" disabled={isSubmitting}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium py-2.5 rounded-lg text-sm transition-colors mt-2"
            >
              {isSubmitting ? 'Saving...' : 'Save Client to Database'}
            </button>
          </form>
        </section>

        <section className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100">
            <h2 className="text-xl font-bold text-gray-900">Active Directory</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-sm text-gray-500 font-medium">
                  <th className="p-4">Name</th>
                  <th className="p-4">Contact</th>
                  <th className="p-4">Service Type</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="text-sm divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan="4" className="p-8 text-center text-gray-400">Loading directory...</td>
                  </tr>
                ) : clients.length > 0 ? (
                  clients.map((client) => (
                    <tr key={client.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="p-4 font-semibold text-gray-950">
                        <Link href={`/clients/${client.id}`} className="text-blue-600 hover:text-blue-800 hover:underline">
                          {client.name}
                        </Link>
                      </td>
                      <td className="p-4 text-gray-600">{client.contact || '—'}</td>
                      <td className="p-4">
                        <span className="bg-blue-50 text-blue-700 px-2.5 py-1 rounded-md text-xs font-medium">
                          {client.service_type || 'General'}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <button 
                          onClick={() => {
                            if (window.confirm(`Are you sure you want to permanently delete ${client.name}?`)) {
                              handleDeleteClient(client.id);
                            }
                          }}
                          className="text-red-500 hover:text-red-700 font-medium text-xs bg-red-50 hover:bg-red-100 px-2.5 py-1.5 rounded-md transition-colors"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="4" className="p-8 text-center text-gray-400">
                      No clients found. Your private list is clean!
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
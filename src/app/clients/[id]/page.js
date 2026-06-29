'use client';

import React, { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function ClientDetailPage({ params }) {
  // Unwrap the params Promise
  const resolvedParams = use(params);
  const clientId = resolvedParams.id;
  
  const [client, setClient] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);

  // Job Form State
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    async function fetchClientAndJobs() {
      // 1. Get the specific client
      const { data: clientData } = await supabase
        .from('clients')
        .select('*')
        .eq('id', clientId)
        .single();

      // 2. Get all jobs belonging only to this client
      const { data: jobsData } = await supabase
        .from('jobs')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false });

      setClient(clientData);
      setJobs(jobsData || []);
      setLoading(false);
    }
    
    if (clientId) {
      fetchClientAndJobs();
    }
  }, [clientId]);

  async function handleAddJob(e) {
    e.preventDefault();
    if (!title || !price) return;
    setIsSubmitting(true);

    const { data, error } = await supabase
      .from('jobs')
      .insert([{ 
        client_id: clientId, 
        title, 
        price: parseFloat(price), 
        due_date: dueDate || null,
        status: 'Pending'
      }])
      .select();

    if (error) {
      alert(`Error saving job: ${error.message}`);
    } else if (data) {
      setJobs([data[0], ...jobs]);
      setTitle('');
      setPrice('');
      setDueDate('');
    }
    setIsSubmitting(false);
  }

  async function handleMarkAsPaid(job) {
    if (window.confirm(`Mark "${job.title}" as paid? This will add $${job.price} to your total revenue.`)) {
      
      // 1. Update the job status to 'Paid'
      const { error: jobError } = await supabase
        .from('jobs')
        .update({ status: 'Paid' })
        .eq('id', job.id);

      if (jobError) {
        alert(`Error updating job: ${jobError.message}`);
        return;
      }

      // 2. Log the payment to the payments table
      const { error: payError } = await supabase
        .from('payments')
        .insert([{ client_id: clientId, amount: job.price }]);

      if (payError) {
        alert(`Error logging payment: ${payError.message}`);
        return;
      }

      // 3. Update the UI so it changes instantly
      setJobs(jobs.map(j => j.id === job.id ? { ...j, status: 'Paid' } : j));
    }
  }

  if (loading) {
    return <div className="min-h-screen bg-gray-50 p-8 flex items-center justify-center text-gray-500">Loading client profile...</div>;
  }

  if (!client) {
    return <div className="min-h-screen bg-gray-50 p-8 flex items-center justify-center text-red-500">Client not found.</div>;
  }

  // Calculate total outstanding/billed for this specific client
  const clientBalance = jobs.reduce((sum, job) => sum + Number(job.price || 0), 0);

  return (
    <main className="min-h-screen bg-gray-50 p-8 text-gray-800">
      <header className="mb-8">
        <Link href="/clients" className="text-sm text-blue-600 hover:underline mb-4 inline-block">← Back to Directory</Link>
        <div className="flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{client.name}</h1>
            <p className="text-gray-500 mt-1">
              {client.contact || 'No contact info'} • <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-xs font-medium">{client.service_type || 'General'}</span>
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-500 font-medium">Total Billed</p>
            <p className="text-2xl font-bold text-gray-900">${clientBalance.toLocaleString()}</p>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* ADD JOB FORM */}
        <section className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-fit">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Add New Project</h2>
          
          <form onSubmit={handleAddJob} className="flex flex-col gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Project Title *</label>
              <input 
                type="text" value={title} onChange={(e) => setTitle(e.target.value)} required
                placeholder="e.g. Homepage Redesign" 
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Price ($) *</label>
              <input 
                type="number" value={price} onChange={(e) => setPrice(e.target.value)} required min="0" step="0.01"
                placeholder="500.00" 
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Due Date</label>
              <input 
                type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-500 text-gray-700"
              />
            </div>

            <button 
              type="submit" disabled={isSubmitting}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium py-2.5 rounded-lg text-sm transition-colors mt-2"
            >
              {isSubmitting ? 'Adding...' : 'Create Project'}
            </button>
          </form>
        </section>

        {/* JOB HISTORY TABLE */}
        <section className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100">
            <h2 className="text-xl font-bold text-gray-900">Project History</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-sm text-gray-500 font-medium">
                  <th className="p-4">Project</th>
                  <th className="p-4">Due Date</th>
                  <th className="p-4 text-right">Price</th>
                  <th className="p-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="text-sm divide-y divide-gray-100">
                {jobs.length > 0 ? (
                  jobs.map((job) => (
                    <tr key={job.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="p-4 font-semibold text-gray-900">{job.title}</td>
                      <td className="p-4 text-gray-500">
                        {job.due_date ? new Date(job.due_date).toLocaleDateString() : '—'}
                      </td>
                      <td className="p-4 text-right font-medium text-gray-900">${Number(job.price).toLocaleString()}</td>
                      <td className="p-4 text-center">
                        {job.status === 'Pending' ? (
                          <button 
                            onClick={() => handleMarkAsPaid(job)}
                            className="bg-green-50 text-green-700 hover:bg-green-100 border border-green-200 px-2.5 py-1 rounded-md text-xs font-medium transition-colors"
                          >
                            Mark Paid
                          </button>
                        ) : (
                          <span className="bg-gray-100 text-gray-600 px-2.5 py-1 rounded-md text-xs font-medium border border-gray-200">
                            Paid
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="4" className="p-8 text-center text-gray-400">
                      No projects logged for this client yet.
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
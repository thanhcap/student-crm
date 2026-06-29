'use client';
import { useState } from 'react';

export default function ClientsPage() {
  const [clients, setClients] = useState([]);
  const [errorMsg, setErrorMsg] = useState(
    "Could not find the 'notes' column of 'clients' in the schema cache"
  );

  return (
    <div className="min-h-screen bg-bg-void text-text-primary p-6 lg:p-10">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Workspace Identity Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border-hud pb-6">
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight bg-gradient-to-r from-text-primary to-text-secondary bg-clip-text text-transparent">
              Client Management
            </h1>
            <p className="text-text-secondary text-xs font-mono mt-1">// PIPELINE REGISTRY PROFILE INDEX</p>
          </div>
        </div>

        {/* Database Diagnostic Alert */}
        {errorMsg && (
          <div className="p-4 bg-surface-card border border-accent-amber/20 rounded-xl flex flex-col gap-1 shadow-lg">
            <span className="text-xs font-mono font-semibold text-accent-amber flex items-center gap-2">
              ⚠️ DB SCHEMA DIAGNOSTIC WARNING
            </span>
            <p className="text-text-secondary text-[11px] font-mono pl-5">
              Database Sync Error: {errorMsg}
            </p>
            <p className="text-text-secondary text-[10px] font-sans pl-5 mt-1 opacity-80">
              Tip: Run the SQL Script in your Supabase SQL Editor workspace to instantly sync missing metadata attributes.
            </p>
          </div>
        )}

        {/* Master Data Capture Grid Matrix */}
        <div className="bg-surface border border-border-hud rounded-2xl p-6 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-border-hud/50 to-transparent" />
          <form className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            <div>
              <label className="block text-[10px] font-mono text-text-secondary uppercase tracking-wider mb-1.5">Full Name *</label>
              <input type="text" required placeholder="thanhcap" className="w-full bg-bg-void border border-border-hud rounded-xl p-3 text-xs text-text-primary focus:outline-none focus:border-accent-cyan transition-all" />
            </div>
            <div>
              <label className="block text-[10px] font-mono text-text-secondary uppercase tracking-wider mb-1.5">Email Address *</label>
              <input type="email" required placeholder="thanh@gmail.com" className="w-full bg-bg-void border border-border-hud rounded-xl p-3 text-xs font-mono text-text-primary focus:outline-none focus:border-accent-cyan transition-all" />
            </div>
            <div>
              <label className="block text-[10px] font-mono text-text-secondary uppercase tracking-wider mb-1.5">Phone Number</label>
              <input type="text" placeholder="1213123123" className="w-full bg-bg-void border border-border-hud rounded-xl p-3 text-xs font-mono text-text-primary focus:outline-none focus:border-accent-cyan transition-all" />
            </div>
            <div>
              <label className="block text-[10px] font-mono text-text-secondary uppercase tracking-wider mb-1.5">Country</label>
              <select className="w-full bg-bg-void border border-border-hud rounded-xl p-3 text-xs text-text-primary focus:outline-none focus:border-accent-cyan transition-all">
                <option value="Vietnam">Vietnam</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-mono text-text-secondary uppercase tracking-wider mb-1.5">LinkedIn URL</label>
              <input type="url" placeholder="https://linkedin.com/in/..." className="w-full bg-bg-void border border-border-hud rounded-xl p-3 text-xs font-mono text-text-primary focus:outline-none focus:border-accent-cyan transition-all" />
            </div>
            <div>
              <label className="block text-[10px] font-mono text-text-secondary uppercase tracking-wider mb-1.5">Birthday</label>
              <input type="date" className="w-full bg-bg-void border border-border-hud rounded-xl p-3 text-xs font-mono text-text-primary focus:outline-none focus:border-accent-cyan transition-all" />
            </div>
            <div>
              <label className="block text-[10px] font-mono text-text-secondary uppercase tracking-wider mb-1.5">Relationship Level</label>
              <select className="w-full bg-bg-void border border-border-hud rounded-xl p-3 text-xs text-text-primary focus:outline-none focus:border-accent-cyan transition-all">
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-mono text-text-secondary uppercase tracking-wider mb-1.5">Status</label>
              <select className="w-full bg-bg-void border border-border-hud rounded-xl p-3 text-xs text-text-primary focus:outline-none focus:border-accent-cyan transition-all">
                <option value="Active">Active</option>
                <option value="Pending">Pending</option>
                <option value="Completed">Completed</option>
              </select>
            </div>
            <div className="flex items-end">
              <button type="submit" className="w-full bg-text-primary hover:bg-white text-bg-void font-semibold text-xs py-3 rounded-xl transition-all uppercase tracking-wider shadow-lg active:scale-[0.98]">
                Add Client
              </button>
            </div>
            <div className="md:col-span-2 lg:col-span-3">
              <label className="block text-[10px] font-mono text-text-secondary uppercase tracking-wider mb-1.5">Note Conversation</label>
              <textarea rows={2} placeholder="aefawef" className="w-full bg-bg-void border border-border-hud rounded-xl p-3 text-xs text-text-primary focus:outline-none focus:border-accent-cyan transition-all resize-none" />
            </div>
          </form>
        </div>

        {/* Unified High-Density Ledger Table */}
        <div className="bg-surface border border-border-hud rounded-2xl overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border-hud bg-surface-card/60">
                  <th className="p-4 text-[10px] font-mono text-text-secondary uppercase tracking-wider">Name</th>
                  <th className="p-4 text-[10px] font-mono text-text-secondary uppercase tracking-wider">Contact Info</th>
                  <th className="p-4 text-[10px] font-mono text-text-secondary uppercase tracking-wider">Location & Bio</th>
                  <th className="p-4 text-[10px] font-mono text-text-secondary uppercase tracking-wider">Conversation Notes</th>
                  <th className="p-4 text-[10px] font-mono text-text-secondary uppercase tracking-wider">Relationship</th>
                  <th className="p-4 text-[10px] font-mono text-text-secondary uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-hud/60 text-xs">
                {clients.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-12 text-center text-text-secondary font-sans tracking-wide">
                      No clients found. Populate registry metrics using the terminal injector above.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
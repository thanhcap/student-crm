'use client';
import { useState } from 'react';

export default function ClientDetailPage() {
  const [billingTotal] = useState(1240);
  const [status, setStatus] = useState('Pending');

  return (
    <div className="min-h-screen bg-bg-void text-text-primary p-6 lg:p-10">
      <div className="max-w-5xl mx-auto space-y-8">
        
        <div className="flex items-center justify-between border-b border-border-hud pb-6">
          <span 
            onClick={() => window.history.back()} 
            className="text-[10px] font-mono text-text-secondary hover:text-accent-cyan transition-colors cursor-pointer uppercase tracking-widest flex items-center gap-2"
          >
            ← Back to Terminal Directory
          </span>
        </div>

        {/* Metric Overview Array */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="bg-surface border border-border-hud rounded-2xl p-6 md:col-span-2 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2.5">
                <span className={`w-2 h-2 rounded-full ring-4 ${
                  status === 'Paid' ? 'bg-accent-mint ring-accent-mint/10' : 'bg-accent-amber ring-accent-amber/10'
                }`} />
                <h2 className="font-display text-2xl font-bold tracking-tight">Nexus Node Matrix</h2>
              </div>
              <p className="text-text-secondary text-xs font-mono mt-1">ENTITY ACCELERATION DATA PIPELINE</p>
            </div>
          </div>

          <div className="bg-surface border border-border-hud rounded-2xl p-6 relative overflow-hidden group">
            <span className="text-[10px] font-mono text-text-secondary uppercase tracking-wider block mb-1">TOTAL PIPELINE VALUE</span>
            <div className="font-mono text-4xl font-bold text-accent-amber tracking-tight transition-all duration-300 drop-shadow-[0_0_20px_rgba(255,184,77,0.12)]">
              ${billingTotal.toLocaleString()}
            </div>
          </div>
        </div>

        {/* Event Logs Hierarchy View */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          <div className="bg-surface border border-border-hud rounded-2xl p-6 space-y-4">
            <h3 className="text-[10px] font-mono text-text-secondary uppercase tracking-wider">Operational Directives</h3>
            
            {status === 'Pending' ? (
              <button 
                onClick={() => setStatus('Paid')}
                className="w-full bg-surface border border-accent-amber/40 hover:border-accent-amber text-accent-amber hover:bg-accent-amber/5 text-xs font-mono py-3 rounded-xl transition-all duration-200 uppercase font-medium tracking-wider"
              >
                Mark Paid // Confirm Settlement
              </button>
            ) : (
              <span className="w-full block text-center bg-accent-mint/5 border border-accent-mint/20 text-accent-mint text-xs font-mono py-3 rounded-xl tracking-wider uppercase font-medium">
                Pipeline Sealed // Paid
              </span>
            )}
          </div>

          <div className="lg:col-span-2 bg-surface border border-border-hud rounded-2xl p-6">
            <h3 className="text-[10px] font-mono text-text-secondary uppercase tracking-wider mb-6">Historical Interaction Ledger</h3>
            <div className="border-l border-border-hud ml-2 pl-4 space-y-6">
              <div className="relative">
                <span className="absolute -left-[20.5px] top-1 w-2 h-2 rounded-full bg-accent-cyan ring-4 ring-accent-cyan/10" />
                <span className="text-[9px] font-mono text-text-secondary uppercase block tracking-widest">RECORD IDENTITY DEPLOYED</span>
                <p className="text-xs text-text-primary mt-1 font-sans">
                  Account telemetry generated successfully. Communications channels established.
                </p>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
'use client';
// B-7 — Settings → Billing. This is the `success_url` / `redirectUrl` target
// for both providers, which is exactly why it grants nothing: it reads the
// `subscriptions` row (SELECT-only under RLS) and re-polls for a few seconds
// while the provider's webhook lands. A hand-typed `?checkout=success` shows
// the same page with whatever plan the database actually says.
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabase';
import { BillingSettings } from '../../components/Billing';

export default function BillingPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data?.user || null);
      setChecking(false);
    });
  }, []);

  function showToast(message, type = 'success') {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }

  if (checking) {
    return <div className="min-h-screen flex items-center justify-center text-[13px] text-gray-400">Loading…</div>;
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 p-4 text-center">
        <p className="text-[15px] font-semibold text-gray-900 dark:text-white">Sign in to see your billing.</p>
        <button type="button" onClick={() => router.push('/')}
          className="px-5 py-2.5 text-[13px] font-semibold text-white dark:text-gray-900 bg-gray-900 dark:bg-white rounded-xl">
          Go to the app
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      <div className="max-w-3xl mx-auto px-4 sm:px-8 py-10">
        <button type="button" onClick={() => router.push('/')}
          className="text-[13px] font-semibold text-gray-500 hover:text-gray-900 dark:hover:text-gray-100 mb-6">
          ← Back to the app
        </button>
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-white mb-1">Billing</h1>
        <p className="text-[13px] text-gray-500 mb-8">Your plan, renewal date, and payment history.</p>
        <BillingSettings user={user} showToast={showToast} />
      </div>

      {toast && (
        <div className={`fixed bottom-6 right-6 px-4 py-3 rounded-xl text-[13px] font-semibold shadow-xl ${
          toast.type === 'error' ? 'bg-red-600 text-white' : 'bg-gray-900 dark:bg-white text-white dark:text-gray-900'
        }`}>
          {toast.message}
        </div>
      )}
    </div>
  );
}

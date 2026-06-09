'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function WelcomeNotification() {
  const [dismissed, setDismissed] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleDismiss() {
    setLoading(true);
    await fetch('/api/profile/welcome-seen', { method: 'PATCH' });
    setLoading(false);
    setDismissed(true);
  }

  if (dismissed) return null;

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex items-center gap-3">
      <div className="shrink-0 text-blue-400">
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 100 20A10 10 0 0012 2z" />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-800">Welcome to the QPTC Score Tracker app!</p>
        <p className="text-xs text-gray-500 mt-0.5">
          Visit the{' '}
          <Link href="/leagues" className="underline hover:text-blue-600">Leagues page</Link>
          {' '}to sign up to an open public league and record your scores via the app. Good luck for your matches!
        </p>
      </div>
      <button
        onClick={handleDismiss}
        disabled={loading}
        className="shrink-0 cursor-pointer text-xs font-medium px-3 py-1.5 rounded-lg bg-blue-200 hover:bg-blue-300 text-blue-900 transition-colors disabled:opacity-50"
      >
        {loading ? '...' : 'OK'}
      </button>
    </div>
  );
}

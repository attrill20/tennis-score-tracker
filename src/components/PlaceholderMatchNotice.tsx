'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function PlaceholderMatchNotice({
  placeholderId,
  placeholderFullName,
  placeholderAlias,
  placeholderAnonymized,
  memberId,
  memberFullName,
  memberEmailVerified,
}: {
  placeholderId: string;
  placeholderFullName: string;
  placeholderAlias: string | null;
  placeholderAnonymized: boolean;
  memberId: string;
  memberFullName: string;
  memberEmailVerified: boolean;
}) {
  const router = useRouter();
  const [dismissed, setDismissed] = useState(false);
  const [swapping, setSwapping] = useState(false);
  const [error, setError] = useState('');

  if (dismissed) return null;

  async function handleSwap() {
    if (!window.confirm(
      `Swap ${memberFullName}'s new account in for the placeholder "${placeholderFullName}"? ` +
      'Every match and league result recorded under the placeholder will move to their real account, and the placeholder will be retired. This cannot be undone.'
    )) return;
    setSwapping(true);
    setError('');
    try {
      const res = await fetch(`/api/admin/placeholder-players/${placeholderId}/merge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ realAccountId: memberId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to swap in the new account');
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
      setSwapping(false);
    }
  }

  return (
    <div className="bg-sky-50 border border-sky-200 rounded-xl px-4 py-3 flex items-start gap-3">
      <svg className="shrink-0 w-5 h-5 text-sky-400 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-sky-800">
          <span className="font-medium">{memberFullName}</span> just registered and matches the placeholder{' '}
          <span className="font-medium">{placeholderFullName}</span>
          {placeholderAnonymized && placeholderAlias ? ` (shown as "${placeholderAlias}")` : ''}
        </p>
        <p className="text-xs text-sky-600 mt-0.5">
          Swap them in to move all of the placeholder&apos;s match history onto their new account
          {!memberEmailVerified ? ' - their email is not verified yet' : ''}
        </p>
        {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
        <div className="flex gap-3 mt-2">
          <button
            type="button"
            onClick={handleSwap}
            disabled={swapping}
            className="text-xs font-medium px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 disabled:opacity-40 text-white transition-colors"
          >
            {swapping ? 'Swapping...' : 'Swap in'}
          </button>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            disabled={swapping}
            className="text-xs font-medium px-3 py-1.5 rounded-lg border border-sky-300 hover:border-sky-400 text-sky-700 transition-colors disabled:opacity-40"
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LeaveLeagueButton({ leagueId }: { leagueId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleLeave() {
    setLoading(true);
    setError('');

    const res = await fetch(`/api/leagues/${leagueId}/leave`, { method: 'POST' });
    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error || 'Something went wrong');
      setConfirming(false);
      return;
    }

    router.push('/leagues');
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500">Are you sure?</span>
        <button
          onClick={handleLeave}
          disabled={loading}
          className="cursor-pointer text-xs font-medium px-3 py-1.5 rounded-lg bg-red-100 hover:bg-red-200 text-red-700 transition-colors disabled:opacity-50"
        >
          {loading ? '...' : 'Yes, leave'}
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="cursor-pointer text-xs font-medium px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div>
      {error && <p className="text-xs text-red-500 mb-1">{error}</p>}
      <button
        onClick={() => setConfirming(true)}
        className="cursor-pointer text-xs font-medium px-3 py-1.5 rounded-lg border border-red-200 hover:border-red-400 text-red-500 hover:text-red-700 transition-colors"
      >
        Leave league
      </button>
    </div>
  );
}

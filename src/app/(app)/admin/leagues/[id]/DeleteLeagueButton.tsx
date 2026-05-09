'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function DeleteLeagueButton({ leagueId, leagueName }: { leagueId: string; leagueName: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleDelete() {
    setLoading(true);
    setError('');

    const res = await fetch(`/api/leagues/${leagueId}`, { method: 'DELETE' });
    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error || 'Something went wrong');
      return;
    }

    router.push('/admin/leagues');
    router.refresh();
  }

  if (!confirming) {
    return (
      <button
        onClick={() => setConfirming(true)}
        className="text-sm text-red-600 hover:text-red-700 font-medium border border-red-200 hover:border-red-400 px-4 py-2 rounded-lg transition-colors"
      >
        Delete league
      </button>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-700">
        Are you sure you want to delete <span className="font-semibold">{leagueName}</span>? This will permanently remove all matches, players and disputes associated with this league.
      </p>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-3">
        <button
          onClick={() => setConfirming(false)}
          className="text-sm border border-gray-300 hover:border-gray-400 text-gray-600 font-medium px-4 py-2 rounded-lg transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleDelete}
          disabled={loading}
          className="text-sm bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-medium px-4 py-2 rounded-lg transition-colors"
        >
          {loading ? 'Deleting...' : 'Yes, delete league'}
        </button>
      </div>
    </div>
  );
}

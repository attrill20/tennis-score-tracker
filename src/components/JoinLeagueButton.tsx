'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function JoinLeagueButton({ leagueId }: { leagueId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleJoin(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setLoading(true);
    setError('');

    const res = await fetch(`/api/leagues/${leagueId}/join`, { method: 'POST' });
    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error || 'Something went wrong');
      return;
    }

    router.refresh();
  }

  return (
    <div className="relative z-20" onClick={(e) => e.stopPropagation()}>
      {error && <p className="text-xs text-red-500 mb-1 text-right">{error}</p>}
      <button
        onClick={handleJoin}
        disabled={loading}
        className="cursor-pointer text-xs bg-green-700 hover:bg-green-800 disabled:opacity-50 text-white font-medium px-3 py-1.5 rounded-full transition-colors"
      >
        {loading ? '...' : 'Join tournament'}
      </button>
    </div>
  );
}

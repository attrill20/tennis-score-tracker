'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function DisputeResolveForm({
  disputeId,
  matchId,
  currentScore,
  player1Name,
  player2Name,
}: {
  disputeId: string;
  matchId: string;
  currentScore: string;
  player1Name: string;
  player2Name: string;
}) {
  const router = useRouter();
  const [override, setOverride] = useState(false);
  const [p1Score, setP1Score] = useState('');
  const [p2Score, setP2Score] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleResolve() {
    setError('');
    if (override && (p1Score === '' || p2Score === '')) {
      setError('Enter the corrected scores');
      return;
    }
    if (override && p1Score === p2Score) {
      setError('Scores cannot be a draw');
      return;
    }

    setLoading(true);
    const res = await fetch(`/api/admin/disputes/${disputeId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        matchId,
        override,
        score_player1: override ? parseInt(p1Score) : undefined,
        score_player2: override ? parseInt(p2Score) : undefined,
      }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error || 'Something went wrong');
      return;
    }

    router.refresh();
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={override}
            onChange={(e) => setOverride(e.target.checked)}
            className="accent-green-700"
          />
          Override the score
        </label>
        <span className="text-xs text-gray-400">Current: {currentScore}</span>
      </div>

      {override && (
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-600 w-28 truncate">{player1Name}</span>
            <input
              type="number"
              min="0"
              max="3"
              value={p1Score}
              onChange={(e) => setP1Score(e.target.value)}
              className="w-14 px-2 py-1.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm text-center"
            />
            <span className="text-gray-400">–</span>
            <input
              type="number"
              min="0"
              max="3"
              value={p2Score}
              onChange={(e) => setP2Score(e.target.value)}
              className="w-14 px-2 py-1.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm text-center"
            />
            <span className="text-gray-600 w-28 truncate">{player2Name}</span>
          </div>
        </div>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}

      <button
        onClick={handleResolve}
        disabled={loading}
        className="bg-green-700 hover:bg-green-800 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
      >
        {loading ? 'Saving...' : override ? 'Override & resolve' : 'Resolve (keep score)'}
      </button>
    </div>
  );
}

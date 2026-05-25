'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function DisputeResolveForm({
  disputeId,
  matchId,
  player1Name,
  player2Name,
  originalScore1,
  originalScore2,
  requestedScore1,
  requestedScore2,
  requestedSets,
}: {
  disputeId: string;
  matchId: string;
  player1Name: string;
  player2Name: string;
  originalScore1: number;
  originalScore2: number;
  requestedScore1: number | null;
  requestedScore2: number | null;
  requestedSets: [number, number][] | null;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState('');

  async function award(score1: number, score2: number, sets: [number, number][] | null, override: boolean) {
    setError('');
    setLoading(`${score1}-${score2}`);

    const res = await fetch(`/api/admin/disputes/${disputeId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ matchId, override, score_player1: score1, score_player2: score2, set_scores: sets }),
    });

    const data = await res.json();
    setLoading(null);

    if (!res.ok) {
      setError(data.error || 'Something went wrong');
      return;
    }

    router.refresh();
  }

  const hasRequest = requestedScore1 !== null && requestedScore2 !== null;

  return (
    <div className="space-y-3 pt-4 border-t border-gray-100">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Award match to</p>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className={`grid gap-2 ${hasRequest ? 'grid-cols-2' : 'grid-cols-2'}`}>
        {/* Award to player1 (keep original) */}
        <button
          onClick={() => award(originalScore1, originalScore2, null, false)}
          disabled={!!loading}
          className="flex flex-col items-center gap-1 px-3 py-3 rounded-xl border-2 border-gray-200 hover:border-green-500 hover:bg-green-50 transition-colors disabled:opacity-50 text-center"
        >
          <span className="text-sm font-semibold text-gray-800">{player1Name.split(' ')[0]}</span>
          <span className="text-xs text-gray-400">
            {originalScore1 > originalScore2 ? 'Keep original' : 'Override'}
          </span>
          <span className="text-lg font-bold text-green-700">{originalScore1}-{originalScore2}</span>
          {loading === `${originalScore1}-${originalScore2}` && <span className="text-xs text-gray-400">Saving...</span>}
        </button>

        {/* Award to player2 — either requested correction or inverse of original */}
        {hasRequest ? (
          <button
            onClick={() => award(requestedScore1!, requestedScore2!, requestedSets, true)}
            disabled={!!loading}
            className="flex flex-col items-center gap-1 px-3 py-3 rounded-xl border-2 border-amber-200 hover:border-green-500 hover:bg-green-50 transition-colors disabled:opacity-50 text-center"
          >
            <span className="text-sm font-semibold text-gray-800">{player2Name.split(' ')[0]}</span>
            <span className="text-xs text-amber-600">Apply correction</span>
            <span className="text-lg font-bold text-green-700">{requestedScore1}-{requestedScore2}</span>
            {loading === `${requestedScore1}-${requestedScore2}` && <span className="text-xs text-gray-400">Saving...</span>}
          </button>
        ) : (
          <button
            onClick={() => award(originalScore2, originalScore1, null, true)}
            disabled={!!loading}
            className="flex flex-col items-center gap-1 px-3 py-3 rounded-xl border-2 border-gray-200 hover:border-green-500 hover:bg-green-50 transition-colors disabled:opacity-50 text-center"
          >
            <span className="text-sm font-semibold text-gray-800">{player2Name.split(' ')[0]}</span>
            <span className="text-xs text-gray-400">Override</span>
            <span className="text-lg font-bold text-green-700">{originalScore2}-{originalScore1}</span>
            {loading === `${originalScore2}-${originalScore1}` && <span className="text-xs text-gray-400">Saving...</span>}
          </button>
        )}
      </div>
    </div>
  );
}

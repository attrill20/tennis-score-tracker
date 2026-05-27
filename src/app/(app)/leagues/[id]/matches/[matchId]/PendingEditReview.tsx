'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function PendingEditReview({
  matchId,
  myName,
  myPendingScore,
  theirPendingScore,
  pendingSetScores,
  pendingTiebreakScores,
  opponentName,
}: {
  matchId: string;
  myName: string;
  myPendingScore: number;
  theirPendingScore: number;
  pendingSetScores: [number, number][] | null;
  pendingTiebreakScores: ([number, number] | null)[] | null;
  opponentName: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<'accept' | 'decline' | null>(null);
  const [error, setError] = useState('');

  async function handleAction(action: 'accept-edit' | 'decline-edit') {
    setError('');
    setLoading(action === 'accept-edit' ? 'accept' : 'decline');

    const res = await fetch(`/api/matches/${matchId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    });

    const data = await res.json();
    setLoading(null);

    if (!res.ok) {
      setError(data.error || 'Something went wrong');
      return;
    }

    router.refresh();
  }

  return (
    <div className="mt-6 pt-5 border-t border-amber-100">
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
        <p className="text-sm font-medium text-amber-800">
          {opponentName} has suggested a correction
        </p>
        {pendingSetScores && pendingSetScores.length > 0 ? (
          <div>
            <div className="flex items-center gap-2 mb-1 pl-[60px]">
              {pendingSetScores.map((_, i) => (
                <span key={i} className="flex-1 text-center text-xs text-gray-400">Set {i + 1}</span>
              ))}
            </div>
            <div className="flex items-center gap-2 mb-1">
              <span className={`w-[52px] text-xs truncate ${myPendingScore > theirPendingScore ? 'text-gray-700 font-medium' : 'text-gray-400'}`}>{myName.split(' ')[0]}</span>
              {pendingSetScores.map(([p1, p2], i) => {
                const tb = pendingTiebreakScores?.[i] ?? null;
                return (
                  <div key={i} className={`relative flex-1 text-center text-sm font-semibold py-1.5 rounded-lg ${p1 > p2 ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
                    {p1}
                    {tb !== null && (
                      <span className="absolute top-1 right-2 text-[9px] font-normal leading-none opacity-60">{tb[0]}</span>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="flex items-center gap-2">
              <span className={`w-[52px] text-xs truncate ${theirPendingScore > myPendingScore ? 'text-gray-700 font-medium' : 'text-gray-400'}`}>{opponentName.split(' ')[0]}</span>
              {pendingSetScores.map(([p1, p2], i) => {
                const tb = pendingTiebreakScores?.[i] ?? null;
                return (
                  <div key={i} className={`relative flex-1 text-center text-sm font-semibold py-1.5 rounded-lg ${p2 > p1 ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
                    {p2}
                    {tb !== null && (
                      <span className="absolute top-1 right-2 text-[9px] font-normal leading-none opacity-60">{tb[1]}</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-800">{myPendingScore} - {theirPendingScore}</p>
            <p className="text-xs text-gray-400 mt-0.5">{myName} - {opponentName}</p>
          </div>
        )}

        {error && <p className="text-xs text-red-600">{error}</p>}

        <div className="flex gap-2">
          <button
            onClick={() => handleAction('decline-edit')}
            disabled={!!loading}
            className="flex-1 text-sm border border-gray-300 hover:border-gray-400 text-gray-600 font-medium py-2 rounded-lg transition-colors disabled:opacity-50"
          >
            {loading === 'decline' ? 'Declining...' : 'Decline'}
          </button>
          <button
            onClick={() => handleAction('accept-edit')}
            disabled={!!loading}
            className="flex-1 text-sm bg-green-700 hover:bg-green-800 text-white font-medium py-2 rounded-lg transition-colors disabled:opacity-50"
          >
            {loading === 'accept' ? 'Accepting...' : 'Accept'}
          </button>
        </div>
      </div>
    </div>
  );
}

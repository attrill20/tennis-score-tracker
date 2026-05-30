'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function DisputeResolutionNotification({
  disputeId,
  matchId,
  leagueId,
  leagueName,
  myName,
  opponentName,
  myScore,
  theirScore,
  matchStatus,
}: {
  disputeId: string;
  matchId: string;
  leagueId: string;
  leagueName: string;
  myName: string;
  opponentName: string;
  myScore: number;
  theirScore: number;
  matchStatus: string;
}) {
  const [dismissed, setDismissed] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleAcknowledge() {
    setLoading(true);
    await fetch(`/api/disputes/${disputeId}`, { method: 'PATCH' });
    setLoading(false);
    setDismissed(true);
  }

  if (dismissed) return null;

  const wasOverridden = matchStatus === 'overridden';

  return (
    <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex items-start justify-between gap-4">
      <div className="flex items-center gap-3 min-w-0">
        <span className="inline-flex items-center justify-center w-5 h-5 bg-green-200 rounded-full shrink-0 text-green-800 font-bold text-xs">✓</span>
        <div className="min-w-0">
          <p className="text-sm font-medium text-green-900">
            Dispute resolved{wasOverridden ? ' (score updated)' : ' (original score kept)'}
          </p>
          <p className="text-xs text-green-700 mt-0.5">
            <Link href={`/leagues/${leagueId}`} className="hover:underline hover:text-blue-600">{leagueName}</Link>
            {' · '}
            <Link href={`/leagues/${leagueId}/matches/${matchId}`} className="hover:underline hover:text-blue-600">{myName} {myScore}-{theirScore} {opponentName}</Link>
          </p>
        </div>
      </div>
      <button
        onClick={handleAcknowledge}
        disabled={loading}
        className="shrink-0 self-center cursor-pointer text-xs bg-green-200 hover:bg-green-300 text-green-900 font-medium px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
      >
        {loading ? '...' : 'OK'}
      </button>
    </div>
  );
}

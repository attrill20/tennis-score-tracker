'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function NewMatchNotification({
  matchId,
  leagueId,
  leagueName,
  submitterName,
  partnerFirstName,
  notificationRole,
  myScore,
  theirScore,
  setScores,
  matchType,
  iWon,
}: {
  matchId: string;
  leagueId: string;
  leagueName: string;
  submitterName: string;
  partnerFirstName?: string | null;
  notificationRole: 'opponent' | 'partner' | 'opponent2';
  myScore: number;
  theirScore: number;
  setScores: [number, number][] | null;
  matchType: string | null;
  iWon: boolean;
}) {
  const [dismissed, setDismissed] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleDismiss() {
    setLoading(true);
    const action =
      notificationRole === 'partner' ? 'seen-by-partner'
      : notificationRole === 'opponent2' ? 'seen-by-opponent2'
      : 'seen-by-opponent';
    await fetch(`/api/matches/${matchId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    });
    setLoading(false);
    setDismissed(true);
  }

  if (dismissed) return null;

  const isDraw = myScore === theirScore && matchType !== 'walkover';
  const outcome = iWon ? 'W' : isDraw ? 'D' : 'L';

  const scoreLabel = matchType === 'walkover'
    ? 'Walkover'
    : setScores && setScores.length > 0
    ? setScores.map(([my, their]) => `${my}-${their}`).join(', ')
    : `${myScore}-${theirScore}`;

  const badgeClass = iWon
    ? 'bg-green-100 text-green-700'
    : isDraw
    ? 'bg-gray-100 text-gray-500'
    : 'bg-red-100 text-red-600';

  // Build headline based on role
  const teamName = partnerFirstName
    ? `${submitterName.split(' ')[0]} / ${partnerFirstName}`
    : submitterName;

  const headline =
    notificationRole === 'partner'
      ? `${submitterName} submitted a result you were part of`
      : `${teamName} submitted a result against you`;

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex items-center gap-3">
      <svg className="shrink-0 w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 100 20A10 10 0 0012 2z" />
      </svg>

      <div className="flex-1 min-w-0">
        <Link href={`/tournaments/${leagueId}/matches/${matchId}`} className="group block">
          <p className="text-sm text-gray-800 group-hover:text-blue-600 group-hover:underline">{headline}</p>
        </Link>
        <div className="flex items-center gap-2 mt-1">
          <Link href={`/tournaments/${leagueId}/matches/${matchId}`} className="group flex items-center gap-2">
            <span className={`inline-flex items-center justify-center w-5 h-5 rounded text-[10px] font-bold shrink-0 ${badgeClass}`}>
              {outcome}
            </span>
            <span className="text-xs text-gray-700 group-hover:text-blue-600 group-hover:underline">{scoreLabel}</span>
          </Link>
          <Link href={`/tournaments/${leagueId}`} className="text-xs text-gray-500 hover:text-blue-600 hover:underline truncate">{leagueName}</Link>
        </div>
      </div>

      <div className="shrink-0 flex flex-col items-end gap-2">
        <button
          onClick={handleDismiss}
          disabled={loading}
          className="cursor-pointer text-xs bg-blue-200 hover:bg-blue-300 text-blue-900 font-medium px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
        >
          {loading ? '...' : 'OK'}
        </button>
        <Link
          href={`/tournaments/${leagueId}/matches/${matchId}/edit`}
          className="text-xs text-blue-600 hover:underline"
        >
          Suggest edit
        </Link>
      </div>
    </div>
  );
}

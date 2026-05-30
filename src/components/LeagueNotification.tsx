'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function LeagueNotification({
  leagueId,
  leagueName,
  type,
  line2,
  bgClass,
  borderClass,
  iconClass,
  icon,
}: {
  leagueId: string;
  leagueName: string;
  type: 'started' | 'ended';
  line2: string;
  bgClass: string;
  borderClass: string;
  iconClass: string;
  icon: React.ReactNode;
}) {
  const [dismissed, setDismissed] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleDismiss() {
    setLoading(true);
    await fetch(`/api/leagues/${leagueId}/seen`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type }),
    });
    setLoading(false);
    setDismissed(true);
  }

  if (dismissed) return null;

  return (
    <div className={`${bgClass} ${borderClass} border rounded-xl px-4 py-3 flex items-center gap-3`}>
      <div className={`shrink-0 ${iconClass}`}>{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-800">
          Your{' '}
          <Link href={`/leagues/${leagueId}`} className="hover:underline hover:text-blue-600">
            {leagueName}
          </Link>
          {' '}league has {type === 'started' ? 'started' : 'finished'}
        </p>
        <p className="text-xs text-gray-500 mt-0.5">{line2}</p>
      </div>
      <button
        onClick={handleDismiss}
        disabled={loading}
        className={`shrink-0 cursor-pointer text-xs font-medium px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 ${
          type === 'started'
            ? 'bg-teal-200 hover:bg-teal-300 text-teal-900'
            : 'bg-purple-200 hover:bg-purple-300 text-purple-900'
        }`}
      >
        {loading ? '...' : 'OK'}
      </button>
    </div>
  );
}

'use client';

import { useState } from 'react';
import Link from 'next/link';

type ArchivedLeague = {
  id: string;
  name: string;
  status: string;
  season_start: string;
  season_end: string;
  is_public: boolean;
  player_count: string;
  matches_played: string;
  max_players: number;
};

function ArchivedLeagueCard({ league }: { league: ArchivedLeague }) {
  const totalPossible = Math.floor(Number(league.player_count) * (Number(league.player_count) - 1) / 2);
  return (
    <Link
      href={`/leagues/${league.id}`}
      className="block bg-white rounded-xl border border-gray-200 p-4 hover:border-gray-300 transition-colors opacity-75"
    >
      <div className="flex items-start justify-between">
        <span className="font-medium text-gray-600">{league.name}</span>
        <span className="text-xs px-2 py-1 rounded-full font-medium bg-slate-100 text-slate-500">Archived</span>
      </div>
      <div className="flex items-center justify-between mt-2">
        <span className="text-xs text-gray-400">
          Players: {league.player_count} | Games Played: {league.matches_played}/{totalPossible}
        </span>
        <p className="text-xs text-gray-400">
          {new Date(league.season_start).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
          {' - '}
          {new Date(league.season_end).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
        </p>
      </div>
    </Link>
  );
}

export default function ArchivedLeaguesSection({ leagues }: { leagues: ArchivedLeague[] }) {
  const [open, setOpen] = useState(false);

  if (leagues.length === 0) return null;

  return (
    <div className="mb-8">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3 hover:text-gray-500 transition-colors"
      >
        <svg
          className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-90' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
        Archived ({leagues.length})
      </button>
      {open && (
        <div className="space-y-3">
          {leagues.map((l) => <ArchivedLeagueCard key={l.id} league={l} />)}
        </div>
      )}
    </div>
  );
}

'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import LeagueColorPicker from '@/components/LeagueColorPicker';
import { LEAGUE_COLOR_KEYS, type LeagueColorKey } from '@/lib/leagueColor';

export default function EditLeagueForm({
  leagueId,
  currentName,
  currentDescription,
  currentStatus,
  currentSeasonStart,
  currentSeasonEnd,
  currentIsPublic,
  currentTiebreaker,
  currentColor,
  currentScoringMethod,
  currentMaxPlayers,
  currentNumPromoted,
  currentNumRelegated,
  currentJoinType,
  leagueType,
}: {
  leagueId: string;
  currentName: string;
  currentDescription: string;
  currentStatus: string;
  currentSeasonStart: string;
  currentSeasonEnd: string;
  currentIsPublic: boolean;
  currentTiebreaker: string;
  currentColor: string | null;
  currentScoringMethod: string;
  currentMaxPlayers: number;
  currentNumPromoted: number;
  currentNumRelegated: number;
  currentJoinType: string;
  leagueType: string;
}) {
  const router = useRouter();
  const [name, setName] = useState(currentName);
  const [description, setDescription] = useState(currentDescription);
  const [status, setStatus] = useState(currentStatus);
  const [seasonStart, setSeasonStart] = useState(currentSeasonStart);
  const [seasonEnd, setSeasonEnd] = useState(currentSeasonEnd);
  const [isPublic, setIsPublic] = useState(currentIsPublic);
  const [tiebreaker, setTiebreaker] = useState(currentTiebreaker);
  const [scoringMethod, setScoringMethod] = useState(currentScoringMethod);
  const [maxPlayers, setMaxPlayers] = useState(currentMaxPlayers);
  const [numPromoted, setNumPromoted] = useState(currentNumPromoted);
  const [numRelegated, setNumRelegated] = useState(currentNumRelegated);
  const [joinType, setJoinType] = useState(currentJoinType);
  const hasStoredColor = currentColor && LEAGUE_COLOR_KEYS.includes(currentColor as LeagueColorKey);
  const [color, setColor] = useState<LeagueColorKey>(hasStoredColor ? currentColor as LeagueColorKey : LEAGUE_COLOR_KEYS[0]);
  useEffect(() => {
    if (!hasStoredColor) setColor(LEAGUE_COLOR_KEYS[Math.floor(Math.random() * LEAGUE_COLOR_KEYS.length)]);
  }, []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  const isDoubles = leagueType === 'doubles';

  function mark() { setSaved(false); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSaved(false);
    setLoading(true);

    const res = await fetch(`/api/leagues/${leagueId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description, status, seasonStart, seasonEnd, isPublic, tiebreaker, color, scoringMethod, maxPlayers, numPromoted, numRelegated, joinType }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error || 'Something went wrong');
      return;
    }

    setSaved(true);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-base font-semibold text-gray-700">Tournament settings</h2>
        <div className="flex items-center gap-3">
          {saved && <p className="text-xs text-green-700">Saved!</p>}
          <button
            type="submit"
            disabled={loading}
            className="bg-green-700 hover:bg-green-800 disabled:opacity-50 text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors"
          >
            {loading ? 'Saving...' : 'Save changes'}
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

      <div className="border-t border-gray-100 pt-5">
        <label htmlFor="leagueName" className="block text-sm font-medium text-gray-700 mb-1">Tournament name</label>
        <input
          id="leagueName"
          type="text"
          value={name}
          onChange={(e) => { setName(e.target.value); mark(); }}
          required
          className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
        />
      </div>

      <div>
        <label htmlFor="leagueDescription" className="block text-sm font-medium text-gray-700 mb-1">Description <span className="text-gray-400 font-normal">(optional)</span></label>
        <textarea
          id="leagueDescription"
          value={description}
          onChange={(e) => { setDescription(e.target.value); mark(); }}
          rows={3}
          className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm resize-none"
          placeholder="e.g. Summer singles tournament for intermediate players..."
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="seasonStart" className="block text-sm font-medium text-gray-700 mb-1">Start date</label>
          <input
            id="seasonStart"
            type="date"
            value={seasonStart}
            onChange={(e) => { setSeasonStart(e.target.value); mark(); }}
            required
            className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
          />
        </div>
        <div>
          <label htmlFor="seasonEnd" className="block text-sm font-medium text-gray-700 mb-1">End date</label>
          <input
            id="seasonEnd"
            type="date"
            value={seasonEnd}
            onChange={(e) => { setSeasonEnd(e.target.value); mark(); }}
            required
            className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
          />
        </div>
      </div>

      <div>
        <label htmlFor="scoringMethod" className="block text-sm font-medium text-gray-700 mb-1">Scoring method</label>
        <select
          id="scoringMethod"
          value={scoringMethod}
          onChange={(e) => { setScoringMethod(e.target.value); mark(); }}
          className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
        >
          <option value="1_set_tiebreak">1 set only (allow tiebreaker)</option>
          <option value="1_set_no_tiebreak">1 set only (no tiebreaker)</option>
          <option value="best_of_3_tiebreak">Best of 3 sets (allow tiebreaker)</option>
          <option value="best_of_3_no_tiebreak">Best of 3 sets (no tiebreaker)</option>
          <option value="best_of_5_tiebreak">Best of 5 sets (allow tiebreaker)</option>
          <option value="best_of_5_no_tiebreak">Best of 5 sets (no tiebreaker)</option>
        </select>
      </div>

      <div>
        <label htmlFor="maxPlayers" className="block text-sm font-medium text-gray-700 mb-1">
          {isDoubles ? 'Number of pairs' : 'Number of players'}
        </label>
        <select
          id="maxPlayers"
          value={maxPlayers}
          onChange={(e) => { setMaxPlayers(Number(e.target.value)); mark(); }}
          className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
        >
          {isDoubles
            ? Array.from({ length: 7 }, (_, i) => i + 2).map((n) => (
                <option key={n} value={n}>{n} pairs ({n * 2} players)</option>
              ))
            : Array.from({ length: 11 }, (_, i) => i + 2).map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="numPromoted" className="block text-sm font-medium text-gray-700 mb-1">Number promoted</label>
          <select
            id="numPromoted"
            value={numPromoted}
            onChange={(e) => { setNumPromoted(Number(e.target.value)); mark(); }}
            className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
          >
            {[0, 1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="numRelegated" className="block text-sm font-medium text-gray-700 mb-1">Number relegated</label>
          <select
            id="numRelegated"
            value={numRelegated}
            onChange={(e) => { setNumRelegated(Number(e.target.value)); mark(); }}
            className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
          >
            {[0, 1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="leagueTiebreaker" className="block text-sm font-medium text-gray-700 mb-1">Position tiebreaker</label>
        <select
          id="leagueTiebreaker"
          value={tiebreaker}
          onChange={(e) => { setTiebreaker(e.target.value); mark(); }}
          className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
        >
          <option value="head_to_head">Head-to-head result</option>
          <option value="most_sets_won">Most sets won</option>
          <option value="set_difference">Set difference (sets for - sets against)</option>
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="leagueStatus" className="block text-sm font-medium text-gray-700 mb-1">Status</label>
          <select
            id="leagueStatus"
            value={status}
            onChange={(e) => { setStatus(e.target.value); mark(); }}
            className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
          >
            <option value="upcoming">Upcoming</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
          </select>
        </div>
        <div>
          <label htmlFor="leagueVisibility" className="block text-sm font-medium text-gray-700 mb-1">Visibility</label>
          <select
            id="leagueVisibility"
            value={isPublic ? 'public' : 'private'}
            onChange={(e) => { setIsPublic(e.target.value === 'public'); mark(); }}
            className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
          >
            <option value="public">Public</option>
            <option value="private">Private</option>
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="joinType" className="block text-sm font-medium text-gray-700 mb-1">Sign-up type</label>
        <select
          id="joinType"
          value={joinType}
          onChange={(e) => { setJoinType(e.target.value); mark(); }}
          className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
        >
          <option value="invite_only">Invite only - admin assigns all players</option>
          <option value="open_invite">Open invite - members can sign up themselves</option>
        </select>
      </div>

      <div>
        <p className="text-sm font-medium text-gray-700 mb-1">Tournament type</p>
        <p className="text-sm text-gray-500 px-3 py-2 bg-gray-50 rounded-lg border border-gray-200">
          {isDoubles ? 'Doubles' : 'Singles'} <span className="text-gray-400 text-xs ml-1">(cannot be changed after creation)</span>
        </p>
      </div>

      <LeagueColorPicker value={color} onChange={(k) => { setColor(k); mark(); }} />
    </form>
  );
}

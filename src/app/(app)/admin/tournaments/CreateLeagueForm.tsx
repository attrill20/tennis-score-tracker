'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import DatePicker from '@/components/DatePicker';
import LeagueColorPicker from '@/components/LeagueColorPicker';
import AssignPlayersPanel from '@/components/AssignPlayersPanel';
import { LEAGUE_COLOR_KEYS, type LeagueColorKey } from '@/lib/leagueColor';

type Member = { id: string; full_name: string };
type Division = { id: string; name: string; order: number };
type Created = { tournamentId: string; format: 'single' | 'multi'; divisions: Division[] };

export default function CreateLeagueForm({ members = [] }: { members?: Member[] }) {
  const [format, setFormat] = useState<'single' | 'multi'>('single');
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [status, setStatus] = useState<'upcoming' | 'active'>('upcoming');
  const [maxPlayers, setMaxPlayers] = useState(8);
  const [scoringMethod, setScoringMethod] = useState('best_of_3_tiebreak');
  const [numPromoted, setNumPromoted] = useState(0);
  const [numRelegated, setNumRelegated] = useState(0);
  const [tiebreaker, setTiebreaker] = useState('head_to_head');
  const [leagueType, setLeagueType] = useState<'singles' | 'doubles'>('singles');
  const [isPublic, setIsPublic] = useState(true);
  const [joinType, setJoinType] = useState<'invite_only' | 'open_invite'>('invite_only');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState<LeagueColorKey>(LEAGUE_COLOR_KEYS[0]);

  // Multi-league fields
  const [numDivisions, setNumDivisions] = useState(3);
  const [roundDates, setRoundDates] = useState<string[]>(['']);
  const [finalEnd, setFinalEnd] = useState('');

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setColor(LEAGUE_COLOR_KEYS[Math.floor(Math.random() * LEAGUE_COLOR_KEYS.length)]);
  }, []);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [created, setCreated] = useState<Created | null>(null);

  function setRoundDate(i: number, val: string) {
    setRoundDates((prev) => prev.map((d, idx) => (idx === i ? val : d)));
  }
  function addRound() {
    setRoundDates((prev) => [...prev, '']);
  }
  function removeRound(i: number) {
    setRoundDates((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const payload =
      format === 'multi'
        ? {
            format,
            name,
            scoringMethod,
            tiebreaker,
            leagueType,
            isPublic,
            description,
            color,
            maxPlayers,
            numPromoted,
            numRelegated,
            numDivisions,
            roundDates: roundDates.filter(Boolean),
            finalEnd,
          }
        : {
            format,
            name,
            startDate,
            endDate,
            status,
            scoringMethod,
            tiebreaker,
            leagueType,
            isPublic,
            joinType,
            description,
            color,
            maxPlayers,
            numPromoted,
            numRelegated,
          };

    const res = await fetch('/api/admin/tournaments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error || 'Something went wrong');
      return;
    }

    setCreated(data as Created);
  }

  if (created) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
          <svg className="w-5 h-5 text-green-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          <div>
            <p className="text-sm font-medium text-green-800">{name} created!</p>
            <p className="text-xs text-green-600 mt-0.5">
              {created.format === 'multi'
                ? 'Now assign players to each division for round 1 below.'
                : 'Now assign players to the tournament below.'}
            </p>
          </div>
        </div>

        {created.divisions.map((div) => (
          <div key={div.id}>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">
              {created.format === 'multi'
                ? div.name
                : leagueType === 'doubles' ? 'Assign pairs' : 'Assign players'}
            </h3>
            <AssignPlayersPanel leagueId={div.id} leagueType={leagueType} members={members} maxPlayers={maxPlayers} />
          </div>
        ))}

        <div className="flex items-center gap-3 pt-2 border-t border-gray-100">
          {created.format === 'multi' ? (
            <Link
              href={`/tournaments/multi/${created.tournamentId}`}
              className="text-sm bg-green-700 hover:bg-green-800 text-white font-medium px-4 py-2 rounded-lg transition-colors"
            >
              View tournament
            </Link>
          ) : (
            <Link
              href={`/admin/tournaments/${created.divisions[0].id}`}
              className="text-sm bg-green-700 hover:bg-green-800 text-white font-medium px-4 py-2 rounded-lg transition-colors"
            >
              Go to tournament settings
            </Link>
          )}
          <Link href="/admin/tournaments" className="text-sm text-gray-500 hover:underline">
            Back to all tournaments
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Tournament format</label>
        <div className="grid grid-cols-2 gap-3">
          {([
            ['single', 'Single', 'One division'],
            ['multi', 'Multi-league', 'Divisions with promotion/relegation'],
          ] as const).map(([val, label, hint]) => (
            <button
              key={val}
              type="button"
              onClick={() => setFormat(val)}
              className={`py-2.5 px-3 rounded-lg border text-sm font-medium transition-colors text-left ${
                format === val
                  ? 'bg-green-900 border-green-900 text-white'
                  : 'border-gray-300 text-gray-500 hover:border-green-900 hover:text-green-900'
              }`}
            >
              <span className="block">{label}</span>
              <span className={`block text-xs font-normal mt-0.5 ${format === val ? 'text-green-100' : 'text-gray-400'}`}>{hint}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Match type</label>
        <div className="grid grid-cols-2 gap-3">
          {(['singles', 'doubles'] as const).map((val) => (
            <button
              key={val}
              type="button"
              onClick={() => { setLeagueType(val); setMaxPlayers(8); }}
              className={`py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                leagueType === val
                  ? 'bg-green-900 border-green-900 text-white'
                  : 'border-gray-300 text-gray-500 hover:border-green-900 hover:text-green-900'
              }`}
            >
              {val === 'singles' ? 'Singles' : 'Doubles'}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label htmlFor="leagueName" className="block text-sm font-medium text-gray-700 mb-1">Tournament name</label>
        <input
          id="leagueName"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
          placeholder={format === 'multi' ? 'e.g. Summer 2026 Championship' : 'e.g. Division 1 - Spring 2026'}
        />
      </div>

      {format === 'single' ? (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="startDate" className="block text-sm font-medium text-gray-700 mb-1">Start date</label>
            <DatePicker
              id="startDate"
              value={startDate}
              onChange={(val) => {
                setStartDate(val);
                if (val) {
                  const today = new Date().toISOString().split('T')[0];
                  setStatus(val > today ? 'upcoming' : 'active');
                }
              }}
              required
            />
          </div>
          <div>
            <label htmlFor="endDate" className="block text-sm font-medium text-gray-700 mb-1">End date</label>
            <DatePicker id="endDate" value={endDate} onChange={setEndDate} required />
          </div>
        </div>
      ) : (
        <div className="space-y-4 bg-green-50/50 border border-green-100 rounded-xl p-4">
          <div>
            <label htmlFor="numDivisions" className="block text-sm font-medium text-gray-700 mb-1">Number of divisions</label>
            <select
              id="numDivisions"
              value={numDivisions}
              onChange={(e) => setNumDivisions(Number(e.target.value))}
              className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
            >
              {[2, 3, 4, 5, 6, 7, 8].map((n) => (
                <option key={n} value={n}>{n} divisions</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Round start dates</label>
            <p className="text-xs text-gray-400 mb-2">Each date starts a fresh round. After each round, players are promoted/relegated between divisions.</p>
            <div className="space-y-2">
              {roundDates.map((d, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 w-16 shrink-0">Round {i + 1}</span>
                  <div className="flex-1">
                    <DatePicker id={`round-${i}`} value={d} onChange={(val) => setRoundDate(i, val)} required />
                  </div>
                  {roundDates.length > 1 && (
                    <button type="button" onClick={() => removeRound(i)} className="text-xs text-red-500 hover:text-red-700 hover:underline shrink-0">
                      Remove
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button type="button" onClick={addRound} className="mt-2 text-xs text-green-700 hover:underline font-medium">
              + Add another round
            </button>
          </div>

          <div>
            <label htmlFor="finalEnd" className="block text-sm font-medium text-gray-700 mb-1">Final finishing date</label>
            <DatePicker id="finalEnd" value={finalEnd} onChange={setFinalEnd} required />
          </div>
        </div>
      )}

      <div>
        <label htmlFor="scoringMethod" className="block text-sm font-medium text-gray-700 mb-1">Scoring method</label>
        <select
          id="scoringMethod"
          value={scoringMethod}
          onChange={(e) => setScoringMethod(e.target.value)}
          className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
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
          {leagueType === 'doubles'
            ? (format === 'multi' ? 'Pairs per division' : 'Number of pairs')
            : (format === 'multi' ? 'Players per division' : 'Number of players')}
        </label>
        <select
          id="maxPlayers"
          value={maxPlayers}
          onChange={(e) => setMaxPlayers(Number(e.target.value))}
          className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
        >
          {leagueType === 'doubles'
            ? Array.from({ length: 7 }, (_, i) => i + 2).map((n) => (
                <option key={n} value={n}>{n} pairs ({n * 2} players)</option>
              ))
            : Array.from({ length: 11 }, (_, i) => i + 2).map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="numPromoted" className="block text-sm font-medium text-gray-700 mb-1">Number promoted</label>
          <select
            id="numPromoted"
            value={numPromoted}
            onChange={(e) => setNumPromoted(Number(e.target.value))}
            className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
          >
            {[0, 1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="numRelegated" className="block text-sm font-medium text-gray-700 mb-1">Number relegated</label>
          <select
            id="numRelegated"
            value={numRelegated}
            onChange={(e) => setNumRelegated(Number(e.target.value))}
            className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
          >
            {[0, 1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>
      </div>

      {format === 'single' && (
        <div>
          <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-1">Status</label>
          <select
            id="status"
            value={status}
            onChange={(e) => setStatus(e.target.value as 'upcoming' | 'active')}
            className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
          >
            <option value="upcoming">Upcoming</option>
            <option value="active">Active</option>
          </select>
        </div>
      )}

      <div>
        <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">Description <span className="text-gray-400 font-normal">(optional)</span></label>
        <textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm resize-none"
          placeholder="e.g. Summer singles tournament for intermediate players..."
        />
      </div>

      <div>
        <label htmlFor="tiebreaker" className="block text-sm font-medium text-gray-700 mb-1">Position tiebreaker</label>
        <select
          id="tiebreaker"
          value={tiebreaker}
          onChange={(e) => setTiebreaker(e.target.value)}
          className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
        >
          <option value="head_to_head">Head-to-head result</option>
          <option value="most_sets_won">Most sets won</option>
          <option value="set_difference">Set difference (sets for - sets against)</option>
        </select>
      </div>

      <div>
        <label htmlFor="visibility" className="block text-sm font-medium text-gray-700 mb-1">Visibility</label>
        <select
          id="visibility"
          value={isPublic ? 'public' : 'private'}
          onChange={(e) => setIsPublic(e.target.value === 'public')}
          className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
        >
          <option value="public">Public - visible to all members</option>
          <option value="private">Private - invited players and admins only</option>
        </select>
      </div>

      {format === 'single' && (
        <div>
          <label htmlFor="joinType" className="block text-sm font-medium text-gray-700 mb-1">Sign-up type</label>
          <select
            id="joinType"
            value={joinType}
            onChange={(e) => setJoinType(e.target.value as 'invite_only' | 'open_invite')}
            className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
          >
            <option value="invite_only">Invite only - admin assigns all players</option>
            <option value="open_invite">Open invite - members can sign up themselves</option>
          </select>
          {joinType === 'open_invite' && (
            <p className="text-xs text-gray-400 mt-1">You can still pre-assign players via the assign players form. Others can join up to the max.</p>
          )}
        </div>
      )}

      <LeagueColorPicker value={color} onChange={setColor} />

      {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

      <div>
        <button
          type="submit"
          disabled={loading}
          className="bg-green-700 hover:bg-green-800 disabled:opacity-50 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors"
        >
          {loading ? 'Creating...' : 'Create tournament'}
        </button>
      </div>
    </form>
  );
}

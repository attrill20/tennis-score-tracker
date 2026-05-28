'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

type TbEntry = { my: string; their: string };

function isTiebreakSet(my: number, their: number) {
  return (my === 7 && their === 6) || (my === 6 && their === 7);
}

function toFormSets(setScores: [number, number][] | null) {
  const base = [{ my: '', their: '' }, { my: '', their: '' }, { my: '', their: '' }];
  if (!setScores) return base;
  return base.map((_, i) =>
    setScores[i]
      ? { my: String(setScores[i][0]), their: String(setScores[i][1]) }
      : { my: '', their: '' }
  );
}

function toFormTiebreaks(tiebreakScores: ([number, number] | null)[] | null): TbEntry[] {
  const base: TbEntry[] = [{ my: '', their: '' }, { my: '', their: '' }, { my: '', their: '' }];
  if (!tiebreakScores) return base;
  return base.map((_, i) =>
    tiebreakScores[i]
      ? { my: String(tiebreakScores[i]![0]), their: String(tiebreakScores[i]![1]) }
      : { my: '', their: '' }
  );
}

export default function SuggestEditForm({
  matchId,
  leagueId,
  myName,
  submitterName,
  currentMyScore,
  currentTheirScore,
  setScores,
  tiebreakScores,
  playedAt: initialPlayedAt,
}: {
  matchId: string;
  leagueId: string;
  myName: string;
  submitterName: string;
  currentMyScore: number;
  currentTheirScore: number;
  setScores: [number, number][] | null;
  tiebreakScores: ([number, number] | null)[] | null;
  playedAt: string;
}) {
  const router = useRouter();
  const [sets, setSets] = useState(toFormSets(setScores));
  const [tiebreaks, setTiebreaks] = useState(toFormTiebreaks(tiebreakScores));
  const [playedAt, setPlayedAt] = useState(initialPlayedAt);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function updateSet(index: number, field: 'my' | 'their', value: string) {
    if (value !== '' && !/^\d+$/.test(value)) return;
    setSets((prev) => prev.map((s, i) => (i === index ? { ...s, [field]: value } : s)));
    setTiebreaks((prev) => prev.map((t, i) => {
      if (i !== index) return t;
      const updated = { ...sets[index], [field]: value };
      const my = parseInt(updated.my);
      const their = parseInt(updated.their);
      return isTiebreakSet(my, their) ? t : { my: '', their: '' };
    }));
  }

  function updateTiebreak(index: number, field: 'my' | 'their', value: string) {
    if (value !== '' && !/^\d+$/.test(value)) return;
    setTiebreaks((prev) => prev.map((t, i) => (i === index ? { ...t, [field]: value } : t)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    const playedIndices = sets.reduce<number[]>((acc, s, i) => {
      if (s.my !== '' && s.their !== '') acc.push(i);
      return acc;
    }, []);
    const playedSets = playedIndices.map((i) => [parseInt(sets[i].my), parseInt(sets[i].their)]);
    const playedTiebreaks = playedIndices.map((i) => {
      const my = parseInt(sets[i].my);
      const their = parseInt(sets[i].their);
      if (!isTiebreakSet(my, their)) return null;
      const tbMy = tiebreaks[i].my !== '' ? parseInt(tiebreaks[i].my) : null;
      const tbTheir = tiebreaks[i].their !== '' ? parseInt(tiebreaks[i].their) : null;
      if (tbMy === null && tbTheir === null) return null;
      return [tbMy ?? 0, tbTheir ?? 0];
    });

    let mySetsWon = 0, theirSetsWon = 0;
    for (const [my, their] of playedSets) {
      if (my > their) mySetsWon++;
      else if (their > my) theirSetsWon++;
    }

    if (playedSets.length < 2) {
      setError('At least 2 sets must be entered.');
      return;
    }
    setLoading(true);
    const res = await fetch(`/api/matches/${matchId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'suggest-edit', sets: playedSets, tiebreaks: playedTiebreaks, playedAt }),
    });
    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error || 'Something went wrong');
      return;
    }

    router.push(`/leagues/${leagueId}/matches/${matchId}`);
  }

  const myWon = currentMyScore > currentTheirScore;
  const anyTiebreak = sets.some((s) => isTiebreakSet(parseInt(s.my), parseInt(s.their)));

  return (
    <div className="space-y-4">
      {/* Current result for reference */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">Current result</p>

        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1" />
          <span className="w-14 text-center text-xs text-gray-400 font-medium">Set 1</span>
          <span className="w-14 text-center text-xs text-gray-400 font-medium">Set 2</span>
          <span className="w-14 text-center text-xs text-gray-400 font-medium">Set 3</span>
        </div>

        <div className="flex items-center gap-3 mb-2">
          <span className={`flex-1 text-sm font-medium truncate ${myWon ? 'text-gray-800' : 'text-gray-400'}`}>{myName}</span>
          {[0, 1, 2].map((i) => {
            const myTb = tiebreakScores?.[i] != null ? tiebreakScores![i]![0] : null;
            return (
              <div key={i} className={`relative w-14 py-2 rounded-lg text-sm text-center font-medium ${
                setScores?.[i]
                  ? setScores[i][0] > setScores[i][1] ? 'bg-green-50 text-green-700' : 'bg-gray-50 text-gray-400'
                  : 'text-gray-200'
              }`}>
                {setScores?.[i] ? setScores[i][0] : '-'}
                {myTb !== null && (
                  <span className="absolute top-1 right-2 text-[9px] font-normal leading-none opacity-60">{myTb}</span>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex items-center gap-3">
          <span className={`flex-1 text-sm font-medium truncate ${!myWon ? 'text-gray-800' : 'text-gray-400'}`}>{submitterName}</span>
          {[0, 1, 2].map((i) => {
            const theirTb = tiebreakScores?.[i] != null ? tiebreakScores![i]![1] : null;
            return (
              <div key={i} className={`relative w-14 py-2 rounded-lg text-sm text-center font-medium ${
                setScores?.[i]
                  ? setScores[i][1] > setScores[i][0] ? 'bg-green-50 text-green-700' : 'bg-gray-50 text-gray-400'
                  : 'text-gray-200'
              }`}>
                {setScores?.[i] ? setScores[i][1] : '-'}
                {theirTb !== null && (
                  <span className="absolute top-1 right-2 text-[9px] font-normal leading-none opacity-60">{theirTb}</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Proposed correction form */}
      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-6 sm:p-8 space-y-6">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Your correction</p>

        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="flex-1" />
            <span className="w-14 text-center text-xs text-gray-400 font-medium">Set 1</span>
            <span className="w-14 text-center text-xs text-gray-400 font-medium">Set 2</span>
            <span className="w-14 text-center text-xs text-gray-400 font-medium">Set 3</span>
          </div>

          <div className="flex items-center gap-3 mb-3">
            <span className="flex-1 text-sm font-medium text-gray-800 truncate">{myName}</span>
            {sets.map((set, i) => (
              <input
                key={i}
                type="text"
                inputMode="numeric"
                value={set.my}
                onChange={(e) => updateSet(i, 'my', e.target.value)}
                className="w-14 px-2 py-2.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm text-center"
                placeholder="-"
              />
            ))}
          </div>

          <div className="flex items-center gap-3">
            <span className="flex-1 text-sm text-gray-500 truncate">{submitterName}</span>
            {sets.map((set, i) => (
              <input
                key={i}
                type="text"
                inputMode="numeric"
                value={set.their}
                onChange={(e) => updateSet(i, 'their', e.target.value)}
                className="w-14 px-2 py-2.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm text-center"
                placeholder="-"
              />
            ))}
          </div>

          {anyTiebreak && (
            <div className="mt-3 pt-3 border-t border-gray-100">
              <div className="flex items-start gap-3">
                <span className="flex-1 text-xs text-gray-400 pt-1">Tiebreak</span>
                {sets.map((set, i) => {
                  const my = parseInt(set.my);
                  const their = parseInt(set.their);
                  return (
                    <div key={i} className="w-14">
                      {isTiebreakSet(my, their) ? (
                        <div className="space-y-1">
                          <input
                            type="text"
                            inputMode="numeric"
                            value={tiebreaks[i].my}
                            onChange={(e) => updateTiebreak(i, 'my', e.target.value)}
                            className="w-full px-1 py-1 rounded border border-gray-300 focus:outline-none focus:ring-1 focus:ring-green-500 text-xs text-center"
                            placeholder="Me"
                            maxLength={2}
                          />
                          <input
                            type="text"
                            inputMode="numeric"
                            value={tiebreaks[i].their}
                            onChange={(e) => updateTiebreak(i, 'their', e.target.value)}
                            className="w-full px-1 py-1 rounded border border-gray-300 focus:outline-none focus:ring-1 focus:ring-green-500 text-xs text-center"
                            placeholder="Opp"
                            maxLength={2}
                          />
                        </div>
                      ) : <div />}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div>
          <label htmlFor="playedAt" className="block text-sm font-medium text-gray-700 mb-1">Date played</label>
          <input
            id="playedAt"
            type="date"
            value={playedAt}
            onChange={(e) => setPlayedAt(e.target.value)}
            required
            className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
          />
        </div>

        {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-green-700 hover:bg-green-800 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg transition-colors text-sm"
        >
          {loading ? 'Sending...' : 'Send correction to ' + submitterName}
        </button>
      </form>
    </div>
  );
}

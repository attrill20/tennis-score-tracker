'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function EditMatchForm({
  matchId,
  leagueId,
  userName,
  opponentName,
  playedAt: initialPlayedAt,
}: {
  matchId: string;
  leagueId: string;
  userName: string;
  opponentName: string;
  playedAt: string;
}) {
  const router = useRouter();

  const [sets, setSets] = useState([
    { my: '', their: '' },
    { my: '', their: '' },
    { my: '', their: '' },
  ]);
  const [playedAt, setPlayedAt] = useState(initialPlayedAt.split('T')[0]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function updateSet(index: number, field: 'my' | 'their', value: string) {
    if (value !== '' && !/^\d+$/.test(value)) return;
    setSets((prev) => prev.map((s, i) => (i === index ? { ...s, [field]: value } : s)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    let mySetsWon = 0, theirSetsWon = 0;
    for (const set of sets) {
      if (set.my !== '' && set.their !== '') {
        const my = parseInt(set.my);
        const their = parseInt(set.their);
        if (my > their) mySetsWon++;
        else if (their > my) theirSetsWon++;
      }
    }

    if (mySetsWon + theirSetsWon < 2) {
      setError('At least 2 sets must be entered.');
      return;
    }
    if (mySetsWon === theirSetsWon) {
      setError('Scores cannot be a draw - one player must win.');
      return;
    }

    setLoading(true);
    const res = await fetch(`/api/matches/${matchId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ myScore: mySetsWon, theirScore: theirSetsWon, playedAt }),
    });
    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error || 'Something went wrong');
      return;
    }

    router.push(`/leagues/${leagueId}`);
  }

  return (
    <div className="max-w-lg mx-auto">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Edit result</h1>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-6 sm:p-8 space-y-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="flex-1" />
            <span className="w-14 text-center text-xs text-gray-400 font-medium">Set 1</span>
            <span className="w-14 text-center text-xs text-gray-400 font-medium">Set 2</span>
            <span className="w-14 text-center text-xs text-gray-400 font-medium">Set 3</span>
          </div>

          <div className="flex items-center gap-3 mb-3">
            <span className="flex-1 text-sm font-medium text-gray-800 truncate">{userName}</span>
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
            <span className="flex-1 text-sm text-gray-500 truncate">{opponentName}</span>
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

        {error && (
          <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-green-700 hover:bg-green-800 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg transition-colors text-sm"
        >
          {loading ? 'Saving...' : 'Save changes'}
        </button>
      </form>
    </div>
  );
}

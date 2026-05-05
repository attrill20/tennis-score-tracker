'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

type Player = { id: string; full_name: string };

export default function SubmitScorePage() {
  const { id: leagueId } = useParams<{ id: string }>();
  const router = useRouter();

  const [players, setPlayers] = useState<Player[]>([]);
  const [opponent, setOpponent] = useState('');
  const [myScore, setMyScore] = useState('');
  const [theirScore, setTheirScore] = useState('');
  const [playedAt, setPlayedAt] = useState(new Date().toISOString().split('T')[0]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch(`/api/leagues/${leagueId}/players`)
      .then((r) => r.json())
      .then((data) => setPlayers(data.players ?? []));
  }, [leagueId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (myScore === theirScore) {
      setError('Scores cannot be a draw — one player must win.');
      return;
    }

    setLoading(true);
    const res = await fetch('/api/matches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        leagueId,
        opponentId: opponent,
        myScore: parseInt(myScore),
        theirScore: parseInt(theirScore),
        playedAt,
      }),
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
    <div className="max-w-md">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Submit a result</h1>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Opponent</label>
          <select
            value={opponent}
            onChange={(e) => setOpponent(e.target.value)}
            required
            className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
          >
            <option value="">Select opponent...</option>
            {players.map((p) => (
              <option key={p.id} value={p.id}>{p.full_name}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Your sets</label>
            <input
              type="number"
              min="0"
              max="3"
              value={myScore}
              onChange={(e) => setMyScore(e.target.value)}
              required
              className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
              placeholder="0"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Their sets</label>
            <input
              type="number"
              min="0"
              max="3"
              value={theirScore}
              onChange={(e) => setTheirScore(e.target.value)}
              required
              className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
              placeholder="0"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Date played</label>
          <input
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
          {loading ? 'Submitting...' : 'Submit result'}
        </button>
      </form>
    </div>
  );
}

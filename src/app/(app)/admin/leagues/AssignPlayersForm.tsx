'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type League = { id: string; name: string; status: string };
type Member = { id: string; full_name: string };

export default function AssignPlayersForm({ leagues, members }: { leagues: League[]; members: Member[] }) {
  const router = useRouter();
  const [leagueId, setLeagueId] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  function togglePlayer(id: string) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (selected.length < 2) {
      setError('Select at least 2 players');
      return;
    }
    if (selected.length > 8) {
      setError('Maximum 8 players per league');
      return;
    }

    setLoading(true);
    const res = await fetch(`/api/admin/leagues/${leagueId}/players`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerIds: selected }),
    });
    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error || 'Something went wrong');
      return;
    }

    setSuccess(`${selected.length} players assigned successfully`);
    setSelected([]);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">League</label>
        <select
          value={leagueId}
          onChange={(e) => setLeagueId(e.target.value)}
          required
          className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
        >
          <option value="">Select a league...</option>
          {leagues.map((l) => (
            <option key={l.id} value={l.id}>{l.name}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Players ({selected.length}/8 selected)
        </label>
        <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto border border-gray-200 rounded-lg p-3">
          {members.map((m) => (
            <label key={m.id} className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={selected.includes(m.id)}
                onChange={() => togglePlayer(m.id)}
                className="accent-green-700"
              />
              <span className="text-gray-700">{m.full_name}</span>
            </label>
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
      {success && <p className="text-sm text-green-700 bg-green-50 px-3 py-2 rounded-lg">{success}</p>}

      <button
        type="submit"
        disabled={loading}
        className="bg-green-700 hover:bg-green-800 disabled:opacity-50 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors"
      >
        {loading ? 'Assigning...' : 'Assign players'}
      </button>
    </form>
  );
}

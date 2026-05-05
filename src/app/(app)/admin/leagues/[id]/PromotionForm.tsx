'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { PlayerStanding } from '@/lib/league';

export default function PromotionForm({ leagueId, standings }: { leagueId: string; standings: PlayerStanding[] }) {
  const router = useRouter();
  // Default: top 2 promoted, bottom 2 relegated
  const [promoted, setPromoted] = useState<string[]>(standings.slice(0, 2).map((s) => s.id));
  const [relegated, setRelegated] = useState<string[]>(standings.slice(-2).map((s) => s.id));
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  function togglePromoted(id: string) {
    setPromoted((prev) => prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]);
  }

  function toggleRelegated(id: string) {
    setRelegated((prev) => prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]);
  }

  async function handleConfirm() {
    setError('');
    setLoading(true);
    const res = await fetch(`/api/admin/leagues/${leagueId}/promote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ promoted, relegated, standings: standings.map((s) => s.id) }),
    });
    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error || 'Something went wrong');
      return;
    }

    setSuccess('Final positions saved');
    router.refresh();
  }

  if (standings.length === 0) {
    return <p className="text-sm text-gray-400">No players in this league yet.</p>;
  }

  return (
    <div className="space-y-3">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-gray-400 border-b border-gray-100">
            <th className="text-left py-2 font-medium">Player</th>
            <th className="text-center py-2 font-medium">Pts</th>
            <th className="text-center py-2 font-medium">Promote</th>
            <th className="text-center py-2 font-medium">Relegate</th>
          </tr>
        </thead>
        <tbody>
          {standings.map((s, i) => (
            <tr key={s.id} className="border-b border-gray-50">
              <td className="py-2.5 text-gray-800">
                <span className="text-gray-400 mr-2 text-xs">{i + 1}</span>{s.name}
              </td>
              <td className="text-center text-gray-600">{s.points}</td>
              <td className="text-center">
                <input
                  type="checkbox"
                  checked={promoted.includes(s.id)}
                  onChange={() => togglePromoted(s.id)}
                  className="accent-green-700"
                />
              </td>
              <td className="text-center">
                <input
                  type="checkbox"
                  checked={relegated.includes(s.id)}
                  onChange={() => toggleRelegated(s.id)}
                  className="accent-red-500"
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="flex items-center gap-4 pt-2 text-xs text-gray-400">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block"></span> Promoted: {promoted.length}</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400 inline-block"></span> Relegated: {relegated.length}</span>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {success && <p className="text-sm text-green-700">{success}</p>}

      <button
        onClick={handleConfirm}
        disabled={loading}
        className="bg-green-700 hover:bg-green-800 disabled:opacity-50 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
      >
        {loading ? 'Saving...' : 'Confirm final positions'}
      </button>
    </div>
  );
}

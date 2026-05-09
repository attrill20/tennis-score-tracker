'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function LeagueDatesForm({
  leagueId,
  seasonStart,
  seasonEnd,
}: {
  leagueId: string;
  seasonStart: string;
  seasonEnd: string;
}) {
  const router = useRouter();
  const [start, setStart] = useState(seasonStart);
  const [end, setEnd] = useState(seasonEnd);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSaved(false);
    setLoading(true);

    const res = await fetch(`/api/leagues/${leagueId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ seasonStart: start, seasonEnd: end }),
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
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="seasonStart" className="block text-sm font-medium text-gray-700 mb-1">Start date</label>
          <input
            id="seasonStart"
            type="date"
            value={start}
            onChange={(e) => { setStart(e.target.value); setSaved(false); }}
            required
            className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
          />
        </div>
        <div>
          <label htmlFor="seasonEnd" className="block text-sm font-medium text-gray-700 mb-1">End date</label>
          <input
            id="seasonEnd"
            type="date"
            value={end}
            onChange={(e) => { setEnd(e.target.value); setSaved(false); }}
            required
            className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
          />
        </div>
      </div>

      <div className="relative inline-block">
        <button
          type="submit"
          disabled={loading}
          className="bg-green-700 hover:bg-green-800 disabled:opacity-50 text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors"
        >
          {loading ? 'Saving...' : 'Save dates'}
        </button>
        {saved && <p className="absolute left-0 top-full mt-1 text-xs text-green-700 whitespace-nowrap">Saved!</p>}
        {error && <p className="absolute left-0 top-full mt-1 text-xs text-red-600 whitespace-nowrap">{error}</p>}
      </div>
    </form>
  );
}

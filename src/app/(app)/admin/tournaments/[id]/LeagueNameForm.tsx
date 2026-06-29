'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function LeagueNameForm({ leagueId, currentName }: { leagueId: string; currentName: string }) {
  const router = useRouter();
  const [name, setName] = useState(currentName);
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
      body: JSON.stringify({ name }),
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
    <form onSubmit={handleSubmit} className="flex items-end gap-3">
      <div className="flex-1">
        <input
          id="leagueName"
          type="text"
          value={name}
          onChange={(e) => { setName(e.target.value); setSaved(false); }}
          required
          className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
        />
      </div>
      <div className="relative">
        <button
          type="submit"
          disabled={loading}
          className="bg-green-700 hover:bg-green-800 disabled:opacity-50 text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors"
        >
          {loading ? 'Saving...' : 'Save'}
        </button>
        {saved && <p className="absolute left-0 top-full mt-1 text-xs text-green-700 whitespace-nowrap">Saved!</p>}
        {error && <p className="absolute left-0 top-full mt-1 text-xs text-red-600 whitespace-nowrap">{error}</p>}
      </div>
    </form>
  );
}

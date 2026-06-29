'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function LeagueDescriptionForm({ leagueId, currentDescription }: { leagueId: string; currentDescription: string }) {
  const router = useRouter();
  const [description, setDescription] = useState(currentDescription);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaved(false);
    setLoading(true);

    await fetch(`/api/leagues/${leagueId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description }),
    });

    setLoading(false);
    setSaved(true);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <textarea
        value={description}
        onChange={(e) => { setDescription(e.target.value); setSaved(false); }}
        rows={3}
        className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm resize-none"
        placeholder="e.g. Summer singles league for intermediate players..."
      />
      <div className="relative inline-block">
        <button
          type="submit"
          disabled={loading}
          className="bg-green-700 hover:bg-green-800 disabled:opacity-50 text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors"
        >
          {loading ? 'Saving...' : 'Save description'}
        </button>
        {saved && <p className="absolute left-0 top-full mt-1 text-xs text-green-700 whitespace-nowrap">Saved!</p>}
      </div>
    </form>
  );
}

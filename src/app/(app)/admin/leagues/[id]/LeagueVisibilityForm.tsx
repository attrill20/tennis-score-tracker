'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function LeagueVisibilityForm({ leagueId, isPublic: initial }: { leagueId: string; isPublic: boolean }) {
  const router = useRouter();
  const [isPublic, setIsPublic] = useState(initial);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleChange(value: boolean) {
    setIsPublic(value);
    setSaved(false);
    setLoading(true);

    await fetch(`/api/leagues/${leagueId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isPublic: value }),
    });

    setLoading(false);
    setSaved(true);
    router.refresh();
  }

  return (
    <div className="relative">
      <select
        value={isPublic ? 'public' : 'private'}
        onChange={(e) => handleChange(e.target.value === 'public')}
        disabled={loading}
        className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm disabled:opacity-50"
      >
        <option value="public">Public - visible to all members</option>
        <option value="private">Private - invited players and admins only</option>
      </select>
      {saved && <p className="absolute left-0 top-full mt-1 text-xs text-green-700 whitespace-nowrap">Saved!</p>}
    </div>
  );
}

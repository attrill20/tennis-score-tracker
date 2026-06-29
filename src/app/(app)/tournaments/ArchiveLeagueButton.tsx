'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function ArchiveLeagueButton({ leagueId }: { leagueId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleArchive() {
    setLoading(true);
    const res = await fetch(`/api/leagues/${leagueId}/archive`, { method: 'POST' });
    setLoading(false);
    if (res.ok) {
      setDone(true);
      router.refresh();
    }
  }

  if (done) return null;

  return (
    <button
      onClick={handleArchive}
      disabled={loading}
      className="relative z-20 text-xs bg-green-700 hover:bg-green-800 disabled:opacity-50 text-white font-medium px-3 py-1 rounded-full transition-colors"
    >
      {loading ? 'Archiving...' : 'Archive'}
    </button>
  );
}

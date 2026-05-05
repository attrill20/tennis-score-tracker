'use client';

import { useState } from 'react';

export default function DisputeButton({ matchId }: { matchId: string }) {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleDispute() {
    const reason = prompt('Briefly describe why you are disputing this result:');
    if (!reason?.trim()) return;

    setLoading(true);
    const res = await fetch('/api/disputes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ matchId, reason }),
    });
    setLoading(false);
    if (res.ok) setDone(true);
  }

  if (done) return <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">Disputed</span>;

  return (
    <button
      onClick={handleDispute}
      disabled={loading}
      className="text-xs text-red-500 hover:text-red-700 underline disabled:opacity-50"
    >
      {loading ? 'Disputing...' : 'Dispute'}
    </button>
  );
}

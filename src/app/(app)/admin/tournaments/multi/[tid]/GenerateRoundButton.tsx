'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function GenerateRoundButton({ tid, nextRound }: { tid: string; nextRound: number }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function generate() {
    if (!confirm(`Generate round ${nextRound} now? Players will be promoted/relegated from the current round's standings. You can adjust each division afterwards.`)) {
      return;
    }
    setError('');
    setLoading(true);
    const res = await fetch(`/api/admin/tournaments/multi/${tid}/next-round`, { method: 'POST' });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error || 'Something went wrong');
      return;
    }
    router.refresh();
  }

  return (
    <div>
      <button
        onClick={generate}
        disabled={loading}
        className="text-sm bg-green-700 hover:bg-green-800 disabled:opacity-50 text-white font-medium px-4 py-2 rounded-lg transition-colors"
      >
        {loading ? 'Generating...' : `Generate round ${nextRound} now`}
      </button>
      {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg mt-2">{error}</p>}
    </div>
  );
}

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function CreateLeagueForm() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [status, setStatus] = useState<'upcoming' | 'active'>('upcoming');
  const [maxPlayers, setMaxPlayers] = useState(8);
  const [scoringMethod, setScoringMethod] = useState('best_of_3_tiebreak');
  const [numPromoted, setNumPromoted] = useState(2);
  const [numRelegated, setNumRelegated] = useState(2);
  const [isPublic, setIsPublic] = useState(true);
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const res = await fetch('/api/admin/leagues', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, startDate, endDate, status, maxPlayers, scoringMethod, numPromoted, numRelegated, isPublic, description }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error || 'Something went wrong');
      return;
    }

    setName('');
    setStartDate('');
    setEndDate('');
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="leagueName" className="block text-sm font-medium text-gray-700 mb-1">League name</label>
        <input
          id="leagueName"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
          placeholder="e.g. Division 1 - Spring 2026"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="startDate" className="block text-sm font-medium text-gray-700 mb-1">Start date</label>
          <input
            id="startDate"
            type="date"
            value={startDate}
            onChange={(e) => {
              const val = e.target.value;
              setStartDate(val);
              if (val) {
                const today = new Date().toISOString().split('T')[0];
                setStatus(val > today ? 'upcoming' : 'active');
              }
            }}
            required
            className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
          />
        </div>
        <div>
          <label htmlFor="endDate" className="block text-sm font-medium text-gray-700 mb-1">End date</label>
          <input
            id="endDate"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            required
            className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
          />
        </div>
      </div>

      <div>
        <label htmlFor="scoringMethod" className="block text-sm font-medium text-gray-700 mb-1">Scoring method</label>
        <select
          id="scoringMethod"
          value={scoringMethod}
          onChange={(e) => setScoringMethod(e.target.value)}
          className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
        >
          <option value="1_set_tiebreak">1 set only (allow tiebreaker)</option>
          <option value="1_set_no_tiebreak">1 set only (no tiebreaker)</option>
          <option value="best_of_3_tiebreak">Best of 3 sets (allow tiebreaker)</option>
          <option value="best_of_3_no_tiebreak">Best of 3 sets (no tiebreaker)</option>
          <option value="best_of_5_tiebreak">Best of 5 sets (allow tiebreaker)</option>
          <option value="best_of_5_no_tiebreak">Best of 5 sets (no tiebreaker)</option>
        </select>
      </div>

      <div>
        <label htmlFor="maxPlayers" className="block text-sm font-medium text-gray-700 mb-1">Number of players</label>
        <select
          id="maxPlayers"
          value={maxPlayers}
          onChange={(e) => setMaxPlayers(Number(e.target.value))}
          className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
        >
          {Array.from({ length: 11 }, (_, i) => i + 2).map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="numPromoted" className="block text-sm font-medium text-gray-700 mb-1">Number promoted</label>
          <select
            id="numPromoted"
            value={numPromoted}
            onChange={(e) => setNumPromoted(Number(e.target.value))}
            className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
          >
            {[0, 1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="numRelegated" className="block text-sm font-medium text-gray-700 mb-1">Number relegated</label>
          <select
            id="numRelegated"
            value={numRelegated}
            onChange={(e) => setNumRelegated(Number(e.target.value))}
            className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
          >
            {[0, 1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-1">Status</label>
        <select
          id="status"
          value={status}
          onChange={(e) => setStatus(e.target.value as 'upcoming' | 'active')}
          className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
        >
          <option value="upcoming">Upcoming</option>
          <option value="active">Active</option>
        </select>
      </div>

      <div>
        <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">Description <span className="text-gray-400 font-normal">(optional)</span></label>
        <textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm resize-none"
          placeholder="e.g. Summer singles league for intermediate players..."
        />
      </div>

      <div>
        <label htmlFor="visibility" className="block text-sm font-medium text-gray-700 mb-1">Visibility</label>
        <select
          id="visibility"
          value={isPublic ? 'public' : 'private'}
          onChange={(e) => setIsPublic(e.target.value === 'public')}
          className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
        >
          <option value="public">Public - visible to all members</option>
          <option value="private">Private - invited players and admins only</option>
        </select>
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="bg-green-700 hover:bg-green-800 disabled:opacity-50 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors"
      >
        {loading ? 'Creating...' : 'Create league'}
      </button>
    </form>
  );
}

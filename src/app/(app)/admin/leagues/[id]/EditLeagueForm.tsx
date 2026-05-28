'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function EditLeagueForm({
  leagueId,
  currentName,
  currentDescription,
  currentStatus,
  currentSeasonStart,
  currentSeasonEnd,
  currentIsPublic,
  currentTiebreaker,
}: {
  leagueId: string;
  currentName: string;
  currentDescription: string;
  currentStatus: string;
  currentSeasonStart: string;
  currentSeasonEnd: string;
  currentIsPublic: boolean;
  currentTiebreaker: string;
}) {
  const router = useRouter();
  const [name, setName] = useState(currentName);
  const [description, setDescription] = useState(currentDescription);
  const [status, setStatus] = useState(currentStatus);
  const [seasonStart, setSeasonStart] = useState(currentSeasonStart);
  const [seasonEnd, setSeasonEnd] = useState(currentSeasonEnd);
  const [isPublic, setIsPublic] = useState(currentIsPublic);
  const [tiebreaker, setTiebreaker] = useState(currentTiebreaker);
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
      body: JSON.stringify({ name, description, status, seasonStart, seasonEnd, isPublic, tiebreaker }),
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
    <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-base font-semibold text-gray-700">League settings</h2>
        <div className="flex items-center gap-3">
          {saved && <p className="text-xs text-green-700">Saved!</p>}
          <button
            type="submit"
            disabled={loading}
            className="bg-green-700 hover:bg-green-800 disabled:opacity-50 text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors"
          >
            {loading ? 'Saving...' : 'Save changes'}
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

      <div className="border-t border-gray-100 pt-5">
        <label htmlFor="leagueName" className="block text-sm font-medium text-gray-700 mb-1">League name</label>
        <input
          id="leagueName"
          type="text"
          value={name}
          onChange={(e) => { setName(e.target.value); setSaved(false); }}
          required
          className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
        />
      </div>

      <div>
        <label htmlFor="leagueDescription" className="block text-sm font-medium text-gray-700 mb-1">Description <span className="text-gray-400 font-normal">(optional)</span></label>
        <textarea
          id="leagueDescription"
          value={description}
          onChange={(e) => { setDescription(e.target.value); setSaved(false); }}
          rows={3}
          className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm resize-none"
          placeholder="e.g. Summer singles league for intermediate players..."
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="seasonStart" className="block text-sm font-medium text-gray-700 mb-1">Start date</label>
          <input
            id="seasonStart"
            type="date"
            value={seasonStart}
            onChange={(e) => { setSeasonStart(e.target.value); setSaved(false); }}
            required
            className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
          />
        </div>
        <div>
          <label htmlFor="seasonEnd" className="block text-sm font-medium text-gray-700 mb-1">End date</label>
          <input
            id="seasonEnd"
            type="date"
            value={seasonEnd}
            onChange={(e) => { setSeasonEnd(e.target.value); setSaved(false); }}
            required
            className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
          />
        </div>
      </div>

      <div>
        <label htmlFor="leagueTiebreaker" className="block text-sm font-medium text-gray-700 mb-1">Position tiebreaker</label>
        <select
          id="leagueTiebreaker"
          value={tiebreaker}
          onChange={(e) => { setTiebreaker(e.target.value); setSaved(false); }}
          className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
        >
          <option value="head_to_head">Head-to-head result</option>
          <option value="most_sets_won">Most sets won</option>
          <option value="set_difference">Set difference (sets for - sets against)</option>
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="leagueStatus" className="block text-sm font-medium text-gray-700 mb-1">Status</label>
          <select
            id="leagueStatus"
            value={status}
            onChange={(e) => { setStatus(e.target.value); setSaved(false); }}
            className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
          >
            <option value="upcoming">Upcoming</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
          </select>
        </div>
        <div>
          <label htmlFor="leagueVisibility" className="block text-sm font-medium text-gray-700 mb-1">Visibility</label>
          <select
            id="leagueVisibility"
            value={isPublic ? 'public' : 'private'}
            onChange={(e) => { setIsPublic(e.target.value === 'public'); setSaved(false); }}
            className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
          >
            <option value="public">Public</option>
            <option value="private">Private</option>
          </select>
        </div>
      </div>
    </form>
  );
}

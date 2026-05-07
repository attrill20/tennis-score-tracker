'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type League = { id: string; name: string; status: string };
type Member = { id: string; full_name: string };

export default function AssignPlayersForm({ leagues, members }: { leagues: League[]; members: Member[] }) {
  const router = useRouter();
  const [leagueId, setLeagueId] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [savedState, setSavedState] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loadingLeague, setLoadingLeague] = useState(false);
  const [saving, setSaving] = useState(false);

  const filtered = members.filter((m) =>
    m.full_name.toLowerCase().includes(search.toLowerCase())
  );

  const hasChanges = JSON.stringify([...selected].sort()) !== JSON.stringify([...savedState].sort());

  async function handleLeagueChange(id: string) {
    setLeagueId(id);
    setError('');
    setSuccess('');
    setSelected([]);
    setSavedState([]);
    if (!id) return;

    setLoadingLeague(true);
    const res = await fetch(`/api/admin/leagues/${id}/players`);
    const data = await res.json();
    setLoadingLeague(false);

    if (res.ok) {
      setSelected(data);
      setSavedState(data);
    }
  }

  function togglePlayer(id: string) {
    setSuccess('');
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  }

  async function handleSave() {
    setError('');
    setSuccess('');
    setSaving(true);

    // Work out what to add and remove
    const toAdd = selected.filter((id) => !savedState.includes(id));
    const toRemove = savedState.filter((id) => !selected.includes(id));

    try {
      for (const playerId of toRemove) {
        const res = await fetch(`/api/admin/leagues/${leagueId}/players`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ playerId }),
        });
        if (!res.ok) throw new Error('Failed to remove a player');
      }

      if (toAdd.length > 0) {
        const res = await fetch(`/api/admin/leagues/${leagueId}/players`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ playerIds: [...savedState.filter((id) => !toRemove.includes(id)), ...toAdd] }),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Failed to add players');
        }
      }

      setSavedState(selected);
      setSuccess(`Players updated successfully`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="assignLeague" className="block text-sm font-medium text-gray-700 mb-1">League</label>
        <select
          id="assignLeague"
          value={leagueId}
          onChange={(e) => handleLeagueChange(e.target.value)}
          className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
        >
          <option value="">Select a league...</option>
          {leagues.map((l) => (
            <option key={l.id} value={l.id}>{l.name}</option>
          ))}
        </select>
      </div>

      {leagueId && (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Players {selected.length > 0 && <span className="text-green-700">({selected.length} selected)</span>}
            </label>
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <div className="p-2 border-b border-gray-200 bg-gray-50">
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search players..."
                  className="w-full px-3 py-2 rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                />
              </div>
              <div className="max-h-64 overflow-y-auto">
                {loadingLeague ? (
                  <p className="text-sm text-gray-400 px-3 py-4 text-center">Loading...</p>
                ) : filtered.length === 0 ? (
                  <p className="text-sm text-gray-400 px-3 py-4 text-center">No players found</p>
                ) : (
                  filtered.map((m) => (
                    <label
                      key={m.id}
                      className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer border-b border-gray-100 last:border-0 hover:bg-gray-50 ${
                        selected.includes(m.id) ? 'bg-green-50' : ''
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selected.includes(m.id)}
                        onChange={() => togglePlayer(m.id)}
                        className="accent-green-700 w-4 h-4 shrink-0"
                      />
                      <span className="text-sm text-gray-700">{m.full_name}</span>
                    </label>
                  ))
                )}
              </div>
            </div>
          </div>

          {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
          {success && <p className="text-sm text-green-700 bg-green-50 px-3 py-2 rounded-lg">{success}</p>}

          <button
            onClick={handleSave}
            disabled={saving || !hasChanges}
            className="bg-green-700 hover:bg-green-800 disabled:opacity-40 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors"
          >
            {saving ? 'Saving...' : hasChanges ? 'Save changes' : 'No changes'}
          </button>
        </>
      )}
    </div>
  );
}

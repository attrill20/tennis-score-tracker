'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type League = { id: string; name: string; status: string };
type Member = { id: string; full_name: string };
type Pair = { p1Id: string; p2Id: string };

function pairKey(p: Pair) {
  return [p.p1Id, p.p2Id].sort().join(':');
}

export default function AssignPlayersForm({ leagues, members }: { leagues: League[]; members: Member[] }) {
  const router = useRouter();
  const [leagueId, setLeagueId] = useState('');
  const [leagueType, setLeagueType] = useState('singles');

  // Singles
  const [selected, setSelected] = useState<string[]>([]);
  const [search, setSearch] = useState('');

  // Doubles
  const [pairs, setPairs] = useState<Pair[]>([]);
  const [newP1, setNewP1] = useState('');
  const [newP2, setNewP2] = useState('');

  const [error, setError] = useState('');
  const [loadingLeague, setLoadingLeague] = useState(false);
  const [saving, setSaving] = useState(false);

  const filtered = members.filter((m) =>
    m.full_name.toLowerCase().includes(search.toLowerCase())
  );

  async function handleLeagueChange(id: string) {
    setLeagueId(id);
    setError('');
    setSelected([]);
    setPairs([]);
    setNewP1('');
    setNewP2('');
    setSearch('');
    if (!id) return;

    setLoadingLeague(true);
    const res = await fetch(`/api/admin/leagues/${id}/players`);
    const data = await res.json();
    setLoadingLeague(false);

    if (res.ok) {
      if (data.leagueType === 'doubles') {
        setLeagueType('doubles');
        setPairs(data.pairs ?? []);
      } else {
        setLeagueType('singles');
        setSelected(Array.isArray(data) ? data : (data.playerIds ?? []));
      }
    }
  }

  async function togglePlayer(id: string) {
    const isAdding = !selected.includes(id);
    setSelected((prev) => isAdding ? [...prev, id] : prev.filter((p) => p !== id));
    setError('');
    setSaving(true);

    try {
      if (isAdding) {
        const res = await fetch(`/api/admin/leagues/${leagueId}/players`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ playerIds: [id] }),
        });
        if (!res.ok) throw new Error((await res.json()).error || 'Failed to add player');
      } else {
        const res = await fetch(`/api/admin/leagues/${leagueId}/players`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ playerId: id }),
        });
        if (!res.ok) throw new Error('Failed to remove player');
      }
      router.refresh();
    } catch (e) {
      // Revert optimistic update
      setSelected((prev) => isAdding ? prev.filter((p) => p !== id) : [...prev, id]);
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setSaving(false);
    }
  }

  const pairedIds = new Set(pairs.flatMap((p) => [p.p1Id, p.p2Id]));

  async function addPair() {
    if (!newP1 || !newP2 || newP1 === newP2) return;
    const pair: Pair = { p1Id: newP1, p2Id: newP2 };
    if (pairs.some((p) => pairKey(p) === pairKey(pair))) return;

    setPairs((prev) => [...prev, pair]);
    setNewP1('');
    setNewP2('');
    setError('');
    setSaving(true);

    try {
      const res = await fetch(`/api/admin/leagues/${leagueId}/players`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pairs: [pair] }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to add pair');
      router.refresh();
    } catch (e) {
      setPairs((prev) => prev.filter((p) => pairKey(p) !== pairKey(pair)));
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setSaving(false);
    }
  }

  async function removePair(pair: Pair) {
    setPairs((prev) => prev.filter((p) => pairKey(p) !== pairKey(pair)));
    setError('');
    setSaving(true);

    try {
      const res = await fetch(`/api/admin/leagues/${leagueId}/players`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pairIds: [pair.p1Id, pair.p2Id] }),
      });
      if (!res.ok) throw new Error('Failed to remove pair');
      router.refresh();
    } catch (e) {
      setPairs((prev) => [...prev, pair]);
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
          {leagueType === 'doubles' ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium text-gray-700">
                  Pairs {pairs.length > 0 && <span className="text-green-700">({pairs.length} {pairs.length === 1 ? 'pair' : 'pairs'})</span>}
                </label>
                {saving && <span className="text-xs text-gray-400">Saving...</span>}
              </div>

              {loadingLeague ? (
                <p className="text-sm text-gray-400 py-2">Loading...</p>
              ) : pairs.length === 0 ? (
                <p className="text-sm text-gray-400">No pairs added yet.</p>
              ) : (
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  {pairs.map((pair, i) => {
                    const p1 = members.find((m) => m.id === pair.p1Id);
                    const p2 = members.find((m) => m.id === pair.p2Id);
                    return (
                      <div
                        key={pairKey(pair)}
                        className={`flex items-center justify-between px-3 py-2.5 ${i < pairs.length - 1 ? 'border-b border-gray-100' : ''}`}
                      >
                        <span className="text-sm text-gray-800">
                          <span className="font-medium">{p1?.full_name ?? 'Unknown'}</span>
                          <span className="text-gray-400 mx-2">+</span>
                          <span className="font-medium">{p2?.full_name ?? 'Unknown'}</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => removePair(pair)}
                          disabled={saving}
                          className="text-xs text-red-500 hover:text-red-700 hover:underline shrink-0 ml-4 disabled:opacity-40"
                        >
                          Remove
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-3">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Add a pair</p>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={newP1}
                    onChange={(e) => setNewP1(e.target.value)}
                    disabled={saving}
                    className="px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm disabled:opacity-40"
                  >
                    <option value="">Player 1...</option>
                    {members
                      .filter((m) => (!pairedIds.has(m.id) || m.id === newP1) && m.id !== newP2)
                      .map((m) => (
                        <option key={m.id} value={m.id}>{m.full_name}</option>
                      ))}
                  </select>
                  <select
                    value={newP2}
                    onChange={(e) => setNewP2(e.target.value)}
                    disabled={saving}
                    className="px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm disabled:opacity-40"
                  >
                    <option value="">Player 2...</option>
                    {members
                      .filter((m) => (!pairedIds.has(m.id) || m.id === newP2) && m.id !== newP1)
                      .map((m) => (
                        <option key={m.id} value={m.id}>{m.full_name}</option>
                      ))}
                  </select>
                </div>
                <button
                  type="button"
                  onClick={addPair}
                  disabled={!newP1 || !newP2 || newP1 === newP2 || saving}
                  className="w-full py-2 rounded-lg bg-green-700 hover:bg-green-800 disabled:opacity-40 text-white text-sm font-medium transition-colors"
                >
                  {saving ? 'Saving...' : 'Add pair'}
                </button>
              </div>
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">
                  Players {selected.length > 0 && <span className="text-green-700">({selected.length} selected)</span>}
                </label>
                {saving && <span className="text-xs text-gray-400">Saving...</span>}
              </div>
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
                        } ${saving ? 'pointer-events-none opacity-60' : ''}`}
                      >
                        <input
                          type="checkbox"
                          checked={selected.includes(m.id)}
                          onChange={() => togglePlayer(m.id)}
                          disabled={saving}
                          className="accent-green-700 w-4 h-4 shrink-0"
                        />
                        <span className="text-sm text-gray-700">{m.full_name}</span>
                      </label>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
        </>
      )}
    </div>
  );
}

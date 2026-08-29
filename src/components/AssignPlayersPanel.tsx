'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { suggestPlaceholderAlias } from '@/lib/placeholderAlias';

type Member = {
  id: string;
  full_name: string;
  is_placeholder?: boolean;
  placeholder_alias?: string | null;
  placeholder_anonymized?: boolean;
};
type Pair = { p1Id: string; p2Id: string };

function pairKey(p: Pair) {
  return [p.p1Id, p.p2Id].sort().join(':');
}

function MemberLabel({ member }: { member: Member }) {
  if (!member.is_placeholder) return <>{member.full_name}</>;
  return (
    <>
      {member.full_name}
      <span className="ml-1.5 text-xs px-1.5 py-0.5 rounded-full font-medium bg-blue-100 text-blue-700">
        Placeholder{member.placeholder_anonymized ? ` - shown as "${member.placeholder_alias}"` : ''}
      </span>
    </>
  );
}

function AddPlaceholderInline({ members, onCreated }: { members: Member[]; onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [fullName, setFullName] = useState('');
  const [alias, setAlias] = useState('');
  const [anonymized, setAnonymized] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function openForm() {
    setAlias(suggestPlaceholderAlias(members.filter((m) => m.is_placeholder).map((m) => m.placeholder_alias)));
    setOpen(true);
  }

  async function handleCreate() {
    if (!fullName.trim()) return;
    if (anonymized && !alias.trim()) {
      setError('An alias is required when anonymizing this placeholder');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/admin/placeholder-players', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName: fullName.trim(), alias: alias.trim() || null, anonymized }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to create placeholder');
      setFullName('');
      setAlias('');
      setAnonymized(false);
      setOpen(false);
      onCreated();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button type="button" onClick={openForm} className="text-xs text-green-700 hover:text-green-900 font-medium hover:underline">
        + Add placeholder player
      </button>
    );
  }

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-2">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">New placeholder player</p>
      <input
        type="text"
        value={fullName}
        onChange={(e) => setFullName(e.target.value)}
        placeholder="Full name"
        disabled={saving}
        className="w-full px-2 py-1.5 rounded border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-green-500 text-xs disabled:opacity-40"
      />
      <input
        type="text"
        value={alias}
        onChange={(e) => setAlias(e.target.value)}
        placeholder="Alias (shown when anonymized)"
        disabled={saving}
        className="w-full px-2 py-1.5 rounded border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-green-500 text-xs disabled:opacity-40"
      />
      <label className="flex items-center gap-2 text-xs text-gray-700">
        <input type="checkbox" checked={anonymized} onChange={(e) => setAnonymized(e.target.checked)} disabled={saving} className="accent-green-700 w-3.5 h-3.5" />
        Anonymize - show the alias everywhere instead of the full name
      </label>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={() => setOpen(false)} disabled={saving}
          className="flex-1 text-xs border border-gray-300 hover:border-gray-400 text-gray-600 font-medium py-1.5 rounded-lg transition-colors disabled:opacity-40">
          Cancel
        </button>
        <button type="button" onClick={handleCreate} disabled={saving || !fullName.trim()}
          className="flex-1 text-xs bg-green-700 hover:bg-green-800 disabled:opacity-40 text-white font-medium py-1.5 rounded-lg transition-colors">
          {saving ? 'Adding...' : 'Add and assign below'}
        </button>
      </div>
    </div>
  );
}

export default function AssignPlayersPanel({
  leagueId,
  leagueType,
  members,
  maxPlayers,
}: {
  leagueId: string;
  leagueType: string;
  members: Member[];
  maxPlayers?: number;
}) {
  const router = useRouter();

  const [selected, setSelected] = useState<string[]>([]);
  const [pairs, setPairs] = useState<Pair[]>([]);
  const [newP1, setNewP1] = useState('');
  const [newP2, setNewP2] = useState('');
  const [p1Search, setP1Search] = useState('');
  const [p2Search, setP2Search] = useState('');
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pendingOverride, setPendingOverride] = useState<{ message: string; onConfirm: () => void } | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const res = await fetch(`/api/admin/leagues/${leagueId}/players`);
      const data = await res.json();
      setLoading(false);
      if (res.ok) {
        if (data.leagueType === 'doubles') {
          setPairs(data.pairs ?? []);
        } else {
          setSelected(Array.isArray(data) ? data : (data.playerIds ?? []));
        }
      }
    }
    load();
  }, [leagueId]);

  async function togglePlayer(id: string, force = false) {
    const isAdding = !selected.includes(id);
    if (!force) setSelected((prev) => isAdding ? [...prev, id] : prev.filter((p) => p !== id));
    setError('');
    setPendingOverride(null);
    setSaving(true);
    try {
      if (isAdding) {
        const res = await fetch(`/api/admin/leagues/${leagueId}/players`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ playerIds: [id], ...(force ? { force: true } : {}) }),
        });
        const data = await res.json();
        if (!res.ok) {
          if (res.status === 409 && data.needsConfirmation) {
            if (!force) setSelected((prev) => prev.filter((p) => p !== id));
            setPendingOverride({ message: data.error, onConfirm: () => togglePlayer(id, true) });
            return;
          }
          throw new Error(data.error || 'Failed to add player');
        }
        if (force) setSelected((prev) => [...prev, id]);
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
      setSelected((prev) => isAdding ? prev.filter((p) => p !== id) : [...prev, id]);
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setSaving(false);
    }
  }

  const pairedIds = new Set(pairs.flatMap((p) => [p.p1Id, p.p2Id]));

  async function addPair(force = false, pairOverride?: Pair) {
    const pair: Pair = pairOverride ?? { p1Id: newP1, p2Id: newP2 };
    if (!force) {
      if (!newP1 || !newP2 || newP1 === newP2) return;
      if (pairs.some((p) => pairKey(p) === pairKey(pair))) return;
      setPairs((prev) => [...prev, pair]);
      setNewP1('');
      setNewP2('');
    }
    setError('');
    setPendingOverride(null);
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/leagues/${leagueId}/players`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pairs: [pair], ...(force ? { force: true } : {}) }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 409 && data.needsConfirmation) {
          if (!force) setPairs((prev) => prev.filter((p) => pairKey(p) !== pairKey(pair)));
          setPendingOverride({ message: data.error, onConfirm: () => addPair(true, pair) });
          return;
        }
        throw new Error(data.error || 'Failed to add pair');
      }
      if (force) setPairs((prev) => [...prev, pair]);
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

  const overrideConfirm = pendingOverride && (
    <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-3 space-y-2">
      <p className="text-sm text-amber-800">{pendingOverride.message}</p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setPendingOverride(null)}
          className="flex-1 text-xs border border-gray-300 hover:border-gray-400 text-gray-600 font-medium py-1.5 rounded-lg transition-colors"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => pendingOverride.onConfirm()}
          className="flex-1 text-xs bg-amber-600 hover:bg-amber-700 text-white font-medium py-1.5 rounded-lg transition-colors"
        >
          Assign anyway
        </button>
      </div>
    </div>
  );

  if (leagueType === 'doubles') {
    const p1Options = members.filter(
      (m) => (!pairedIds.has(m.id) || m.id === newP1) && m.id !== newP2 &&
        m.full_name.toLowerCase().includes(p1Search.toLowerCase())
    );
    const p2Options = members.filter(
      (m) => (!pairedIds.has(m.id) || m.id === newP2) && m.id !== newP1 &&
        m.full_name.toLowerCase().includes(p2Search.toLowerCase())
    );
    const p1Member = members.find((m) => m.id === newP1);
    const p2Member = members.find((m) => m.id === newP2);

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700">
            Pairs {pairs.length > 0 && <span className="text-green-700">({pairs.length} {pairs.length === 1 ? 'pair' : 'pairs'})</span>}
          </span>
          {saving && <span className="text-xs text-gray-400">Saving...</span>}
        </div>

        <AddPlaceholderInline members={members} onCreated={() => router.refresh()} />

        {/* Assigned pairs */}
        {loading ? (
          <p className="text-sm text-gray-400 py-1">Loading...</p>
        ) : pairs.length === 0 ? (
          <p className="text-sm text-gray-400">No pairs added yet</p>
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
                    <span className="font-medium">{p1 ? <MemberLabel member={p1} /> : 'Unknown'}</span>
                    <span className="text-gray-400 mx-2">+</span>
                    <span className="font-medium">{p2 ? <MemberLabel member={p2} /> : 'Unknown'}</span>
                  </span>
                  <button type="button" onClick={() => removePair(pair)} disabled={saving}
                    className="text-xs text-red-500 hover:text-red-700 hover:underline shrink-0 ml-4 disabled:opacity-40">
                    Remove
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Add a pair — two side-by-side searchable panels */}
        {!loading && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg overflow-hidden">
            <div className="px-3 pt-3 pb-2 border-b border-gray-200">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Add a pair</p>
              {(newP1 || newP2) && (
                <p className="text-xs text-gray-500 mt-1">
                  {newP1 && newP2
                    ? <><span className="font-medium text-gray-700">{p1Member?.full_name}</span> + <span className="font-medium text-gray-700">{p2Member?.full_name}</span></>
                    : newP1
                    ? <><span className="font-medium text-gray-700">{p1Member?.full_name}</span> - select player 2</>
                    : <>select player 1 - <span className="font-medium text-gray-700">{p2Member?.full_name}</span></>
                  }
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 divide-x divide-gray-200">
              {/* Player 1 picker */}
              <div className="flex flex-col">
                <div className="px-2 pt-2 pb-1.5 border-b border-gray-200">
                  <p className="text-xs text-gray-500 mb-1.5 font-medium">Player 1</p>
                  <input type="text" name="p1Search" value={p1Search} onChange={(e) => setP1Search(e.target.value)}
                    placeholder="Search..."
                    className="w-full px-2 py-1.5 rounded border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-green-500 text-xs" />
                </div>
                <div className="max-h-44 overflow-y-auto">
                  {p1Options.length === 0 ? (
                    <p className="text-xs text-gray-400 px-2 py-3 text-center">{p1Search ? 'No match' : 'None available'}</p>
                  ) : p1Options.map((m, i) => (
                    <button key={m.id} type="button" onClick={() => { setNewP1(m.id); setP1Search(''); }} disabled={saving}
                      className={`w-full text-left px-2 py-2 text-xs border-b border-gray-100 last:border-0 transition-colors disabled:opacity-40 ${
                        newP1 === m.id ? 'bg-green-100 text-green-800 font-medium' : 'hover:bg-white text-gray-700'
                      }`}>
                      <MemberLabel member={m} />
                    </button>
                  ))}
                </div>
              </div>
              {/* Player 2 picker */}
              <div className="flex flex-col">
                <div className="px-2 pt-2 pb-1.5 border-b border-gray-200">
                  <p className="text-xs text-gray-500 mb-1.5 font-medium">Player 2</p>
                  <input type="text" name="p2Search" value={p2Search} onChange={(e) => setP2Search(e.target.value)}
                    placeholder="Search..."
                    className="w-full px-2 py-1.5 rounded border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-green-500 text-xs" />
                </div>
                <div className="max-h-44 overflow-y-auto">
                  {p2Options.length === 0 ? (
                    <p className="text-xs text-gray-400 px-2 py-3 text-center">{p2Search ? 'No match' : 'None available'}</p>
                  ) : p2Options.map((m) => (
                    <button key={m.id} type="button" onClick={() => { setNewP2(m.id); setP2Search(''); }} disabled={saving}
                      className={`w-full text-left px-2 py-2 text-xs border-b border-gray-100 last:border-0 transition-colors disabled:opacity-40 ${
                        newP2 === m.id ? 'bg-green-100 text-green-800 font-medium' : 'hover:bg-white text-gray-700'
                      }`}>
                      <MemberLabel member={m} />
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="px-3 py-2.5 border-t border-gray-200">
              <button type="button" onClick={() => addPair()} disabled={!newP1 || !newP2 || newP1 === newP2 || saving}
                className="w-full py-2 rounded-lg bg-green-700 hover:bg-green-800 disabled:opacity-40 text-white text-sm font-medium transition-colors">
                {saving ? 'Saving...' : 'Add pair'}
              </button>
            </div>
          </div>
        )}

        {maxPlayers !== undefined && pairs.length > maxPlayers && (
          <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 px-3 py-2 rounded-lg">
            Warning: {pairs.length} pairs assigned but the league limit is {maxPlayers}. Reduce pairs or increase the limit in league settings.
          </p>
        )}
        {overrideConfirm}
        {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
      </div>
    );
  }

  const availableMembers = members.filter(
    (m) => !selected.includes(m.id) && m.full_name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700">
          Assigned {selected.length > 0 && <span className="text-green-700">({selected.length})</span>}
        </span>
        {saving && <span className="text-xs text-gray-400">Saving...</span>}
      </div>

      <AddPlaceholderInline members={members} onCreated={() => router.refresh()} />

      {/* Assigned players */}
      {loading ? (
        <p className="text-sm text-gray-400 py-1">Loading...</p>
      ) : selected.length === 0 ? (
        <p className="text-sm text-gray-400">No players assigned yet</p>
      ) : (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          {selected.map((id, i) => {
            const member = members.find((m) => m.id === id);
            return (
              <div
                key={id}
                className={`flex items-center justify-between px-3 py-2.5 ${i < selected.length - 1 ? 'border-b border-gray-100' : ''}`}
              >
                <span className="text-sm font-medium text-gray-800">{member ? <MemberLabel member={member} /> : 'Unknown'}</span>
                <button
                  type="button"
                  onClick={() => togglePlayer(id)}
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

      {/* Available players panel */}
      {!loading && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg overflow-hidden">
          <div className="px-3 pt-3 pb-2 border-b border-gray-200">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
              {members.filter((m) => !selected.includes(m.id)).length === 0 ? 'All players assigned' : 'Add players'}
            </p>
            <input
              type="text"
              name="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search..."
              className="w-full px-3 py-2 rounded-md border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
            />
          </div>
          <div className="max-h-52 overflow-y-auto">
            {availableMembers.length === 0 ? (
              <p className="text-sm text-gray-400 px-3 py-4 text-center">
                {search ? 'No players match your search' : 'All players assigned'}
              </p>
            ) : (
              availableMembers.map((m, i) => (
                <div
                  key={m.id}
                  className={`flex items-center justify-between px-3 py-2.5 ${i < availableMembers.length - 1 ? 'border-b border-gray-100' : ''} ${saving ? 'opacity-60' : ''}`}
                >
                  <span className="text-sm text-gray-700"><MemberLabel member={m} /></span>
                  <button
                    type="button"
                    onClick={() => togglePlayer(m.id)}
                    disabled={saving}
                    className="text-xs text-green-700 hover:text-green-900 font-medium hover:underline shrink-0 ml-4 disabled:opacity-40"
                  >
                    Add
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {maxPlayers !== undefined && selected.length > maxPlayers && (
        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 px-3 py-2 rounded-lg">
          Warning: {selected.length} players assigned but the league limit is {maxPlayers}. Remove players or increase the limit in league settings.
        </p>
      )}
      {overrideConfirm}
      {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
    </div>
  );
}

'use client';

import { useState } from 'react';

const DEFAULT_TRIGGER_CLASS = 'text-xs text-blue-600 hover:text-blue-800 hover:underline font-medium';

export default function SwitchPlaceholderControl({
  placeholderId,
  placeholderFullName,
  realMembers,
  onSwapped,
  triggerClassName,
}: {
  placeholderId: string;
  placeholderFullName: string;
  realMembers: { id: string; full_name: string }[];
  onSwapped: () => void;
  /** Overrides the collapsed trigger button's classes - e.g. to match sibling badges' padding/spacing. */
  triggerClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [swapping, setSwapping] = useState(false);
  const [error, setError] = useState('');

  function close() {
    setOpen(false);
    setSearch('');
    setError('');
  }

  async function handleSwitch(targetId: string, targetName: string) {
    if (!window.confirm(
      `Switch "${placeholderFullName}" to ${targetName}? ` +
      `Every match and league result recorded under the placeholder will move to ${targetName}'s account, and the placeholder will be retired. This cannot be undone.`
    )) return;
    setSwapping(true);
    setError('');
    try {
      const res = await fetch(`/api/admin/placeholder-players/${placeholderId}/merge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ realAccountId: targetId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to switch to a real member');
      close();
      onSwapped();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setSwapping(false);
    }
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={triggerClassName ?? DEFAULT_TRIGGER_CLASS}>
        Switch
      </button>
    );
  }

  const candidates = realMembers.filter((m) => m.full_name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="w-full bg-white border border-gray-200 rounded-lg p-2 space-y-1.5">
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search real members..."
        autoFocus
        disabled={swapping}
        className="w-full text-xs px-2 py-1 rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-40"
      />
      <div className="max-h-40 overflow-y-auto divide-y divide-gray-100">
        {candidates.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-2">No matches</p>
        ) : (
          candidates.map((m) => (
            <button
              key={m.id}
              type="button"
              disabled={swapping}
              onClick={() => handleSwitch(m.id, m.full_name)}
              className="w-full text-left px-1 py-1.5 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-40"
            >
              {m.full_name}
            </button>
          ))
        )}
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <button type="button" onClick={close} disabled={swapping} className="w-full text-xs text-gray-500 hover:text-gray-700 py-1 disabled:opacity-40">
        Cancel
      </button>
    </div>
  );
}

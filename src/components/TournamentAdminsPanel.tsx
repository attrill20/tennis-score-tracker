'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import PlayerAvatar from '@/components/PlayerAvatar';

type AdminOption = { id: string; full_name: string; avatar_url: string | null };

export default function TournamentAdminsPanel({
  tournamentId,
  adminOptions,
  creatorId,
}: {
  tournamentId: string;
  adminOptions: AdminOption[];
  creatorId: string | null;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      setLoading(true);
      const res = await fetch(`/api/admin/tournaments/${tournamentId}/admins`);
      const data = await res.json();
      setLoading(false);
      if (res.ok) setSelected(data.adminIds ?? []);
    }
    load();
  }, [tournamentId]);

  async function addAdmin(id: string) {
    setSelected((prev) => [...prev, id]);
    setError('');
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/tournaments/${tournamentId}/admins`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminId: id }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to add admin');
      router.refresh();
    } catch (e) {
      setSelected((prev) => prev.filter((a) => a !== id));
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setSaving(false);
    }
  }

  async function removeAdmin(id: string) {
    setSelected((prev) => prev.filter((a) => a !== id));
    setError('');
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/tournaments/${tournamentId}/admins`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminId: id }),
      });
      if (!res.ok) throw new Error('Failed to remove admin');
      router.refresh();
    } catch (e) {
      setSelected((prev) => [...prev, id]);
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setSaving(false);
    }
  }

  const availableAdmins = adminOptions.filter(
    (a) => a.id !== creatorId && !selected.includes(a.id) && a.full_name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700">
          Additional admins {selected.length > 0 && <span className="text-green-700">({selected.length})</span>}
        </span>
        {saving && <span className="text-xs text-gray-400">Saving...</span>}
      </div>

      {loading ? (
        <p className="text-sm text-gray-400 py-1">Loading...</p>
      ) : selected.length === 0 ? (
        <p className="text-sm text-gray-400">No additional admins added yet</p>
      ) : (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          {selected.map((id, i) => {
            const admin = adminOptions.find((a) => a.id === id);
            return (
              <div
                key={id}
                className={`flex items-center justify-between px-3 py-2.5 ${i < selected.length - 1 ? 'border-b border-gray-100' : ''}`}
              >
                <span className="flex items-center gap-2 text-sm font-medium text-gray-800 min-w-0">
                  <PlayerAvatar name={admin?.full_name ?? 'Unknown'} avatarUrl={admin?.avatar_url ?? null} size="sm" />
                  {admin?.full_name ?? 'Unknown'}
                </span>
                <button
                  type="button"
                  onClick={() => removeAdmin(id)}
                  disabled={saving}
                  className="text-xs text-red-500 hover:text-red-700 hover:underline disabled:opacity-40 shrink-0 ml-4"
                >
                  Remove
                </button>
              </div>
            );
          })}
        </div>
      )}

      {!loading && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg overflow-hidden">
          <div className="px-3 pt-3 pb-2 border-b border-gray-200">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
              {availableAdmins.length === 0 && !search ? 'All admins added' : 'Add an admin'}
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
            {availableAdmins.length === 0 ? (
              <p className="text-sm text-gray-400 px-3 py-4 text-center">
                {search ? 'No admins match your search' : 'All admins added'}
              </p>
            ) : (
              availableAdmins.map((a, i) => (
                <div
                  key={a.id}
                  className={`flex items-center justify-between px-3 py-2.5 ${i < availableAdmins.length - 1 ? 'border-b border-gray-100' : ''} ${saving ? 'opacity-60' : ''}`}
                >
                  <span className="flex items-center gap-2 text-sm text-gray-700">
                    <PlayerAvatar name={a.full_name} avatarUrl={a.avatar_url} size="sm" />
                    {a.full_name}
                  </span>
                  <button
                    type="button"
                    onClick={() => addAdmin(a.id)}
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

      {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
    </div>
  );
}

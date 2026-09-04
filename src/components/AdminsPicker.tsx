'use client';

import { useState } from 'react';
import PlayerAvatar from '@/components/PlayerAvatar';

type AdminOption = { id: string; full_name: string; avatar_url: string | null };

export default function AdminsPicker({
  adminOptions,
  selectedIds,
  onChange,
  excludeId,
}: {
  adminOptions: AdminOption[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  excludeId?: string | null;
}) {
  const [search, setSearch] = useState('');

  const availableAdmins = adminOptions.filter(
    (a) => a.id !== excludeId && !selectedIds.includes(a.id) && a.full_name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-3">
      {selectedIds.length > 0 && (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          {selectedIds.map((id, i) => {
            const admin = adminOptions.find((a) => a.id === id);
            return (
              <div
                key={id}
                className={`flex items-center justify-between px-3 py-2.5 ${i < selectedIds.length - 1 ? 'border-b border-gray-100' : ''}`}
              >
                <span className="flex items-center gap-2 text-sm font-medium text-gray-800 min-w-0">
                  <PlayerAvatar name={admin?.full_name ?? 'Unknown'} avatarUrl={admin?.avatar_url ?? null} size="sm" />
                  {admin?.full_name ?? 'Unknown'}
                </span>
                <button
                  type="button"
                  onClick={() => onChange(selectedIds.filter((a) => a !== id))}
                  className="text-xs text-red-500 hover:text-red-700 hover:underline shrink-0 ml-4"
                >
                  Remove
                </button>
              </div>
            );
          })}
        </div>
      )}

      <div className="bg-gray-50 border border-gray-200 rounded-lg overflow-hidden">
        <div className="px-3 pt-3 pb-2 border-b border-gray-200">
          <input
            type="text"
            name="adminSearch"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search admins..."
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
                className={`flex items-center justify-between px-3 py-2.5 ${i < availableAdmins.length - 1 ? 'border-b border-gray-100' : ''}`}
              >
                <span className="flex items-center gap-2 text-sm text-gray-700">
                  <PlayerAvatar name={a.full_name} avatarUrl={a.avatar_url} size="sm" />
                  {a.full_name}
                </span>
                <button
                  type="button"
                  onClick={() => onChange([...selectedIds, a.id])}
                  className="text-xs text-green-700 hover:text-green-900 font-medium hover:underline shrink-0 ml-4"
                >
                  Add
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { suggestPlaceholderAlias } from '@/lib/placeholderAlias';

type Placeholder = {
  id: string;
  full_name: string;
  placeholder_alias: string | null;
  placeholder_anonymized: boolean;
  deleted_at: string | null;
};
type Member = { id: string; full_name: string };

function PlaceholderForm({
  initialFullName = '',
  initialAlias = '',
  initialAnonymized = false,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initialFullName?: string;
  initialAlias?: string;
  initialAnonymized?: boolean;
  submitLabel: string;
  onSubmit: (input: { fullName: string; alias: string; anonymized: boolean }) => Promise<void>;
  onCancel?: () => void;
}) {
  const [fullName, setFullName] = useState(initialFullName);
  const [alias, setAlias] = useState(initialAlias);
  const [anonymized, setAnonymized] = useState(initialAnonymized);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!fullName.trim()) return;
    if (anonymized && !alias.trim()) {
      setError('An alias is required when anonymizing this placeholder');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await onSubmit({ fullName: fullName.trim(), alias: alias.trim(), anonymized });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label htmlFor="placeholderFullName" className="block text-sm font-medium text-gray-700 mb-1">Full name</label>
        <input
          id="placeholderFullName"
          name="placeholderFullName"
          type="text"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="e.g. Bob Smith"
          className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
        />
      </div>
      <div>
        <label htmlFor="placeholderAlias" className="block text-sm font-medium text-gray-700 mb-1">Alias (shown instead of the full name when anonymized)</label>
        <input
          id="placeholderAlias"
          name="placeholderAlias"
          type="text"
          value={alias}
          onChange={(e) => setAlias(e.target.value)}
          placeholder="e.g. Mystery Player"
          className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
        />
      </div>
      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input
          type="checkbox"
          checked={anonymized}
          onChange={(e) => setAnonymized(e.target.checked)}
          className="accent-green-700 w-4 h-4"
        />
        Anonymize - show the alias everywhere instead of the full name
      </label>
      {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
      <div className="flex gap-2">
        {onCancel && (
          <button type="button" onClick={onCancel} disabled={saving}
            className="flex-1 text-sm border border-gray-300 hover:border-gray-400 text-gray-600 font-medium py-2 rounded-lg transition-colors disabled:opacity-40">
            Cancel
          </button>
        )}
        <button type="submit" disabled={saving || !fullName.trim()}
          className="flex-1 py-2 rounded-lg bg-green-700 hover:bg-green-800 disabled:opacity-40 text-white text-sm font-medium transition-colors">
          {saving ? 'Saving...' : submitLabel}
        </button>
      </div>
    </form>
  );
}

function MergePanel({ placeholder, members, onDone, onCancel }: { placeholder: Placeholder; members: Member[]; onDone: () => void; onCancel: () => void }) {
  const [targetId, setTargetId] = useState('');
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const filtered = members.filter((m) => m.full_name.toLowerCase().includes(search.toLowerCase()));

  async function handleConfirm() {
    if (!targetId) return;
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`/api/admin/placeholder-players/${placeholder.id}/merge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ realAccountId: targetId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to attribute to that account');
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-3 space-y-2">
      <p className="text-sm text-amber-800">
        Move every match played as <span className="font-medium">{placeholder.full_name}</span> onto a real member&apos;s account, then retire this placeholder.
      </p>
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search members..."
        className="w-full px-3 py-2 rounded-md border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
      />
      <div className="max-h-40 overflow-y-auto border border-amber-200 rounded-lg bg-white">
        {filtered.length === 0 ? (
          <p className="text-xs text-gray-400 px-3 py-3 text-center">No members match</p>
        ) : (
          filtered.map((m) => (
            <button key={m.id} type="button" onClick={() => setTargetId(m.id)}
              className={`w-full text-left px-3 py-2 text-sm border-b border-gray-100 last:border-0 transition-colors ${
                targetId === m.id ? 'bg-green-100 text-green-800 font-medium' : 'hover:bg-gray-50 text-gray-700'
              }`}>
              {m.full_name}
            </button>
          ))
        )}
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={onCancel} disabled={saving}
          className="flex-1 text-xs border border-gray-300 hover:border-gray-400 text-gray-600 font-medium py-1.5 rounded-lg transition-colors disabled:opacity-40">
          Cancel
        </button>
        <button type="button" onClick={handleConfirm} disabled={!targetId || saving}
          className="flex-1 text-xs bg-amber-600 hover:bg-amber-700 disabled:opacity-40 text-white font-medium py-1.5 rounded-lg transition-colors">
          {saving ? 'Attributing...' : 'Attribute to this account'}
        </button>
      </div>
    </div>
  );
}

function PlaceholderRow({ placeholder, members }: { placeholder: Placeholder; members: Member[] }) {
  const router = useRouter();
  const [mode, setMode] = useState<'view' | 'edit' | 'retire' | 'merge'>('view');
  const [error, setError] = useState('');
  const [retiring, setRetiring] = useState(false);

  async function handleSaveEdit(input: { fullName: string; alias: string; anonymized: boolean }) {
    const res = await fetch(`/api/admin/placeholder-players/${placeholder.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fullName: input.fullName, alias: input.alias || null, anonymized: input.anonymized }),
    });
    if (!res.ok) throw new Error((await res.json()).error || 'Failed to save');
    setMode('view');
    router.refresh();
  }

  async function handleRetire() {
    setRetiring(true);
    setError('');
    try {
      const res = await fetch(`/api/admin/placeholder-players/${placeholder.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to retire');
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
      setRetiring(false);
    }
  }

  if (mode === 'edit') {
    return (
      <div className="px-3 py-3 border-b border-gray-100 last:border-0">
        <PlaceholderForm
          initialFullName={placeholder.full_name}
          initialAlias={placeholder.placeholder_alias ?? ''}
          initialAnonymized={placeholder.placeholder_anonymized}
          submitLabel="Save"
          onSubmit={handleSaveEdit}
          onCancel={() => setMode('view')}
        />
      </div>
    );
  }

  if (mode === 'merge') {
    return (
      <div className="px-3 py-3 border-b border-gray-100 last:border-0">
        <MergePanel placeholder={placeholder} members={members} onDone={() => { setMode('view'); router.refresh(); }} onCancel={() => setMode('view')} />
      </div>
    );
  }

  return (
    <div className="px-3 py-2.5 border-b border-gray-100 last:border-0">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5 sm:gap-2">
        <div>
          <span className="text-sm font-medium text-gray-800">{placeholder.full_name}</span>
          {placeholder.placeholder_anonymized && (
            <span className="ml-2 text-xs px-2 py-0.5 rounded-full font-medium bg-blue-100 text-blue-700">
              Anonymized{placeholder.placeholder_alias ? `: ${placeholder.placeholder_alias}` : ''}
            </span>
          )}
        </div>
        {mode !== 'retire' && (
          <div className="flex items-center gap-3 justify-end">
            <button type="button" onClick={() => setMode('edit')} className="text-xs text-gray-600 hover:text-gray-800 hover:underline">
              Edit
            </button>
            <button type="button" onClick={() => setMode('merge')} className="text-xs text-green-700 hover:text-green-900 hover:underline">
              Attribute to account
            </button>
            <button type="button" onClick={() => setMode('retire')} className="text-xs text-red-500 hover:text-red-700 hover:underline">
              Retire
            </button>
          </div>
        )}
      </div>
      {mode === 'retire' && (
        <div className="mt-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 space-y-2">
          <p className="text-sm text-red-800">
            Retire <span className="font-medium">{placeholder.full_name}</span>? They&apos;ll be removed from any leagues but past matches keep showing them correctly.
          </p>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={() => setMode('view')} disabled={retiring}
              className="flex-1 text-xs border border-gray-300 hover:border-gray-400 text-gray-600 font-medium py-1.5 rounded-lg transition-colors disabled:opacity-40">
              Cancel
            </button>
            <button type="button" onClick={handleRetire} disabled={retiring}
              className="flex-1 text-xs bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white font-medium py-1.5 rounded-lg transition-colors">
              {retiring ? 'Retiring...' : 'Yes, retire'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PlaceholderRosterPanel({ initialPlaceholders, members }: { initialPlaceholders: Placeholder[]; members: Member[] }) {
  const router = useRouter();
  const active = initialPlaceholders.filter((p) => !p.deleted_at);
  const retired = initialPlaceholders.filter((p) => !!p.deleted_at);
  const suggestedAlias = suggestPlaceholderAlias(initialPlaceholders.map((p) => p.placeholder_alias));

  async function handleCreate(input: { fullName: string; alias: string; anonymized: boolean }) {
    const res = await fetch('/api/admin/placeholder-players', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fullName: input.fullName, alias: input.alias || null, anonymized: input.anonymized }),
    });
    if (!res.ok) throw new Error((await res.json()).error || 'Failed to create placeholder');
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-base font-semibold text-gray-700 mb-4">Add a placeholder player</h2>
        <PlaceholderForm key={suggestedAlias} initialAlias={suggestedAlias} submitLabel="Add placeholder" onSubmit={handleCreate} />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-700">Roster ({active.length})</h2>
        </div>
        {active.length === 0 ? (
          <p className="text-sm text-gray-400 px-4 py-6 text-center">No placeholder players yet</p>
        ) : (
          active.map((p) => <PlaceholderRow key={p.id} placeholder={p} members={members} />)
        )}
      </div>

      {retired.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-2">Retired</h2>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden opacity-60">
            {retired.map((p) => (
              <div key={p.id} className="px-3 py-2.5 border-b border-gray-100 last:border-0">
                <span className="text-sm text-gray-600">{p.full_name}</span>
                {p.placeholder_anonymized && (
                  <span className="ml-2 text-xs px-2 py-0.5 rounded-full font-medium bg-gray-100 text-gray-500">
                    Anonymized{p.placeholder_alias ? `: ${p.placeholder_alias}` : ''}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

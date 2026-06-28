'use client';

import { useState } from 'react';

const COLORS = [
  '#fb7185', '#fb923c', '#f59e0b', '#10b981',
  '#14b8a6', '#0ea5e9', '#6366f1', '#8b5cf6', '#f472b6',
];

function colorFromName(name: string) {
  const hash = name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return COLORS[hash % COLORS.length];
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export default function AvatarUpload({ name, initialAvatarUrl }: { name: string; initialAvatarUrl: string | null }) {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initialAvatarUrl);
  const [loading, setLoading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState('');

  function handleUploadClick() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/jpeg,image/png,image/webp,image/gif';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      setError('');
      setLoading(true);
      const form = new FormData();
      form.append('avatar', file);
      const res = await fetch('/api/upload-avatar', { method: 'POST', body: form });
      const data = await res.json();
      setLoading(false);
      if (!res.ok) {
        setError(data.error || 'Upload failed');
      } else {
        setAvatarUrl(data.url);
      }
    };
    input.click();
  }

  async function handleRemove() {
    setError('');
    setRemoving(true);
    const res = await fetch('/api/upload-avatar', { method: 'DELETE' });
    setRemoving(false);
    if (res.ok) {
      setAvatarUrl(null);
    } else {
      const data = await res.json();
      setError(data.error || 'Failed to remove photo');
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Profile Photo</h2>
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col flex-1">
          <button
            type="button"
            onClick={handleUploadClick}
            disabled={loading || removing}
            className="text-sm bg-white border border-gray-300 hover:border-green-700 text-gray-700 hover:text-green-700 font-medium px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 w-full mb-1"
          >
            {loading ? 'Uploading...' : avatarUrl ? 'Change photo' : 'Upload photo'}
          </button>
          <p className="text-xs text-gray-400 mb-2">JPEG or PNG file, max 5MB</p>
          {avatarUrl && (
            <button
              type="button"
              onClick={handleRemove}
              disabled={loading || removing}
              className="text-sm text-red-500 hover:text-red-700 font-medium transition-colors disabled:opacity-50 text-left"
            >
              {removing ? 'Deleting...' : 'Delete photo'}
            </button>
          )}
          {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
        </div>
        {avatarUrl ? (
          <span className="w-16 h-16 rounded-full overflow-hidden shrink-0 inline-block ring-1 ring-black/30">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={avatarUrl} alt={name} className="w-full h-full object-cover" />
          </span>
        ) : (
          <span
            className="w-16 h-16 rounded-full flex items-center justify-center text-white text-xl font-semibold shrink-0"
            style={{ backgroundColor: colorFromName(name) }}
            aria-label={name}
          >
            {initials(name)}
          </span>
        )}
      </div>
    </div>
  );
}

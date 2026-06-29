'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function DeleteUserButton({ userId, userName }: { userId: string; userName: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleDelete() {
    setLoading(true);
    setError('');

    const res = await fetch(`/api/admin/users/${userId}`, { method: 'DELETE' });
    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error || 'Something went wrong');
      setConfirming(false);
      return;
    }

    router.push('/admin/users');
    router.refresh();
  }

  if (confirming) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-red-700">
          Are you sure you want to delete <strong>{userName}</strong>? This will remove them from all tournaments and cannot be undone.
        </p>
        <div className="flex gap-3">
          <button
            onClick={handleDelete}
            disabled={loading}
            className="bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            {loading ? 'Deleting...' : 'Yes, delete user'}
          </button>
          <button
            onClick={() => setConfirming(false)}
            disabled={loading}
            className="bg-white hover:bg-gray-50 text-gray-700 text-sm font-medium px-4 py-2 rounded-lg border border-gray-300 transition-colors"
          >
            Cancel
          </button>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="bg-white hover:bg-red-50 text-red-600 text-sm font-medium px-4 py-2 rounded-lg border border-red-300 transition-colors"
    >
      Delete user
    </button>
  );
}

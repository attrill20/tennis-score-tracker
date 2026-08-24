'use client';

import { useState } from 'react';

export default function SendResetEmailButton({ userId }: { userId: string }) {
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  async function handleSend() {
    setLoading(true);
    setError('');
    setSent(false);

    const res = await fetch(`/api/admin/users/${userId}/send-reset-email`, { method: 'POST' });
    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error || 'Something went wrong');
      return;
    }

    setSent(true);
  }

  return (
    <div>
      <button
        onClick={handleSend}
        disabled={loading}
        className="bg-white hover:border-green-400 disabled:opacity-50 text-gray-700 text-sm font-medium px-4 py-2 rounded-lg border border-gray-300 transition-colors"
      >
        {loading ? 'Sending...' : 'Send reset password email'}
      </button>
      {sent && <p className="text-sm text-green-700 mt-2">Reset password email sent.</p>}
      {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
    </div>
  );
}

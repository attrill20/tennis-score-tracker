'use client';

import { useState, FormEvent } from 'react';

export default function AdminSetPasswordForm({ userId }: { userId: string }) {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess(false);

    const res = await fetch(`/api/admin/users/${userId}/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error || 'Something went wrong');
      return;
    }

    setSuccess(true);
    setPassword('');
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 sm:items-start">
      <div className="flex-1">
        <label htmlFor="admin-new-password" className="sr-only">New password</label>
        <input
          id="admin-new-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="New password (min. 8 characters)"
          minLength={8}
          required
          className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-400"
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="bg-white hover:border-green-400 disabled:opacity-50 text-gray-700 text-sm font-medium px-4 py-2 rounded-lg border border-gray-300 transition-colors shrink-0"
      >
        {loading ? 'Setting...' : 'Set password'}
      </button>
      {success && <p className="text-sm text-green-700 sm:self-center">Password updated</p>}
      {error && <p className="text-sm text-red-600 sm:self-center">{error}</p>}
    </form>
  );
}

'use client';

import { useState } from 'react';
import { signOut } from 'next-auth/react';
import PasswordInput from '@/components/PasswordInput';

export default function DeleteAccountSection() {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function closeModal() {
    setOpen(false);
    setPassword('');
    setError('');
  }

  async function handleDelete(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const res = await fetch('/api/profile', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    const data = await res.json();

    if (!res.ok) {
      setLoading(false);
      setError(data.error || 'Something went wrong');
      return;
    }

    await signOut({ redirectTo: '/login?deleted=true' });
  }

  return (
    <div className="bg-white rounded-xl border border-red-200 p-5">
      <h2 className="text-sm font-semibold text-red-500 uppercase tracking-wide mb-2">Danger zone</h2>
      <p className="text-sm text-gray-500 mb-4">
        Permanently delete your account. This cannot be undone.
      </p>
      <button
        onClick={() => setOpen(true)}
        className="w-full text-sm border border-red-300 hover:border-red-500 text-red-500 hover:text-red-700 font-medium py-2.5 rounded-lg transition-colors"
      >
        Delete my account
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-bold text-gray-800">Delete your account?</h3>

            <div className="text-sm text-gray-600 space-y-2">
              <p>This is permanent. Your name, profile photo, email and phone number will be removed and you won&apos;t be able to sign in again.</p>
              <p>Your match history stays visible to other players, so league tables and other members&apos; stats stay accurate - it just shows as &quot;Deleted User&quot;. You&apos;ll be excluded from being picked for any new matches.</p>
            </div>

            <form onSubmit={handleDelete} className="space-y-3">
              <div>
                <label htmlFor="deletePassword" className="block text-sm font-medium text-gray-700 mb-1">
                  Enter your password to confirm
                </label>
                <PasswordInput
                  id="deletePassword"
                  name="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  inputClassName="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-red-500 text-base sm:text-sm"
                />
              </div>

              {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={loading}
                  className="flex-1 text-sm border border-gray-300 hover:border-gray-400 text-gray-600 font-medium py-2.5 rounded-lg transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 text-sm bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg transition-colors"
                >
                  {loading ? 'Deleting...' : 'Delete my account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

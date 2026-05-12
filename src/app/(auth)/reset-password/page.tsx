'use client';

import { useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [error, setError] = useState('');

  if (!token) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-green-100 p-8 text-center">
        <p className="text-sm text-red-600 mb-4">This reset link is invalid or has expired.</p>
        <Link href="/forgot-password" className="text-sm text-green-700 font-medium hover:underline">
          Request a new link
        </Link>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }

    setStatus('loading');

    const res = await fetch('/api/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password }),
    });

    const data = await res.json();

    if (!res.ok) {
      setError(data.error || 'Something went wrong');
      setStatus('error');
      return;
    }

    router.push('/login?reset=true');
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-green-100 p-8">
      <h2 className="text-xl font-semibold text-gray-800 mb-6">Set new password</h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
            New password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
            className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
            placeholder="Min. 8 characters"
          />
        </div>

        <div>
          <label htmlFor="confirm" className="block text-sm font-medium text-gray-700 mb-1">
            Confirm password
          </label>
          <input
            id="confirm"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            autoComplete="new-password"
            className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
            placeholder="••••••••"
          />
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
        )}

        <button
          type="submit"
          disabled={status === 'loading'}
          className="w-full bg-green-700 hover:bg-green-800 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg transition-colors text-sm"
        >
          {status === 'loading' ? 'Saving...' : 'Set new password'}
        </button>
      </form>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}

'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'sent' | 'error'>('idle');
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setStatus('loading');

    const res = await fetch('/api/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });

    const data = await res.json();

    if (!res.ok) {
      setError(data.error || 'Something went wrong');
      setStatus('error');
      return;
    }

    setStatus('sent');
  }

  if (status === 'sent') {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-green-900/20 p-8 text-center">
        <div className="text-4xl mb-4">&#9993;</div>
        <h2 className="text-xl font-semibold text-gray-800 mb-2">Check your email</h2>
        <p className="text-sm text-gray-600 mb-6">
          We sent a password reset link to <strong>{email}</strong>. It expires in 1 hour.
        </p>
        <Link href="/login" className="text-sm text-green-900 font-medium hover:underline">
          &larr; Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-green-900/20 p-8">
      <h2 className="text-xl font-semibold text-gray-800 mb-2">Forgot password</h2>
      <p className="text-sm text-gray-500 mb-6">
        Enter your email and we will send you a reset link.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-900 focus:border-transparent text-sm text-gray-900 placeholder:text-gray-500"
            placeholder="you@example.com"
          />
        </div>

        {status === 'error' && (
          <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
        )}

        <button
          type="submit"
          disabled={status === 'loading'}
          className="w-full bg-green-900 hover:bg-green-800 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg transition-colors text-sm"
        >
          {status === 'loading' ? 'Sending...' : 'Send reset link'}
        </button>
      </form>

      <p className="text-sm text-center text-gray-500 mt-6">
        <Link href="/login" className="text-green-900 font-medium hover:underline">
          &larr; Back to sign in
        </Link>
      </p>
    </div>
  );
}

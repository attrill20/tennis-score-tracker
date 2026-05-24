'use client';

import { useState, Suspense } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const registered = searchParams.get('registered') === 'true';
  const verified = searchParams.get('verified') === 'true';
  const reset = searchParams.get('reset') === 'true';
  const invalidToken = searchParams.get('error') === 'invalid_token';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const result = await signIn('credentials', {
      email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (result?.error === 'EMAIL_NOT_VERIFIED') {
      setError('Please verify your email before signing in. Check your inbox for the verification link.');
    } else if (result?.error) {
      setError('Invalid email or password');
    } else {
      router.push('/dashboard');
    }
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-green-900/20 p-8">
      <h2 className="text-xl font-semibold text-gray-800 mb-6">Sign in</h2>

      {registered && !verified && (
        <div className="mb-4 text-sm text-blue-700 bg-blue-50 px-3 py-2 rounded-lg">
          Account created! Please check your email to verify your address before signing in.
        </div>
      )}
      {verified && (
        <div className="mb-4 text-sm text-green-900 bg-green-50 px-3 py-2 rounded-lg">
          Email verified! You can now sign in.
        </div>
      )}
      {reset && (
        <div className="mb-4 text-sm text-green-900 bg-green-50 px-3 py-2 rounded-lg">
          Password updated! You can now sign in with your new password.
        </div>
      )}
      {invalidToken && (
        <div className="mb-4 text-sm text-red-700 bg-red-50 px-3 py-2 rounded-lg">
          That link is invalid or has expired.
        </div>
      )}

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
            autoComplete="username"
            className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-900 focus:border-transparent text-sm"
            placeholder="you@example.com"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
              Password
            </label>
            <Link href="/forgot-password" className="text-xs text-green-900 hover:underline">
              Forgot password?
            </Link>
          </div>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-900 focus:border-transparent text-sm"
            placeholder="••••••••"
          />
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-green-900 hover:bg-green-800 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg transition-colors text-sm"
        >
          {loading ? 'Signing in...' : 'Sign in'}
        </button>
      </form>

      <p className="text-sm text-center text-gray-500 mt-6">
        No account?{' '}
        <Link href="/register" className="text-green-900 font-medium hover:underline">
          Register here
        </Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

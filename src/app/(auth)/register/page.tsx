'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const inputClass = 'w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-900 focus:border-transparent text-sm text-gray-900 placeholder:text-gray-500';

function PasswordStrength({ password }: { password: string }) {
  const checks = [
    { label: 'At least 8 characters', pass: password.length >= 8 },
    { label: 'One uppercase letter', pass: /[A-Z]/.test(password) },
    { label: 'One number', pass: /[0-9]/.test(password) },
  ];

  if (!password) return null;

  return (
    <ul className="mt-2 space-y-1">
      {checks.map(({ label, pass }) => (
        <li key={label} className={`text-xs flex items-center gap-1.5 ${pass ? 'text-green-700' : 'text-gray-400'}`}>
          <span>{pass ? '✓' : '○'}</span>
          {label}
        </li>
      ))}
    </ul>
  );
}

export default function RegisterPage() {
  const router = useRouter();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [gender, setGender] = useState<'mens' | 'womens' | ''>('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const passwordValid = password.length >= 8 && /[A-Z]/.test(password) && /[0-9]/.test(password);
  const passwordsMatch = password === confirm;

  function handlePhone(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value.replace(/[^\d\s+\-()]/g, '');
    setPhone(val);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!gender) {
      setError('Please select whether you play in Men\'s or Women\'s singles.');
      return;
    }
    if (!passwordValid) {
      setError('Password does not meet the requirements.');
      return;
    }
    if (!passwordsMatch) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);

    const res = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, phone, password, gender, firstName, lastName }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error || 'Something went wrong');
      return;
    }

    router.push('/login?registered=true&verify=true');
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-green-900/20 p-8">
      <h2 className="text-xl font-semibold text-gray-800 mb-6">Create account</h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-1">First name</label>
            <input
              id="firstName"
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
              autoComplete="given-name"
              className={inputClass}
              placeholder="Forename"
            />
          </div>
          <div>
            <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-1">Last name</label>
            <input
              id="lastName"
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              required
              autoComplete="family-name"
              className={inputClass}
              placeholder="Surname"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">I play in</label>
          <div className="grid grid-cols-2 gap-3">
            {(['mens', 'womens'] as const).map((val) => (
              <button
                key={val}
                type="button"
                onClick={() => setGender(val)}
                className={`py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                  gender === val
                    ? 'bg-green-900 border-green-900 text-white'
                    : 'border-gray-300 text-gray-500 hover:border-green-900 hover:text-green-900'
                }`}
              >
                {val === 'mens' ? "Men's singles" : "Women's singles"}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            className={inputClass}
            placeholder="you@example.com"
          />
        </div>

        <div>
          <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">Phone number</label>
          <input
            id="phone"
            type="tel"
            value={phone}
            onChange={handlePhone}
            required
            autoComplete="tel"
            className={inputClass}
            placeholder="Shared with your league members"
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">Password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="new-password"
            className={inputClass}
            placeholder="Min. 8 characters"
          />
          <PasswordStrength password={password} />
        </div>

        <div>
          <label htmlFor="confirm" className="block text-sm font-medium text-gray-700 mb-1">Confirm password</label>
          <input
            id="confirm"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            autoComplete="new-password"
            className={inputClass}
            placeholder="Re-enter password"
          />
          {confirm && !passwordsMatch && (
            <p className="text-xs text-red-500 mt-1">Passwords do not match</p>
          )}
          {confirm && passwordsMatch && (
            <p className="text-xs text-green-700 mt-1">✓ Passwords match</p>
          )}
        </div>

        {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-green-900 hover:bg-green-800 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg transition-colors text-sm"
        >
          {loading ? 'Creating account...' : 'Create account'}
        </button>
      </form>

      <p className="text-sm text-center text-gray-500 mt-6">
        Already have an account?{' '}
        <Link href="/login" className="text-green-900 font-medium hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}

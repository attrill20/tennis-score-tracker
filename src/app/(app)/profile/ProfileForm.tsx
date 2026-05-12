'use client';

import { useState } from 'react';

const TITLES = ['', 'Mr', 'Mrs', 'Ms', 'Miss', 'Dr', 'Prof'];

export default function ProfileForm({
  initialTitle,
  initialFirstName,
  initialLastName,
  initialEmail,
  initialIsInjured,
}: {
  initialTitle: string;
  initialFirstName: string;
  initialLastName: string;
  initialEmail: string;
  initialIsInjured: boolean;
}) {
  const [title, setTitle] = useState(initialTitle);
  const [firstName, setFirstName] = useState(initialFirstName);
  const [lastName, setLastName] = useState(initialLastName);
  const [email, setEmail] = useState(initialEmail);
  const [isInjured, setIsInjured] = useState(initialIsInjured);
  const [hasBeenTicked, setHasBeenTicked] = useState(initialIsInjured);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (newPassword && newPassword !== confirmPassword) {
      setError('New passwords do not match');
      return;
    }
    if (newPassword && newPassword.length < 8) {
      setError('New password must be at least 8 characters');
      return;
    }
    if (newPassword && !currentPassword) {
      setError('Enter your current password to set a new one');
      return;
    }

    setLoading(true);
    const res = await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        firstName,
        lastName,
        email,
        currentPassword: currentPassword || undefined,
        newPassword: newPassword || undefined,
        isInjured,
      }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error || 'Something went wrong');
      return;
    }

    setSuccess('Profile updated successfully');
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
          <select
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-3 py-2.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
          >
            {TITLES.map((t) => <option key={t} value={t}>{t || '-'}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">First name</label>
          <input
            type="text"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            required
            className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Last name</label>
          <input
            type="text"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            required
            className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
        />
      </div>

      <hr className="border-gray-100" />
      <p className="text-xs text-gray-400">Leave password fields blank to keep your current password</p>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Current password</label>
        <input
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          autoComplete="current-password"
          className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
          placeholder="Required to change password"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">New password</label>
        <input
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          autoComplete="new-password"
          className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
          placeholder="Min. 8 characters"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Confirm new password</label>
        <input
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          autoComplete="new-password"
          className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
          placeholder="Repeat new password"
        />
      </div>

      <hr className="border-gray-100" />

      <label className="flex items-center gap-3 cursor-pointer select-none">
        <input
          id="is_injured"
          type="checkbox"
          checked={isInjured}
          onChange={(e) => { setIsInjured(e.target.checked); if (e.target.checked) setHasBeenTicked(true); }}
          className="w-4 h-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
        />
        <span className="text-sm font-medium text-gray-700">Mark myself as injured</span>
      </label>
      {isInjured && (
        <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg -mt-2">
          Your name will show an injury indicator in league tables while this is ticked.
        </p>
      )}
      {hasBeenTicked && !isInjured && (
        <p className="text-xs text-green-700 bg-green-50 px-3 py-2 rounded-lg -mt-2">
          Great to hear you have recovered, welcome back to the courts!
        </p>
      )}

      {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
      {success && <p className="text-sm text-green-700 bg-green-50 px-3 py-2 rounded-lg">{success}</p>}

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-green-700 hover:bg-green-800 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg transition-colors text-sm"
      >
        {loading ? 'Saving...' : 'Save changes'}
      </button>
    </form>
  );
}

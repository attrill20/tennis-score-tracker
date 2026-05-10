'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function EditUserForm({
  userId,
  currentTitle,
  currentFirstName,
  currentLastName,
  currentEmail,
  currentRole,
}: {
  userId: string;
  currentTitle: string;
  currentFirstName: string;
  currentLastName: string;
  currentEmail: string;
  currentRole: string;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(currentTitle);
  const [firstName, setFirstName] = useState(currentFirstName);
  const [lastName, setLastName] = useState(currentLastName);
  const [email, setEmail] = useState(currentEmail);
  const [role, setRole] = useState(currentRole);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSaved(false);
    setLoading(true);

    const res = await fetch(`/api/admin/users/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, firstName, lastName, email, role }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error || 'Something went wrong');
      return;
    }

    setSaved(true);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-base font-semibold text-gray-700">User details</h2>
        <div className="flex items-center gap-3">
          {saved && <p className="text-xs text-green-700">Saved!</p>}
          <button
            type="submit"
            disabled={loading}
            className="bg-green-700 hover:bg-green-800 disabled:opacity-50 text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors"
          >
            {loading ? 'Saving...' : 'Save changes'}
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

      <div className="border-t border-gray-100 pt-5 grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="userTitle" className="block text-sm font-medium text-gray-700 mb-1">Title <span className="text-gray-400 font-normal">(optional)</span></label>
          <input
            id="userTitle"
            type="text"
            value={title}
            onChange={(e) => { setTitle(e.target.value); setSaved(false); }}
            className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
            placeholder="e.g. Mr, Mrs, Dr"
          />
        </div>
        <div>
          <label htmlFor="userRole" className="block text-sm font-medium text-gray-700 mb-1">Role</label>
          <select
            id="userRole"
            value={role}
            onChange={(e) => { setRole(e.target.value); setSaved(false); }}
            className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
          >
            <option value="member">member</option>
            <option value="admin">admin</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="userFirstName" className="block text-sm font-medium text-gray-700 mb-1">First name</label>
          <input
            id="userFirstName"
            type="text"
            value={firstName}
            onChange={(e) => { setFirstName(e.target.value); setSaved(false); }}
            required
            className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
          />
        </div>
        <div>
          <label htmlFor="userLastName" className="block text-sm font-medium text-gray-700 mb-1">Last name</label>
          <input
            id="userLastName"
            type="text"
            value={lastName}
            onChange={(e) => { setLastName(e.target.value); setSaved(false); }}
            required
            className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
          />
        </div>
      </div>

      <div>
        <label htmlFor="userEmail" className="block text-sm font-medium text-gray-700 mb-1">Email</label>
        <input
          id="userEmail"
          type="email"
          value={email}
          onChange={(e) => { setEmail(e.target.value); setSaved(false); }}
          className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
        />
      </div>
    </form>
  );
}

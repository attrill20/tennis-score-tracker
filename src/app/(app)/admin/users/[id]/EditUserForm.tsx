'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function EditUserForm({
  userId,
  currentFirstName,
  currentLastName,
  currentEmail,
  currentRole,
  currentPhone,
  currentGender,
}: {
  userId: string;
  currentFirstName: string;
  currentLastName: string;
  currentEmail: string;
  currentRole: string;
  currentPhone: string;
  currentGender: string;
}) {
  const router = useRouter();
  const [firstName, setFirstName] = useState(currentFirstName);
  const [lastName, setLastName] = useState(currentLastName);
  const [email, setEmail] = useState(currentEmail);
  const [role, setRole] = useState(currentRole);
  const [phone, setPhone] = useState(currentPhone);
  const [gender, setGender] = useState(currentGender);
  const [loading, setLoading] = useState(false);
  const [roleLoading, setRoleLoading] = useState(false);
  const [error, setError] = useState('');
  const [roleError, setRoleError] = useState('');
  const [saved, setSaved] = useState(false);
  const [roleSaved, setRoleSaved] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSaved(false);
    setLoading(true);

    const res = await fetch(`/api/admin/users/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ firstName, lastName, email, phone, gender }),
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

  async function handleRoleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setRoleError('');
    setRoleSaved(false);
    setRoleLoading(true);

    const res = await fetch(`/api/admin/users/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role }),
    });

    const data = await res.json();
    setRoleLoading(false);

    if (!res.ok) {
      setRoleError(data.error || 'Something went wrong');
      return;
    }

    setRoleSaved(true);
    router.refresh();
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-base font-semibold text-gray-700">Personal details</h2>
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

        <div className="grid grid-cols-2 gap-4">
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
          <div>
            <label htmlFor="userPhone" className="block text-sm font-medium text-gray-700 mb-1">Phone <span className="text-gray-400 font-normal">(optional)</span></label>
            <input
              id="userPhone"
              type="tel"
              value={phone}
              onChange={(e) => { setPhone(e.target.value); setSaved(false); }}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
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
                onClick={() => { setGender(gender === val ? '' : val); setSaved(false); }}
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
      </form>

      <form onSubmit={handleRoleSubmit} className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-base font-semibold text-gray-700">Role</h2>
          <div className="flex items-center gap-3">
            {roleSaved && <p className="text-xs text-green-700">Saved!</p>}
            <button
              type="submit"
              disabled={roleLoading}
              className="bg-green-700 hover:bg-green-800 disabled:opacity-50 text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors"
            >
              {roleLoading ? 'Saving...' : 'Save changes'}
            </button>
          </div>
        </div>

        {roleError && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{roleError}</p>}

        <div className="border-t border-gray-100 pt-5">
          <label htmlFor="userRole" className="block text-sm font-medium text-gray-700 mb-1">Role</label>
          <select
            id="userRole"
            value={role}
            onChange={(e) => { setRole(e.target.value); setRoleSaved(false); }}
            className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
          >
            <option value="member">member</option>
            <option value="admin">admin</option>
          </select>
        </div>
      </form>
    </>
  );
}

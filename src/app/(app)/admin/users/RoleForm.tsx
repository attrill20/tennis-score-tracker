'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function RoleForm({
  userId,
  currentRole,
  currentIsActive,
}: {
  userId: string;
  currentRole: string;
  currentIsActive: boolean;
}) {
  const router = useRouter();
  const [value, setValue] = useState(currentIsActive ? currentRole : 'inactive');
  const [loading, setLoading] = useState(false);

  async function handleChange(newValue: string) {
    setValue(newValue);
    setLoading(true);
    const body = newValue === 'inactive'
      ? { isActive: false }
      : { role: newValue, isActive: true };
    await fetch(`/api/admin/users/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    setLoading(false);
    router.refresh();
  }

  return (
    <select
      name="role"
      value={value}
      onChange={(e) => handleChange(e.target.value)}
      disabled={loading}
      className="text-base sm:text-sm px-2 py-1.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50"
    >
      <option value="unverified">unverified</option>
      <option value="member">member</option>
      <option value="admin">admin</option>
      <option value="inactive">inactive</option>
    </select>
  );
}

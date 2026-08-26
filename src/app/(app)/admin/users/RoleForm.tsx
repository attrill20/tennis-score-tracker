'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const ROLE_COLORS: Record<string, string> = {
  unverified: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  member: 'bg-gray-100 text-gray-600 border-gray-200',
  admin: 'bg-blue-100 text-blue-700 border-blue-200',
  inactive: 'bg-red-100 text-red-600 border-red-200',
};

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
      className={`text-xs px-2 py-0.5 rounded-full border font-medium focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50 ${ROLE_COLORS[value] ?? ROLE_COLORS.member}`}
    >
      <option value="unverified">unverified</option>
      <option value="member">member</option>
      <option value="admin">admin</option>
      <option value="inactive">inactive</option>
    </select>
  );
}

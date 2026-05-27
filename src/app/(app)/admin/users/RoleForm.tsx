'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function RoleForm({ userId, currentRole }: { userId: string; currentRole: string }) {
  const router = useRouter();
  const [role, setRole] = useState(currentRole);
  const [loading, setLoading] = useState(false);

  async function handleChange(newRole: string) {
    setRole(newRole);
    setLoading(true);
    await fetch(`/api/admin/users/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: newRole }),
    });
    setLoading(false);
    router.refresh();
  }

  return (
    <select
      value={role}
      onChange={(e) => handleChange(e.target.value)}
      disabled={loading}
      className="text-xs px-2 py-1.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50"
    >
      <option value="unverified">unverified</option>
      <option value="member">member</option>
      <option value="admin">admin</option>
    </select>
  );
}

import { auth } from '@/auth';
import sql from '@/lib/db';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import RoleForm from './RoleForm';

export default async function AdminUsersPage() {
  const session = await auth();
  if (session?.user?.role !== 'super_admin') {
    redirect('/dashboard');
  }

  const users = await sql`
    SELECT id, title, first_name, last_name, email, role
    FROM profiles
    ORDER BY last_name, first_name
  `;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800 mb-1">Admin - Users</h1>
        <p className="text-sm text-gray-400">Manage member roles. Only super admins can access this page.</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-xs text-gray-500 border-b border-gray-200">
              <th className="text-left px-4 py-3 font-medium">Member</th>
              <th className="text-left px-4 py-3 font-medium">Email</th>
              <th className="text-left px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id as string} className="border-t border-gray-100">
                <td className="px-4 py-3 text-gray-800">
                  {[user.title, user.first_name, user.last_name].filter(Boolean).join(' ')}
                  {user.id === session.user.id && (
                    <span className="ml-2 text-xs text-green-600 font-medium">(you)</span>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-500">{user.email as string}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    user.role === 'super_admin' ? 'bg-purple-100 text-purple-700'
                    : user.role === 'admin' ? 'bg-blue-100 text-blue-700'
                    : 'bg-gray-100 text-gray-500'
                  }`}>
                    {user.role as string}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {user.id !== session.user.id && user.role !== 'super_admin' && (
                      <RoleForm userId={user.id as string} currentRole={user.role as string} />
                    )}
                    {user.role !== 'super_admin' && (
                      <Link
                        href={`/admin/users/${user.id}`}
                        className="text-xs px-3 py-1.5 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors"
                      >
                        Edit
                      </Link>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

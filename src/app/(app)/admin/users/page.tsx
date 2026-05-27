import { auth } from '@/auth';
import sql from '@/lib/db';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import RoleForm from './RoleForm';
import SearchInput from './SearchInput';

type SortCol = 'name' | 'email' | 'role' | 'created_at';

function sortHref(col: string, currentSort: string, currentOrder: string, search: string) {
  const newOrder = currentSort === col && currentOrder === 'asc' ? 'desc' : 'asc';
  const params = new URLSearchParams({ sort: col, order: newOrder });
  if (search) params.set('search', search);
  return `/admin/users?${params}`;
}

function SortIcon({ col, currentSort, currentOrder }: { col: string; currentSort: string; currentOrder: string }) {
  if (col !== currentSort) return <span className="ml-1 text-gray-300">↕</span>;
  return <span className="ml-1">{currentOrder === 'asc' ? '↑' : '↓'}</span>;
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string; order?: string; search?: string }>;
}) {
  const session = await auth();
  if (session?.user?.role !== 'super_admin') {
    redirect('/dashboard');
  }

  const { sort, order, search: rawSearch } = await searchParams;

  const validSortCols: SortCol[] = ['name', 'email', 'role', 'created_at'];
  const sortCol: SortCol = validSortCols.includes(sort as SortCol) ? (sort as SortCol) : 'created_at';
  const sortOrder = order === 'asc' ? 'asc' : 'desc';
  const search = rawSearch?.trim() ?? '';

  const users = await sql`
    SELECT id, title, first_name, last_name, email, role, created_at, member_number
    FROM profiles
  `;

  type User = {
    id: string;
    title: string | null;
    first_name: string;
    last_name: string;
    email: string;
    role: string;
    created_at: Date | null;
    member_number: number | null;
  };

  let filtered = users as User[];

  if (search) {
    const q = search.toLowerCase();
    filtered = filtered.filter(
      (u) =>
        `${u.first_name} ${u.last_name}`.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q),
    );
  }

  filtered.sort((a, b) => {
    let aVal: string, bVal: string;
    if (sortCol === 'name') {
      aVal = `${a.last_name} ${a.first_name}`.toLowerCase();
      bVal = `${b.last_name} ${b.first_name}`.toLowerCase();
    } else if (sortCol === 'created_at') {
      aVal = a.created_at?.toISOString() ?? '';
      bVal = b.created_at?.toISOString() ?? '';
    } else {
      aVal = (a[sortCol] as string)?.toLowerCase() ?? '';
      bVal = (b[sortCol] as string)?.toLowerCase() ?? '';
    }
    const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
    return sortOrder === 'asc' ? cmp : -cmp;
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800 mb-1">Admin - Users</h1>
        <p className="text-sm text-gray-400">Manage member roles. Only super admins can access this page.</p>
      </div>

      <SearchInput initialSearch={search} sortCol={sortCol} sortOrder={sortOrder} />

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-xs text-gray-500 border-b border-gray-200">
              <th className="text-left px-4 py-3 font-medium">#</th>
              <th className="text-left px-4 py-3 font-medium">
                <Link href={sortHref('name', sortCol, sortOrder, search)} className="hover:text-gray-800 inline-flex items-center">
                  Member<SortIcon col="name" currentSort={sortCol} currentOrder={sortOrder} />
                </Link>
              </th>
              <th className="text-left px-4 py-3 font-medium">
                <Link href={sortHref('email', sortCol, sortOrder, search)} className="hover:text-gray-800 inline-flex items-center">
                  Email<SortIcon col="email" currentSort={sortCol} currentOrder={sortOrder} />
                </Link>
              </th>
              <th className="text-left px-4 py-3 font-medium">
                <Link href={sortHref('role', sortCol, sortOrder, search)} className="hover:text-gray-800 inline-flex items-center">
                  Role<SortIcon col="role" currentSort={sortCol} currentOrder={sortOrder} />
                </Link>
              </th>
              <th className="text-left px-4 py-3 font-medium">
                <Link href={sortHref('created_at', sortCol, sortOrder, search)} className="hover:text-gray-800 inline-flex items-center">
                  Date Created<SortIcon col="created_at" currentSort={sortCol} currentOrder={sortOrder} />
                </Link>
              </th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                  No users found.
                </td>
              </tr>
            )}
            {filtered.map((user) => (
              <tr key={user.id} className="border-t border-gray-100">
                <td className="px-4 py-3 text-gray-400 text-xs">{user.member_number ?? '-'}</td>
                <td className="px-4 py-3 text-gray-800">
                  {[user.title, user.first_name, user.last_name].filter(Boolean).join(' ')}
                  {user.id === session.user.id && (
                    <span className="ml-2 text-xs text-green-600 font-medium">(you)</span>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-500">{user.email}</td>
                <td className="px-4 py-3">
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      user.role === 'super_admin'
                        ? 'bg-purple-100 text-purple-700'
                        : user.role === 'admin'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {user.role}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-500">
                  {user.created_at
                    ? new Date(user.created_at).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })
                    : '-'}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {user.id !== session.user.id && user.role !== 'super_admin' && (
                      <RoleForm userId={user.id} currentRole={user.role} />
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

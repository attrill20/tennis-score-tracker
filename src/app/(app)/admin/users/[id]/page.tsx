import { auth } from '@/auth';
import sql from '@/lib/db';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import EditUserForm from './EditUserForm';
import DeleteUserButton from './DeleteUserButton';

export default async function AdminUserEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (session?.user?.role !== 'super_admin') {
    redirect('/dashboard');
  }

  const users = await sql`SELECT id, first_name, last_name, email, role, phone, gender, last_login_at FROM profiles WHERE id = ${id}`;
  const user = users[0];
  if (!user) notFound();

  const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ');
  const isSelf = user.id === session.user.id;
  const isSuperAdmin = user.role === 'super_admin';

  return (
    <div className="space-y-8 max-w-2xl mx-auto">
      <div>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 mb-1">{fullName}</h1>
            <p className="text-sm text-gray-400">Admin - Edit user</p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-xs text-gray-400 font-medium">Last login</p>
            <p className="text-xs text-gray-500">
              {user.last_login_at
                ? new Date(user.last_login_at as string).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
                : 'Never'}
            </p>
          </div>
        </div>
        <Link href="/admin/users" className="text-sm text-green-700 hover:underline mt-2 inline-block">
          &larr; Back to users
        </Link>
      </div>

      {isSuperAdmin ? (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <p className="text-sm text-gray-500">Super admin accounts cannot be edited here.</p>
        </div>
      ) : (
        <EditUserForm
          userId={id}
          currentFirstName={user.first_name as string}
          currentLastName={user.last_name as string}
          currentEmail={(user.email as string) ?? ''}
          currentRole={user.role as string}
          currentPhone={(user.phone as string) ?? ''}
          currentGender={(user.gender as string) ?? ''}
        />
      )}

      {!isSelf && !isSuperAdmin && (
        <div className="bg-white rounded-xl border border-red-200 p-6">
          <h2 className="text-base font-semibold text-red-600 mb-4">Danger zone</h2>
          <DeleteUserButton userId={id} userName={fullName} />
        </div>
      )}
    </div>
  );
}

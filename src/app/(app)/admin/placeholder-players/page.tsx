import { auth } from '@/auth';
import sql from '@/lib/db';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import PlaceholderRosterPanel from './PlaceholderRosterPanel';

export default async function PlaceholderPlayersPage() {
  const session = await auth();
  if (session?.user?.role !== 'admin' && session?.user?.role !== 'super_admin') {
    redirect('/dashboard');
  }

  const [placeholders, members] = await Promise.all([
    sql`
      SELECT id, full_name, placeholder_alias, placeholder_anonymized, deleted_at
      FROM profiles
      WHERE is_placeholder = true
      ORDER BY deleted_at IS NOT NULL, full_name
    `,
    sql`
      SELECT id, full_name
      FROM profiles
      WHERE is_placeholder = false AND deleted_at IS NULL AND role != 'unverified'
      ORDER BY full_name
    `,
  ]);

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-gray-800 mb-1">Placeholder players</h1>
        <p className="text-sm text-gray-400 mb-2">
          For members who want to play but not use the app. No login, no contact details shown
        </p>
        <Link href="/admin/users" className="text-sm text-green-700 hover:underline">
          ← Back to users
        </Link>
      </div>

      <PlaceholderRosterPanel
        initialPlaceholders={placeholders as {
          id: string;
          full_name: string;
          placeholder_alias: string | null;
          placeholder_anonymized: boolean;
          deleted_at: string | null;
        }[]}
        members={members as { id: string; full_name: string }[]}
      />
    </div>
  );
}

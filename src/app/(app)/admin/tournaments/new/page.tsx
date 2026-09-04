import { auth } from '@/auth';
import sql from '@/lib/db';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import CreateLeagueForm from '../CreateLeagueForm';

export default async function NewLeaguePage() {
  const session = await auth();
  if (session?.user?.role !== 'admin' && session?.user?.role !== 'super_admin') {
    redirect('/dashboard');
  }

  const members = await sql`
    SELECT id, (first_name || ' ' || last_name) AS full_name, is_placeholder, placeholder_alias, placeholder_anonymized,
      role = 'unverified' AS is_unverified
    FROM profiles
    WHERE deleted_at IS NULL
      AND email != 'qptcscoreadmin@gmail.com'
    ORDER BY first_name, last_name
  `;

  const adminOptions = await sql`
    SELECT id, (first_name || ' ' || last_name) AS full_name, avatar_url
    FROM profiles
    WHERE role IN ('admin', 'super_admin') AND deleted_at IS NULL
    ORDER BY first_name, last_name
  `;

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-1">Create a new tournament</h1>
        <Link href="/admin/tournaments" className="text-sm text-green-700 hover:underline">
          ← Back to leagues
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <CreateLeagueForm
          members={members as {
            id: string;
            full_name: string;
            is_placeholder: boolean;
            placeholder_alias: string | null;
            placeholder_anonymized: boolean;
            is_unverified: boolean;
          }[]}
          adminOptions={adminOptions as { id: string; full_name: string; avatar_url: string | null }[]}
          currentUserId={session!.user.id}
        />
      </div>
    </div>
  );
}

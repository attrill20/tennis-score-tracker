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
    SELECT id, (first_name || ' ' || last_name) AS full_name
    FROM profiles
    WHERE role != 'unverified'
    ORDER BY first_name, last_name
  `;

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-1">Create a new league</h1>
        <Link href="/admin/leagues" className="text-sm text-green-700 hover:underline">
          ← Back to leagues
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <CreateLeagueForm members={members as { id: string; full_name: string }[]} />
      </div>
    </div>
  );
}

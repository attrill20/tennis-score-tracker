import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import CreateLeagueForm from '../CreateLeagueForm';

export default async function NewLeaguePage() {
  const session = await auth();
  if (session?.user?.role !== 'admin' && session?.user?.role !== 'super_admin') {
    redirect('/dashboard');
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-1">Create a new league</h1>
        <Link href="/admin/leagues" className="text-sm text-green-700 hover:underline">
          ← Back to leagues
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <CreateLeagueForm />
      </div>
    </div>
  );
}

import { auth } from '@/auth';
import sql from '@/lib/db';
import { redirect } from 'next/navigation';
import CreateLeagueForm from './CreateLeagueForm';
import AssignPlayersForm from './AssignPlayersForm';

export default async function AdminLeaguesPage() {
  const session = await auth();
  if (session?.user?.role !== 'admin' && session?.user?.role !== 'super_admin') {
    redirect('/dashboard');
  }

  const leagues = await sql`
    SELECT id, name, status FROM leagues ORDER BY created_at DESC
  `;

  const members = await sql`
    SELECT id, (first_name || ' ' || last_name) AS full_name FROM profiles ORDER BY last_name, first_name
  `;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-800 mb-1">Admin - Leagues</h1>
        <p className="text-sm text-gray-400">Create leagues and manage players</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-base font-semibold text-gray-700 mb-4">Create a new league</h2>
        <CreateLeagueForm />
      </div>

      {leagues.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-base font-semibold text-gray-700 mb-4">Assign players to a league</h2>
          <AssignPlayersForm
            leagues={leagues as { id: string; name: string; status: string }[]}
            members={members as { id: string; full_name: string }[]}
          />
        </div>
      )}

      {leagues.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-base font-semibold text-gray-700 mb-4">Manage leagues</h2>
          <div className="space-y-2">
            {leagues.map((league) => (
              <div key={league.id as string} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                <span className="text-sm text-gray-800">{league.name as string}</span>
                <div className="flex items-center gap-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    league.status === 'active' ? 'bg-green-100 text-green-700'
                    : league.status === 'upcoming' ? 'bg-yellow-100 text-yellow-700'
                    : 'bg-gray-100 text-gray-500'
                  }`}>{league.status as string}</span>
                  <a href={`/leagues/${league.id}`} className="text-xs text-green-700 hover:underline">View</a>
                  <a href={`/admin/leagues/${league.id}`} className="text-xs text-blue-600 hover:underline">Manage</a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

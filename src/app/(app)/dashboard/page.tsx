import { auth } from '@/auth';
import sql from '@/lib/db';
import Link from 'next/link';

export default async function DashboardPage() {
  const session = await auth();

  const leagues = await sql`
    SELECT l.id, l.name, l.status, l.season_start, l.season_end
    FROM leagues l
    JOIN league_players lp ON lp.league_id = l.id
    WHERE lp.player_id = ${session!.user.id}
    ORDER BY l.season_start DESC
  `;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-1">
        Welcome back, {session?.user?.name?.split(' ')[0]}
      </h1>
      <p className="text-gray-500 text-sm mb-6">Queen's Park Tennis Club</p>

      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Your Leagues</h2>

      {leagues.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">
          <p>You haven't been added to any leagues yet.</p>
          <p className="text-sm mt-1">Contact an admin to get assigned.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {leagues.map((league) => (
            <Link
              key={league.id as string}
              href={`/leagues/${league.id}`}
              className="block bg-white rounded-xl border border-gray-200 p-4 hover:border-green-400 transition-colors"
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-gray-800">{league.name as string}</span>
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                  league.status === 'active'
                    ? 'bg-green-100 text-green-700'
                    : league.status === 'upcoming'
                    ? 'bg-yellow-100 text-yellow-700'
                    : 'bg-gray-100 text-gray-500'
                }`}>
                  {league.status as string}
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-1">
                {new Date(league.season_start as string).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                {' – '}
                {new Date(league.season_end as string).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
              </p>
            </Link>
          ))}
        </div>
      )}

      <div className="mt-6">
        <Link
          href="/leagues"
          className="text-sm text-green-700 font-medium hover:underline"
        >
          View all leagues →
        </Link>
      </div>
    </div>
  );
}

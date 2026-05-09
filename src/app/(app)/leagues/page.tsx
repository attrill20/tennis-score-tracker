import { auth } from '@/auth';
import sql from '@/lib/db';
import Link from 'next/link';

export default async function LeaguesPage() {
  const session = await auth();
  const userId = session!.user.id;
  const isAdmin = session?.user?.role === 'admin' || session?.user?.role === 'super_admin';

  const leagues = await sql`
    SELECT id, name, status, season_start, season_end, is_public,
      (SELECT COUNT(*) FROM league_players WHERE league_id = leagues.id) AS player_count
    FROM leagues
    WHERE is_public = true
      OR ${isAdmin}
      OR EXISTS (SELECT 1 FROM league_players WHERE league_id = leagues.id AND player_id = ${userId})
    ORDER BY season_start DESC
  `;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">All Leagues</h1>

      {leagues.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">
          No leagues have been created yet.
        </div>
      ) : (
        <div className="space-y-3">
          {leagues.map((league) => (
            <Link
              key={league.id as string}
              href={`/leagues/${league.id}`}
              className="block bg-white rounded-xl border border-gray-200 p-4 hover:border-green-400 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div>
                  <span className="font-medium text-gray-800">{league.name as string}</span>
                  <p className="text-xs text-gray-400 mt-1">
                    {new Date(league.season_start as string).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    {' - '}
                    {new Date(league.season_end as string).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <div className="flex items-center gap-2">
                    {!league.is_public && (
                      <span className="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded-full font-medium">Private</span>
                    )}
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                      league.status === 'active'
                        ? 'bg-green-100 text-green-700'
                        : league.status === 'upcoming'
                        ? 'bg-yellow-100 text-yellow-700'
                        : 'bg-gray-100 text-gray-500'
                    }`}>
                      {(league.status as string).charAt(0).toUpperCase() + (league.status as string).slice(1)}
                    </span>
                  </div>
                  <span className="text-xs text-gray-400">{league.player_count as string} players</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

import sql from '@/lib/db';
import Link from 'next/link';

export default async function LeaguesPage() {
  const leagues = await sql`
    SELECT id, name, status, season_start, season_end,
      (SELECT COUNT(*) FROM league_players WHERE league_id = leagues.id) AS player_count
    FROM leagues
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
                {league.player_count as string} players ·{' '}
                {new Date(league.season_start as string).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                {' – '}
                {new Date(league.season_end as string).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

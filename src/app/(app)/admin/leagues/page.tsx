import { auth } from '@/auth';
import sql from '@/lib/db';
import { redirect } from 'next/navigation';
import Link from 'next/link';
export default async function AdminLeaguesPage() {
  const session = await auth();
  if (session?.user?.role !== 'admin' && session?.user?.role !== 'super_admin') {
    redirect('/dashboard');
  }

  const leagues = await sql`
    SELECT
      l.id, l.name, l.status, l.max_players, l.league_type,
      COUNT(DISTINCT lp.player_id) AS player_count,
      COUNT(DISTINCT m.id) AS matches_played
    FROM leagues l
    LEFT JOIN league_players lp ON lp.league_id = l.id
    LEFT JOIN matches m ON m.league_id = l.id
    GROUP BY l.id, l.name, l.status, l.max_players, l.league_type
    ORDER BY l.created_at DESC
  `;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 mb-1">Admin - Leagues</h1>
          <p className="text-sm text-gray-400">Create leagues and manage players</p>
        </div>
        <Link
          href="/admin/leagues/new"
          className="text-sm bg-green-700 hover:bg-green-800 text-white font-medium px-4 py-2 rounded-lg transition-colors"
        >
          + Create league
        </Link>
      </div>

      {leagues.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-base font-semibold text-gray-700 mb-4">Manage leagues</h2>
          <div className="space-y-2">
            {leagues.map((league) => {
              const isDoubles = league.league_type === 'doubles';
              const playerCount = Number(league.player_count);
              const maxPlayers = Number(league.max_players);
              const matchesPlayed = Number(league.matches_played);
              // For doubles: max_players stores pair count; player_count rows = pairs * 2
              const unitCount = isDoubles ? Math.floor(playerCount / 2) : playerCount;
              const totalMatches = (unitCount * (unitCount - 1)) / 2;
              return (
                <div key={league.id as string} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                  <div className="flex items-center gap-2">
                    <a href={`/admin/leagues/${league.id}`} className="text-sm text-gray-800 hover:text-green-700 hover:underline">{league.name as string}</a>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      league.status === 'active' ? 'bg-green-100 text-green-700'
                      : league.status === 'upcoming' ? 'bg-blue-100 text-blue-700'
                      : 'bg-slate-100 text-slate-600'
                    }`}>{(league.status as string).charAt(0).toUpperCase() + (league.status as string).slice(1)}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-400">
                      {isDoubles ? `${unitCount}/${maxPlayers} pairs` : `${playerCount}/${maxPlayers} players`}
                    </span>
                    <span className="text-xs text-gray-400">{matchesPlayed}/{totalMatches} games played</span>
                    <a href={`/leagues/${league.id}`} className="text-xs text-green-700 hover:underline">View</a>
                    <a href={`/admin/leagues/${league.id}`} className="text-xs text-blue-600 hover:underline">Manage</a>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

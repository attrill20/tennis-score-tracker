import { auth } from '@/auth';
import sql from '@/lib/db';
import Link from 'next/link';

type League = {
  id: string;
  name: string;
  status: string;
  season_start: string;
  season_end: string;
  is_public: boolean;
  player_count: string;
  matches_played: string;
  my_final_position: number | null;
  is_member: boolean;
};

function LeagueCard({ league }: { league: League }) {
  const totalPossible = Math.floor(Number(league.player_count) * (Number(league.player_count) - 1) / 2);
  return (
    <Link
      href={`/leagues/${league.id}`}
      className="block bg-white rounded-xl border border-gray-200 p-4 hover:border-green-400 transition-colors"
    >
      <div className="flex items-start justify-between">
        <span className="font-medium text-gray-800">{league.name}</span>
        <div className="flex items-center gap-2">
          {!league.is_public && (
            <span className="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded-full font-medium">Private</span>
          )}
          <span className={`text-xs px-2 py-1 rounded-full font-medium ${
            league.status === 'active'
              ? 'bg-green-100 text-green-700'
              : league.status === 'upcoming'
              ? 'bg-blue-100 text-blue-700'
              : 'bg-slate-100 text-slate-600'
          }`}>
            {league.status.charAt(0).toUpperCase() + league.status.slice(1)}
          </span>
        </div>
      </div>
      <div className="flex items-center justify-between mt-2">
        <span className="text-xs text-gray-400">
          {league.status === 'upcoming'
            ? <>Players Registered: {league.player_count}</>
            : <>Players: {league.player_count} | Games Played: {league.matches_played}/{totalPossible}</>
          }
        </span>
        <p className="text-xs text-gray-400">
          {new Date(league.season_start).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
          {' - '}
          {new Date(league.season_end).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
        </p>
      </div>
    </Link>
  );
}

function Section({ title, leagues }: { title: string; leagues: League[] }) {
  return (
    <div className="mb-8">
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">{title}</h2>
      {leagues.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-6 text-center text-gray-400 text-sm">
          None yet.
        </div>
      ) : (
        <div className="space-y-3">
          {leagues.map((l) => <LeagueCard key={l.id} league={l} />)}
        </div>
      )}
    </div>
  );
}

export default async function LeaguesPage() {
  const session = await auth();
  const userId = session!.user.id;
  const isAdmin = session?.user?.role === 'admin' || session?.user?.role === 'super_admin';

  const rows = await sql`
    SELECT
      l.id, l.name, l.status, l.season_start, l.season_end, l.is_public,
      (SELECT COUNT(*) FROM league_players WHERE league_id = l.id) AS player_count,
      (SELECT lp.final_position FROM league_players lp WHERE lp.league_id = l.id AND lp.player_id = ${userId}) AS my_final_position,
      (SELECT COUNT(*) FROM matches m WHERE m.league_id = l.id) AS matches_played,
      EXISTS (SELECT 1 FROM league_players WHERE league_id = l.id AND player_id = ${userId}) AS is_member
    FROM leagues l
    WHERE l.is_public = true
      OR ${isAdmin}
      OR EXISTS (SELECT 1 FROM league_players WHERE league_id = l.id AND player_id = ${userId})
    ORDER BY l.season_start DESC
  `;

  const leagues = rows as unknown as League[];

  const active    = leagues.filter((l) => l.status === 'active');
  const upcoming  = leagues.filter((l) => l.status === 'upcoming');
  const myLeagues = leagues.filter((l) => l.is_member);
  const completed = leagues.filter((l) => l.status === 'completed');

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Leagues</h1>
      <Section title="Active Leagues" leagues={active} />
      <Section title="Upcoming Leagues" leagues={upcoming} />
      <Section title="My Leagues" leagues={myLeagues} />
      <Section title="Completed Leagues" leagues={completed} />
    </div>
  );
}

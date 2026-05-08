import { auth } from '@/auth';
import sql from '@/lib/db';
import { calculateStandings } from '@/lib/league';
import Link from 'next/link';
import DisputeButton from '../leagues/[id]/DisputeButton';

export default async function DashboardPage() {
  const session = await auth();
  const userId = session!.user.id;

  const leagues = await sql`
    SELECT l.id, l.name, l.status, l.season_start, l.season_end
    FROM leagues l
    JOIN league_players lp ON lp.league_id = l.id
    WHERE lp.player_id = ${userId}
    ORDER BY l.season_start DESC
  `;

  const leagueIds = leagues.map((l) => l.id as string);

  const recentMatches = await sql`
    SELECT
      m.id, m.score_player1, m.score_player2, m.played_at,
      m.submitted_by, m.status, m.league_id, m.player1_id, m.player2_id,
      l.name AS league_name,
      (p1.first_name || ' ' || p1.last_name) AS player1_name,
      (p2.first_name || ' ' || p2.last_name) AS player2_name
    FROM matches m
    JOIN leagues l ON l.id = m.league_id
    JOIN profiles p1 ON p1.id = m.player1_id
    JOIN profiles p2 ON p2.id = m.player2_id
    WHERE m.player1_id = ${userId} OR m.player2_id = ${userId}
    ORDER BY m.played_at DESC, m.submitted_at DESC
    LIMIT 10
  `;

  const [allPlayers, allMatches] = leagueIds.length > 0
    ? await Promise.all([
        sql`
          SELECT p.id, (p.first_name || ' ' || p.last_name) AS full_name, lp.league_id
          FROM profiles p
          JOIN league_players lp ON lp.player_id = p.id
          WHERE lp.league_id = ANY(${leagueIds}::uuid[])
        `,
        sql`
          SELECT * FROM matches
          WHERE league_id = ANY(${leagueIds}::uuid[])
        `,
      ])
    : [[], []];

  type LeagueStats = { position: number; played: number; total: number };

  const leagueStats: Record<string, LeagueStats> = {};
  for (const league of leagues) {
    const id = league.id as string;
    const players = allPlayers.filter((p) => p.league_id === id) as { id: string; full_name: string }[];
    const matches = allMatches.filter((m) => m.league_id === id) as {
      player1_id: string;
      player2_id: string;
      score_player1: number;
      score_player2: number;
      status: string;
    }[];
    const standings = calculateStandings(players, matches);
    const position = standings.findIndex((s) => s.id === userId) + 1;
    const played = standings.find((s) => s.id === userId)?.played ?? 0;
    const total = players.length - 1;
    leagueStats[id] = { position, played, total };
  }

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
          {leagues.map((league) => {
            const id = league.id as string;
            const stats = leagueStats[id];
            const ordinal = (n: number) => {
              const s = ['th', 'st', 'nd', 'rd'];
              const v = n % 100;
              return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
            };
            return (
            <Link
              key={id}
              href={`/leagues/${id}`}
              className="block bg-white rounded-xl border border-gray-200 p-4 hover:border-green-400 transition-colors"
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-gray-800">{league.name as string}</span>
                <div className="flex items-center gap-3">
                  {stats && league.status === 'active' && (
                    <span className="text-xs text-gray-400">
                      Position: {ordinal(stats.position)} &nbsp; Games played: {stats.played}/{stats.total}
                    </span>
                  )}
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    league.status === 'active'
                      ? 'bg-green-100 text-green-700'
                      : league.status === 'upcoming'
                      ? 'bg-yellow-100 text-yellow-700'
                      : 'bg-gray-100 text-gray-500'
                  }`}>
                    {league.status as string}
                  </span>
                </div>
              </div>
              <p className="text-xs text-gray-400 mt-1">
                {new Date(league.season_start as string).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                {' - '}
                {new Date(league.season_end as string).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
              </p>
            </Link>
            );
          })}
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

      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3 mt-8">My recent games</h2>

      {recentMatches.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">
          <p>No games played yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {recentMatches.map((match) => {
            const isPlayer1 = match.player1_id === userId;
            const myScore = isPlayer1 ? match.score_player1 as number : match.score_player2 as number;
            const theirScore = isPlayer1 ? match.score_player2 as number : match.score_player1 as number;
            const opponentName = isPlayer1 ? match.player2_name as string : match.player1_name as string;
            const submittedByMe = match.submitted_by === userId;
            const canEdit = submittedByMe && match.status === 'confirmed';
            const canDispute = !submittedByMe && match.status === 'confirmed';

            return (
              <div key={match.id as string} className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 text-sm">
                    <span className={`font-medium ${myScore > theirScore ? 'text-gray-800' : 'text-gray-400'}`}>
                      {session?.user?.name?.split(' ')[0]}
                    </span>
                    <span className="font-bold text-gray-800">{myScore} - {theirScore}</span>
                    <span className={`font-medium ${theirScore > myScore ? 'text-gray-800' : 'text-gray-400'}`}>
                      {opponentName}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    {match.status === 'disputed' && (
                      <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">Disputed</span>
                    )}
                    {match.status === 'overridden' && (
                      <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">Overridden</span>
                    )}
                    <span className="text-xs text-gray-400">{match.league_name as string}</span>
                    {canEdit && (
                      <Link
                        href={`/leagues/${match.league_id}/matches/${match.id}/edit`}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        Edit
                      </Link>
                    )}
                    {canDispute && <DisputeButton matchId={match.id as string} />}
                  </div>
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  {new Date(match.played_at as string).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

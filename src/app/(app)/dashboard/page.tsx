import { auth } from '@/auth';
import sql from '@/lib/db';
import { calculateStandings } from '@/lib/league';
import Link from 'next/link';
import DisputeResolutionNotification from '@/components/DisputeResolutionNotification';

export default async function DashboardPage() {
  const session = await auth();
  const userId = session!.user.id;

  const [leagues, profileRows] = await Promise.all([
    sql`
      SELECT l.id, l.name, l.status, l.season_start, l.season_end, lp.final_position,
        (SELECT COUNT(*) FROM league_players WHERE league_id = l.id) AS player_count
      FROM leagues l
      JOIN league_players lp ON lp.league_id = l.id AND lp.player_id = ${userId}
      WHERE lp.player_id = ${userId}
      ORDER BY
        CASE l.status WHEN 'active' THEN 0 WHEN 'upcoming' THEN 1 ELSE 2 END,
        l.season_start DESC
    `,
    sql`SELECT is_injured FROM profiles WHERE id = ${userId}`,
  ]);
  const isInjured = (profileRows[0]?.is_injured as boolean) ?? false;

  const leagueIds = leagues.map((l) => l.id as string);

  const [recentMatches, allPlayers, allMatches, pendingEdits, disputedMatches, resolvedDisputes] = await Promise.all([
    sql`
      SELECT
        m.id, m.score_player1, m.score_player2, m.set_scores, m.played_at,
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
      LIMIT 3
    `,
    leagueIds.length > 0 ? sql`
      SELECT p.id, (p.first_name || ' ' || p.last_name) AS full_name, lp.league_id
      FROM profiles p
      JOIN league_players lp ON lp.player_id = p.id
      WHERE lp.league_id = ANY(${leagueIds}::uuid[])
    ` : Promise.resolve([]),
    leagueIds.length > 0 ? sql`
      SELECT player1_id, player2_id, score_player1, score_player2, status, league_id
      FROM matches
      WHERE league_id = ANY(${leagueIds}::uuid[])
    ` : Promise.resolve([]),
    sql`
      SELECT m.id, m.league_id, m.pending_score_player1, m.pending_score_player2, m.pending_set_scores,
        (p2.first_name || ' ' || p2.last_name) AS opponent_name
      FROM matches m
      JOIN profiles p2 ON p2.id = m.pending_edit_by
      WHERE m.submitted_by = ${userId} AND m.status = 'pending_edit'
    `,
    sql`
      SELECT m.id, m.league_id, m.score_player1, m.score_player2, m.player1_id, m.player2_id,
        (p1.first_name || ' ' || p1.last_name) AS player1_name,
        (p2.first_name || ' ' || p2.last_name) AS player2_name
      FROM matches m
      JOIN profiles p1 ON p1.id = m.player1_id
      JOIN profiles p2 ON p2.id = m.player2_id
      WHERE m.status = 'disputed'
        AND (m.player1_id = ${userId} OR m.player2_id = ${userId})
    `,
    sql`
      SELECT
        d.id AS dispute_id, d.acknowledged_by_player1, d.acknowledged_by_player2,
        m.id AS match_id, m.league_id, m.score_player1, m.score_player2, m.status AS match_status,
        m.player1_id, m.player2_id,
        (p1.first_name || ' ' || p1.last_name) AS player1_name,
        (p2.first_name || ' ' || p2.last_name) AS player2_name,
        l.name AS league_name
      FROM disputes d
      JOIN matches m ON m.id = d.match_id
      JOIN profiles p1 ON p1.id = m.player1_id
      JOIN profiles p2 ON p2.id = m.player2_id
      JOIN leagues l ON l.id = m.league_id
      WHERE d.status = 'resolved'
        AND (m.player1_id = ${userId} OR m.player2_id = ${userId})
        AND (
          (m.player1_id = ${userId} AND d.acknowledged_by_player1 = false)
          OR (m.player2_id = ${userId} AND d.acknowledged_by_player2 = false)
        )
    `,
  ]);

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

      {isInjured && (
        <div className="mb-6 flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
          <span className="inline-flex items-center justify-center w-5 h-5 bg-white border border-red-300 rounded-full shrink-0 mt-0.5">
            <svg className="w-3 h-3 text-red-500" viewBox="0 0 16 16" fill="currentColor">
              <path d="M7 2h2v5h5v2h-5v5H7v-5H2V7h5z"/>
            </svg>
          </span>
          <span>
            You have currently marked yourself as injured. If you have recovered, please{' '}
            <Link href="/profile" className="font-medium underline underline-offset-2 hover:text-red-900">
              click here to unmark yourself
            </Link>.
          </span>
        </div>
      )}

      {resolvedDisputes.length > 0 && (
        <div className="mb-4 space-y-2">
          {resolvedDisputes.map((d) => {
            const isPlayer1 = d.player1_id === userId;
            const myScore = isPlayer1 ? d.score_player1 as number : d.score_player2 as number;
            const theirScore = isPlayer1 ? d.score_player2 as number : d.score_player1 as number;
            const myName = isPlayer1 ? d.player1_name as string : d.player2_name as string;
            const opponentName = isPlayer1 ? d.player2_name as string : d.player1_name as string;
            return (
              <DisputeResolutionNotification
                key={d.dispute_id as string}
                disputeId={d.dispute_id as string}
                matchId={d.match_id as string}
                leagueId={d.league_id as string}
                leagueName={d.league_name as string}
                myName={myName}
                opponentName={opponentName}
                myScore={myScore}
                theirScore={theirScore}
                matchStatus={d.match_status as string}
              />
            );
          })}
        </div>
      )}

      {pendingEdits.length > 0 && (
        <div className="mb-6 space-y-2">
          {pendingEdits.map((pe) => {
            const pendingSets = (pe.pending_set_scores ?? []) as [number, number][];
            return (
              <div key={pe.id as string} className="flex items-center justify-between gap-4 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="inline-flex items-center justify-center w-5 h-5 bg-amber-200 rounded-full shrink-0 text-amber-800 font-bold text-xs">!</span>
                  <div className="min-w-0">
                    <p className="text-sm text-amber-800">
                      <span className="font-medium">{pe.opponent_name as string}</span> suggested a score correction
                    </p>
                    <p className="text-xs text-amber-700 mt-0.5">
                      You {pe.pending_score_player1 as number}-{pe.pending_score_player2 as number} them
                      {pendingSets.length > 0 && (
                        <span className="ml-1 text-amber-600">
                          ({pendingSets.map(([p1, p2], i) => (
                            <span key={i}>{i > 0 ? ', ' : ''}{p1}-{p2}</span>
                          ))})
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                <Link
                  href={`/leagues/${pe.league_id as string}/matches/${pe.id as string}`}
                  className="shrink-0 text-xs bg-amber-200 hover:bg-amber-300 text-amber-900 font-medium px-3 py-1.5 rounded-lg transition-colors"
                >
                  Review
                </Link>
              </div>
            );
          })}
        </div>
      )}

      {disputedMatches.length > 0 && (
        <div className="mb-6 space-y-2">
          {disputedMatches.map((m) => {
            const isPlayer1 = m.player1_id === userId;
            const opponentName = isPlayer1 ? m.player2_name as string : m.player1_name as string;
            const myScore = isPlayer1 ? m.score_player1 as number : m.score_player2 as number;
            const theirScore = isPlayer1 ? m.score_player2 as number : m.score_player1 as number;
            return (
              <div key={m.id as string} className="flex items-center justify-between gap-4 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="inline-flex items-center justify-center w-5 h-5 bg-red-200 rounded-full shrink-0 text-red-800 font-bold text-xs">!</span>
                  <div className="min-w-0">
                    <p className="text-sm text-red-800">
                      Your match with <span className="font-medium">{opponentName}</span> is disputed
                    </p>
                    <p className="text-xs text-red-600 mt-0.5">Score {myScore}-{theirScore} - awaiting admin review</p>
                  </div>
                </div>
                <Link
                  href={`/leagues/${m.league_id as string}/matches/${m.id as string}`}
                  className="shrink-0 text-xs bg-red-200 hover:bg-red-300 text-red-900 font-medium px-3 py-1.5 rounded-lg transition-colors"
                >
                  View
                </Link>
              </div>
            );
          })}
        </div>
      )}

      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">My Leagues</h2>

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
            const medal = (n: number) => n === 1 ? ' 🥇' : n === 2 ? ' 🥈' : n === 3 ? ' 🥉' : '';
            return (
            <div key={id} className="relative bg-white rounded-xl border border-gray-200 p-4 hover:border-green-400 transition-colors cursor-pointer">
              <Link href={`/leagues/${id}`} className="absolute inset-0 rounded-xl z-10" aria-label={league.name as string} />
              <div className="relative">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-800">{league.name as string}</span>
                  <div className="flex items-center gap-2">
                    {league.status === 'active' && (
                      <Link
                        href={`/leagues/${id}/submit`}
                        className="relative z-20 text-xs bg-green-700 hover:bg-green-800 text-white font-medium px-3 py-1 rounded-full transition-colors"
                      >
                        Submit a result
                      </Link>
                    )}
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      league.status === 'active'
                        ? 'bg-green-100 text-green-700'
                        : league.status === 'upcoming'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-slate-100 text-slate-600'
                    }`}>
                      {(league.status as string).charAt(0).toUpperCase() + (league.status as string).slice(1)}
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-2">
                  {league.status === 'upcoming' ? (
                    <span className="text-xs text-gray-400">Players Registered: {league.player_count as string}</span>
                  ) : stats && (league.status === 'active' || league.status === 'completed') ? (
                    <span className="text-xs text-gray-400">
                      {league.status === 'completed'
                        ? <>Finished: {ordinal(league.final_position != null ? league.final_position as number : stats.position)}{medal(league.final_position != null ? league.final_position as number : stats.position)} &nbsp; Games Played: {stats.played}/{stats.total}</>
                        : <>Position: {ordinal(stats.position)} &nbsp; Games played: {stats.played}/{stats.total}</>
                      }
                    </span>
                  ) : <span />}
                  <p className="text-xs text-gray-400">
                    {new Date(league.season_start as string).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    {' - '}
                    {new Date(league.season_end as string).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })}
                  </p>
                </div>
              </div>
            </div>
            );
          })}
        </div>
      )}

      <div className="mt-3">
        <Link
          href="/leagues"
          className="text-sm text-green-700 font-medium hover:underline"
        >
          View all leagues →
        </Link>
      </div>

      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3 mt-8">My Recent Matches</h2>

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
            const canSuggestEdit = !submittedByMe && match.status === 'confirmed' &&
              (match.player1_id === userId || match.player2_id === userId);
            const setScores = match.set_scores as [number, number][] | null;
            const result = myScore > theirScore ? 'W' : myScore < theirScore ? 'L' : 'D';
            const badgeClass = result === 'W' ? 'bg-green-100 text-green-700' : result === 'L' ? 'bg-red-100 text-red-600' : 'bg-yellow-100 text-yellow-700';

            return (
              <div key={match.id as string} className="relative bg-white rounded-xl border border-gray-200 p-4 hover:border-green-400 transition-colors cursor-pointer">
                <Link href={canEdit ? `/leagues/${match.league_id as string}/matches/${match.id as string}/edit` : `/leagues/${match.league_id as string}/matches/${match.id as string}`} className="absolute inset-0 rounded-xl z-10" />
                <div className="relative flex items-center gap-3">
                  {/* W/L badge */}
                  <span className={`text-xs font-bold px-1.5 py-1 rounded shrink-0 self-center ${badgeClass}`}>{result}</span>

                  {/* Player rows with fixed-width name column */}
                  <div className="flex-1 min-w-0 text-sm">
                    <div className="flex items-center">
                      <span className={`font-medium w-24 shrink-0 truncate ${myScore > theirScore ? 'text-gray-800' : 'text-gray-400'}`}>
                        {session?.user?.name}
                      </span>
                      <div className="flex items-center gap-1.5">
                        {setScores && setScores.length > 0 ? setScores.map(([p1, p2], i) => {
                          const my = isPlayer1 ? p1 : p2;
                          const their = isPlayer1 ? p2 : p1;
                          return <span key={i} className={`text-xs font-medium w-6 text-center ${my > their ? 'text-gray-700' : 'text-gray-400'}`}>{my}</span>;
                        }) : <span className="text-xs font-medium text-gray-700">{myScore}</span>}
                      </div>
                    </div>
                    <div className="flex items-center mt-0.5">
                      <span className={`font-medium w-24 shrink-0 truncate ${theirScore > myScore ? 'text-gray-800' : 'text-gray-400'}`}>
                        {opponentName}
                      </span>
                      <div className="flex items-center gap-1.5">
                        {setScores && setScores.length > 0 ? setScores.map(([p1, p2], i) => {
                          const my = isPlayer1 ? p1 : p2;
                          const their = isPlayer1 ? p2 : p1;
                          return <span key={i} className={`text-xs font-medium w-6 text-center ${their > my ? 'text-gray-700' : 'text-gray-400'}`}>{their}</span>;
                        }) : <span className="text-xs font-medium text-gray-400">{theirScore}</span>}
                      </div>
                    </div>
                  </div>

                  {/* Right side: row 1 = league + edit/dispute, row 2 = date */}
                  <div className="flex flex-col items-end gap-1 shrink-0 text-right">
                    <div className="flex items-center gap-2">
                      {match.status === 'pending_edit' && (
                        <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">Edit pending</span>
                      )}
                      {match.status === 'overridden' && (
                        <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">Overridden</span>
                      )}
                      <span className="text-xs text-gray-400">{match.league_name as string}</span>
                      {canEdit && (
                        <Link href={`/leagues/${match.league_id}/matches/${match.id}/edit`} className="relative z-20 text-xs text-green-700 hover:underline">
                          Edit
                        </Link>
                      )}
                      {canSuggestEdit && (
                        <Link href={`/leagues/${match.league_id}/matches/${match.id}/suggest-edit`} className="relative z-20 text-xs text-green-700 hover:underline">
                          Suggest edit
                        </Link>
                      )}
                    </div>
                    <span className="text-xs text-gray-400">
                      {new Date(match.played_at as string).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-3">
        <Link href="/matches" className="text-sm text-green-700 font-medium hover:underline">
          View all my matches →
        </Link>
      </div>
    </div>
  );
}

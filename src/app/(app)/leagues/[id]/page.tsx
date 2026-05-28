import { auth } from '@/auth';
import sql from '@/lib/db';
import { calculateStandings, type Tiebreaker } from '@/lib/league';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import StandingsRow from './StandingsRow';

export default async function LeaguePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();

  const leagues = await sql`SELECT * FROM leagues WHERE id = ${id}`;
  const league = leagues[0];
  if (!league) notFound();

  const [players, matches] = await Promise.all([
    sql`
      SELECT p.id, (p.first_name || ' ' || p.last_name) AS full_name, p.is_injured
      FROM profiles p
      JOIN league_players lp ON lp.player_id = p.id
      WHERE lp.league_id = ${id}
      ORDER BY p.last_name, p.first_name
    `,
    sql`
      SELECT m.id, m.player1_id, m.player2_id, m.score_player1, m.score_player2,
             m.set_scores, m.tiebreak_scores, m.status, m.submitted_by, m.played_at,
             (p1.first_name || ' ' || p1.last_name) AS player1_name,
             (p2.first_name || ' ' || p2.last_name) AS player2_name
      FROM matches m
      JOIN profiles p1 ON p1.id = m.player1_id
      JOIN profiles p2 ON p2.id = m.player2_id
      WHERE m.league_id = ${id}
      ORDER BY m.played_at DESC, m.submitted_at DESC
    `,
  ]);

  const standings = calculateStandings(
    players as { id: string; full_name: string }[],
    matches as { player1_id: string; player2_id: string; score_player1: number; score_player2: number; status: string }[],
    ((league.tiebreaker as string) ?? 'head_to_head') as Tiebreaker
  );

  const injuredIds = new Set(players.filter((p) => p.is_injured).map((p) => p.id as string));

  const isInLeague = players.some((p) => p.id === session?.user?.id);
  const userId = session?.user?.id;

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-2xl font-bold text-gray-800">{league.name as string}</h1>
        <span className={`text-xs px-2 py-1 rounded-full font-medium ${
          league.status === 'active' ? 'bg-green-100 text-green-700'
          : league.status === 'upcoming' ? 'bg-blue-100 text-blue-700'
          : 'bg-slate-100 text-slate-600'
        }`}>
          {(league.status as string).charAt(0).toUpperCase() + (league.status as string).slice(1)}
        </span>
      </div>
      <p className="text-sm text-gray-400 mb-2">
        {new Date(league.season_start as string).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })}
        {' - '}
        {new Date(league.season_end as string).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
      </p>
      {league.description && (
        <p className="text-sm text-gray-600 mb-6">{league.description as string}</p>
      )}

      {/* League Table */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Table</h2>
        {isInLeague && league.status === 'active' && (
          <Link
            href={`/leagues/${id}/submit`}
            className="text-xs bg-green-700 hover:bg-green-800 text-white font-medium px-3 py-1.5 rounded-lg transition-colors"
          >
            Submit a result
          </Link>
        )}
      </div>
      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto mb-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-gray-500 text-xs">
              <th className="text-left px-4 py-3 font-medium">Player</th>
              <th className="text-center px-2 py-3 font-medium">P</th>
              <th className="text-center px-2 py-3 font-medium">W</th>
              <th className="text-center px-2 py-3 font-medium">D</th>
              <th className="text-center px-2 py-3 font-medium">L</th>
              <th className="text-center px-2 py-3 font-medium">Sets</th>
              <th className="text-center px-2 py-3 font-medium">Pts</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((s, i) => {
              const numPromoted = league.num_promoted as number ?? 0;
              const numRelegated = league.num_relegated as number ?? 0;
              const total = standings.length;
              const isPromotion = numPromoted > 0 && i < numPromoted;
              const isRelegation = numRelegated > 0 && i >= total - numRelegated;
              const rowClass = isPromotion ? 'bg-green-50' : isRelegation ? 'bg-red-50' : '';
              return (
                <StandingsRow
                  key={s.id}
                  playerId={s.id}
                  userId={userId}
                  name={s.name}
                  isInjured={injuredIds.has(s.id)}
                  position={i + 1}
                  played={s.played}
                  won={s.won}
                  drawn={s.drawn}
                  lost={s.lost}
                  setsFor={s.setsFor}
                  setsAgainst={s.setsAgainst}
                  points={s.points}
                  rowClass={rowClass}
                />
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Submit Score */}
      {/* Recent Results */}
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Results</h2>
      {matches.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-6 text-center text-gray-400 text-sm">
          No results yet.
        </div>
      ) : (
        <div className="space-y-2">
          {matches.map((match) => {
            const isPlayer1 = match.player1_id === userId;
            const isInvolved = match.player1_id === userId || match.player2_id === userId;
            const submittedByMe = match.submitted_by === userId;
            const canEdit = submittedByMe && match.status === 'confirmed';
            const canSuggestEdit = isInvolved && match.status === 'confirmed' && !submittedByMe;
            const setScores = match.set_scores as [number, number][] | null;
            const tiebreakScores = match.tiebreak_scores as ([number, number] | null)[] | null;

            // From current user's perspective if involved, otherwise winner first
            const p1Won = (match.score_player1 as number) > (match.score_player2 as number);
            const topIsPlayer1 = isInvolved ? isPlayer1 : p1Won;
            const topName = topIsPlayer1 ? match.player1_name as string : match.player2_name as string;
            const bottomName = topIsPlayer1 ? match.player2_name as string : match.player1_name as string;
            const topScore = topIsPlayer1 ? match.score_player1 as number : match.score_player2 as number;
            const bottomScore = topIsPlayer1 ? match.score_player2 as number : match.score_player1 as number;
            const topWon = topScore > bottomScore;

            const result = isInvolved ? (topWon ? 'W' : topScore < bottomScore ? 'L' : 'D') : null;
            const badgeClass = result === 'W' ? 'bg-green-100 text-green-700' : result === 'L' ? 'bg-red-100 text-red-600' : 'bg-yellow-100 text-yellow-700';

            const href = canEdit
              ? `/leagues/${id}/matches/${match.id as string}/edit`
              : `/leagues/${id}/matches/${match.id as string}`;

            return (
              <div key={match.id as string} className="relative bg-white rounded-xl border border-gray-200 p-4 hover:border-green-400 transition-colors cursor-pointer">
                <Link href={href} className="absolute inset-0 rounded-xl z-10" />
                <div className="relative flex items-start gap-3">
                  <div className="flex flex-1 min-w-0 items-center gap-3">
                  <div className="w-8 shrink-0 flex justify-center">
                    {result && (
                      <span className={`text-xs font-bold px-1.5 py-1 rounded ${badgeClass}`}>{result}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0 text-sm">
                    <div className="flex items-center">
                      <span className={`font-medium w-24 shrink-0 truncate ${topWon ? 'text-gray-800' : 'text-gray-400'}`}>{topName}</span>
                      <div className="flex items-center gap-1.5">
                        {setScores && setScores.length > 0 ? setScores.map(([p1, p2], i) => {
                          const top = topIsPlayer1 ? p1 : p2;
                          const bot = topIsPlayer1 ? p2 : p1;
                          const tb = tiebreakScores?.[i] ?? null;
                          const topTb = tb ? (topIsPlayer1 ? tb[0] : tb[1]) : null;
                          return (
                            <span key={i} className={`relative inline-block text-xs font-medium w-6 text-center ${top > bot ? 'text-gray-700' : 'text-gray-400'}`}>
                              {top}
                              {topTb !== null && <span className="absolute -top-0.5 -right-0.5 text-[8px] font-normal leading-none opacity-50">{topTb}</span>}
                            </span>
                          );
                        }) : <span className="text-xs font-medium text-gray-700">{topScore}</span>}
                      </div>
                    </div>
                    <div className="flex items-center mt-0.5">
                      <span className={`font-medium w-24 shrink-0 truncate ${!topWon ? 'text-gray-800' : 'text-gray-400'}`}>{bottomName}</span>
                      <div className="flex items-center gap-1.5">
                        {setScores && setScores.length > 0 ? setScores.map(([p1, p2], i) => {
                          const top = topIsPlayer1 ? p1 : p2;
                          const bot = topIsPlayer1 ? p2 : p1;
                          const tb = tiebreakScores?.[i] ?? null;
                          const botTb = tb ? (topIsPlayer1 ? tb[1] : tb[0]) : null;
                          return (
                            <span key={i} className={`relative inline-block text-xs font-medium w-6 text-center ${bot > top ? 'text-gray-700' : 'text-gray-400'}`}>
                              {bot}
                              {botTb !== null && <span className="absolute -top-0.5 -right-0.5 text-[8px] font-normal leading-none opacity-50">{botTb}</span>}
                            </span>
                          );
                        }) : <span className="text-xs font-medium text-gray-400">{bottomScore}</span>}
                      </div>
                    </div>
                  </div>
                  </div>
                  <div className="flex flex-col items-end justify-between self-stretch shrink-0 text-right">
                    <div className="flex items-center gap-2 relative z-10">
                      {match.status === 'pending_edit' && (
                        <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">Edit pending</span>
                      )}
                      {match.status === 'overridden' && (
                        <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">Overridden</span>
                      )}
                      {canSuggestEdit && (
                        <Link href={`/leagues/${id}/matches/${match.id as string}/suggest-edit`} className="relative z-20 text-xs text-green-700 hover:underline">Suggest edit</Link>
                      )}
                      <span className="text-xs text-gray-400">
                        {new Date(match.played_at as string).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })}
                      </span>
                    </div>
                    {canEdit && (
                      <Link href={`/leagues/${id}/matches/${match.id as string}/edit`} className="relative z-20 text-xs text-green-700 hover:underline">Edit</Link>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

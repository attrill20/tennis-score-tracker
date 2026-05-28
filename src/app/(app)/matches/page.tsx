import { auth } from '@/auth';
import sql from '@/lib/db';
import Link from 'next/link';
export default async function MatchesPage() {
  const session = await auth();
  const userId = session!.user.id;

  const matches = await sql`
    SELECT
      m.id, m.score_player1, m.score_player2, m.set_scores, m.tiebreak_scores, m.played_at,
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
  `;

  const total = matches.length;
  const wins = matches.filter((m) => {
    const isP1 = m.player1_id === userId;
    const my = isP1 ? m.score_player1 as number : m.score_player2 as number;
    const their = isP1 ? m.score_player2 as number : m.score_player1 as number;
    return my > their;
  }).length;
  const losses = matches.filter((m) => {
    const isP1 = m.player1_id === userId;
    const my = isP1 ? m.score_player1 as number : m.score_player2 as number;
    const their = isP1 ? m.score_player2 as number : m.score_player1 as number;
    return their > my;
  }).length;
  const draws = total - wins - losses;
  const pct = (n: number) => total === 0 ? '0%' : Math.round((n / total) * 100) + '%';

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">My Matches</h1>

      {total > 0 && (
        <>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">My Overall Stats</h2>
          <div className="bg-white rounded-xl border border-gray-200 px-4 py-3 mb-6 flex flex-wrap justify-center gap-x-6 gap-y-1 text-sm">
            <span className="text-gray-500">Played: <span className="font-semibold text-gray-800">{total}</span></span>
            <span className="text-gray-500">Wins: <span className="font-semibold text-green-700">{wins}</span> <span className="text-xs text-green-600">({pct(wins)})</span></span>
            <span className="text-gray-500">Losses: <span className="font-semibold text-red-500">{losses}</span> <span className="text-xs text-red-500">({pct(losses)})</span></span>
            <span className="text-gray-500">Draws: <span className="font-semibold text-yellow-500">{draws}</span> <span className="text-xs text-yellow-500">({pct(draws)})</span></span>
          </div>
        </>
      )}

      {matches.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">
          <p>No games played yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {matches.map((match) => {
            const isPlayer1 = match.player1_id === userId;
            const myScore = isPlayer1 ? match.score_player1 as number : match.score_player2 as number;
            const theirScore = isPlayer1 ? match.score_player2 as number : match.score_player1 as number;
            const opponentName = isPlayer1 ? match.player2_name as string : match.player1_name as string;
            const submittedByMe = match.submitted_by === userId;
            const canEdit = submittedByMe && match.status === 'confirmed';
            const canSuggestEdit = !submittedByMe && match.status === 'confirmed' &&
              (match.player1_id === userId || match.player2_id === userId);
            const setScores = match.set_scores as [number, number][] | null;
            const tiebreakScores = match.tiebreak_scores as ([number, number] | null)[] | null;
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
                          const tb = tiebreakScores?.[i] ?? null;
                          const myTb = tb ? (isPlayer1 ? tb[0] : tb[1]) : null;
                          return (
                            <span key={i} className={`relative inline-block text-xs font-medium w-6 text-center ${my > their ? 'text-gray-700' : 'text-gray-400'}`}>
                              {my}
                              {myTb !== null && <span className="absolute -top-0.5 right-1.5 text-[9px] font-normal leading-none opacity-50">{myTb}</span>}
                            </span>
                          );
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
                          const tb = tiebreakScores?.[i] ?? null;
                          const theirTb = tb ? (isPlayer1 ? tb[1] : tb[0]) : null;
                          return (
                            <span key={i} className={`relative inline-block text-xs font-medium w-6 text-center ${their > my ? 'text-gray-700' : 'text-gray-400'}`}>
                              {their}
                              {theirTb !== null && <span className="absolute -top-0.5 right-1.5 text-[9px] font-normal leading-none opacity-50">{theirTb}</span>}
                            </span>
                          );
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
    </div>
  );
}

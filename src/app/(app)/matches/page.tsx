import { auth } from '@/auth';
import sql from '@/lib/db';
import Link from 'next/link';

export default async function MatchesPage() {
  const session = await auth();
  const userId = session!.user.id;

  const matches = await sql`
    SELECT
      m.id, m.score_player1, m.score_player2, m.set_scores, m.tiebreak_scores, m.played_at,
      m.submitted_by, m.status, m.league_id, m.player1_id, m.player2_id, m.player3_id, m.player4_id,
      m.match_type, m.winner_id,
      l.name AS league_name,
      p1.first_name AS player1_first, (p1.first_name || ' ' || p1.last_name) AS player1_name,
      p2.first_name AS player2_first, (p2.first_name || ' ' || p2.last_name) AS player2_name,
      p3.first_name AS player3_first,
      p4.first_name AS player4_first
    FROM matches m
    JOIN leagues l ON l.id = m.league_id
    JOIN profiles p1 ON p1.id = m.player1_id
    JOIN profiles p2 ON p2.id = m.player2_id
    LEFT JOIN profiles p3 ON p3.id = m.player3_id
    LEFT JOIN profiles p4 ON p4.id = m.player4_id
    WHERE m.player1_id = ${userId} OR m.player2_id = ${userId}
       OR m.player3_id = ${userId} OR m.player4_id = ${userId}
    ORDER BY m.played_at DESC, m.submitted_at DESC
  `;

  type Match = (typeof matches)[0];

  function getResult(m: Match): 'W' | 'L' | 'D' {
    const isTeam1 = m.player1_id === userId || m.player3_id === userId;
    const winnerId = m.winner_id as string | null;
    if (winnerId) {
      return (winnerId === m.player1_id) === isTeam1 ? 'W' : 'L';
    }
    const s1 = m.score_player1 as number;
    const s2 = m.score_player2 as number;
    const my = isTeam1 ? s1 : s2;
    const their = isTeam1 ? s2 : s1;
    return my > their ? 'W' : my < their ? 'L' : 'D';
  }

  const singlesMatches = matches.filter((m) => !m.player3_id && !m.player4_id);
  const doublesMatches = matches.filter((m) => m.player3_id || m.player4_id);

  function calcStats(ms: Match[]) {
    const total = ms.length;
    const wins = ms.filter((m) => getResult(m) === 'W').length;
    const losses = ms.filter((m) => getResult(m) === 'L').length;
    const draws = total - wins - losses;
    const pct = (n: number) => total === 0 ? '0%' : Math.round((n / total) * 100) + '%';
    return { total, wins, losses, draws, pct };
  }

  const singles = calcStats(singlesMatches);
  const dbl = calcStats(doublesMatches);
  const hasDoubles = doublesMatches.length > 0;
  const hasSingles = singlesMatches.length > 0;

  const myFirstName = (session?.user?.name ?? '').split(' ')[0];

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">My Matches</h1>

      {(hasSingles || hasDoubles) && (
        <>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">My Overall Stats</h2>
          <div className="bg-white rounded-xl border border-gray-200 px-4 py-3 mb-6">
            {hasSingles && hasDoubles ? (
              <div className="grid grid-cols-2 gap-4 text-sm">
                {(['singles', 'doubles'] as const).map((type) => {
                  const s = type === 'singles' ? singles : dbl;
                  return (
                    <div key={type}>
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">{type}</p>
                      <div className="space-y-1">
                        <div className="flex justify-between">
                          <span className="text-gray-500">Played</span>
                          <span className="font-semibold text-gray-800">{s.total}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Wins</span>
                          <span className="font-semibold text-green-700">{s.wins} <span className="text-xs text-green-600">({s.pct(s.wins)})</span></span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Losses</span>
                          <span className="font-semibold text-red-500">{s.losses} <span className="text-xs text-red-400">({s.pct(s.losses)})</span></span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Draws</span>
                          <span className="font-semibold text-yellow-500">{s.draws} <span className="text-xs text-yellow-400">({s.pct(s.draws)})</span></span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-wrap justify-center gap-x-6 gap-y-1 text-sm">
                {(() => { const s = hasSingles ? singles : dbl; return (
                  <>
                    <span className="text-gray-500">Played: <span className="font-semibold text-gray-800">{s.total}</span></span>
                    <span className="text-gray-500">Wins: <span className="font-semibold text-green-700">{s.wins}</span> <span className="text-xs text-green-600">({s.pct(s.wins)})</span></span>
                    <span className="text-gray-500">Losses: <span className="font-semibold text-red-500">{s.losses}</span> <span className="text-xs text-red-500">({s.pct(s.losses)})</span></span>
                    <span className="text-gray-500">Draws: <span className="font-semibold text-yellow-500">{s.draws}</span> <span className="text-xs text-yellow-500">({s.pct(s.draws)})</span></span>
                  </>
                ); })()}
              </div>
            )}
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
            const isDoubles = !!(match.player3_id || match.player4_id);
            const isTeam1 = match.player1_id === userId || match.player3_id === userId;
            const result = getResult(match);
            const badgeClass = result === 'W' ? 'bg-green-100 text-green-700' : result === 'L' ? 'bg-red-100 text-red-600' : 'bg-yellow-100 text-yellow-700';

            const submittedByMe = match.submitted_by === userId;
            const isInvolved = match.player1_id === userId || match.player2_id === userId || match.player3_id === userId || match.player4_id === userId;
            const canEdit = submittedByMe && match.status === 'confirmed';
            const canSuggestEdit = isInvolved && !submittedByMe && match.status === 'confirmed';

            const setScores = match.set_scores as [number, number][] | null;
            const tiebreakScores = match.tiebreak_scores as ([number, number] | null)[] | null;

            // Name display
            const p1First = match.player1_first as string;
            const p2First = match.player2_first as string;
            const p3First = match.player3_first as string | null;
            const p4First = match.player4_first as string | null;

            const myDisplayName = isDoubles
              ? `${myFirstName} / ${isTeam1 ? (p3First ?? '') : (p4First ?? '')}`
              : (session?.user?.name ?? '');
            const theirDisplayName = isDoubles
              ? `${isTeam1 ? p2First : p1First} / ${isTeam1 ? (p4First ?? '') : (p3First ?? '')}`
              : (isTeam1 ? (match.player2_name as string) : (match.player1_name as string));

            // Scores from "my team" perspective
            const myTeamScore = isTeam1 ? match.score_player1 as number : match.score_player2 as number;
            const theirTeamScore = isTeam1 ? match.score_player2 as number : match.score_player1 as number;
            const myWon = result === 'W';

            return (
              <div key={match.id as string} className="relative bg-white rounded-xl border border-gray-200 p-4 hover:border-green-400 transition-colors cursor-pointer">
                <Link
                  href={canEdit ? `/leagues/${match.league_id as string}/matches/${match.id as string}/edit` : `/leagues/${match.league_id as string}/matches/${match.id as string}`}
                  className="absolute inset-0 rounded-xl z-10"
                />
                <div className="relative flex items-center gap-3">
                  <span className={`text-xs font-bold px-1.5 py-1 rounded shrink-0 self-center ${badgeClass}`}>{result}</span>

                  <div className="flex-1 min-w-0 text-sm">
                    <div className="flex items-center">
                      <span className={`font-medium w-28 shrink-0 truncate ${myWon ? 'text-gray-800' : 'text-gray-400'}`}>
                        {myDisplayName}
                      </span>
                      <div className="flex items-center gap-1.5">
                        {setScores && setScores.length > 0 ? setScores.map(([p1, p2], i) => {
                          const my = isTeam1 ? p1 : p2;
                          const their = isTeam1 ? p2 : p1;
                          const tb = tiebreakScores?.[i] ?? null;
                          const myTb = tb ? (isTeam1 ? tb[0] : tb[1]) : null;
                          return (
                            <span key={i} className={`relative inline-block text-xs font-medium w-6 text-center ${my > their ? 'text-gray-700' : 'text-gray-400'}`}>
                              {my}
                              {myTb !== null && <span className="absolute -top-0.5 right-1.5 text-[9px] font-normal leading-none opacity-50">{myTb}</span>}
                            </span>
                          );
                        }) : <span className="text-xs font-medium text-gray-700">{myTeamScore}</span>}
                      </div>
                    </div>
                    <div className="flex items-center mt-0.5">
                      <span className={`font-medium w-28 shrink-0 truncate ${!myWon ? 'text-gray-800' : 'text-gray-400'}`}>
                        {theirDisplayName}
                      </span>
                      <div className="flex items-center gap-1.5">
                        {setScores && setScores.length > 0 ? setScores.map(([p1, p2], i) => {
                          const my = isTeam1 ? p1 : p2;
                          const their = isTeam1 ? p2 : p1;
                          const tb = tiebreakScores?.[i] ?? null;
                          const theirTb = tb ? (isTeam1 ? tb[1] : tb[0]) : null;
                          return (
                            <span key={i} className={`relative inline-block text-xs font-medium w-6 text-center ${their > my ? 'text-gray-700' : 'text-gray-400'}`}>
                              {their}
                              {theirTb !== null && <span className="absolute -top-0.5 right-1.5 text-[9px] font-normal leading-none opacity-50">{theirTb}</span>}
                            </span>
                          );
                        }) : <span className="text-xs font-medium text-gray-400">{theirTeamScore}</span>}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1 shrink-0 text-right">
                    <div className="flex items-center gap-2">
                      {isDoubles && (
                        <span className="text-xs bg-blue-50 text-blue-500 px-1.5 py-0.5 rounded-full font-medium">Doubles</span>
                      )}
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

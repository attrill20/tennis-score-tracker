import { auth } from '@/auth';
import sql from '@/lib/db';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import PendingEditReview from './PendingEditReview';

export default async function MatchPage({
  params,
}: {
  params: Promise<{ id: string; matchId: string }>;
}) {
  const { id: leagueId, matchId } = await params;
  const session = await auth();
  const userId = session!.user.id;

  const matches = await sql`
    SELECT m.*,
      (p1.first_name || ' ' || p1.last_name) AS player1_name,
      (p2.first_name || ' ' || p2.last_name) AS player2_name,
      l.name AS league_name
    FROM matches m
    JOIN profiles p1 ON p1.id = m.player1_id
    JOIN profiles p2 ON p2.id = m.player2_id
    JOIN leagues l ON l.id = m.league_id
    WHERE m.id = ${matchId} AND m.league_id = ${leagueId}
  `;

  const match = matches[0];
  if (!match) notFound();

  const disputes = match.status === 'disputed' ? await sql`
    SELECT requested_score_player1, requested_score_player2, requested_set_scores
    FROM disputes
    WHERE match_id = ${matchId} AND status = 'open'
    LIMIT 1
  ` : [];
  const dispute = disputes[0] ?? null;

  const isPlayer1 = match.player1_id === userId;
  const myScore = isPlayer1 ? match.score_player1 as number : match.score_player2 as number;
  const theirScore = isPlayer1 ? match.score_player2 as number : match.score_player1 as number;
  const myName = isPlayer1 ? match.player1_name as string : match.player2_name as string;
  const opponentName = isPlayer1 ? match.player2_name as string : match.player1_name as string;
  const setScores = (match.set_scores ?? null) as [number, number][] | null;
  const tiebreakScores = (match.tiebreak_scores ?? null) as ([number, number] | null)[] | null;
  const submittedByMe = match.submitted_by === userId;
  const isPendingEdit = match.status === 'pending_edit';

  const canEdit = submittedByMe && match.status === 'confirmed';
  const canSuggestEdit = !submittedByMe && match.status === 'confirmed' &&
    (match.player1_id === userId || match.player2_id === userId);

  // From submitter's (player1) perspective for the pending review
  const myPendingScore = match.pending_score_player1 as number | null;
  const theirPendingScore = match.pending_score_player2 as number | null;
  const pendingSetScores = (match.pending_set_scores ?? null) as [number, number][] | null;
  const pendingTiebreakScores = (match.pending_tiebreak_scores ?? null) as ([number, number] | null)[] | null;

  return (
    <div className="max-w-lg mx-auto">
      <div className="mb-4">
        <Link href={`/leagues/${leagueId}`} className="text-sm text-green-700 hover:underline">
          - {match.league_name as string}
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6 sm:p-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-lg font-bold text-gray-800">Match result</h1>
          <div className="flex items-center gap-2">
            {isPendingEdit && (
              <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">Edit pending</span>
            )}
            {match.status === 'disputed' && (
              <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">Disputed</span>
            )}
            {match.status === 'overridden' && (
              <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">Overridden</span>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between gap-4 mb-4">
          <div className="text-center flex-1">
            <Link
              href={`/players/${userId}`}
              className={`text-sm font-medium mb-1 hover:underline ${myScore > theirScore ? 'text-gray-800' : 'text-gray-400'}`}
            >
              {myName}
            </Link>
            <p className={`text-5xl font-bold ${myScore > theirScore ? 'text-green-700' : 'text-gray-300'}`}>
              {myScore}
            </p>
          </div>
          <p className="text-2xl font-light text-gray-300">-</p>
          <div className="text-center flex-1">
            <Link
              href={`/players/${isPlayer1 ? match.player2_id : match.player1_id}`}
              className={`text-sm font-medium mb-1 hover:underline ${theirScore > myScore ? 'text-gray-800' : 'text-gray-400'}`}
            >
              {opponentName}
            </Link>
            <p className={`text-5xl font-bold ${theirScore > myScore ? 'text-green-700' : 'text-gray-300'}`}>
              {theirScore}
            </p>
          </div>
        </div>

        {setScores && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-1 pl-[60px]">
              {setScores.map((_, i) => (
                <span key={i} className="flex-1 text-center text-xs text-gray-400">Set {i + 1}</span>
              ))}
            </div>
            <div className="flex items-center gap-2 mb-1">
              <Link href={`/players/${userId}`} className={`w-[52px] text-xs truncate hover:underline ${myScore > theirScore ? 'text-gray-700 font-medium' : 'text-gray-400'}`}>{myName.split(' ')[0]}</Link>
              {setScores.map(([p1, p2], i) => {
                const my = isPlayer1 ? p1 : p2;
                const their = isPlayer1 ? p2 : p1;
                const tb = tiebreakScores?.[i] ?? null;
                const myTb = tb ? (isPlayer1 ? tb[0] : tb[1]) : null;
                return (
                  <div key={i} className={`relative flex-1 text-center text-sm font-semibold py-1.5 rounded-lg ${my > their ? 'bg-green-50 text-green-700' : 'bg-gray-50 text-gray-400'}`}>
                    {my}
                    {myTb !== null && (
                      <span className="absolute top-1 right-2 text-[9px] font-normal leading-none opacity-60">{myTb}</span>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="flex items-center gap-2">
              <Link href={`/players/${isPlayer1 ? match.player2_id : match.player1_id}`} className={`w-[52px] text-xs truncate hover:underline ${theirScore > myScore ? 'text-gray-700 font-medium' : 'text-gray-400'}`}>{opponentName.split(' ')[0]}</Link>
              {setScores.map(([p1, p2], i) => {
                const my = isPlayer1 ? p1 : p2;
                const their = isPlayer1 ? p2 : p1;
                const tb = tiebreakScores?.[i] ?? null;
                const theirTb = tb ? (isPlayer1 ? tb[1] : tb[0]) : null;
                return (
                  <div key={i} className={`relative flex-1 text-center text-sm font-semibold py-1.5 rounded-lg ${their > my ? 'bg-green-50 text-green-700' : 'bg-gray-50 text-gray-400'}`}>
                    {their}
                    {theirTb !== null && (
                      <span className="absolute top-1 right-2 text-[9px] font-normal leading-none opacity-60">{theirTb}</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <p className="text-xs text-gray-400 text-center mb-6">
          {new Date(match.played_at as string).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })}
        </p>

        {/* Disputed — show original vs requested, awaiting admin */}
        {match.status === 'disputed' && (
          <div className="mt-2 pt-5 border-t border-red-100 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              {/* Original score */}
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Original</p>
                <div className="flex items-center gap-2 mb-1 pl-[44px]">
                  {setScores?.map((_, i) => (
                    <span key={i} className="flex-1 text-center text-xs text-gray-400">S{i + 1}</span>
                  ))}
                </div>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`w-[36px] text-xs truncate font-medium ${myScore > theirScore ? 'text-gray-800' : 'text-gray-400'}`}>{myName.split(' ')[0]}</span>
                  {setScores ? setScores.map(([p1, p2], i) => {
                    const my = isPlayer1 ? p1 : p2;
                    const their = isPlayer1 ? p2 : p1;
                    return <div key={i} className={`flex-1 text-center text-xs font-semibold py-1 rounded-md ${my > their ? 'bg-green-100 text-green-700' : 'bg-white text-gray-400'}`}>{my}</div>;
                  }) : <span className="text-sm font-bold text-gray-800">{myScore}</span>}
                </div>
                <div className="flex items-center gap-2">
                  <span className={`w-[36px] text-xs truncate font-medium ${theirScore > myScore ? 'text-gray-800' : 'text-gray-400'}`}>{opponentName.split(' ')[0]}</span>
                  {setScores ? setScores.map(([p1, p2], i) => {
                    const my = isPlayer1 ? p1 : p2;
                    const their = isPlayer1 ? p2 : p1;
                    return <div key={i} className={`flex-1 text-center text-xs font-semibold py-1 rounded-md ${their > my ? 'bg-green-100 text-green-700' : 'bg-white text-gray-400'}`}>{their}</div>;
                  }) : <span className="text-sm font-bold text-gray-400">{theirScore}</span>}
                </div>
              </div>

              {/* Requested correction */}
              {dispute && dispute.requested_score_player1 != null ? (() => {
                const reqSets = (dispute.requested_set_scores ?? null) as [number, number][] | null;
                const reqMyScore = isPlayer1 ? dispute.requested_score_player1 as number : dispute.requested_score_player2 as number;
                const reqTheirScore = isPlayer1 ? dispute.requested_score_player2 as number : dispute.requested_score_player1 as number;
                return (
                  <div className="bg-red-50 rounded-xl p-3">
                    <p className="text-xs font-semibold text-red-400 uppercase tracking-wide mb-3">Requested</p>
                    <div className="flex items-center gap-2 mb-1 pl-[44px]">
                      {reqSets?.map((_, i) => (
                        <span key={i} className="flex-1 text-center text-xs text-gray-400">S{i + 1}</span>
                      ))}
                    </div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`w-[36px] text-xs truncate font-medium ${reqMyScore > reqTheirScore ? 'text-gray-800' : 'text-gray-400'}`}>{myName.split(' ')[0]}</span>
                      {reqSets ? reqSets.map(([p1, p2], i) => {
                        const my = isPlayer1 ? p1 : p2;
                        const their = isPlayer1 ? p2 : p1;
                        return <div key={i} className={`flex-1 text-center text-xs font-semibold py-1 rounded-md ${my > their ? 'bg-green-100 text-green-700' : 'bg-white text-gray-400'}`}>{my}</div>;
                      }) : <span className="text-sm font-bold text-gray-800">{reqMyScore}</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`w-[36px] text-xs truncate font-medium ${reqTheirScore > reqMyScore ? 'text-gray-800' : 'text-gray-400'}`}>{opponentName.split(' ')[0]}</span>
                      {reqSets ? reqSets.map(([p1, p2], i) => {
                        const my = isPlayer1 ? p1 : p2;
                        const their = isPlayer1 ? p2 : p1;
                        return <div key={i} className={`flex-1 text-center text-xs font-semibold py-1 rounded-md ${their > my ? 'bg-green-100 text-green-700' : 'bg-white text-gray-400'}`}>{their}</div>;
                      }) : <span className="text-sm font-bold text-gray-400">{reqTheirScore}</span>}
                    </div>
                  </div>
                );
              })() : (
                <div className="bg-red-50 rounded-xl p-3 flex items-center justify-center">
                  <p className="text-xs text-red-400 text-center">No correction recorded</p>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
              <span className="text-red-400 text-sm">&#9888;</span>
              <p className="text-sm text-red-700">This dispute is awaiting admin review. The original score stands in the meantime.</p>
            </div>
          </div>
        )}

        {/* Submitter sees pending review */}
        {isPendingEdit && submittedByMe && myPendingScore !== null && theirPendingScore !== null && (
          <PendingEditReview
            matchId={matchId}
            myName={myName}
            myPendingScore={myPendingScore}
            theirPendingScore={theirPendingScore}
            pendingSetScores={pendingSetScores}
            pendingTiebreakScores={pendingTiebreakScores}
            opponentName={opponentName}
          />
        )}

        {/* Non-submitter sees waiting message when their edit is pending */}
        {isPendingEdit && !submittedByMe && (
          <div className="mt-6 pt-4 border-t border-amber-100">
            <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-center">
              Your correction is awaiting {opponentName}&apos;s review.
            </p>
          </div>
        )}

        {/* Normal actions when confirmed */}
        {(canEdit || canSuggestEdit) && (
          <div className="flex justify-center gap-3 pt-4 border-t border-gray-100">
            {canEdit && (
              <Link
                href={`/leagues/${leagueId}/matches/${matchId}/edit`}
                className="text-sm bg-green-700 hover:bg-green-800 text-white font-medium px-5 py-2.5 rounded-lg transition-colors"
              >
                Edit result
              </Link>
            )}
            {canSuggestEdit && (
              <Link
                href={`/leagues/${leagueId}/matches/${matchId}/suggest-edit`}
                className="text-sm bg-green-700 hover:bg-green-800 text-white font-medium px-5 py-2.5 rounded-lg transition-colors"
              >
                Suggest edit
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

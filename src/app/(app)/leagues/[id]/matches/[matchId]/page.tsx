import { auth } from '@/auth';
import sql from '@/lib/db';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import PendingEditReview from './PendingEditReview';
import BackButton from '@/components/BackButton';

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
      p1.first_name AS player1_first, (p1.first_name || ' ' || p1.last_name) AS player1_name,
      p2.first_name AS player2_first, (p2.first_name || ' ' || p2.last_name) AS player2_name,
      p3.first_name AS player3_first,
      p4.first_name AS player4_first,
      l.name AS league_name
    FROM matches m
    JOIN profiles p1 ON p1.id = m.player1_id
    JOIN profiles p2 ON p2.id = m.player2_id
    LEFT JOIN profiles p3 ON p3.id = m.player3_id
    LEFT JOIN profiles p4 ON p4.id = m.player4_id
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
  const isDoubles = !!(match.player3_id);
  const matchType = match.match_type as string | null;
  const winnerId = match.winner_id as string | null;
  const myScore = isPlayer1 ? match.score_player1 as number : match.score_player2 as number;
  const theirScore = isPlayer1 ? match.score_player2 as number : match.score_player1 as number;
  const iWon = winnerId ? winnerId === userId : myScore > theirScore;

  const p1First = match.player1_first as string;
  const p2First = match.player2_first as string;
  const p3First = match.player3_first as string | null;
  const p4First = match.player4_first as string | null;

  const myName = isDoubles
    ? isPlayer1 ? `${p1First} / ${p3First}` : `${p2First} / ${p4First}`
    : isPlayer1 ? (match.player1_name as string) : (match.player2_name as string);

  const opponentName = isDoubles
    ? isPlayer1 ? `${p2First} / ${p4First}` : `${p1First} / ${p3First}`
    : isPlayer1 ? (match.player2_name as string) : (match.player1_name as string);

  const opponentPlayerId = isPlayer1 ? match.player2_id as string : match.player1_id as string;
  const setScores = (match.set_scores ?? null) as [number, number][] | null;
  const tiebreakScores = (match.tiebreak_scores ?? null) as ([number, number] | null)[] | null;
  const submittedByMe = match.submitted_by === userId;
  const isPendingEdit = match.status === 'pending_edit';

  const canEdit = submittedByMe && match.status === 'confirmed';
  const canSuggestEdit = !submittedByMe && match.status === 'confirmed' &&
    (match.player1_id === userId || match.player2_id === userId);

  const myPendingScore = match.pending_score_player1 as number | null;
  const theirPendingScore = match.pending_score_player2 as number | null;
  const pendingSetScores = (match.pending_set_scores ?? null) as [number, number][] | null;
  const pendingTiebreakScores = (match.pending_tiebreak_scores ?? null) as ([number, number] | null)[] | null;

  return (
    <div className="max-w-lg mx-auto">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4 mb-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Match result</h1>
          <BackButton />
          {(matchType === 'walkover' || matchType === 'retirement' || isPendingEdit || match.status === 'disputed' || match.status === 'overridden') && (
            <div className="flex items-center gap-2 mt-1">
              {matchType === 'walkover' && (
                <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">Walkover</span>
              )}
              {matchType === 'retirement' && (
                <span className="text-xs bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full">Retirement</span>
              )}
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
          )}
        </div>
        <Link href={`/leagues/${leagueId}`} className="text-sm text-green-700 hover:underline shrink-0 mt-1">
          {match.league_name as string}
        </Link>
      </div>

      {/* Result card */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Submitted result</p>
          <span className="text-xs text-gray-400">
            {new Date(match.played_at as string).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })}
          </span>
        </div>

        {matchType === 'walkover' ? (
          <div className="text-center py-2">
            <p className="text-sm font-semibold text-gray-800">
              {iWon ? myName : opponentName} won by walkover
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-1" />
              <span className="w-14 text-center text-xs text-gray-400 font-medium">Set 1</span>
              <span className="w-14 text-center text-xs text-gray-400 font-medium">Set 2</span>
              <span className="w-14 text-center text-xs text-gray-400 font-medium">Set 3</span>
            </div>

            <div className="flex items-center gap-3 mb-2">
              <Link href={`/players/${userId}`} className={`flex-1 text-sm font-medium truncate hover:underline ${iWon ? 'text-gray-800' : 'text-gray-400'}`}>
                {myName}
              </Link>
              {[0, 1, 2].map((i) => {
                const entry = setScores?.[i];
                const my = entry ? (isPlayer1 ? entry[0] : entry[1]) : null;
                const their = entry ? (isPlayer1 ? entry[1] : entry[0]) : null;
                const tb = tiebreakScores?.[i] ?? null;
                const myTb = tb ? (isPlayer1 ? tb[0] : tb[1]) : null;
                return (
                  <div key={i} className={`relative w-14 py-2 rounded-lg text-sm text-center font-medium ${
                    my !== null
                      ? my > (their ?? 0) ? 'bg-green-50 text-green-700' : 'bg-gray-50 text-gray-400'
                      : 'text-gray-200'
                  }`}>
                    {my !== null ? my : '-'}
                    {myTb !== null && (
                      <span className="absolute top-1 right-1.5 text-[10px] font-normal leading-none opacity-60">{myTb}</span>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex items-center gap-3">
              <Link href={`/players/${opponentPlayerId}`} className={`flex-1 text-sm font-medium truncate hover:underline ${!iWon ? 'text-gray-800' : 'text-gray-400'}`}>
                {opponentName}
              </Link>
              {[0, 1, 2].map((i) => {
                const entry = setScores?.[i];
                const my = entry ? (isPlayer1 ? entry[0] : entry[1]) : null;
                const their = entry ? (isPlayer1 ? entry[1] : entry[0]) : null;
                const tb = tiebreakScores?.[i] ?? null;
                const theirTb = tb ? (isPlayer1 ? tb[1] : tb[0]) : null;
                return (
                  <div key={i} className={`relative w-14 py-2 rounded-lg text-sm text-center font-medium ${
                    their !== null
                      ? (their ?? 0) > (my ?? 0) ? 'bg-green-50 text-green-700' : 'bg-gray-50 text-gray-400'
                      : 'text-gray-200'
                  }`}>
                    {their !== null ? their : '-'}
                    {theirTb !== null && (
                      <span className="absolute top-1 right-1.5 text-[10px] font-normal leading-none opacity-60">{theirTb}</span>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}

        {(canEdit || canSuggestEdit) && (
          <Link
            href={`/leagues/${leagueId}/matches/${matchId}/edit`}
            className="mt-6 w-full block text-center text-sm border border-gray-300 hover:border-red-400 hover:text-red-600 text-gray-600 font-medium py-2.5 rounded-lg transition-colors"
          >
            {canEdit ? 'Edit result' : 'Suggest edit'}
          </Link>
        )}
      </div>

      {/* Disputed */}
      {match.status === 'disputed' && (
        <div className="mt-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white rounded-xl border border-gray-200 p-4">
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

            {dispute && dispute.requested_score_player1 != null ? (() => {
              const reqSets = (dispute.requested_set_scores ?? null) as [number, number][] | null;
              const reqMyScore = isPlayer1 ? dispute.requested_score_player1 as number : dispute.requested_score_player2 as number;
              const reqTheirScore = isPlayer1 ? dispute.requested_score_player2 as number : dispute.requested_score_player1 as number;
              return (
                <div className="bg-red-50 rounded-xl border border-red-100 p-4">
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
              <div className="bg-red-50 rounded-xl border border-red-100 p-4 flex items-center justify-center">
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

      {/* Pending edit review (submitter) */}
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

      {/* Pending edit waiting (opponent) */}
      {isPendingEdit && !submittedByMe && (
        <div className="mt-4">
          <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-center">
            Your correction is awaiting {opponentName}&apos;s review.
          </p>
        </div>
      )}


    </div>
  );
}

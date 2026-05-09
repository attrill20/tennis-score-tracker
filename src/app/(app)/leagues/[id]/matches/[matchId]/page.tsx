import { auth } from '@/auth';
import sql from '@/lib/db';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import DisputeButton from '../../DisputeButton';

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

  const isPlayer1 = match.player1_id === userId;
  const myScore = isPlayer1 ? match.score_player1 as number : match.score_player2 as number;
  const theirScore = isPlayer1 ? match.score_player2 as number : match.score_player1 as number;
  const myName = isPlayer1 ? match.player1_name as string : match.player2_name as string;
  const opponentName = isPlayer1 ? match.player2_name as string : match.player1_name as string;
  const setScores = (match.set_scores ?? null) as [number, number][] | null;
  const submittedByMe = match.submitted_by === userId;
  const canEdit = submittedByMe && match.status === 'confirmed';
  const canDispute = !submittedByMe && match.status === 'confirmed';

  return (
    <div className="max-w-lg mx-auto">
      <div className="mb-4">
        <Link href={`/leagues/${leagueId}`} className="text-sm text-green-700 hover:underline">
          ← {match.league_name as string}
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6 sm:p-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-lg font-bold text-gray-800">Match result</h1>
          <div className="flex items-center gap-2">
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
            <p className={`text-sm font-medium mb-1 ${myScore > theirScore ? 'text-gray-800' : 'text-gray-400'}`}>
              {myName}
            </p>
            <p className={`text-5xl font-bold ${myScore > theirScore ? 'text-green-700' : 'text-gray-300'}`}>
              {myScore}
            </p>
          </div>
          <p className="text-2xl font-light text-gray-300">-</p>
          <div className="text-center flex-1">
            <p className={`text-sm font-medium mb-1 ${theirScore > myScore ? 'text-gray-800' : 'text-gray-400'}`}>
              {opponentName}
            </p>
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
              <span className={`w-[52px] text-xs truncate ${myScore > theirScore ? 'text-gray-700 font-medium' : 'text-gray-400'}`}>{myName.split(' ')[0]}</span>
              {setScores.map(([p1, p2], i) => {
                const my = isPlayer1 ? p1 : p2;
                const their = isPlayer1 ? p2 : p1;
                return (
                  <div key={i} className={`flex-1 text-center text-sm font-semibold py-1.5 rounded-lg ${my > their ? 'bg-green-50 text-green-700' : 'bg-gray-50 text-gray-400'}`}>
                    {my}
                  </div>
                );
              })}
            </div>
            <div className="flex items-center gap-2">
              <span className={`w-[52px] text-xs truncate ${theirScore > myScore ? 'text-gray-700 font-medium' : 'text-gray-400'}`}>{opponentName.split(' ')[0]}</span>
              {setScores.map(([p1, p2], i) => {
                const my = isPlayer1 ? p1 : p2;
                const their = isPlayer1 ? p2 : p1;
                return (
                  <div key={i} className={`flex-1 text-center text-sm font-semibold py-1.5 rounded-lg ${their > my ? 'bg-green-50 text-green-700' : 'bg-gray-50 text-gray-400'}`}>
                    {their}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <p className="text-xs text-gray-400 text-center mb-6">
          {new Date(match.played_at as string).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })}
        </p>

        {(canEdit || canDispute) && (
          <div className="flex justify-center gap-3 pt-4 border-t border-gray-100">
            {canEdit && (
              <Link
                href={`/leagues/${leagueId}/matches/${matchId}/edit`}
                className="text-sm bg-green-700 hover:bg-green-800 text-white font-medium px-5 py-2.5 rounded-lg transition-colors"
              >
                Edit result
              </Link>
            )}
            {canDispute && <DisputeButton matchId={matchId} />}
          </div>
        )}
      </div>
    </div>
  );
}

import { auth } from '@/auth';
import sql from '@/lib/db';
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import SuggestEditForm from './SuggestEditForm';

export default async function SuggestEditPage({
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

  // Only the non-submitter (opponent) can suggest edits
  if (match.submitted_by === userId) redirect(`/leagues/${leagueId}/matches/${matchId}/edit`);
  if (match.player1_id !== userId && match.player2_id !== userId) redirect(`/leagues/${leagueId}`);
  if (match.status !== 'confirmed') redirect(`/leagues/${leagueId}/matches/${matchId}`);

  // Non-submitter is always player2 (submitter = player1)
  const myName = match.player2_name as string;
  const submitterName = match.player1_name as string;
  const currentMyScore = match.score_player2 as number;
  const currentTheirScore = match.score_player1 as number;
  const setScores = (match.set_scores ?? null) as [number, number][] | null;
  // Flip set scores to my/their perspective (currently stored as [p1, p2] = [submitter, me])
  const mySetScores = setScores ? setScores.map(([p1, p2]) => [p2, p1] as [number, number]) : null;
  const playedAt = new Date(match.played_at as string).toISOString().split('T')[0];

  return (
    <div className="max-w-lg mx-auto">
      <div className="mb-4">
        <Link href={`/leagues/${leagueId}/matches/${matchId}`} className="text-sm text-green-700 hover:underline">
          - Back to match
        </Link>
      </div>

      <h1 className="text-2xl font-bold text-gray-800 mb-2">Suggest a correction</h1>
      <p className="text-sm text-gray-500 mb-6">
        Enter what you believe the correct score was. {submitterName} will be asked to accept or decline.
      </p>

      <SuggestEditForm
        matchId={matchId}
        leagueId={leagueId}
        myName={myName}
        submitterName={submitterName}
        currentMyScore={currentMyScore}
        currentTheirScore={currentTheirScore}
        setScores={mySetScores}
        playedAt={playedAt}
      />
    </div>
  );
}

import { auth } from '@/auth';
import sql from '@/lib/db';
import { notFound, redirect } from 'next/navigation';
import EditMatchForm from './EditMatchForm';

export default async function EditMatchPage({
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
      (p2.first_name || ' ' || p2.last_name) AS player2_name
    FROM matches m
    JOIN profiles p1 ON p1.id = m.player1_id
    JOIN profiles p2 ON p2.id = m.player2_id
    WHERE m.id = ${matchId} AND m.league_id = ${leagueId}
  `;

  const match = matches[0];
  if (!match) notFound();
  if (match.submitted_by !== userId) redirect(`/leagues/${leagueId}`);
  if (match.status !== 'confirmed') redirect(`/leagues/${leagueId}/matches/${matchId}`);

  const isPlayer1 = match.player1_id === userId;
  const opponentName = isPlayer1 ? (match.player2_name as string) : (match.player1_name as string);
  const opponentId = isPlayer1 ? (match.player2_id as string) : (match.player1_id as string);
  const currentMyScore = isPlayer1 ? match.score_player1 as number : match.score_player2 as number;
  const currentTheirScore = isPlayer1 ? match.score_player2 as number : match.score_player1 as number;

  // set_scores stored as [[p1,p2],...] where p1 = submitter = player1
  const setScores = (match.set_scores ?? null) as [number, number][] | null;

  return (
    <EditMatchForm
      matchId={matchId}
      leagueId={leagueId}
      userId={userId}
      userName={session!.user.name ?? 'You'}
      opponentId={opponentId}
      opponentName={opponentName}
      playedAt={new Date(match.played_at as string).toISOString().split('T')[0]}
      currentMyScore={currentMyScore}
      currentTheirScore={currentTheirScore}
      setScores={setScores}
    />
  );
}

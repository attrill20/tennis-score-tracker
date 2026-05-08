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
  if (match.status !== 'confirmed') redirect(`/leagues/${leagueId}`);

  const opponentName =
    match.player1_id === userId
      ? (match.player2_name as string)
      : (match.player1_name as string);

  return (
    <EditMatchForm
      matchId={matchId}
      leagueId={leagueId}
      userName={session!.user.name ?? 'You'}
      opponentName={opponentName}
      playedAt={match.played_at as string}
    />
  );
}

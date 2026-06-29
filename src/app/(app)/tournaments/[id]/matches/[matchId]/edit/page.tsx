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

  if (match.player1_id !== userId && match.player2_id !== userId) {
    redirect(`/leagues/${leagueId}`);
  }
  if (match.status !== 'confirmed') redirect(`/leagues/${leagueId}/matches/${matchId}`);

  const isSubmitter = match.submitted_by === userId;
  const isPlayer1 = match.player1_id === userId;
  const isDoubles = !!(match.player3_id);

  const p1First = match.player1_first as string;
  const p2First = match.player2_first as string;
  const p3First = match.player3_first as string | null;
  const p4First = match.player4_first as string | null;

  const myName = isDoubles
    ? isPlayer1
      ? `${p1First} / ${p3First}`
      : `${p2First} / ${p4First}`
    : isPlayer1 ? (match.player1_name as string) : (match.player2_name as string);

  const opponentName = isDoubles
    ? isPlayer1
      ? `${p2First} / ${p4First}`
      : `${p1First} / ${p3First}`
    : isPlayer1 ? (match.player2_name as string) : (match.player1_name as string);

  const opponentId = isPlayer1 ? (match.player2_id as string) : (match.player1_id as string);
  const currentMyScore = isPlayer1 ? match.score_player1 as number : match.score_player2 as number;
  const currentTheirScore = isPlayer1 ? match.score_player2 as number : match.score_player1 as number;

  const rawSetScores = (match.set_scores ?? null) as [number, number][] | null;
  const setScores = isPlayer1
    ? rawSetScores
    : rawSetScores?.map(([p1, p2]) => [p2, p1] as [number, number]) ?? null;

  const rawTiebreakScores = (match.tiebreak_scores ?? null) as ([number, number] | null)[] | null;
  const tiebreakScores = isPlayer1
    ? rawTiebreakScores
    : rawTiebreakScores?.map((tb) => tb ? [tb[1], tb[0]] as [number, number] : null) ?? null;

  return (
    <EditMatchForm
      matchId={matchId}
      leagueId={leagueId}
      leagueName={match.league_name as string}
      myId={userId}
      myName={myName}
      opponentId={opponentId}
      opponentName={opponentName}
      playedAt={new Date(match.played_at as string).toISOString().split('T')[0]}
      currentMyScore={currentMyScore}
      currentTheirScore={currentTheirScore}
      setScores={setScores}
      tiebreakScores={tiebreakScores}
      existingMatchType={match.match_type as string | null}
      existingWinnerId={match.winner_id as string | null}
      isSubmitter={isSubmitter}
    />
  );
}

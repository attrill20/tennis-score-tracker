import { redirect } from 'next/navigation';

export default async function SuggestEditPage({
  params,
}: {
  params: Promise<{ id: string; matchId: string }>;
}) {
  const { id: leagueId, matchId } = await params;
  redirect(`/leagues/${leagueId}/matches/${matchId}/edit`);
}

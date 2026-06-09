import { auth } from '@/auth';
import sql from '@/lib/db';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { calculateStandings } from '@/lib/league';
import PromotionForm from './PromotionForm';
import EditLeagueForm from './EditLeagueForm';
import DeleteLeagueButton from './DeleteLeagueButton';
import AdminMatchesSection from './AdminMatchesSection';

export default async function AdminLeagueDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (session?.user?.role !== 'admin' && session?.user?.role !== 'super_admin') {
    redirect('/dashboard');
  }

  const leagues = await sql`SELECT * FROM leagues WHERE id = ${id}`;
  const league = leagues[0];
  if (!league) notFound();

  const players = await sql`
    SELECT p.id, (p.first_name || ' ' || p.last_name) AS full_name, lp.final_position
    FROM profiles p
    JOIN league_players lp ON lp.player_id = p.id
    WHERE lp.league_id = ${id}
    ORDER BY p.last_name, p.first_name
  `;

  const matches = await sql`
    SELECT
      m.id, m.player1_id, m.player2_id, m.score_player1, m.score_player2,
      m.set_scores, m.tiebreak_scores, m.played_at, m.match_type, m.winner_id, m.status,
      (p1.first_name || ' ' || p1.last_name) AS player1_name,
      (p2.first_name || ' ' || p2.last_name) AS player2_name
    FROM matches m
    JOIN profiles p1 ON p1.id = m.player1_id
    JOIN profiles p2 ON p2.id = m.player2_id
    WHERE m.league_id = ${id}
    ORDER BY m.played_at DESC, m.submitted_at DESC
  `;

  const standings = calculateStandings(
    players as { id: string; full_name: string }[],
    matches as { player1_id: string; player2_id: string; score_player1: number; score_player2: number; status: string }[],
    (league.tiebreaker as string ?? 'head_to_head') as import('@/lib/league').Tiebreaker
  );

  return (
    <div className="space-y-8 max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-gray-800 mb-1">{league.name as string}</h1>
        <p className="text-sm text-gray-400 mb-2">Admin - League management</p>
        <Link href="/admin/leagues" className="text-sm text-green-700 hover:underline">
          ← Back to leagues
        </Link>
      </div>

      <EditLeagueForm
        leagueId={id}
        currentName={league.name as string}
        currentDescription={(league.description as string) ?? ''}
        currentStatus={league.status as string}
        currentSeasonStart={new Date(league.season_start as string).toISOString().split('T')[0]}
        currentSeasonEnd={new Date(league.season_end as string).toISOString().split('T')[0]}
        currentIsPublic={league.is_public as boolean ?? true}
        currentTiebreaker={(league.tiebreaker as string) ?? 'head_to_head'}
      />

      <AdminMatchesSection
        leagueId={id}
        players={players as { id: string; full_name: string }[]}
        matches={matches as never}
        leagueType={(league.league_type as string) ?? 'singles'}
      />

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-base font-semibold text-gray-700 mb-1">Promotion & relegation</h2>
        <p className="text-xs text-gray-400 mb-4">Auto-calculated from standings. Adjust before confirming.</p>
        <PromotionForm leagueId={id} standings={standings} />
      </div>

      {session?.user?.role === 'super_admin' && (
        <div className="bg-white rounded-xl border border-red-200 p-6">
          <h2 className="text-base font-semibold text-red-600 mb-4">Danger zone</h2>
          <DeleteLeagueButton leagueId={id} leagueName={league.name as string} />
        </div>
      )}
    </div>
  );
}

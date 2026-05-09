import { auth } from '@/auth';
import sql from '@/lib/db';
import { redirect, notFound } from 'next/navigation';
import { calculateStandings } from '@/lib/league';
import PromotionForm from './PromotionForm';
import LeagueStatusForm from './LeagueStatusForm';
import LeagueDatesForm from './LeagueDatesForm';
import LeagueNameForm from './LeagueNameForm';
import DeleteLeagueButton from './DeleteLeagueButton';

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
    SELECT player1_id, player2_id, score_player1, score_player2, status
    FROM matches WHERE league_id = ${id}
  `;

  const standings = calculateStandings(
    players as { id: string; full_name: string }[],
    matches as { player1_id: string; player2_id: string; score_player1: number; score_player2: number; status: string }[]
  );

  return (
    <div className="space-y-8 max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-gray-800 mb-1">{league.name as string}</h1>
        <p className="text-sm text-gray-400">Admin - League management</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-base font-semibold text-gray-700 mb-4">League name</h2>
        <LeagueNameForm leagueId={id} currentName={league.name as string} />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-base font-semibold text-gray-700 mb-4">League status</h2>
        <LeagueStatusForm leagueId={id} currentStatus={league.status as string} />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-base font-semibold text-gray-700 mb-4">Season dates</h2>
        <LeagueDatesForm
          leagueId={id}
          seasonStart={new Date(league.season_start as string).toISOString().split('T')[0]}
          seasonEnd={new Date(league.season_end as string).toISOString().split('T')[0]}
        />
      </div>

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

import { auth } from '@/auth';
import sql from '@/lib/db';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { calculateStandings } from '@/lib/league';
import PromotionForm from './PromotionForm';
import EditLeagueForm from './EditLeagueForm';
import DeleteLeagueButton from './DeleteLeagueButton';
import AdminMatchesSection from './AdminMatchesSection';
import AssignPlayersPanel from '@/components/AssignPlayersPanel';
import RegistrationsPanel from '@/components/RegistrationsPanel';
import PlaceholderMatchNotice from '@/components/PlaceholderMatchNotice';
import { getPlaceholderNameMatchesForTournament } from '@/lib/placeholders';

export default async function AdminLeagueDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (session?.user?.role !== 'admin' && session?.user?.role !== 'super_admin') {
    redirect('/dashboard');
  }

  const leagues = await sql`SELECT * FROM leagues WHERE id = ${id}`;
  const league = leagues[0];
  if (!league) notFound();

  const [players, matches, members] = await Promise.all([
    sql`
      SELECT p.id, (p.first_name || ' ' || p.last_name) AS full_name, lp.final_position
      FROM profiles p
      JOIN league_players lp ON lp.player_id = p.id
      WHERE lp.league_id = ${id}
      ORDER BY p.last_name, p.first_name
    `,
    sql`
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
    `,
    sql`
      SELECT id, (first_name || ' ' || last_name) AS full_name, is_placeholder, placeholder_alias, placeholder_anonymized,
        role = 'unverified' AS is_unverified
      FROM profiles
      WHERE deleted_at IS NULL
        AND email != 'qptcscoreadmin@gmail.com'
      ORDER BY first_name, last_name
    `,
  ]);

  const standings = calculateStandings(
    players as { id: string; full_name: string }[],
    matches as { player1_id: string; player2_id: string; score_player1: number; score_player2: number; status: string }[],
    (league.tiebreaker as string ?? 'head_to_head') as import('@/lib/league').Tiebreaker,
    (league.points_config as import('@/lib/league').PointsConfig | null) ?? undefined
  );

  const leagueType = (league.league_type as string) ?? 'singles';

  const [tournamentRow] = league.tournament_id
    ? await sql`SELECT format, has_registration_form, registration_questions FROM tournaments WHERE id = ${league.tournament_id}`
    : [];
  const hasRegistrationForm = (tournamentRow?.has_registration_form as boolean) ?? false;
  const registrationQuestions = (tournamentRow?.registration_questions as import('@/lib/registration').RegistrationQuestion[] | null) ?? [];
  const isMultiFormat = tournamentRow?.format === 'multi';

  const placeholderMatches = league.tournament_id
    ? await getPlaceholderNameMatchesForTournament(league.tournament_id as string)
    : [];

  const pendingRegistrations = hasRegistrationForm
    ? (await sql`
        SELECT r.id, r.player_id, (p.first_name || ' ' || p.last_name) AS full_name, p.phone, p.email,
          r.ability_level, r.answers
        FROM tournament_registrations r
        JOIN profiles p ON p.id = r.player_id
        WHERE r.tournament_id = ${league.tournament_id} AND r.assigned_league_id IS NULL
        ORDER BY r.created_at ASC
      `).map((r) => ({
        id: r.id as string,
        player_id: r.player_id as string,
        full_name: r.full_name as string,
        phone: r.phone as string | null,
        email: r.email as string,
        ability_level: r.ability_level as string,
        answers: (r.answers as Record<string, string> | null) ?? {},
        suggested_division: 1,
      }))
    : [];

  return (
    <div className="space-y-8 max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-gray-800 mb-1">{league.name as string}</h1>
        <p className="text-sm text-gray-400 mb-2">Admin - Tournament management</p>
        <Link href="/admin/tournaments" className="text-sm text-green-700 hover:underline">
          ← Back to leagues
        </Link>
      </div>

      {placeholderMatches.map((pm) => (
        <PlaceholderMatchNotice
          key={pm.placeholderId}
          placeholderId={pm.placeholderId}
          placeholderFullName={pm.placeholderFullName}
          placeholderAlias={pm.placeholderAlias}
          placeholderAnonymized={pm.placeholderAnonymized}
          memberId={pm.memberId}
          memberFullName={pm.memberFullName}
          memberEmailVerified={pm.memberEmailVerified}
        />
      ))}

      <EditLeagueForm
        leagueId={id}
        currentName={league.name as string}
        currentDescription={(league.description as string) ?? ''}
        currentStatus={league.status as string}
        currentSeasonStart={new Date(league.season_start as string).toISOString().split('T')[0]}
        currentSeasonEnd={new Date(league.season_end as string).toISOString().split('T')[0]}
        currentIsPublic={(league.is_public as boolean) ?? true}
        currentTiebreaker={(league.tiebreaker as string) ?? 'head_to_head'}
        currentColor={(league.color as string) ?? null}
        currentScoringMethod={(league.scoring_method as string) ?? 'best_of_3_tiebreak'}
        currentPointsConfig={(league.points_config as import('@/lib/league').PointsConfig | null) ?? null}
        currentGenderCategory={(league.gender_category as import('@/lib/genderCategory').GenderCategory) ?? 'either'}
        currentMaxPlayers={Number(league.max_players ?? 8)}
        currentNumPromoted={Number(league.num_promoted ?? 0)}
        currentNumRelegated={Number(league.num_relegated ?? 0)}
        currentJoinType={(league.join_type as string) ?? 'invite_only'}
        leagueType={leagueType}
        isMultiFormat={isMultiFormat}
        manageTournamentHref={isMultiFormat ? `/admin/tournaments/multi/${league.tournament_id as string}` : undefined}
      />

      {hasRegistrationForm && (
        <RegistrationsPanel
          registrations={pendingRegistrations}
          registrationCount={pendingRegistrations.length}
          maxRegistrations={null}
          divisions={[{ id, name: league.name as string, order: 1 }]}
          questions={registrationQuestions}
        />
      )}

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-base font-semibold text-gray-700 mb-4">
          {leagueType === 'doubles' ? 'Assign pairs' : 'Assign players'}
        </h2>
        <AssignPlayersPanel
          leagueId={id}
          leagueType={leagueType}
          members={members as {
            id: string;
            full_name: string;
            is_placeholder: boolean;
            placeholder_alias: string | null;
            placeholder_anonymized: boolean;
            is_unverified: boolean;
          }[]}
          maxPlayers={Number(league.max_players ?? 8)}
        />
      </div>

      <AdminMatchesSection
        leagueId={id}
        players={players as { id: string; full_name: string }[]}
        matches={matches as never}
        leagueType={leagueType}
      />

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-base font-semibold text-gray-700 mb-1">Promotion & relegation</h2>
        <p className="text-xs text-gray-400 mb-4">Auto-calculated from standings. Adjust before confirming</p>
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

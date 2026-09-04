import { auth } from '@/auth';
import sql from '@/lib/db';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import TournamentSettingsForm from './TournamentSettingsForm';
import DeleteTournamentButton from './DeleteTournamentButton';
import RegistrationsPanel from '@/components/RegistrationsPanel';
import AssignDivisionsPanel from '@/components/AssignDivisionsPanel';
import CollapsibleSection from '@/components/CollapsibleSection';
import TournamentAdminsPanel from '@/components/TournamentAdminsPanel';
import PlaceholderMatchNotice from '@/components/PlaceholderMatchNotice';
import { getPlaceholderNameMatchesForTournament } from '@/lib/placeholders';
import { computeSuggestedDivisions, type RegistrationQuestion } from '@/lib/registration';
import { type PointsConfig } from '@/lib/league';

type Tournament = {
  id: string;
  name: string;
  format: string;
  status: string;
  num_divisions: number;
  num_promoted: number;
  num_relegated: number;
  num_rounds: number;
  final_end: string | null;
  description: string | null;
  round_dates_text: string[] | null;
  final_end_text: string | null;
  has_registration_form: boolean;
  max_registrations: number | null;
  registration_questions: RegistrationQuestion[] | null;
  scoring_method: string;
  points_config: PointsConfig | null;
  zero_matches_policy: 'relegate' | 'double_relegate' | 'remove';
  created_by: string | null;
};

type Division = {
  id: string;
  name: string;
  status: string;
  division_order: number;
  round_number: number;
  player_count: string;
  draft_count: string;
};

export default async function AdminMultiTournamentPage({ params }: { params: Promise<{ tid: string }> }) {
  const { tid } = await params;
  const session = await auth();
  if (session?.user?.role !== 'admin' && session?.user?.role !== 'super_admin') {
    redirect('/dashboard');
  }

  const tRows = await sql`
    SELECT *, round_dates::text[] AS round_dates_text, final_end::text AS final_end_text
    FROM tournaments WHERE id = ${tid}
  `;
  if (tRows.length === 0) notFound();
  const tournament = tRows[0] as unknown as Tournament;

  const [{ current_round }] = await sql`
    SELECT COALESCE(MAX(round_number), 1) AS current_round FROM leagues WHERE tournament_id = ${tid}
  `;

  const divisions = (await sql`
    SELECT
      l.id, l.name, l.status, l.division_order, l.round_number,
      (SELECT COUNT(*) FROM league_players WHERE league_id = l.id) AS player_count,
      (SELECT COUNT(*) FROM league_player_drafts WHERE league_id = l.id) AS draft_count
    FROM leagues l
    WHERE l.tournament_id = ${tid} AND l.round_number = ${current_round}
    ORDER BY l.division_order ASC
  `) as unknown as Division[];
  const isCurrentRoundUpcoming = divisions.length > 0 && divisions[0].status === 'upcoming';

  const adminOptions = await sql`
    SELECT id, (first_name || ' ' || last_name) AS full_name, avatar_url
    FROM profiles
    WHERE role IN ('admin', 'super_admin') AND deleted_at IS NULL
    ORDER BY first_name, last_name
  `;

  const placeholderMatches = await getPlaceholderNameMatchesForTournament(tournament.id);

  let registrationCount = 0;
  let pendingRegistrations: {
    id: string; player_id: string; full_name: string; phone: string | null; email: string;
    ability_level: string; answers: Record<string, string>; suggested_division: number | null;
  }[] = [];
  const registrationQuestions = tournament.registration_questions ?? [];

  if (tournament.has_registration_form) {
    const [{ count }] = await sql`SELECT COUNT(*) FROM tournament_registrations WHERE tournament_id = ${tid}`;
    registrationCount = Number(count);

    const rows = await sql`
      SELECT r.id, r.player_id, (p.first_name || ' ' || p.last_name) AS full_name, p.phone, p.email,
        r.ability_level, r.answers
      FROM tournament_registrations r
      JOIN profiles p ON p.id = r.player_id
      WHERE r.tournament_id = ${tid} AND r.assigned_league_id IS NULL
      ORDER BY r.created_at ASC
    `;

    const suggestions = computeSuggestedDivisions(
      rows.map((r) => ({
        id: r.id as string,
        ability_level: r.ability_level as import('@/lib/registration').AbilityLevel,
        previous_division: (r.answers as Record<string, string> | null)?.previous_division ?? null,
      })),
      tournament.num_divisions
    );

    pendingRegistrations = rows.map((r) => ({
      id: r.id as string,
      player_id: r.player_id as string,
      full_name: r.full_name as string,
      phone: r.phone as string | null,
      email: r.email as string,
      ability_level: r.ability_level as string,
      answers: (r.answers as Record<string, string> | null) ?? {},
      suggested_division: suggestions.get(r.id as string) ?? null,
    }));
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/tournaments" className="text-sm text-green-700 hover:underline">&larr; All tournaments</Link>
        <h1 className="text-2xl font-bold text-gray-800 mt-2">{tournament.name}</h1>
        <Link href={`/tournaments/multi/${tournament.id}`} className="inline-block mt-2 text-xs text-green-700 hover:underline">
          View public page
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

      <TournamentSettingsForm
        tid={tournament.id}
        initialName={tournament.name}
        initialDescription={tournament.description ?? ''}
        initialRoundDates={tournament.round_dates_text ?? []}
        initialFinalEnd={tournament.final_end_text ?? ''}
        initialPromoted={tournament.num_promoted}
        initialRelegated={tournament.num_relegated}
        hasRegistrationForm={tournament.has_registration_form}
        initialMaxRegistrations={tournament.max_registrations}
        initialScoringMethod={tournament.scoring_method}
        initialPointsConfig={tournament.points_config}
        initialNumDivisions={divisions.length || tournament.num_divisions}
        initialZeroMatchesPolicy={tournament.zero_matches_policy}
        isCurrentRoundUpcoming={isCurrentRoundUpcoming}
      />

      <CollapsibleSection
        title={`Round ${String(current_round)} divisions`}
        meta={<span className="text-xs text-gray-400">{divisions.length} divisions</span>}
      >
        <div className="-m-4 divide-y divide-gray-100">
          {divisions.map((d) => (
            <div key={d.id} className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-800">{d.name}</span>
                <span className="text-xs text-gray-400">
                  {d.status === 'upcoming'
                    ? `${Number(d.draft_count)} drafted`
                    : `${Number(d.player_count)} players`}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <Link href={`/tournaments/${d.id}`} className="text-xs text-green-700 hover:underline">View</Link>
                <Link href={`/admin/tournaments/${d.id}`} className="text-xs text-blue-600 hover:underline">Manage division</Link>
              </div>
            </div>
          ))}
        </div>
      </CollapsibleSection>

      {isCurrentRoundUpcoming && (
        <AssignDivisionsPanel tournamentId={tournament.id} tournamentName={tournament.name} />
      )}

      <CollapsibleSection title="Additional admins">
        <TournamentAdminsPanel
          tournamentId={tournament.id}
          adminOptions={adminOptions as { id: string; full_name: string; avatar_url: string | null }[]}
          creatorId={tournament.created_by}
        />
      </CollapsibleSection>

      {tournament.has_registration_form && (
        <RegistrationsPanel
          registrations={pendingRegistrations}
          registrationCount={registrationCount}
          maxRegistrations={tournament.max_registrations}
          divisions={divisions.map((d) => ({ id: d.id, name: d.name, order: d.division_order }))}
          questions={registrationQuestions}
        />
      )}

      <CollapsibleSection title="Danger zone" titleClassName="text-red-700" borderClassName="border-red-200">
        <p className="text-sm text-gray-400 mb-3">
          Deleting the tournament removes every division and round along with all of their matches, players and disputes. This cannot be undone.
        </p>
        <DeleteTournamentButton tid={tournament.id} tournamentName={tournament.name} />
      </CollapsibleSection>
    </div>
  );
}

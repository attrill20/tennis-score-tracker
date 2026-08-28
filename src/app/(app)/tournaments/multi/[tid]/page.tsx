import { auth } from '@/auth';
import sql from '@/lib/db';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { leagueBorderColor } from '@/lib/leagueColor';
import { SCORING_METHOD_LABELS, DEFAULT_POINTS_CONFIG, presetForConfig, type PointsConfig } from '@/lib/league';
import RegisterButton from '@/components/RegisterButton';
import CollapsibleSection from '@/components/CollapsibleSection';

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
  is_public: boolean;
  color: string | null;
  description: string | null;
  has_registration_form: boolean;
  max_registrations: number | null;
};

type Division = {
  id: string;
  name: string;
  status: string;
  division_order: number;
  round_number: number;
  season_start: string;
  season_end: string;
  color: string | null;
  max_players: number;
  scoring_method: string;
  points_config: PointsConfig | null;
  player_count: string;
  matches_played: string;
};

function fmt(d: string | null) {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function pointsTypeName(config: PointsConfig | null): string {
  const preset = presetForConfig(config);
  return preset === 'classic' ? 'Classic' : preset === 'split' ? 'Split' : 'Custom';
}

function pointsBreakdown(config: PointsConfig | null): { label: string; value: number }[] {
  const c = config ?? DEFAULT_POINTS_CONFIG;
  const simple = presetForConfig(config) === 'classic';
  const rows = simple
    ? [
        { label: 'Win', value: c.winStraightSets },
        { label: 'Draw', value: c.draw },
        { label: 'Loss', value: c.loseStraightSets },
      ]
    : [
        { label: 'Straight-sets win', value: c.winStraightSets },
        { label: 'Straight-sets loss', value: c.loseStraightSets },
        { label: 'Deciding-set win', value: c.winDecider },
        { label: 'Deciding-set loss', value: c.loseDecider },
        { label: 'Unfinished', value: c.draw },
      ];
  return rows.sort((a, b) => b.value - a.value);
}

export default async function MultiTournamentPage({ params }: { params: Promise<{ tid: string }> }) {
  const { tid } = await params;
  const session = await auth();
  const userId = session!.user.id;
  const isAdmin = session?.user?.role === 'admin' || session?.user?.role === 'super_admin';
  const today = new Date().toISOString().split('T')[0];

  const tRows = await sql`SELECT * FROM tournaments WHERE id = ${tid}`;
  if (tRows.length === 0) notFound();
  const tournament = tRows[0] as unknown as Tournament;

  // A single-division tournament has no overview - send the user straight to its division.
  if (tournament.format !== 'multi') {
    const [div] = await sql`SELECT id FROM leagues WHERE tournament_id = ${tid} ORDER BY round_number DESC, division_order ASC LIMIT 1`;
    if (div) redirect(`/tournaments/${div.id}`);
    notFound();
  }

  // Current round = the highest round number that has divisions.
  const [{ current_round }] = await sql`
    SELECT COALESCE(MAX(round_number), 1) AS current_round FROM leagues WHERE tournament_id = ${tid}
  `;

  const divisions = (await sql`
    SELECT
      l.id, l.name, l.status, l.division_order, l.round_number, l.season_start, l.season_end, l.color, l.max_players, l.scoring_method, l.points_config,
      (SELECT COUNT(*) FROM league_players WHERE league_id = l.id) AS player_count,
      (SELECT COUNT(*) FROM matches m WHERE m.league_id = l.id) AS matches_played
    FROM leagues l
    WHERE l.tournament_id = ${tid} AND l.round_number = ${current_round}
    ORDER BY l.division_order ASC
  `) as unknown as Division[];

  let canView = tournament.is_public || isAdmin;
  if (!canView) {
    const membership = await sql`
      SELECT 1 FROM league_players lp
      JOIN leagues l ON l.id = lp.league_id
      WHERE l.tournament_id = ${tid} AND lp.player_id = ${userId}
      LIMIT 1
    `;
    canView = membership.length > 0;
  }

  if (!canView) redirect('/tournaments');

  // Divisions (in the current round) the viewer plays in - so we can offer a submit-result shortcut.
  const myDivisionIds = new Set(
    (await sql`
      SELECT lp.league_id FROM league_players lp
      JOIN leagues l ON l.id = lp.league_id
      WHERE l.tournament_id = ${tid} AND l.round_number = ${current_round} AND lp.player_id = ${userId}
    `).map((r) => r.league_id as string)
  );
  const tournamentActive = tournament.status === 'active';

  const isMemberRows = await sql`
    SELECT 1 FROM league_players lp JOIN leagues l ON l.id = lp.league_id
    WHERE l.tournament_id = ${tid} AND lp.player_id = ${userId} LIMIT 1
  `;
  const isMember = isMemberRows.length > 0;

  let isRegistered = false;
  let registrationCount = 0;
  if (tournament.has_registration_form) {
    const rows = await sql`SELECT 1 FROM tournament_registrations WHERE tournament_id = ${tid} AND player_id = ${userId}`;
    isRegistered = rows.length > 0;
    const [{ count }] = await sql`SELECT COUNT(*) FROM tournament_registrations WHERE tournament_id = ${tid}`;
    registrationCount = Number(count);
  }

  // Per-round start/end dates, computed in SQL (as text) to avoid timezone shifts.
  // A round runs from its start date until the day before the next round starts (or the final date).
  const roundSchedule = (await sql`
    SELECT
      r AS round,
      (t.round_dates[r])::text AS start_date,
      CASE WHEN t.round_dates[r + 1] IS NOT NULL
           THEN (t.round_dates[r + 1] - 1)::text
           ELSE t.final_end::text END AS end_date
    FROM tournaments t, generate_series(1, t.num_rounds) AS r
    WHERE t.id = ${tid}
    ORDER BY r
  `) as unknown as { round: number; start_date: string | null; end_date: string | null }[];

  return (
    <div className="space-y-6">
      <div>
        <Link href="/tournaments" className="text-sm text-green-700 hover:underline">&larr; All tournaments</Link>
        <div className="flex items-start justify-between gap-3 mt-2">
          <h1 className="text-2xl font-bold text-gray-800">{tournament.name}</h1>
          <div className="flex flex-col items-end gap-2 sm:flex-row sm:items-center shrink-0">
            <span className={`hidden sm:inline-flex text-xs px-2 py-1 rounded-full font-medium ${
              tournament.status === 'active' ? 'bg-green-100 text-green-700'
              : tournament.status === 'upcoming' ? 'bg-blue-100 text-blue-700'
              : 'bg-slate-100 text-slate-600'
            }`}>
              {tournament.status.charAt(0).toUpperCase() + tournament.status.slice(1)}
            </span>
            {tournament.has_registration_form && !isMember && tournament.status === 'upcoming' && (
              <RegisterButton tournamentId={tournament.id} isRegistered={isRegistered} />
            )}
            {isAdmin && (
              <Link
                href={`/admin/tournaments/multi/${tournament.id}`}
                className="text-xs bg-blue-50 text-blue-700 hover:bg-blue-100 font-medium px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap"
              >
                Manage
              </Link>
            )}
          </div>
        </div>
        {tournament.description && <p className="text-sm text-gray-500 mt-2">{tournament.description}</p>}
      </div>

      <CollapsibleSection
        title="Tournament Details"
        meta={<span className="text-xs text-gray-400">{fmt(roundSchedule[0]?.start_date ?? null)} - {fmt(roundSchedule[roundSchedule.length - 1]?.end_date ?? tournament.final_end)}</span>}
      >
        <div className="text-sm text-gray-400 space-y-1">
          <p><span className="font-semibold text-gray-500">Round:</span> {String(current_round)} of {tournament.num_rounds}</p>
          <p><span className="font-semibold text-gray-500">Format:</span> Multi-league, {tournament.num_divisions} divisions</p>
          <p><span className="font-semibold text-gray-500">Promotion/Relegation:</span> {tournament.num_promoted} promoted / {tournament.num_relegated} relegated<span className="hidden sm:inline"> each round</span></p>
          <p><span className="font-semibold text-gray-500">Scoring System:</span> {SCORING_METHOD_LABELS[divisions[0]?.scoring_method] ?? divisions[0]?.scoring_method}</p>
          <div className="sm:flex sm:items-center sm:gap-2">
            <p><span className="font-semibold text-gray-500">Points:</span> {pointsTypeName(divisions[0]?.points_config ?? null)} -</p>
            <div className="flex flex-wrap gap-1.5 mt-1 sm:mt-0">
              {pointsBreakdown(divisions[0]?.points_config ?? null).map((p) => (
                <span key={p.label} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium">
                  {p.label}: {p.value}
                </span>
              ))}
            </div>
          </div>
          {tournament.status === 'upcoming'
            ? tournament.has_registration_form && (
                <p><span className="font-semibold text-gray-500">Registered:</span> {registrationCount}{tournament.max_registrations !== null ? ` / ${tournament.max_registrations}` : ''}</p>
              )
            : <p><span className="font-semibold text-gray-500">Players:</span> {divisions.reduce((sum, d) => sum + Number(d.player_count), 0)}</p>
          }
        </div>
      </CollapsibleSection>

      <div>
        <h2 className="text-sm font-semibold text-green-500 uppercase tracking-wide mb-3">
          Round {String(current_round)} divisions
        </h2>
        <div className="space-y-3">
          {divisions.map((d) => {
            const playerCount = Number(d.player_count);
            const totalPossible = Math.floor(playerCount * (playerCount - 1) / 2);
            return (
              <div key={d.id} className={`relative bg-white rounded-xl border border-gray-200 border-l-4 ${leagueBorderColor(d.id, d.color)} p-4 hover:border-green-400 transition-colors`}>
                <Link href={`/tournaments/${d.id}`} className="absolute inset-0 rounded-xl z-10" aria-label={d.name} />
                <div className="relative flex items-start justify-between gap-3">
                  <div>
                    <span className="block font-medium text-gray-800">{d.name}</span>
                    <span className="block text-xs text-gray-400 mt-0.5">Players: {playerCount}/{d.max_players}</span>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    {myDivisionIds.has(d.id) && tournamentActive && (
                      <Link
                        href={`/tournaments/${d.id}/submit`}
                        className="relative z-20 text-xs bg-green-700 hover:bg-green-800 text-white font-medium px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap"
                      >
                        Submit a result
                      </Link>
                    )}
                    <span className="text-xs text-gray-400">
                      Games Played: {String(d.matches_played)}/{totalPossible}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-green-500 uppercase tracking-wide mb-3">Round schedule</h2>
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
          {roundSchedule.map(({ round: r, start_date, end_date }) => {
            // A round only counts as started/completed once its own start date has actually arrived -
            // not just because it's the highest round with divisions generated for it.
            const hasStarted = !!start_date && start_date <= today;
            const hasEnded = !!end_date && end_date < today;
            const roundLabel = hasEnded ? 'Completed' : hasStarted ? 'Current' : 'Upcoming';
            return (
              <div key={r} className="flex items-center justify-between px-4 py-3">
                <div>
                  <span className="text-sm text-gray-700">Round {r}</span>
                  <span className="block text-xs text-gray-400 mt-0.5">{fmt(start_date)} - {fmt(end_date)}</span>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  hasEnded ? 'bg-slate-100 text-slate-500'
                  : hasStarted ? 'bg-green-100 text-green-700'
                  : 'bg-blue-50 text-blue-600'
                }`}>
                  {roundLabel}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

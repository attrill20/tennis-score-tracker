import { auth } from '@/auth';
import sql from '@/lib/db';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { leagueBorderColor, leagueFullBorderColor } from '@/lib/leagueColor';
import { SCORING_METHOD_LABELS, DEFAULT_POINTS_CONFIG, presetForConfig, calculateStandings, type PointsConfig } from '@/lib/league';
import RegisterButton from '@/components/RegisterButton';
import CollapsibleSection from '@/components/CollapsibleSection';
import LeagueAdminsLine from '@/components/LeagueAdminsLine';
import { formatDateOrRange } from '@/lib/format';

type Tournament = {
  id: string;
  name: string;
  format: string;
  status: string;
  num_divisions: number;
  num_promoted: number;
  num_relegated: number;
  num_rounds: number;
  final_end_text: string | null;
  is_public: boolean;
  color: string | null;
  description: string | null;
  has_registration_form: boolean;
  max_registrations: number | null;
  zero_matches_policy: 'relegate' | 'double_relegate' | 'remove';
  created_by: string | null;
};

const ZERO_MATCHES_POLICY_LABELS: Record<Tournament['zero_matches_policy'], string> = {
  relegate: 'Relegated as normal',
  double_relegate: 'Double relegation',
  remove: 'Removed from the tournament',
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
  league_type: string;
  scoring_method: string;
  points_config: PointsConfig | null;
  player_count: string;
  matches_played: string;
};

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
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

  const tRows = await sql`SELECT *, final_end::text AS final_end_text FROM tournaments WHERE id = ${tid}`;
  if (tRows.length === 0) notFound();
  const tournament = tRows[0] as unknown as Tournament;

  const adminRows = tournament.created_by
    ? await sql`
        SELECT id, first_name, last_name, title, avatar_url, 0 AS sort_order, NULL::timestamptz AS added_at
        FROM profiles WHERE id = ${tournament.created_by}
        UNION ALL
        SELECT p.id, p.first_name, p.last_name, p.title, p.avatar_url, 1 AS sort_order, ta.added_at
        FROM tournament_admins ta
        JOIN profiles p ON p.id = ta.admin_id AND p.role IN ('admin', 'super_admin')
        WHERE ta.tournament_id = ${tid} AND ta.admin_id != ${tournament.created_by}
        ORDER BY sort_order, added_at
      `
    : [];
  const admins = adminRows.map((a) => ({
    id: a.id as string,
    name: [a.title, a.first_name, a.last_name].filter(Boolean).join(' '),
    avatarUrl: (a.avatar_url as string | null) ?? null,
  }));

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
      l.id, l.name, l.status, l.division_order, l.round_number, l.season_start, l.season_end, l.color, l.max_players, l.league_type, l.scoring_method, l.points_config,
      (SELECT COUNT(*) FROM league_players WHERE league_id = l.id) AS player_count,
      (SELECT COUNT(*) FROM matches m WHERE m.league_id = l.id) AS matches_played
    FROM leagues l
    WHERE l.tournament_id = ${tid} AND l.round_number = ${current_round}
    ORDER BY l.division_order ASC
  `) as unknown as Division[];

  // Draft assignments are never shown to members before the round goes active - admins get an
  // early look here so they can sanity-check who's currently assigned to each division.
  const showDraftRosters = isAdmin && divisions.length > 0 && divisions[0].status === 'upcoming';
  const draftRosterRows = showDraftRosters
    ? await sql`
        SELECT lpd.league_id,
               CASE WHEN p.is_placeholder AND p.placeholder_anonymized THEN p.placeholder_alias ELSE (p.first_name || ' ' || p.last_name) END AS full_name
        FROM league_player_drafts lpd
        JOIN profiles p ON p.id = lpd.player_id
        JOIN leagues l ON l.id = lpd.league_id
        WHERE l.tournament_id = ${tid} AND l.round_number = ${current_round}
        ORDER BY full_name
      `
    : [];
  const draftRosterByDivision = new Map<string, string[]>();
  for (const row of draftRosterRows) {
    const key = row.league_id as string;
    const names = draftRosterByDivision.get(key) ?? [];
    names.push(row.full_name as string);
    draftRosterByDivision.set(key, names);
  }

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
  const myDivisionRows = await sql`
    SELECT lp.league_id FROM league_players lp
    JOIN leagues l ON l.id = lp.league_id
    WHERE l.tournament_id = ${tid} AND l.round_number = ${current_round} AND lp.player_id = ${userId}
  `;
  const myDivisionIds = new Set(myDivisionRows.map((r) => r.league_id as string));
  const tournamentActive = tournament.status === 'active';
  const myDivision = divisions.find((d) => myDivisionIds.has(d.id)) ?? null;

  // The viewer's own division shows their personal position/games-played rather than division-wide totals.
  let myPosition: number | null = null;
  let myPlayed = 0;
  let myTotal = 0;
  if (myDivision) {
    const [myDivisionPlayers, myDivisionMatches] = await Promise.all([
      sql`
        SELECT p.id, (p.first_name || ' ' || p.last_name) AS full_name, lp.partner_id
        FROM profiles p
        JOIN league_players lp ON lp.player_id = p.id
        WHERE lp.league_id = ${myDivision.id}
      `,
      sql`
        SELECT player1_id, player2_id, player3_id, player4_id, score_player1, score_player2, status, match_type, winner_id
        FROM matches WHERE league_id = ${myDivision.id}
      `,
    ]);
    const players = myDivisionPlayers as unknown as { id: string; full_name: string; partner_id: string | null }[];
    const matches = myDivisionMatches as unknown as {
      player1_id: string;
      player2_id: string;
      player3_id?: string | null;
      player4_id?: string | null;
      score_player1: number;
      score_player2: number;
      status: string;
      match_type?: string | null;
      winner_id?: string | null;
    }[];
    const isDoubles = myDivision.league_type === 'doubles';
    const pointsConfig = myDivision.points_config ?? undefined;
    const standings = calculateStandings(players, matches, 'head_to_head', pointsConfig);
    myPlayed = standings.find((s) => s.id === userId)?.played ?? 0;

    if (isDoubles) {
      const pairCount = Math.floor(players.length / 2);
      myTotal = pairCount - 1;
      const partnerMap: Record<string, string> = {};
      for (const p of players) {
        if (p.partner_id) partnerMap[p.id] = p.partner_id;
      }
      const seen = new Set<string>();
      let pairPosition = 0;
      let rank = 0;
      for (const s of standings) {
        if (seen.has(s.id)) continue;
        rank++;
        seen.add(s.id);
        const partnerId = partnerMap[s.id];
        if (partnerId) seen.add(partnerId);
        if (s.id === userId || partnerId === userId) {
          pairPosition = rank;
          break;
        }
      }
      myPosition = pairPosition;
    } else {
      myPosition = standings.findIndex((s) => s.id === userId) + 1;
      myTotal = players.length - 1;
    }
  }

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
  const currentRoundSchedule = roundSchedule.find((r) => r.round === current_round) ?? null;

  const renderDivisionCard = (d: Division, isMine: boolean, highlight = true) => {
    const playerCount = Number(d.player_count);
    const totalPossible = Math.floor(playerCount * (playerCount - 1) / 2);
    const leftColor = leagueBorderColor(d.id, d.color);
    const fullColor = leagueFullBorderColor(d.id, d.color);
    return (
      <div key={d.id} className={`relative bg-white rounded-xl p-4 hover:shadow-md transition-shadow ${
        isMine && highlight ? `border-2 ${fullColor} border-l-4 ${leftColor}` : `border border-gray-200 border-l-4 ${leftColor}`
      }`}>
        <Link href={`/tournaments/${d.id}`} className="absolute inset-0 rounded-xl z-10 focus:outline-none focus:ring-2 focus:ring-green-500" aria-label={d.name} />
        <div className="relative flex items-start justify-between gap-3">
          <div>
            <span className="block font-medium text-gray-800">{d.name}</span>
            {showDraftRosters && (
              <span className="block text-xs text-gray-500 mt-1">
                Assigned: {(draftRosterByDivision.get(d.id) ?? []).length > 0
                  ? draftRosterByDivision.get(d.id)!.join(', ')
                  : 'None yet'}
              </span>
            )}
          </div>
          {isMine && tournamentActive && (
            <Link
              href={`/tournaments/${d.id}/submit`}
              className="relative z-20 text-xs bg-green-700 hover:bg-green-800 text-white font-medium px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              Submit a result
            </Link>
          )}
        </div>
        <div className="relative flex items-center justify-between mt-2">
          <span className="text-xs text-gray-400">
            {isMine ? <>Position: {myPosition && myPosition > 0 ? ordinal(myPosition) : 'N/A'} &nbsp; My Games: {myPlayed}/{myTotal}</> : <>Players: {playerCount}</>}
          </span>
          <span className="text-xs text-gray-400">
            Games Played: {String(d.matches_played)}/{totalPossible}
          </span>
        </div>
      </div>
    );
  };

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
            {tournament.status === 'upcoming' && (
              isMember ? (
                <span className="text-xs px-2 py-1 rounded-full font-medium bg-emerald-100 text-emerald-700">Registered</span>
              ) : tournament.has_registration_form ? (
                <RegisterButton tournamentId={tournament.id} isRegistered={isRegistered} />
              ) : null
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
        <LeagueAdminsLine admins={admins} textClassName="text-gray-500" className="mt-2" />
      </div>

      <CollapsibleSection
        title="Tournament Details"
        meta={<span className="text-xs text-gray-400">
          {formatDateOrRange(
            roundSchedule[0]?.start_date ?? null,
            roundSchedule[roundSchedule.length - 1]?.end_date ?? tournament.final_end_text,
            { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }
          )}
        </span>}
      >
        <div className="text-sm text-gray-400 space-y-1">
          <p><span className="font-semibold text-gray-500">Round:</span> {String(current_round)} of {tournament.num_rounds}</p>
          <p><span className="font-semibold text-gray-500">Format:</span> Multi-league, {tournament.num_divisions} divisions</p>
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
          <p><span className="font-semibold text-gray-500">Promotion/Relegation:</span> {tournament.num_promoted} promoted / {tournament.num_relegated} relegated<span className="hidden sm:inline"> each round</span></p>
          <p><span className="font-semibold text-gray-500">Zero matches played:</span> {ZERO_MATCHES_POLICY_LABELS[tournament.zero_matches_policy]}</p>
          {tournament.status === 'upcoming'
            ? tournament.has_registration_form && (
                <p><span className="font-semibold text-gray-500">Registered:</span> {registrationCount}{tournament.max_registrations !== null ? ` / ${tournament.max_registrations}` : ''}</p>
              )
            : <p><span className="font-semibold text-gray-500">Players:</span> {divisions.reduce((sum, d) => sum + Number(d.player_count), 0)}</p>
          }
        </div>
      </CollapsibleSection>

      {myDivision && (
        <div>
          <h2 className="text-sm font-semibold text-green-500 uppercase tracking-wide mb-3">My Division</h2>
          <div className="space-y-3">
            {renderDivisionCard(myDivision, true, false)}
          </div>
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-green-500 uppercase tracking-wide">
            Round {String(current_round)} divisions
          </h2>
          <span className="text-xs text-gray-400">
            {formatDateOrRange(
              currentRoundSchedule?.start_date ?? null,
              currentRoundSchedule?.end_date ?? null,
              { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }
            )}
          </span>
        </div>
        <div className="space-y-3">
          {divisions.map((d) => renderDivisionCard(d, myDivisionIds.has(d.id)))}
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
                  <span className="block text-xs text-gray-400 mt-0.5">
                    {formatDateOrRange(start_date, end_date, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })}
                  </span>
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

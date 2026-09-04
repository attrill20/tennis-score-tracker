import { auth } from '@/auth';
import { leagueBorderColor } from '@/lib/leagueColor';
import sql from '@/lib/db';
import { calculateStandings, type Tiebreaker } from '@/lib/league';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import StandingsRow from './StandingsRow';
import ArchiveLeagueButton from '../ArchiveLeagueButton';
import LeaveLeagueButton from '@/components/LeaveLeagueButton';
import ScoringRulesInfo from '@/components/ScoringRulesInfo';
import RegisterButton from '@/components/RegisterButton';
import LeagueAdminsLine from '@/components/LeagueAdminsLine';
import { GENDER_CATEGORY_LABELS } from '@/lib/genderCategory';
import { formatDateOrRange } from '@/lib/format';

export default async function LeaguePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();

  const leagues = await sql`SELECT * FROM leagues WHERE id = ${id}`;
  const league = leagues[0];
  if (!league) notFound();

  const tRows = league.tournament_id
    ? await sql`SELECT id, name, format, description, status, has_registration_form, max_registrations, created_by FROM tournaments WHERE id = ${league.tournament_id}`
    : [];
  const tournament = tRows[0];
  const userId = session?.user?.id;

  const adminId = (tournament?.created_by as string | undefined) ?? (league.created_by as string | undefined);
  const tournamentIdForAdmins = tournament?.id as string | undefined;
  const adminRows = adminId
    ? tournamentIdForAdmins
      ? await sql`
          SELECT id, first_name, last_name, title, avatar_url, 0 AS sort_order, NULL::timestamptz AS added_at
          FROM profiles WHERE id = ${adminId}
          UNION ALL
          SELECT p.id, p.first_name, p.last_name, p.title, p.avatar_url, 1 AS sort_order, ta.added_at
          FROM tournament_admins ta
          JOIN profiles p ON p.id = ta.admin_id AND p.role IN ('admin', 'super_admin')
          WHERE ta.tournament_id = ${tournamentIdForAdmins} AND ta.admin_id != ${adminId}
          ORDER BY sort_order, added_at
        `
      : await sql`SELECT id, first_name, last_name, title, avatar_url FROM profiles WHERE id = ${adminId}`
    : [];
  const admins = adminRows.map((a) => ({
    id: a.id as string,
    name: [a.title, a.first_name, a.last_name].filter(Boolean).join(' '),
    avatarUrl: (a.avatar_url as string | null) ?? null,
  }));

  let registrationCount = 0;
  let isRegistered = false;
  if (tournament?.has_registration_form) {
    const [{ count }] = await sql`SELECT COUNT(*) FROM tournament_registrations WHERE tournament_id = ${tournament.id}`;
    registrationCount = Number(count);
    if (userId) {
      const regRows = await sql`SELECT 1 FROM tournament_registrations WHERE tournament_id = ${tournament.id} AND player_id = ${userId}`;
      isRegistered = regRows.length > 0;
    }
  }
  const isMultiDivision = tournament?.format === 'multi';
  // A current-round division counts as active whenever its parent tournament is active.
  // (A completed round - e.g. an earlier round after promotion - stays completed.)
  const divisionActive = league.status === 'active' || (isMultiDivision && tournament?.status === 'active' && league.status === 'upcoming');
  const displayStatus = divisionActive ? 'active' : (league.status as string);
  const description = (tournament?.description as string | null) ?? (league.description as string | null);
  const displayName = isMultiDivision
    ? `${tournament.name as string}: ${league.name as string}`
    : (league.name as string);

  const [players, matches] = await Promise.all([
    sql`
      SELECT p.id,
             CASE WHEN p.is_placeholder AND p.placeholder_anonymized THEN p.placeholder_alias ELSE (p.first_name || ' ' || p.last_name) END AS full_name,
             p.is_injured, p.avatar_url, p.is_placeholder,
             lp.partner_id,
             CASE WHEN pp.is_placeholder AND pp.placeholder_anonymized THEN pp.placeholder_alias ELSE (pp.first_name || ' ' || pp.last_name) END AS partner_full_name,
             pp.avatar_url AS partner_avatar_url, pp.is_placeholder AS partner_is_placeholder
      FROM profiles p
      JOIN league_players lp ON lp.player_id = p.id
      LEFT JOIN profiles pp ON pp.id = lp.partner_id
      WHERE lp.league_id = ${id}
      ORDER BY p.last_name, p.first_name
    `,
    sql`
      SELECT m.id, m.player1_id, m.player2_id, m.player3_id, m.player4_id,
             m.score_player1, m.score_player2,
             m.set_scores, m.tiebreak_scores, m.status, m.submitted_by, m.played_at,
             m.match_type, m.winner_id,
             CASE WHEN p1.is_placeholder AND p1.placeholder_anonymized THEN p1.placeholder_alias ELSE p1.first_name END AS player1_first,
             CASE WHEN p1.is_placeholder AND p1.placeholder_anonymized THEN p1.placeholder_alias ELSE (p1.first_name || ' ' || p1.last_name) END AS player1_name,
             CASE WHEN p2.is_placeholder AND p2.placeholder_anonymized THEN p2.placeholder_alias ELSE p2.first_name END AS player2_first,
             CASE WHEN p2.is_placeholder AND p2.placeholder_anonymized THEN p2.placeholder_alias ELSE (p2.first_name || ' ' || p2.last_name) END AS player2_name,
             CASE WHEN p3.is_placeholder AND p3.placeholder_anonymized THEN p3.placeholder_alias ELSE p3.first_name END AS player3_first,
             CASE WHEN p3.is_placeholder AND p3.placeholder_anonymized THEN p3.placeholder_alias ELSE (p3.first_name || ' ' || p3.last_name) END AS player3_name,
             CASE WHEN p4.is_placeholder AND p4.placeholder_anonymized THEN p4.placeholder_alias ELSE p4.first_name END AS player4_first,
             CASE WHEN p4.is_placeholder AND p4.placeholder_anonymized THEN p4.placeholder_alias ELSE (p4.first_name || ' ' || p4.last_name) END AS player4_name
      FROM matches m
      JOIN profiles p1 ON p1.id = m.player1_id
      JOIN profiles p2 ON p2.id = m.player2_id
      LEFT JOIN profiles p3 ON p3.id = m.player3_id
      LEFT JOIN profiles p4 ON p4.id = m.player4_id
      WHERE m.league_id = ${id}
      ORDER BY m.played_at DESC, m.submitted_at DESC
    `,
  ]);

  const isDoubles = league.league_type === 'doubles';

  const pointsConfig = (league.points_config as import('@/lib/league').PointsConfig | null) ?? undefined;

  const standings = calculateStandings(
    players as { id: string; full_name: string }[],
    matches as { player1_id: string; player2_id: string; player3_id?: string | null; player4_id?: string | null; score_player1: number; score_player2: number; status: string; match_type?: string | null; winner_id?: string | null }[],
    ((league.tiebreaker as string) ?? 'head_to_head') as Tiebreaker,
    pointsConfig
  );

  // For doubles, collapse standings into one row per pair
  type PairStanding = (typeof standings)[0] & {
    avatarUrl?: string | null;
    isPlaceholder?: boolean;
    partnerId?: string;
    partnerName?: string;
    isPartnerInjured?: boolean;
    partnerAvatarUrl?: string | null;
    partnerIsPlaceholder?: boolean;
  };
  let displayStandings: PairStanding[];

  if (isDoubles) {
    const partnerMap: Record<string, { id: string; name: string; isInjured: boolean; avatarUrl: string | null; isPlaceholder: boolean }> = {};
    for (const p of players) {
      if (p.partner_id) {
        const partnerRow = players.find((x) => x.id === p.partner_id);
        partnerMap[p.id as string] = {
          id: p.partner_id as string,
          name: p.partner_full_name as string,
          isInjured: !!(partnerRow?.is_injured),
          avatarUrl: (p.partner_avatar_url as string | null) ?? null,
          isPlaceholder: !!p.partner_is_placeholder,
        };
      }
    }
    const seen = new Set<string>();
    displayStandings = standings.reduce<PairStanding[]>((acc, s) => {
      if (seen.has(s.id)) return acc;
      seen.add(s.id);
      const partner = partnerMap[s.id];
      if (partner) seen.add(partner.id);
      const playerRow = players.find((x) => x.id === s.id);
      acc.push({
        ...s,
        avatarUrl: (playerRow?.avatar_url as string | null) ?? null,
        isPlaceholder: !!playerRow?.is_placeholder,
        partnerId: partner?.id,
        partnerName: partner?.name,
        isPartnerInjured: partner?.isInjured,
        partnerAvatarUrl: partner?.avatarUrl ?? null,
        partnerIsPlaceholder: partner?.isPlaceholder,
      });
      return acc;
    }, []);
  } else {
    displayStandings = standings.map((s) => {
      const playerRow = players.find((x) => x.id === s.id);
      return { ...s, avatarUrl: (playerRow?.avatar_url as string | null) ?? null, isPlaceholder: !!playerRow?.is_placeholder };
    });
  }

  const injuredIds = new Set(players.filter((p) => p.is_injured).map((p) => p.id as string));

  const isInLeague = players.some((p) => p.id === userId);

  const memberRow = userId && isInLeague ? await sql`
    SELECT user_archived FROM league_players WHERE league_id = ${id} AND player_id = ${userId}
  ` : [];
  const userArchived = (memberRow[0]?.user_archived as boolean) ?? false;

  return (
    <div>
      {isMultiDivision ? (
        <Link href={`/tournaments/multi/${tournament.id}`} className="text-sm text-green-700 hover:underline">
          &larr; {tournament.name as string}
        </Link>
      ) : (
        <Link href="/tournaments" className="text-sm text-green-700 hover:underline">&larr; All tournaments</Link>
      )}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-1 mt-2 gap-1">
        <h1 className="text-2xl font-bold text-gray-800 w-full sm:w-auto">{displayName}</h1>
        <div className="hidden sm:flex items-center gap-2 shrink-0">
          {league.gender_category !== 'either' && league.gender_category !== 'open' && (
            <span className="text-xs bg-purple-100 text-purple-600 px-2 py-1 rounded-full font-medium">
              {GENDER_CATEGORY_LABELS[league.gender_category as keyof typeof GENDER_CATEGORY_LABELS]}
            </span>
          )}
          <span className={`text-xs px-2 py-1 rounded-full font-medium ${
            displayStatus === 'active' ? 'bg-green-100 text-green-700'
            : displayStatus === 'upcoming' ? 'bg-blue-100 text-blue-700'
            : 'bg-slate-100 text-slate-600'
          }`}>
            {displayStatus.charAt(0).toUpperCase() + displayStatus.slice(1)}
          </span>
        </div>
      </div>
      <div className="flex items-center justify-between mb-2 gap-2">
        <p className="text-sm text-gray-400">
          {formatDateOrRange(
            league.season_start as string,
            league.season_end as string,
            { day: 'numeric', month: 'long', year: 'numeric' },
            { day: 'numeric', month: 'long' }
          )}
          {tournament?.has_registration_form && (
            <> | Registered: {registrationCount}{tournament.max_registrations !== null ? ` / ${tournament.max_registrations}` : ''}</>
          )}
        </p>
        <div className="flex items-center gap-2">
          <div className="flex sm:hidden items-center gap-2">
            {league.gender_category !== 'either' && league.gender_category !== 'open' && (
              <span className="text-xs bg-purple-100 text-purple-600 px-2 py-1 rounded-full font-medium">
                {GENDER_CATEGORY_LABELS[league.gender_category as keyof typeof GENDER_CATEGORY_LABELS]}
              </span>
            )}
            <span className={`text-xs px-2 py-1 rounded-full font-medium ${
              displayStatus === 'active' ? 'bg-green-100 text-green-700'
              : displayStatus === 'upcoming' ? 'bg-blue-100 text-blue-700'
              : 'bg-slate-100 text-slate-600'
            }`}>
              {displayStatus.charAt(0).toUpperCase() + displayStatus.slice(1)}
            </span>
          </div>
          {league.status === 'upcoming' && (
            isInLeague ? (
              <span className="text-xs px-2 py-1 rounded-full font-medium bg-emerald-100 text-emerald-700">Registered</span>
            ) : tournament?.has_registration_form ? (
              <RegisterButton tournamentId={tournament.id} isRegistered={isRegistered} />
            ) : null
          )}
          {isInLeague && league.status === 'upcoming' && league.join_type === 'open_invite' && (
            <LeaveLeagueButton leagueId={id} />
          )}
          {isInLeague && !userArchived && (league.status === 'completed' || league.status === 'archived') && (
            <ArchiveLeagueButton leagueId={id} />
          )}
        </div>
      </div>
      {(description || admins.length > 0) && (
        <div className="mb-6 space-y-2">
          {description && <p className="text-sm text-gray-600">{description}</p>}
          <LeagueAdminsLine admins={admins} textClassName="text-gray-600" />
        </div>
      )}

      {/* Tournament Table */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5">
          <h2 className="text-sm font-semibold text-green-500 uppercase tracking-wide">Table</h2>
          <ScoringRulesInfo pointsConfig={pointsConfig} />
        </div>
        {isInLeague && divisionActive && (
          <Link
            href={`/tournaments/${id}/submit`}
            className="text-xs bg-green-700 hover:bg-green-800 text-white font-medium px-3 py-1.5 rounded-lg transition-colors"
          >
            Submit a result
          </Link>
        )}
      </div>
      <div className={`bg-white rounded-xl border border-gray-200 border-l-4 ${leagueBorderColor(id, league.color as string | null)} overflow-x-auto mb-6`}>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-gray-500 text-xs">
              <th className="text-left px-4 py-3 font-medium">Player</th>
              <th className="text-center px-2 py-3 font-medium">P</th>
              <th className="text-center px-2 py-3 font-medium">W</th>
              <th className="text-center px-2 py-3 font-medium">D</th>
              <th className="text-center px-2 py-3 font-medium">L</th>
              <th className="text-center px-2 py-3 font-medium">Sets</th>
              <th className="text-center px-2 py-3 font-medium">Pts</th>
            </tr>
          </thead>
          <tbody>
            {displayStandings.map((s, i) => {
              const numPromoted = league.num_promoted as number ?? 0;
              const numRelegated = league.num_relegated as number ?? 0;
              const total = displayStandings.length;
              const isPromotion = numPromoted > 0 && i < numPromoted;
              const isRelegation = numRelegated > 0 && i >= total - numRelegated;
              const rowClass = isPromotion ? 'bg-green-50' : isRelegation ? 'bg-red-50' : '';
              return (
                <StandingsRow
                  key={s.id}
                  playerId={s.id}
                  userId={userId}
                  name={s.name}
                  avatarUrl={s.avatarUrl}
                  isPlaceholder={s.isPlaceholder}
                  isInjured={injuredIds.has(s.id)}
                  position={i + 1}
                  played={s.played}
                  won={s.won}
                  drawn={s.drawn}
                  lost={s.lost}
                  setsFor={s.setsFor}
                  setsAgainst={s.setsAgainst}
                  points={s.points}
                  rowClass={rowClass}
                  partnerId={s.partnerId}
                  partnerName={s.partnerName}
                  isPartnerInjured={s.isPartnerInjured}
                  partnerAvatarUrl={s.partnerAvatarUrl}
                  partnerIsPlaceholder={s.partnerIsPlaceholder}
                />
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Submit Score */}
      {/* Recent Results */}
      <h2 className="text-sm font-semibold text-green-500 uppercase tracking-wide mb-3">Results</h2>
      {matches.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-6 text-center text-gray-400 text-sm">
          No results yet
        </div>
      ) : (
        <div className="space-y-2">
          {matches.map((match) => {
            const isPlayer1 = match.player1_id === userId;
            const isPlayer3 = match.player3_id === userId;
            const isTeam1 = isPlayer1 || isPlayer3;
            const isInvolved = match.player1_id === userId || match.player2_id === userId || match.player3_id === userId || match.player4_id === userId;
            const submittedByMe = match.submitted_by === userId;
            const canEdit = submittedByMe && match.status === 'confirmed';
            const canSuggestEdit = isInvolved && match.status === 'confirmed' && !submittedByMe;
            const setScores = match.set_scores as [number, number][] | null;
            const tiebreakScores = match.tiebreak_scores as ([number, number] | null)[] | null;
            const matchType = match.match_type as string | null;
            const winnerId = match.winner_id as string | null;

            const isDoubles = !!(match.player3_id || match.player4_id);

            // Build display names — mobile: First / First, desktop: Full Name / Full Name
            const p1First = match.player1_first as string;
            const p2First = match.player2_first as string;
            const p3First = match.player3_first as string | null;
            const p4First = match.player4_first as string | null;
            const p3FullName = match.player3_name as string | null;
            const p4FullName = match.player4_name as string | null;
            const team1Name = isDoubles && p3First ? `${p1First} / ${p3First}` : match.player1_name as string;
            const team2Name = isDoubles && p4First ? `${p2First} / ${p4First}` : match.player2_name as string;
            const team1NameDesktop = isDoubles && p3FullName ? `${match.player1_name as string} / ${p3FullName}` : match.player1_name as string;
            const team2NameDesktop = isDoubles && p4FullName ? `${match.player2_name as string} / ${p4FullName}` : match.player2_name as string;

            // From current user's perspective if involved, otherwise winner first
            const p1Won = winnerId ? winnerId === match.player1_id : (match.score_player1 as number) > (match.score_player2 as number);
            const topIsPlayer1 = isInvolved ? isTeam1 : p1Won;
            const topName = topIsPlayer1 ? team1Name : team2Name;
            const bottomName = topIsPlayer1 ? team2Name : team1Name;
            const topNameDesktop = topIsPlayer1 ? team1NameDesktop : team2NameDesktop;
            const bottomNameDesktop = topIsPlayer1 ? team2NameDesktop : team1NameDesktop;
            const topScore = topIsPlayer1 ? match.score_player1 as number : match.score_player2 as number;
            const bottomScore = topIsPlayer1 ? match.score_player2 as number : match.score_player1 as number;
            const topPlayerId = topIsPlayer1 ? match.player1_id as string : match.player2_id as string;
            const isUnfinishedMatch = matchType === 'unfinished';
            const topWon = !isUnfinishedMatch && (winnerId ? winnerId === topPlayerId : topScore > bottomScore);
            const bottomWon = !isUnfinishedMatch && (winnerId ? winnerId !== topPlayerId : bottomScore > topScore);

            const result = isInvolved ? (isUnfinishedMatch ? 'D' : topWon ? 'W' : (winnerId || topScore < bottomScore) ? 'L' : 'D') : null;
            const badgeClass = result === 'W' ? 'bg-green-100 text-green-700' : result === 'L' ? 'bg-red-100 text-red-600' : 'bg-yellow-100 text-yellow-700';
            const matchBorderColor = result === 'W' ? 'border-l-green-300' : result === 'L' ? 'border-l-red-300' : result === 'D' ? 'border-l-yellow-300' : 'border-l-gray-200';

            const href = canEdit
              ? `/tournaments/${id}/matches/${match.id as string}/edit`
              : `/tournaments/${id}/matches/${match.id as string}`;

            return (
              <div key={match.id as string} className={`relative bg-white rounded-xl border border-gray-200 border-l-4 ${matchBorderColor} p-4 hover:border-green-400 transition-colors cursor-pointer`}>
                <Link href={href} className="absolute inset-0 rounded-xl z-10" />
                <div className="relative flex items-start gap-3">
                  <div className="flex flex-1 min-w-0 items-center gap-3">
                  <div className="w-8 shrink-0 flex justify-center">
                    {result && (
                      <span className={`text-xs font-bold px-1.5 py-1 rounded ${badgeClass}`}>{result}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0 text-sm">
                    <div className="flex items-center">
                      <span className={`font-medium ${isDoubles ? 'w-24 sm:w-48' : 'w-24'} shrink-0 truncate ${topWon ? 'text-gray-800' : 'text-gray-400'}`}>
                        {isDoubles ? <><span className="sm:hidden">{topName}</span><span className="hidden sm:inline">{topNameDesktop}</span></> : topName}
                      </span>
                      <div className="flex items-center gap-1.5">
                        {matchType === 'walkover' ? (
                          <span className="text-xs text-gray-400 italic">no sets</span>
                        ) : setScores && setScores.length > 0 ? setScores.map(([p1, p2], i) => {
                          const top = topIsPlayer1 ? p1 : p2;
                          const bot = topIsPlayer1 ? p2 : p1;
                          const tb = tiebreakScores?.[i] ?? null;
                          const topTb = tb ? (topIsPlayer1 ? tb[0] : tb[1]) : null;
                          return (
                            <span key={i} className={`relative inline-block text-xs font-medium w-6 text-center ${top > bot ? 'text-gray-700' : 'text-gray-400'}`}>
                              {top}
                              {topTb !== null && <span className="absolute -top-0.5 -right-0.5 text-[9px] font-normal leading-none opacity-50">{topTb}</span>}
                            </span>
                          );
                        }) : <span className="text-xs font-medium text-gray-700">{topScore}</span>}
                      </div>
                    </div>
                    <div className="flex items-center mt-0.5">
                      <span className={`font-medium ${isDoubles ? 'w-24 sm:w-48' : 'w-24'} shrink-0 truncate ${bottomWon ? 'text-gray-800' : 'text-gray-400'}`}>
                        {isDoubles ? <><span className="sm:hidden">{bottomName}</span><span className="hidden sm:inline">{bottomNameDesktop}</span></> : bottomName}
                      </span>
                      <div className="flex items-center gap-1.5">
                        {matchType === 'walkover' ? null : setScores && setScores.length > 0 ? setScores.map(([p1, p2], i) => {
                          const top = topIsPlayer1 ? p1 : p2;
                          const bot = topIsPlayer1 ? p2 : p1;
                          const tb = tiebreakScores?.[i] ?? null;
                          const botTb = tb ? (topIsPlayer1 ? tb[1] : tb[0]) : null;
                          return (
                            <span key={i} className={`relative inline-block text-xs font-medium w-6 text-center ${bot > top ? 'text-gray-700' : 'text-gray-400'}`}>
                              {bot}
                              {botTb !== null && <span className="absolute -top-0.5 -right-0.5 text-[9px] font-normal leading-none opacity-50">{botTb}</span>}
                            </span>
                          );
                        }) : <span className="text-xs font-medium text-gray-400">{bottomScore}</span>}
                      </div>
                    </div>
                  </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0 text-right">
                    <div className="flex items-center gap-2 relative z-10">
                      {matchType === 'walkover' && (
                        <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">Walkover</span>
                      )}
                      {matchType === 'retirement' && (
                        <span className="text-xs bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full">Retirement</span>
                      )}
                      {matchType === 'unfinished' && (
                        <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full">Unfinished</span>
                      )}
                      {match.status === 'pending_edit' && (
                        <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">Edit pending</span>
                      )}
                      {match.status === 'overridden' && (
                        <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">Overridden</span>
                      )}
                      <span className="text-xs text-gray-400">
                        {new Date(match.played_at as string).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })}
                      </span>
                    </div>
                    {(canEdit || canSuggestEdit) && (
                      <Link href={`/tournaments/${id}/matches/${match.id as string}/edit`} className="relative z-20 text-xs text-green-700 hover:underline">
                        {canEdit ? 'Edit' : 'Suggest edit'}
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

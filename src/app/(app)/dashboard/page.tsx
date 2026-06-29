import { auth } from '@/auth';
import { leagueBorderColor, leagueRightBorderColor } from '@/lib/leagueColor';
import sql from '@/lib/db';
import { calculateStandings } from '@/lib/league';
import Link from 'next/link';
import DisputeResolutionNotification from '@/components/DisputeResolutionNotification';
import NewMatchNotification from '@/components/NewMatchNotification';
import LeagueNotification from '@/components/LeagueNotification';
import WelcomeNotification from '@/components/WelcomeNotification';
import ArchiveLeagueButton from '@/app/(app)/tournaments/ArchiveLeagueButton';

export default async function DashboardPage() {
  const session = await auth();
  const userId = session!.user.id;

  const [leagues, profileRows] = await Promise.all([
    sql`
      SELECT l.id, l.name, l.status, l.season_start, l.season_end, l.league_type, l.color, l.max_players, lp.final_position,
        lp.started_seen, lp.ended_seen,
        t.name AS tournament_name, t.format AS tournament_format, t.status AS tournament_status,
        (SELECT COUNT(*) FROM league_players WHERE league_id = l.id) AS player_count
      FROM leagues l
      JOIN league_players lp ON lp.league_id = l.id AND lp.player_id = ${userId}
      LEFT JOIN tournaments t ON t.id = l.tournament_id
      WHERE lp.player_id = ${userId}
        AND lp.user_archived = false
        AND l.status != 'archived'
      ORDER BY
        CASE l.status WHEN 'active' THEN 0 WHEN 'upcoming' THEN 1 ELSE 2 END,
        l.season_start DESC
    `,
    sql`SELECT is_injured, welcome_seen FROM profiles WHERE id = ${userId}`,
  ]);
  const isInjured = (profileRows[0]?.is_injured as boolean) ?? false;
  const showWelcome = !(profileRows[0]?.welcome_seen as boolean);

  const leagueIds = leagues.map((l) => l.id as string);

  const [recentMatches, allPlayers, allMatches, pendingEdits, disputedMatches, resolvedDisputes, newMatchNotifications] = await Promise.all([
    sql`
      SELECT
        m.id, m.score_player1, m.score_player2, m.set_scores, m.tiebreak_scores, m.played_at,
        m.submitted_by, m.status, m.league_id, m.player1_id, m.player2_id, m.player3_id, m.player4_id,
        l.name AS league_name,
        p1.first_name AS player1_first, p2.first_name AS player2_first,
        p3.first_name AS player3_first, p4.first_name AS player4_first
      FROM matches m
      JOIN leagues l ON l.id = m.league_id
      JOIN profiles p1 ON p1.id = m.player1_id
      JOIN profiles p2 ON p2.id = m.player2_id
      LEFT JOIN profiles p3 ON p3.id = m.player3_id
      LEFT JOIN profiles p4 ON p4.id = m.player4_id
      WHERE m.player1_id = ${userId} OR m.player2_id = ${userId}
        OR m.player3_id = ${userId} OR m.player4_id = ${userId}
      ORDER BY m.played_at DESC, m.submitted_at DESC
      LIMIT 3
    `,
    leagueIds.length > 0 ? sql`
      SELECT p.id, (p.first_name || ' ' || p.last_name) AS full_name, lp.league_id, lp.partner_id
      FROM profiles p
      JOIN league_players lp ON lp.player_id = p.id
      WHERE lp.league_id = ANY(${leagueIds}::uuid[])
    ` : Promise.resolve([]),
    leagueIds.length > 0 ? sql`
      SELECT player1_id, player2_id, score_player1, score_player2, status, league_id
      FROM matches
      WHERE league_id = ANY(${leagueIds}::uuid[])
    ` : Promise.resolve([]),
    sql`
      SELECT m.id, m.league_id, m.pending_score_player1, m.pending_score_player2, m.pending_set_scores, m.pending_match_type,
        l.name AS league_name,
        (p2.first_name || ' ' || p2.last_name) AS opponent_name
      FROM matches m
      JOIN leagues l ON l.id = m.league_id
      JOIN profiles p2 ON p2.id = m.pending_edit_by
      WHERE m.submitted_by = ${userId} AND m.status = 'pending_edit'
    `,
    sql`
      SELECT m.id, m.league_id, m.score_player1, m.score_player2, m.player1_id, m.player2_id,
        l.name AS league_name,
        (p1.first_name || ' ' || p1.last_name) AS player1_name,
        (p2.first_name || ' ' || p2.last_name) AS player2_name
      FROM matches m
      JOIN leagues l ON l.id = m.league_id
      JOIN profiles p1 ON p1.id = m.player1_id
      JOIN profiles p2 ON p2.id = m.player2_id
      WHERE m.status = 'disputed'
        AND (m.player1_id = ${userId} OR m.player2_id = ${userId})
    `,
    sql`
      SELECT
        d.id AS dispute_id, d.acknowledged_by_player1, d.acknowledged_by_player2,
        m.id AS match_id, m.league_id, m.score_player1, m.score_player2, m.status AS match_status,
        m.player1_id, m.player2_id,
        (p1.first_name || ' ' || p1.last_name) AS player1_name,
        (p2.first_name || ' ' || p2.last_name) AS player2_name,
        l.name AS league_name
      FROM disputes d
      JOIN matches m ON m.id = d.match_id
      JOIN profiles p1 ON p1.id = m.player1_id
      JOIN profiles p2 ON p2.id = m.player2_id
      JOIN leagues l ON l.id = m.league_id
      WHERE d.status = 'resolved'
        AND (m.player1_id = ${userId} OR m.player2_id = ${userId})
        AND (
          (m.player1_id = ${userId} AND d.acknowledged_by_player1 = false)
          OR (m.player2_id = ${userId} AND d.acknowledged_by_player2 = false)
        )
    `,
    sql`
      SELECT m.id, m.league_id, m.score_player1, m.score_player2, m.set_scores,
             m.match_type, m.winner_id, m.player1_id, m.player2_id, m.player3_id, m.player4_id,
             l.name AS league_name,
             (p1.first_name || ' ' || p1.last_name) AS submitter_name,
             CASE WHEN m.player3_id IS NOT NULL THEN p3.first_name ELSE NULL END AS partner_first_name
      FROM matches m
      JOIN leagues l ON l.id = m.league_id
      JOIN profiles p1 ON p1.id = m.player1_id
      LEFT JOIN profiles p3 ON p3.id = m.player3_id
      WHERE m.submitted_at > NOW() - INTERVAL '30 days'
        AND (
          (m.player2_id = ${userId} AND m.opponent_seen = false)
          OR (m.player3_id = ${userId} AND m.partner_seen = false)
          OR (m.player4_id = ${userId} AND m.opponent2_seen = false)
        )
      ORDER BY m.submitted_at DESC
    `,
  ]);

  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const leagueStartedNotifications = leagues.filter((l) => {
    const start = new Date(l.season_start as string);
    return l.status === 'active' && start >= sevenDaysAgo && start <= now && !l.started_seen;
  });

  const leagueEndedNotifications = leagues.filter((l) => {
    const end = new Date(l.season_end as string);
    return l.status === 'completed' && end >= sevenDaysAgo && end <= now && !l.ended_seen;
  });

  type LeagueStats = { position: number; played: number; total: number };

  const leagueStats: Record<string, LeagueStats> = {};
  for (const league of leagues) {
    const id = league.id as string;
    const isDoubles = league.league_type === 'doubles';
    const players = allPlayers.filter((p) => p.league_id === id) as { id: string; full_name: string; partner_id?: string | null }[];
    const matches = allMatches.filter((m) => m.league_id === id) as {
      player1_id: string;
      player2_id: string;
      score_player1: number;
      score_player2: number;
      status: string;
    }[];
    const standings = calculateStandings(players, matches);
    const played = standings.find((s) => s.id === userId)?.played ?? 0;

    let position: number;
    let total: number;

    if (isDoubles) {
      const pairCount = Math.floor(players.length / 2);
      total = pairCount - 1;
      // Build partner map to deduplicate standings into pair order
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
      position = pairPosition;
    } else {
      position = standings.findIndex((s) => s.id === userId) + 1;
      total = players.length - 1;
    }

    leagueStats[id] = { position, played, total };
  }


  const leagueColorMap: Record<string, string | null> = {};
  for (const league of leagues) {
    leagueColorMap[league.id as string] = (league.color as string | null) ?? null;
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-1">
        Welcome back, {session?.user?.name?.split(' ')[0]}
      </h1>
      <p className="text-gray-500 text-sm mb-6">Queen's Park Tennis Club</p>

      {isInjured && (
        <div className="mb-6 flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
          <span className="inline-flex items-center justify-center w-5 h-5 bg-white border border-red-300 rounded-full shrink-0 mt-0.5">
            <svg className="w-3 h-3 text-red-500" viewBox="0 0 16 16" fill="currentColor">
              <path d="M7 2h2v5h5v2h-5v5H7v-5H2V7h5z"/>
            </svg>
          </span>
          <span>
            You have currently marked yourself as injured. If you have recovered, please{' '}
            <Link href="/profile" className="font-medium underline underline-offset-2 hover:text-red-900">
              click here to unmark yourself
            </Link>.
          </span>
        </div>
      )}

      {(showWelcome || newMatchNotifications.length > 0 || pendingEdits.length > 0 || disputedMatches.length > 0 || resolvedDisputes.length > 0 || leagueStartedNotifications.length > 0 || leagueEndedNotifications.length > 0) && (
        <div className="mb-4 space-y-2">
          <h2 className="text-sm font-semibold text-green-500 uppercase tracking-wide mb-3">My Notifications</h2>

          {showWelcome && <WelcomeNotification />}

          {resolvedDisputes.map((d) => {
            const isPlayer1 = d.player1_id === userId;
            const myScore = isPlayer1 ? d.score_player1 as number : d.score_player2 as number;
            const theirScore = isPlayer1 ? d.score_player2 as number : d.score_player1 as number;
            const myName = isPlayer1 ? d.player1_name as string : d.player2_name as string;
            const opponentName = isPlayer1 ? d.player2_name as string : d.player1_name as string;
            return (
              <DisputeResolutionNotification
                key={d.dispute_id as string}
                disputeId={d.dispute_id as string}
                matchId={d.match_id as string}
                leagueId={d.league_id as string}
                leagueName={d.league_name as string}
                myName={myName}
                opponentName={opponentName}
                myScore={myScore}
                theirScore={theirScore}
                matchStatus={d.match_status as string}
              />
            );
          })}

          {leagueStartedNotifications.map((l) => (
            <LeagueNotification
              key={`started-${l.id as string}`}
              leagueId={l.id as string}
              type="started"
              leagueName={(l.tournament_format === 'multi' ? l.tournament_name : l.name) as string}
              line2="Good luck for your matches!"
              bgClass="bg-teal-50"
              borderClass="border-teal-200"
              iconClass="text-teal-400"
              icon={
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              }
            />
          ))}

          {leagueEndedNotifications.map((l) => {
            const stats = leagueStats[l.id as string];
            const finalPos = l.final_position != null ? l.final_position as number : stats?.position;
            const ordinal = (n: number) => { const s = ['th','st','nd','rd']; const v = n % 100; return n + (s[(v-20)%10] ?? s[v] ?? s[0]); };
            const medal = finalPos === 1 ? '🥇' : finalPos === 2 ? '🥈' : finalPos === 3 ? '🥉' : null;
            const line2 = finalPos
              ? `${medal ? medal + ' ' : ''}You finished ${ordinal(finalPos)}${medal ? ' - well done!' : ''}`
              : 'Season complete';
            return (
              <LeagueNotification
                key={`ended-${l.id as string}`}
                leagueId={l.id as string}
                type="ended"
                leagueName={(l.tournament_format === 'multi' ? l.tournament_name : l.name) as string}
                line2={line2}
                bgClass="bg-purple-50"
                borderClass="border-purple-200"
                iconClass="text-purple-400"
                icon={
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                  </svg>
                }
              />
            );
          })}

          {pendingEdits.map((m) => {
            const myPending = m.pending_score_player1 as number;
            const theirPending = m.pending_score_player2 as number;
            const pendingMatchType = m.pending_match_type as string | null;
            const pendingSetScores = (m.pending_set_scores ?? null) as [number, number][] | null;
            const outcome = myPending > theirPending ? 'W' : myPending < theirPending ? 'L' : 'D';
            const badgeClass = outcome === 'W' ? 'bg-green-100 text-green-700' : outcome === 'L' ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-500';
            const scoreLabel = pendingMatchType === 'walkover'
              ? 'Walkover'
              : pendingSetScores && pendingSetScores.length > 0
              ? pendingSetScores.map(([p1, p2]) => `${p1}-${p2}`).join(', ')
              : `${myPending}-${theirPending}`;
            return (
              <div key={m.id as string} className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-3">
                <svg className="shrink-0 w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 100 20A10 10 0 0012 2z" />
                </svg>
                <div className="flex-1 min-w-0">
                  <Link href={`/tournaments/${m.league_id as string}/matches/${m.id as string}`} className="group block">
                    <p className="text-sm text-gray-800 group-hover:text-blue-600 group-hover:underline">{m.opponent_name as string} has suggested a correction</p>
                  </Link>
                  <div className="flex items-center gap-2 mt-1">
                    <Link href={`/tournaments/${m.league_id as string}/matches/${m.id as string}`} className="group flex items-center gap-2">
                      <span className={`inline-flex items-center justify-center w-5 h-5 rounded text-[10px] font-bold shrink-0 ${badgeClass}`}>{outcome}</span>
                      <span className="text-xs text-gray-700 group-hover:text-blue-600 group-hover:underline">{scoreLabel}</span>
                    </Link>
                    <Link href={`/tournaments/${m.league_id as string}`} className="text-xs text-gray-500 hover:text-blue-600 hover:underline truncate">{m.league_name as string}</Link>
                  </div>
                </div>
                <Link
                  href={`/tournaments/${m.league_id as string}/matches/${m.id as string}`}
                  className="shrink-0 text-xs font-medium px-3 py-1.5 rounded-lg bg-amber-200 hover:bg-amber-300 text-amber-900 transition-colors"
                >
                  View edit
                </Link>
              </div>
            );
          })}

          {disputedMatches.map((m) => {
            const opponentName = m.player1_id === userId ? m.player2_name as string : m.player1_name as string;
            return (
              <div key={m.id as string} className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-center gap-3">
                <svg className="shrink-0 w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                </svg>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-800">Result disputed vs {opponentName}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    <Link href={`/tournaments/${m.league_id as string}`} className="hover:text-blue-600 hover:underline">{m.league_name as string}</Link>
                    {' - awaiting admin review'}
                  </p>
                </div>
                <Link
                  href={`/tournaments/${m.league_id as string}/matches/${m.id as string}`}
                  className="shrink-0 text-xs font-medium px-3 py-1.5 rounded-lg bg-red-200 hover:bg-red-300 text-red-900 transition-colors"
                >
                  View match
                </Link>
              </div>
            );
          })}

          {newMatchNotifications.map((m) => {
            const winnerId = m.winner_id as string | null;
            const notificationRole = m.player3_id === userId ? 'partner' : m.player4_id === userId ? 'opponent2' : 'opponent';
            const partnerFirstName = m.partner_first_name as string | null;

            // iWon from this user's perspective:
            // - opponent / opponent2: user is on team2, team2 wins if score_player2 > score_player1
            // - partner: user is on team1 (same as submitter), team1 wins if score_player1 > score_player2
            const isTeam1 = notificationRole === 'partner';
            const team1Won = winnerId ? winnerId === m.player1_id : (m.score_player1 as number) > (m.score_player2 as number);
            const iWon = isTeam1 ? team1Won : !team1Won;

            const setScores = (m.set_scores ?? null) as [number, number][] | null;
            // Flip set scores so they're from "my team" perspective
            const mySetScores = isTeam1
              ? setScores
              : setScores ? setScores.map(([p1, p2]) => [p2, p1] as [number, number]) : null;
            const myScore = isTeam1 ? m.score_player1 as number : m.score_player2 as number;
            const theirScore = isTeam1 ? m.score_player2 as number : m.score_player1 as number;

            return (
              <NewMatchNotification
                key={`${m.id as string}-${notificationRole}`}
                matchId={m.id as string}
                leagueId={m.league_id as string}
                leagueName={m.league_name as string}
                submitterName={m.submitter_name as string}
                partnerFirstName={partnerFirstName}
                notificationRole={notificationRole}
                myScore={myScore}
                theirScore={theirScore}
                setScores={mySetScores}
                matchType={m.match_type as string | null}
                iWon={iWon}
              />
            );
          })}
        </div>
      )}

      <h2 className="text-sm font-semibold text-green-500 uppercase tracking-wide mb-3">My Tournaments</h2>

      {leagues.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">
          <p>You haven't been added to any tournaments yet.</p>
          <p className="text-sm mt-1">Contact an admin to get assigned.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {leagues.map((league) => {
            const id = league.id as string;
            const stats = leagueStats[id];
            const ordinal = (n: number) => {
              const s = ['th', 'st', 'nd', 'rd'];
              const v = n % 100;
              return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
            };
            const medal = (n: number) => n === 1 ? ' 🥇' : n === 2 ? ' 🥈' : n === 3 ? ' 🥉' : '';
            const isMultiDivision = league.tournament_format === 'multi';
            // Outside the tournament view, show which tournament a division belongs to.
            const displayName = isMultiDivision
              ? `${league.tournament_name as string}: ${league.name as string}`
              : (league.name as string);
            // A current-round (upcoming) division counts as active whenever its tournament is active.
            const effectiveActive = league.status === 'active' || (isMultiDivision && league.tournament_status === 'active' && league.status === 'upcoming');
            const effStatus = effectiveActive ? 'active' : (league.status as string);
            const totalUnits = stats ? stats.total + 1 : 1;
            const positionRatio = stats && totalUnits > 1 ? stats.position / totalUnits : 0;
            const leagueHasMatches = (allMatches as { league_id: string }[]).some((m) => m.league_id === id);
            const positionPillBg = !leagueHasMatches ? null
              : positionRatio >= 1 ? 'bg-red-100'
              : positionRatio <= 0.25 ? 'bg-green-100'
              : positionRatio <= 0.5 ? 'bg-yellow-100'
              : positionRatio <= 0.75 ? 'bg-amber-100'
              : 'bg-orange-100';
            return (
            <div key={id} className={`relative bg-white rounded-xl border border-gray-200 border-l-4 ${leagueBorderColor(id, league.color as string | null)} p-4 hover:border-green-400 transition-colors cursor-pointer`}>
              <Link href={`/tournaments/${id}`} className="absolute inset-0 rounded-xl z-10" aria-label={displayName} />
              <div className="relative">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-800">{displayName}</span>
                  <div className="flex items-center gap-2">
                    {effectiveActive && (
                      <Link
                        href={`/tournaments/${id}/submit`}
                        className="relative z-20 text-xs bg-green-700 hover:bg-green-800 text-white font-medium px-3 py-1 rounded-full transition-colors"
                      >
                        Submit a result
                      </Link>
                    )}
                    {league.status === 'completed' && (
                      <ArchiveLeagueButton leagueId={id} />
                    )}
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      effStatus === 'active'
                        ? 'bg-green-100 text-green-700'
                        : effStatus === 'upcoming'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-slate-100 text-slate-600'
                    }`}>
                      {effStatus.charAt(0).toUpperCase() + effStatus.slice(1)}
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-2">
                  {effStatus === 'upcoming' ? (
                    <span className="text-xs text-gray-400">Players Registered: {league.player_count as string}/{league.max_players as number}</span>
                  ) : stats && (effStatus === 'active' || effStatus === 'completed') ? (
                    <span className="text-xs text-gray-400">
                      {league.status === 'completed'
                        ? <>Finished: {ordinal(league.final_position != null ? league.final_position as number : stats.position)}{medal(league.final_position != null ? league.final_position as number : stats.position)} &nbsp; Games Played: {stats.played}/{stats.total}</>
                        : <>Position: {positionPillBg ? <span className={`inline-flex items-center ${positionPillBg} text-gray-800 rounded-full px-1.5 py-0.5 font-semibold`}>{ordinal(stats.position)}</span> : <span>N/A</span>} &nbsp; Games played: {stats.played}/{stats.total}</>
                      }
                    </span>
                  ) : <span />}
                  <p className="text-xs text-gray-400">
                    {new Date(league.season_start as string).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    {' - '}
                    {new Date(league.season_end as string).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })}
                  </p>
                </div>
              </div>
            </div>
            );
          })}
        </div>
      )}

      <div className="mt-3">
        <Link
          href="/tournaments"
          className="text-sm text-green-700 font-medium hover:underline"
        >
          View all tournaments →
        </Link>
      </div>

      <h2 className="text-sm font-semibold text-green-500 uppercase tracking-wide mb-3 mt-8">My Recent Matches</h2>

      {recentMatches.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">
          <p>No games played yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {recentMatches.map((match) => {
            const isPlayer1 = match.player1_id === userId;
            const isPlayer3 = match.player3_id === userId;
            const isTeam1 = isPlayer1 || isPlayer3;
            const isDoubles = !!(match.player3_id);
            const myScore = isTeam1 ? match.score_player1 as number : match.score_player2 as number;
            const theirScore = isTeam1 ? match.score_player2 as number : match.score_player1 as number;
            const p1First = match.player1_first as string;
            const p2First = match.player2_first as string;
            const p3First = match.player3_first as string | null;
            const p4First = match.player4_first as string | null;
            const opponentName = isDoubles
              ? isTeam1 ? `${p2First} / ${p4First}` : `${p1First} / ${p3First}`
              : isTeam1 ? p2First : p1First;
            const submittedByMe = match.submitted_by === userId;
            const canEdit = submittedByMe && match.status === 'confirmed';
            const canSuggestEdit = !submittedByMe && match.status === 'confirmed' &&
              (match.player1_id === userId || match.player2_id === userId ||
               match.player3_id === userId || match.player4_id === userId);
            const setScores = match.set_scores as [number, number][] | null;
            const tiebreakScores = match.tiebreak_scores as ([number, number] | null)[] | null;
            const result = myScore > theirScore ? 'W' : myScore < theirScore ? 'L' : 'D';
            const badgeClass = result === 'W' ? 'bg-green-100 text-green-700' : result === 'L' ? 'bg-red-100 text-red-600' : 'bg-yellow-100 text-yellow-700';
            const matchBorderColor = result === 'W' ? 'border-l-green-300' : result === 'L' ? 'border-l-red-300' : 'border-l-yellow-300';

            return (
              <div key={match.id as string} className={`relative bg-white rounded-xl border border-gray-200 border-l-4 ${matchBorderColor} p-4 hover:border-green-400 transition-colors cursor-pointer`}>
                <Link href={canEdit ? `/tournaments/${match.league_id as string}/matches/${match.id as string}/edit` : `/tournaments/${match.league_id as string}/matches/${match.id as string}`} className="absolute inset-0 rounded-xl z-10" />
                <div className="relative flex items-center gap-3">
                  {/* W/L badge */}
                  <span className={`text-xs font-bold px-1.5 py-1 rounded shrink-0 self-center ${badgeClass}`}>{result}</span>

                  {/* Player rows with fixed-width name column */}
                  <div className="flex-1 min-w-0 text-sm">
                    <div className="flex items-center">
                      <span className={`font-medium w-24 shrink-0 truncate ${myScore > theirScore ? 'text-gray-800' : 'text-gray-400'}`}>
                        {session?.user?.name}
                      </span>
                      <div className="flex items-center gap-1.5">
                        {setScores && setScores.length > 0 ? setScores.map(([p1, p2], i) => {
                          const my = isTeam1 ? p1 : p2;
                          const their = isTeam1 ? p2 : p1;
                          const tb = tiebreakScores?.[i] ?? null;
                          const myTb = tb ? (isTeam1 ? tb[0] : tb[1]) : null;
                          return (
                            <span key={i} className={`relative inline-block text-xs font-medium w-6 text-center ${my > their ? 'text-gray-700' : 'text-gray-400'}`}>
                              {my}
                              {myTb !== null && <span className="absolute -top-0.5 -right-0.5 text-[9px] font-normal leading-none opacity-50">{myTb}</span>}
                            </span>
                          );
                        }) : <span className="text-xs font-medium text-gray-700">{myScore}</span>}
                      </div>
                    </div>
                    <div className="flex items-center mt-0.5">
                      <span className={`font-medium w-24 shrink-0 truncate ${theirScore > myScore ? 'text-gray-800' : 'text-gray-400'}`}>
                        {opponentName}
                      </span>
                      <div className="flex items-center gap-1.5">
                        {setScores && setScores.length > 0 ? setScores.map(([p1, p2], i) => {
                          const my = isTeam1 ? p1 : p2;
                          const their = isTeam1 ? p2 : p1;
                          const tb = tiebreakScores?.[i] ?? null;
                          const theirTb = tb ? (isTeam1 ? tb[1] : tb[0]) : null;
                          return (
                            <span key={i} className={`relative inline-block text-xs font-medium w-6 text-center ${their > my ? 'text-gray-700' : 'text-gray-400'}`}>
                              {their}
                              {theirTb !== null && <span className="absolute -top-0.5 -right-0.5 text-[9px] font-normal leading-none opacity-50">{theirTb}</span>}
                            </span>
                          );
                        }) : <span className="text-xs font-medium text-gray-400">{theirScore}</span>}
                      </div>
                    </div>
                  </div>

                  {/* Right side: league name, date, action link */}
                  <div className={`flex flex-col items-end gap-1 w-24 shrink-0 text-right border-r-2 ${leagueRightBorderColor(match.league_id as string, leagueColorMap[match.league_id as string])} pr-2`}>
                    <div className="flex flex-col items-end gap-0.5">
                      {match.status === 'pending_edit' && (
                        <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">Edit pending</span>
                      )}
                      {match.status === 'overridden' && (
                        <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">Overridden</span>
                      )}
                      <span className="text-xs text-gray-400 truncate">{match.league_name as string}</span>
                    </div>
                    <span className="text-xs text-gray-400">
                      {new Date(match.played_at as string).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })}
                    </span>
                    {canEdit && (
                      <Link href={`/tournaments/${match.league_id}/matches/${match.id}/edit`} className="relative z-20 text-xs text-green-700 hover:underline">
                        Edit
                      </Link>
                    )}
                    {canSuggestEdit && (
                      <Link href={`/tournaments/${match.league_id}/matches/${match.id}/suggest-edit`} className="relative z-20 text-xs text-green-700 hover:underline">
                        Suggest edit
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-3">
        <Link href="/matches" className="text-sm text-green-700 font-medium hover:underline">
          View all my matches →
        </Link>
      </div>
    </div>
  );
}

import { auth } from '@/auth';
import { leagueBorderColor } from '@/lib/leagueColor';
import sql from '@/lib/db';
import Link from 'next/link';
import JoinLeagueButton from '@/components/JoinLeagueButton';
import RegisterButton from '@/components/RegisterButton';
import ArchivedLeaguesSection from './ArchivedLeaguesSection';
import ArchiveLeagueButton from './ArchiveLeagueButton';
import { GENDER_CATEGORY_LABELS } from '@/lib/genderCategory';
import { formatDateOrRange } from '@/lib/format';

type League = {
  id: string;
  tournament_id: string | null;
  name: string;
  status: string;
  season_start: string;
  season_end: string;
  is_public: boolean;
  join_type: string;
  league_type: string;
  max_players: number;
  player_count: string;
  matches_played: string;
  my_final_position: number | null;
  is_member: boolean;
  user_archived: boolean;
  color: string | null;
  gender_category: string;
  has_registration_form: boolean;
  is_registered: boolean;
  registration_count: string;
};

type MultiTournament = {
  id: string;
  name: string;
  status: string;
  num_divisions: number;
  num_rounds: number;
  final_end: string | null;
  start_date: string | null;
  final_end_text: string | null;
  player_count: string;
  color: string | null;
  is_public: boolean;
  current_round: number;
  is_member: boolean;
  has_registration_form: boolean;
  is_registered: boolean;
  registration_count: string;
};

function MultiTournamentCard({ t }: { t: MultiTournament }) {
  return (
    <div className={`relative bg-white rounded-xl border border-gray-200 border-l-4 ${leagueBorderColor(t.id, t.color)} p-4 hover:border-green-400 transition-colors cursor-pointer`}>
      <Link href={`/tournaments/multi/${t.id}`} className="absolute inset-0 rounded-xl z-10" aria-label={t.name} />
      <div className="relative">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-1.5 sm:gap-2">
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium text-gray-800">{t.name}</span>
            {t.status === 'upcoming' && (
              t.is_member ? (
                <span className="sm:hidden shrink-0 text-xs px-2 py-1 rounded-full font-medium bg-emerald-100 text-emerald-700 whitespace-nowrap">Registered</span>
              ) : t.has_registration_form ? (
                <div className="sm:hidden shrink-0">
                  <RegisterButton tournamentId={t.id} isRegistered={t.is_registered} />
                </div>
              ) : null
            )}
          </div>
          <div className="flex items-center flex-wrap gap-2 justify-end sm:justify-start shrink-0">
            <span className="hidden sm:inline text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full font-medium">Multi-league</span>
            {!t.is_public && <span className="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded-full font-medium">Private</span>}
            <span className={`hidden sm:inline text-xs px-2 py-1 rounded-full font-medium ${
              t.status === 'active' ? 'bg-green-100 text-green-700'
              : t.status === 'upcoming' ? 'bg-blue-100 text-blue-700'
              : 'bg-slate-100 text-slate-600'
            }`}>
              {t.status.charAt(0).toUpperCase() + t.status.slice(1)}
            </span>
            {t.status === 'upcoming' && (
              t.is_member ? (
                <span className="hidden sm:inline text-xs px-2 py-1 rounded-full font-medium bg-emerald-100 text-emerald-700">Registered</span>
              ) : t.has_registration_form ? (
                <div className="hidden sm:block shrink-0">
                  <RegisterButton tournamentId={t.id} isRegistered={t.is_registered} />
                </div>
              ) : null
            )}
          </div>
        </div>
        <div className="flex items-center justify-between mt-2">
          <span className="text-xs text-gray-400">
            {t.num_divisions} divisions
            <span className="hidden sm:inline">
              {' | '}{t.status === 'upcoming' ? `${t.num_rounds} rounds` : `Round ${Number(t.current_round)} of ${t.num_rounds}`}
            </span>
            {t.status === 'upcoming'
              ? <> | Registered: {Number(t.has_registration_form ? t.registration_count : t.player_count)}</>
              : <> | Players: {Number(t.player_count)}</>
            }
          </span>
          <p className="text-xs text-gray-400">
            {formatDateOrRange(
              t.start_date,
              t.final_end_text ?? t.final_end,
              { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' },
              { day: 'numeric', month: 'short', timeZone: 'UTC' }
            )}
          </p>
        </div>
      </div>
    </div>
  );
}

function LeagueCard({ league, canJoin, canArchive }: { league: League; canJoin: boolean; canArchive: boolean }) {
  const isDoubles = league.league_type === 'doubles';
  const playerCount = Number(league.player_count);
  // For doubles: max_players = pair count; unitCount = current pairs
  const unitCount = isDoubles ? Math.floor(playerCount / 2) : playerCount;
  const totalPossible = Math.floor(unitCount * (unitCount - 1) / 2);
  const isOneDay = new Date(league.season_start).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    === new Date(league.season_end).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  return (
    <div className={`relative bg-white rounded-xl border border-gray-200 border-l-4 ${leagueBorderColor(league.id, league.color)} p-4 hover:border-green-400 transition-colors cursor-pointer`}>
      <Link href={`/tournaments/${league.id}`} className="absolute inset-0 rounded-xl z-10" aria-label={league.name} />
      <div className="relative">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-1.5 sm:gap-2">
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium text-gray-800">{league.name}</span>
            <div className="sm:hidden flex items-center gap-2 shrink-0">
              {canJoin && <JoinLeagueButton leagueId={league.id} />}
              {league.status === 'upcoming' && (
                league.is_member ? (
                  <span className="shrink-0 text-xs px-2 py-1 rounded-full font-medium bg-emerald-100 text-emerald-700 whitespace-nowrap">Registered</span>
                ) : league.has_registration_form && league.tournament_id ? (
                  <RegisterButton tournamentId={league.tournament_id} isRegistered={league.is_registered} />
                ) : null
              )}
            </div>
          </div>
          <div className="flex items-center flex-wrap gap-2 justify-end sm:justify-start shrink-0">
            {canArchive && <ArchiveLeagueButton leagueId={league.id} />}
            {isOneDay && (
              <span className="hidden sm:inline text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded-full font-medium">One-Day</span>
            )}
            {!league.is_public && (
              <span className="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded-full font-medium">Private</span>
            )}
            {league.gender_category !== 'either' && league.gender_category !== 'open' && (
              <span className="text-xs bg-purple-100 text-purple-600 px-2 py-1 rounded-full font-medium">
                {GENDER_CATEGORY_LABELS[league.gender_category as keyof typeof GENDER_CATEGORY_LABELS]}
              </span>
            )}
            <span className={`hidden sm:inline text-xs px-2 py-1 rounded-full font-medium ${
              league.status === 'active'
                ? 'bg-green-100 text-green-700'
                : league.status === 'upcoming'
                ? 'bg-blue-100 text-blue-700'
                : 'bg-slate-100 text-slate-600'
            }`}>
              {league.status.charAt(0).toUpperCase() + league.status.slice(1)}
            </span>
            {league.status === 'upcoming' && (
              league.is_member ? (
                <span className="hidden sm:inline text-xs px-2 py-1 rounded-full font-medium bg-emerald-100 text-emerald-700">Registered</span>
              ) : league.has_registration_form && league.tournament_id ? (
                <div className="hidden sm:block shrink-0">
                  <RegisterButton tournamentId={league.tournament_id} isRegistered={league.is_registered} />
                </div>
              ) : null
            )}
            {canJoin && (
              <div className="hidden sm:block shrink-0">
                <JoinLeagueButton leagueId={league.id} />
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center justify-between mt-2">
          <span className="text-xs text-gray-400">
            {league.status === 'upcoming'
              ? <>Registered: {league.has_registration_form ? Number(league.registration_count) : (isDoubles ? unitCount : playerCount)}</>
              : isDoubles
              ? <>Pairs: {unitCount} | Games Played: {league.matches_played}/{totalPossible}</>
              : <>Players: {playerCount} | Games Played: {league.matches_played}/{totalPossible}</>
            }
          </span>
          <p className="text-xs text-gray-400">
            {formatDateOrRange(
              league.season_start,
              league.season_end,
              { day: 'numeric', month: 'short', year: 'numeric' },
              { day: 'numeric', month: 'short' }
            )}
          </p>
        </div>
      </div>
    </div>
  );
}

function Section({ title, leagues, multis = [], joinableIds, archivableIds }: { title: string; leagues: League[]; multis?: MultiTournament[]; joinableIds: Set<string>; archivableIds: Set<string> }) {
  return (
    <div className="mb-8">
      <h2 className="text-sm font-semibold text-green-500 uppercase tracking-wide mb-3">{title}</h2>
      {leagues.length === 0 && multis.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-6 text-center text-gray-400 text-sm">
          No tournaments to display here currently
        </div>
      ) : (
        <div className="space-y-3">
          {multis.map((t) => <MultiTournamentCard key={t.id} t={t} />)}
          {leagues.map((l) => <LeagueCard key={l.id} league={l} canJoin={joinableIds.has(l.id)} canArchive={archivableIds.has(l.id)} />)}
        </div>
      )}
    </div>
  );
}

export default async function LeaguesPage() {
  const session = await auth();
  const userId = session!.user.id;
  const isAdmin = session?.user?.role === 'admin' || session?.user?.role === 'super_admin';

  // Single-division tournaments render as individual cards (one league = one tournament).
  // Multi-league tournaments are surfaced separately, below, linking to their overview.
  const rows = await sql`
    SELECT
      l.id, l.tournament_id, l.name, l.status, l.season_start, l.season_end, l.is_public, l.color,
      COALESCE(l.gender_category, 'either') AS gender_category,
      COALESCE(l.join_type, 'invite_only') AS join_type,
      COALESCE(l.league_type, 'singles') AS league_type,
      COALESCE(l.max_players, 8) AS max_players,
      (SELECT COUNT(*) FROM league_players WHERE league_id = l.id) AS player_count,
      (SELECT lp.final_position FROM league_players lp WHERE lp.league_id = l.id AND lp.player_id = ${userId}) AS my_final_position,
      (SELECT COUNT(*) FROM matches m WHERE m.league_id = l.id) AS matches_played,
      EXISTS (SELECT 1 FROM league_players WHERE league_id = l.id AND player_id = ${userId}) AS is_member,
      COALESCE((SELECT lp.user_archived FROM league_players lp WHERE lp.league_id = l.id AND lp.player_id = ${userId}), false) AS user_archived,
      COALESCE(t.has_registration_form, false) AS has_registration_form,
      EXISTS (SELECT 1 FROM tournament_registrations WHERE tournament_id = t.id AND player_id = ${userId}) AS is_registered,
      (SELECT COUNT(*) FROM tournament_registrations WHERE tournament_id = t.id) AS registration_count
    FROM leagues l
    LEFT JOIN tournaments t ON t.id = l.tournament_id
    WHERE (t.format IS NULL OR t.format = 'single')
      AND (
        l.is_public = true
        OR ${isAdmin}
        OR EXISTS (SELECT 1 FROM league_players WHERE league_id = l.id AND player_id = ${userId})
      )
    ORDER BY l.season_start DESC
  `;

  const leagues = rows as unknown as League[];

  const multiRows = await sql`
    SELECT
      t.id, t.name, t.status, t.num_divisions, t.num_rounds, t.final_end, t.color, t.is_public,
      (t.round_dates[1])::text AS start_date,
      t.final_end::text AS final_end_text,
      (SELECT COUNT(*) FROM league_players lp JOIN leagues l3 ON l3.id = lp.league_id
       WHERE l3.tournament_id = t.id
         AND l3.round_number = (SELECT MAX(round_number) FROM leagues WHERE tournament_id = t.id)) AS player_count,
      (SELECT COALESCE(MAX(round_number), 1) FROM leagues WHERE tournament_id = t.id) AS current_round,
      EXISTS (
        SELECT 1 FROM league_players lp JOIN leagues l2 ON l2.id = lp.league_id
        WHERE l2.tournament_id = t.id AND lp.player_id = ${userId}
      ) AS is_member,
      t.has_registration_form,
      EXISTS (SELECT 1 FROM tournament_registrations WHERE tournament_id = t.id AND player_id = ${userId}) AS is_registered,
      (SELECT COUNT(*) FROM tournament_registrations WHERE tournament_id = t.id) AS registration_count
    FROM tournaments t
    WHERE t.format = 'multi'
      AND t.status <> 'archived'
      AND (
        t.is_public = true
        OR ${isAdmin}
        OR EXISTS (
          SELECT 1 FROM league_players lp JOIN leagues l2 ON l2.id = lp.league_id
          WHERE l2.tournament_id = t.id AND lp.player_id = ${userId}
        )
      )
    ORDER BY t.created_at DESC
  `;
  const multiTournaments = multiRows as unknown as MultiTournament[];

  // Tournaments the current user can join: open_invite, not a member, not full, not completed
  const joinableIds = new Set(
    leagues
      .filter((l) => {
        const pc = Number(l.player_count);
        const units = l.league_type === 'doubles' ? Math.floor(pc / 2) : pc;
        return l.join_type === 'open_invite' && !l.is_member && l.status !== 'completed' && units < l.max_players;
      })
      .map((l) => l.id)
  );

  const isArchived = (l: League) => l.status === 'archived' || l.user_archived;
  // Registering (even before an admin assigns you to a division) counts as "yours" too.
  const isMine = (l: League) => l.is_member || l.is_registered;
  const isMineMulti = (t: MultiTournament) => t.is_member || t.is_registered;

  const myLeagues = leagues.filter((l) => isMine(l) && !isArchived(l));
  // Tournaments you're in (or registered for) only appear under "My Tournaments" - keep them out of the status sections.
  const active    = leagues.filter((l) => l.status === 'active' && !isArchived(l) && !isMine(l));
  const upcoming  = leagues.filter((l) => l.status === 'upcoming' && !isArchived(l) && !isMine(l));
  const completed = leagues.filter((l) => l.status === 'completed' && !isArchived(l) && !isMine(l));
  const archived  = leagues.filter(isArchived);

  const myMulti        = multiTournaments.filter(isMineMulti);
  const activeMulti    = multiTournaments.filter((t) => t.status === 'active' && !isMineMulti(t));
  const upcomingMulti  = multiTournaments.filter((t) => t.status === 'upcoming' && !isMineMulti(t));
  const completedMulti = multiTournaments.filter((t) => t.status === 'completed' && !isMineMulti(t));

  const archivableIds = new Set(
    leagues
      .filter((l) => l.is_member && !l.user_archived && l.status === 'completed')
      .map((l) => l.id)
  );

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Tournaments</h1>
      <Section title="My Tournaments" leagues={myLeagues} multis={myMulti} joinableIds={joinableIds} archivableIds={archivableIds} />
      <Section title="Active Tournaments" leagues={active} multis={activeMulti} joinableIds={joinableIds} archivableIds={archivableIds} />
      <Section title="Upcoming Tournaments" leagues={upcoming} multis={upcomingMulti} joinableIds={joinableIds} archivableIds={archivableIds} />
      <Section title="Completed Tournaments" leagues={completed} multis={completedMulti} joinableIds={joinableIds} archivableIds={archivableIds} />
      <ArchivedLeaguesSection leagues={archived} />
    </div>
  );
}

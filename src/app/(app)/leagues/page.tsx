import { auth } from '@/auth';
import { leagueBorderColor } from '@/lib/leagueColor';
import sql from '@/lib/db';
import Link from 'next/link';
import JoinLeagueButton from '@/components/JoinLeagueButton';
import ArchivedLeaguesSection from './ArchivedLeaguesSection';
import ArchiveLeagueButton from './ArchiveLeagueButton';

type League = {
  id: string;
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
};

function LeagueCard({ league, canJoin, canArchive }: { league: League; canJoin: boolean; canArchive: boolean }) {
  const isDoubles = league.league_type === 'doubles';
  const playerCount = Number(league.player_count);
  // For doubles: max_players = pair count; unitCount = current pairs
  const unitCount = isDoubles ? Math.floor(playerCount / 2) : playerCount;
  const totalPossible = Math.floor(unitCount * (unitCount - 1) / 2);
  const spotsLeft = league.max_players - unitCount;
  return (
    <div className={`relative bg-white rounded-xl border border-gray-200 border-l-4 ${leagueBorderColor(league.id, league.color)} p-4 hover:border-green-400 transition-colors cursor-pointer`}>
      <Link href={`/leagues/${league.id}`} className="absolute inset-0 rounded-xl z-10" aria-label={league.name} />
      <div className="relative">
        <div className="flex items-start justify-between gap-2">
          <span className="font-medium text-gray-800">{league.name}</span>
          <div className="flex items-center gap-2 shrink-0">
            {canJoin && <JoinLeagueButton leagueId={league.id} />}
            {canArchive && <ArchiveLeagueButton leagueId={league.id} />}
            {!league.is_public && (
              <span className="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded-full font-medium">Private</span>
            )}
            <span className={`text-xs px-2 py-1 rounded-full font-medium ${
              league.status === 'active'
                ? 'bg-green-100 text-green-700'
                : league.status === 'upcoming'
                ? 'bg-blue-100 text-blue-700'
                : 'bg-slate-100 text-slate-600'
            }`}>
              {league.status.charAt(0).toUpperCase() + league.status.slice(1)}
            </span>
          </div>
        </div>
        <div className="flex items-center justify-between mt-2">
          <span className="text-xs text-gray-400">
            {league.status === 'upcoming'
              ? isDoubles
                ? <>Pairs: {unitCount}/{league.max_players}{canJoin && spotsLeft > 0 ? ` (${spotsLeft} spot${spotsLeft !== 1 ? 's' : ''} left)` : ''}</>
                : <>Players: {playerCount}/{league.max_players}{canJoin && spotsLeft > 0 ? ` (${spotsLeft} spot${spotsLeft !== 1 ? 's' : ''} left)` : ''}</>
              : isDoubles
              ? <>Pairs: {unitCount} | Games Played: {league.matches_played}/{totalPossible}</>
              : <>Players: {playerCount} | Games Played: {league.matches_played}/{totalPossible}</>
            }
          </span>
          <p className="text-xs text-gray-400">
            {new Date(league.season_start).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
            {' - '}
            {new Date(league.season_end).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
          </p>
        </div>
      </div>
    </div>
  );
}

function Section({ title, leagues, joinableIds, archivableIds }: { title: string; leagues: League[]; joinableIds: Set<string>; archivableIds: Set<string> }) {
  return (
    <div className="mb-8">
      <h2 className="text-sm font-semibold text-green-500 uppercase tracking-wide mb-3">{title}</h2>
      {leagues.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-6 text-center text-gray-400 text-sm">
          No leagues to display here currently
        </div>
      ) : (
        <div className="space-y-3">
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

  const rows = await sql`
    SELECT
      l.id, l.name, l.status, l.season_start, l.season_end, l.is_public, l.color,
      COALESCE(l.join_type, 'invite_only') AS join_type,
      COALESCE(l.league_type, 'singles') AS league_type,
      COALESCE(l.max_players, 8) AS max_players,
      (SELECT COUNT(*) FROM league_players WHERE league_id = l.id) AS player_count,
      (SELECT lp.final_position FROM league_players lp WHERE lp.league_id = l.id AND lp.player_id = ${userId}) AS my_final_position,
      (SELECT COUNT(*) FROM matches m WHERE m.league_id = l.id) AS matches_played,
      EXISTS (SELECT 1 FROM league_players WHERE league_id = l.id AND player_id = ${userId}) AS is_member,
      COALESCE((SELECT lp.user_archived FROM league_players lp WHERE lp.league_id = l.id AND lp.player_id = ${userId}), false) AS user_archived
    FROM leagues l
    WHERE l.is_public = true
      OR ${isAdmin}
      OR EXISTS (SELECT 1 FROM league_players WHERE league_id = l.id AND player_id = ${userId})
    ORDER BY l.season_start DESC
  `;

  const leagues = rows as unknown as League[];

  // Leagues the current user can join: open_invite, not a member, not full, not completed
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

  const active    = leagues.filter((l) => l.status === 'active' && !isArchived(l));
  const upcoming  = leagues.filter((l) => l.status === 'upcoming' && !isArchived(l));
  const myLeagues = leagues.filter((l) => l.is_member && !isArchived(l));
  const completed = leagues.filter((l) => l.status === 'completed' && !isArchived(l));
  const archived  = leagues.filter(isArchived);

  const archivableIds = new Set(
    leagues
      .filter((l) => l.is_member && !l.user_archived && l.status === 'completed')
      .map((l) => l.id)
  );

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Leagues</h1>
      <Section title="Active Leagues" leagues={active} joinableIds={joinableIds} archivableIds={archivableIds} />
      <Section title="Upcoming Leagues" leagues={upcoming} joinableIds={joinableIds} archivableIds={archivableIds} />
      <Section title="My Leagues" leagues={myLeagues} joinableIds={joinableIds} archivableIds={archivableIds} />
      <Section title="Completed Leagues" leagues={completed} joinableIds={joinableIds} archivableIds={archivableIds} />
      <ArchivedLeaguesSection leagues={archived} />
    </div>
  );
}

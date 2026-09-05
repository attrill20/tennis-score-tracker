import { auth } from '@/auth';
import sql from '@/lib/db';
import Link from 'next/link';
import { formatDateOrRange } from '@/lib/format';

export default async function MyTournamentsPage() {
  const session = await auth();
  const userId = session!.user.id;

  const tournamentHistory = await sql`
    SELECT l.id, l.name AS league_name, l.status, l.season_start, l.season_end,
           lp.final_position,
           t.name AS tournament_name, t.format AS tournament_format
    FROM league_players lp
    JOIN leagues l ON l.id = lp.league_id
    LEFT JOIN tournaments t ON t.id = l.tournament_id
    WHERE lp.player_id = ${userId}
    ORDER BY l.season_start DESC
  `;

  function ordinal(n: number) {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
  }

  function positionBadgeClass(n: number) {
    if (n === 1) return 'bg-amber-100 text-amber-700';
    if (n === 2) return 'bg-slate-200 text-slate-600';
    if (n === 3) return 'bg-orange-100 text-orange-700';
    return 'bg-gray-100 text-gray-500';
  }

  const statusBadgeClass: Record<string, string> = {
    active: 'bg-green-100 text-green-700',
    upcoming: 'bg-blue-100 text-blue-700',
    completed: 'bg-slate-100 text-slate-600',
    archived: 'bg-slate-100 text-slate-600',
  };

  const totalTournaments = tournamentHistory.length;
  const wins = tournamentHistory.filter((t) => t.final_position === 1).length;
  const podiums = tournamentHistory.filter((t) => t.final_position != null && (t.final_position as number) <= 3).length;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">My Tournament History</h1>

      {totalTournaments > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 px-4 py-3 mb-6">
          <div className="grid grid-cols-3 gap-4 text-sm text-center">
            <div>
              <p className="text-xs text-gray-500">Tournaments Played</p>
              <p className="font-bold text-gray-900">{totalTournaments}</p>
            </div>
            <div>
              <p className="text-xs text-amber-600">Tournaments Won</p>
              <p className="font-bold text-gray-900">{wins}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Podium Finishes</p>
              <p className="font-bold text-gray-900">{podiums}</p>
            </div>
          </div>
        </div>
      )}

      {tournamentHistory.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">
          <p>You haven&apos;t joined any tournaments yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {tournamentHistory.map((t) => {
            const isMulti = t.tournament_format === 'multi';
            const displayName = isMulti ? `${t.tournament_name as string}: ${t.league_name as string}` : (t.league_name as string);
            const finalPosition = t.final_position as number | null;
            const status = t.status as string;

            return (
              <div key={t.id as string} className="relative bg-white rounded-xl border border-gray-200 p-4 hover:border-green-400 transition-colors cursor-pointer">
                <Link href={`/tournaments/${t.id as string}`} className="absolute inset-0 rounded-xl z-10 focus:outline-none focus:ring-2 focus:ring-green-500" />
                <div className="relative flex items-center gap-3">
                  <span className={`text-xs font-bold px-1.5 py-1 rounded shrink-0 self-center ${finalPosition != null ? positionBadgeClass(finalPosition) : (statusBadgeClass[status] ?? 'bg-gray-100 text-gray-500')}`}>
                    {finalPosition != null ? ordinal(finalPosition) : status.charAt(0).toUpperCase() + status.slice(1)}
                  </span>

                  <div className="flex-1 min-w-0 text-sm">
                    <p className="font-medium text-gray-800 truncate">{displayName}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {formatDateOrRange(t.season_start as string, t.season_end as string)}
                    </p>
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

import { auth } from '@/auth';
import sql from '@/lib/db';
import { redirect } from 'next/navigation';
import Link from 'next/link';

type Row = {
  id: string;
  name: string;
  format: string;
  status: string;
  num_divisions: number;
  division_count: string;
  player_count: string;
  matches_played: string;
  first_division_id: string | null;
};

export default async function AdminLeaguesPage() {
  const session = await auth();
  if (session?.user?.role !== 'admin' && session?.user?.role !== 'super_admin') {
    redirect('/dashboard');
  }

  const tournaments = (await sql`
    SELECT
      t.id, t.name, t.format, t.status, t.num_divisions,
      (SELECT COUNT(*) FROM leagues WHERE tournament_id = t.id) AS division_count,
      (SELECT COUNT(*) FROM league_players lp JOIN leagues l ON l.id = lp.league_id WHERE l.tournament_id = t.id) AS player_count,
      (SELECT COUNT(*) FROM matches m JOIN leagues l ON l.id = m.league_id WHERE l.tournament_id = t.id) AS matches_played,
      (SELECT l.id FROM leagues l WHERE l.tournament_id = t.id ORDER BY l.round_number DESC, l.division_order ASC LIMIT 1) AS first_division_id
    FROM tournaments t
    WHERE EXISTS (SELECT 1 FROM leagues l WHERE l.tournament_id = t.id)
    ORDER BY t.created_at DESC
  `) as unknown as Row[];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 mb-1">Admin - Tournaments</h1>
          <p className="text-sm text-gray-400">Create tournaments and manage players</p>
        </div>
        <Link
          href="/admin/tournaments/new"
          className="text-sm bg-green-700 hover:bg-green-800 text-white font-medium px-4 py-2 rounded-lg transition-colors"
        >
          + Create tournament
        </Link>
      </div>

      {tournaments.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-base font-semibold text-gray-700 mb-4">Manage tournaments</h2>
          <div className="space-y-2">
            {tournaments.map((t) => {
              const isMulti = t.format === 'multi';
              const viewHref = isMulti ? `/tournaments/multi/${t.id}` : `/tournaments/${t.first_division_id}`;
              const manageHref = isMulti ? `/admin/tournaments/multi/${t.id}` : `/admin/tournaments/${t.first_division_id}`;
              return (
                <div key={t.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                  <div className="flex items-center gap-2">
                    <a href={manageHref} className="text-sm text-gray-800 hover:text-green-700 hover:underline">{t.name}</a>
                    {isMulti && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600">{Number(t.division_count)}-division</span>
                    )}
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      t.status === 'active' ? 'bg-green-100 text-green-700'
                      : t.status === 'upcoming' ? 'bg-blue-100 text-blue-700'
                      : 'bg-slate-100 text-slate-600'
                    }`}>{t.status.charAt(0).toUpperCase() + t.status.slice(1)}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-400">{Number(t.player_count)} players</span>
                    <span className="text-xs text-gray-400">{Number(t.matches_played)} games played</span>
                    <a href={viewHref} className="text-xs text-green-700 hover:underline">View</a>
                    <a href={manageHref} className="text-xs text-blue-600 hover:underline">Manage</a>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

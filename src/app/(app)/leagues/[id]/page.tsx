import { auth } from '@/auth';
import sql from '@/lib/db';
import { calculateStandings } from '@/lib/league';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import DisputeButton from './DisputeButton';

export default async function LeaguePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();

  const leagues = await sql`SELECT * FROM leagues WHERE id = ${id}`;
  const league = leagues[0];
  if (!league) notFound();

  const players = await sql`
    SELECT p.id, (p.first_name || ' ' || p.last_name) AS full_name
    FROM profiles p
    JOIN league_players lp ON lp.player_id = p.id
    WHERE lp.league_id = ${id}
    ORDER BY p.last_name, p.first_name
  `;

  const matches = await sql`
    SELECT m.*, (p1.first_name || ' ' || p1.last_name) AS player1_name, (p2.first_name || ' ' || p2.last_name) AS player2_name
    FROM matches m
    JOIN profiles p1 ON p1.id = m.player1_id
    JOIN profiles p2 ON p2.id = m.player2_id
    WHERE m.league_id = ${id}
    ORDER BY m.played_at DESC, m.submitted_at DESC
  `;

  const standings = calculateStandings(
    players as { id: string; full_name: string }[],
    matches as {
      player1_id: string;
      player2_id: string;
      score_player1: number;
      score_player2: number;
      status: string;
    }[]
  );

  const isInLeague = players.some((p) => p.id === session?.user?.id);
  const userId = session?.user?.id;

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-2xl font-bold text-gray-800">{league.name as string}</h1>
        <span className={`text-xs px-2 py-1 rounded-full font-medium ${
          league.status === 'active' ? 'bg-green-100 text-green-700'
          : league.status === 'upcoming' ? 'bg-yellow-100 text-yellow-700'
          : 'bg-gray-100 text-gray-500'
        }`}>
          {league.status as string}
        </span>
      </div>
      <p className="text-sm text-gray-400 mb-6">
        {new Date(league.season_start as string).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })}
        {' – '}
        {new Date(league.season_end as string).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
      </p>

      {/* League Table */}
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Table</h2>
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-gray-500 text-xs">
              <th className="text-left px-4 py-3 font-medium">Player</th>
              <th className="text-center px-2 py-3 font-medium">P</th>
              <th className="text-center px-2 py-3 font-medium">W</th>
              <th className="text-center px-2 py-3 font-medium">L</th>
              <th className="text-center px-2 py-3 font-medium">Sets</th>
              <th className="text-center px-2 py-3 font-medium">Pts</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((s, i) => (
              <tr key={s.id} className={`border-t border-gray-100 ${s.id === userId ? 'bg-green-50' : ''}`}>
                <td className="px-4 py-3 font-medium text-gray-800">
                  <span className="text-gray-400 mr-2">{i + 1}</span>
                  {s.name}
                </td>
                <td className="text-center px-2 py-3 text-gray-600">{s.played}</td>
                <td className="text-center px-2 py-3 text-gray-600">{s.won}</td>
                <td className="text-center px-2 py-3 text-gray-600">{s.lost}</td>
                <td className="text-center px-2 py-3 text-gray-600">{s.setsFor}-{s.setsAgainst}</td>
                <td className="text-center px-2 py-3 font-semibold text-gray-800">{s.points}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Submit Score */}
      {isInLeague && league.status === 'active' && (
        <div className="mb-6">
          <Link
            href={`/leagues/${id}/submit`}
            className="inline-block bg-green-700 hover:bg-green-800 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors"
          >
            Submit a result
          </Link>
        </div>
      )}

      {/* Recent Results */}
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Results</h2>
      {matches.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-6 text-center text-gray-400 text-sm">
          No results yet.
        </div>
      ) : (
        <div className="space-y-2">
          {matches.map((match) => {
            const canDispute =
              (match.player1_id === userId || match.player2_id === userId) &&
              match.status === 'confirmed' &&
              match.submitted_by !== userId;
            return (
              <div key={match.id as string} className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 text-sm">
                    <span className={`font-medium ${(match.score_player1 as number) > (match.score_player2 as number) ? 'text-gray-800' : 'text-gray-400'}`}>
                      {match.player1_name as string}
                    </span>
                    <span className="font-bold text-gray-800">
                      {match.score_player1 as number} – {match.score_player2 as number}
                    </span>
                    <span className={`font-medium ${(match.score_player2 as number) > (match.score_player1 as number) ? 'text-gray-800' : 'text-gray-400'}`}>
                      {match.player2_name as string}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {match.status === 'disputed' && (
                      <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">Disputed</span>
                    )}
                    {match.status === 'overridden' && (
                      <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">Overridden</span>
                    )}
                    {canDispute && (
                      <DisputeButton matchId={match.id as string} />
                    )}
                  </div>
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  {new Date(match.played_at as string).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

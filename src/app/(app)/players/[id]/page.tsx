import { auth } from '@/auth';
import sql from '@/lib/db';
import { notFound } from 'next/navigation';
import BackButton from '@/components/BackButton';

export default async function PlayerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const userId = session!.user.id;
  const role = session!.user.role as string;
  const isAdmin = role === 'admin' || role === 'super_admin';

  let showContactDetails = isAdmin || id === userId;

  if (!isAdmin && id !== userId) {
    const shared = await sql`
      SELECT 1
      FROM league_players lp1
      JOIN league_players lp2 ON lp1.league_id = lp2.league_id
      WHERE lp1.player_id = ${userId} AND lp2.player_id = ${id}
      LIMIT 1
    `;
    if (shared.length > 0) {
      showContactDetails = true;
    } else {
      const inPublicLeague = await sql`
        SELECT 1
        FROM league_players lp
        JOIN leagues l ON l.id = lp.league_id
        WHERE lp.player_id = ${id} AND l.is_public = true
        LIMIT 1
      `;
      if (inPublicLeague.length === 0) notFound();
    }
  }

  const [rows, matches] = await Promise.all([
    sql`SELECT first_name, last_name, title, email, phone, is_injured FROM profiles WHERE id = ${id}`,
    sql`SELECT player1_id, player2_id, score_player1, score_player2 FROM matches WHERE player1_id = ${id} OR player2_id = ${id}`,
  ]);

  const player = rows[0];
  if (!player) notFound();

  const total = matches.length;
  const wins = matches.filter((m) => {
    const isP1 = m.player1_id === id;
    return isP1 ? (m.score_player1 as number) > (m.score_player2 as number) : (m.score_player2 as number) > (m.score_player1 as number);
  }).length;
  const losses = matches.filter((m) => {
    const isP1 = m.player1_id === id;
    return isP1 ? (m.score_player1 as number) < (m.score_player2 as number) : (m.score_player2 as number) < (m.score_player1 as number);
  }).length;
  const draws = total - wins - losses;
  const pct = (n: number) => total === 0 ? '0%' : Math.round((n / total) * 100) + '%';

  const name = [player.title, player.first_name, player.last_name].filter(Boolean).join(' ');

  return (
    <div className="max-w-md mx-auto">
      <div className="mb-3">
        <h1 className="text-2xl font-bold text-gray-800">{name}</h1>
        <BackButton />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        {player.is_injured && (
          <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">
            <span className="inline-flex items-center justify-center w-4 h-4 bg-white border border-red-300 rounded-full shrink-0">
              <svg className="w-2.5 h-2.5 text-red-500" viewBox="0 0 16 16" fill="currentColor">
                <path d="M7 2h2v5h5v2h-5v5H7v-5H2V7h5z"/>
              </svg>
            </span>
            Currently injured
          </div>
        )}

        {showContactDetails && (
          <>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Contact Info</h2>
            <div>
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-0.5">Email</p>
              <a href={`mailto:${player.email as string}`} className="text-sm text-green-700 hover:underline">
                {player.email as string}
              </a>
            </div>

            <div>
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-0.5">Phone</p>
              {player.phone ? (
                <a href={`tel:${player.phone as string}`} className="text-sm text-green-700 hover:underline">
                  {player.phone as string}
                </a>
              ) : (
                <p className="text-sm text-gray-400">Not provided</p>
              )}
            </div>
          </>
        )}

        {!showContactDetails && !player.is_injured && (
          <p className="text-sm text-gray-400">Join a shared league to see contact details.</p>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6 mt-4">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Overall Stats</h2>
        {total === 0 ? (
          <p className="text-sm text-gray-400">No matches played yet.</p>
        ) : (
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Played</span>
              <span className="font-semibold text-gray-800">{total}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Wins</span>
              <span className="font-semibold text-green-700">{wins} <span className="text-xs text-green-600">({pct(wins)})</span></span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Losses</span>
              <span className="font-semibold text-red-500">{losses} <span className="text-xs text-red-400">({pct(losses)})</span></span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Draws</span>
              <span className="font-semibold text-yellow-500">{draws} <span className="text-xs text-yellow-400">({pct(draws)})</span></span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

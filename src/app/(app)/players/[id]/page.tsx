import { auth } from '@/auth';
import sql from '@/lib/db';
import { notFound } from 'next/navigation';
import BackButton from '@/components/BackButton';
import PlayerAvatar from '@/components/PlayerAvatar';

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
      JOIN leagues l ON l.id = lp1.league_id
      WHERE lp1.player_id = ${userId} AND lp2.player_id = ${id}
        AND l.status = 'active'
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
    sql`SELECT first_name, last_name, title, email, phone, is_injured, avatar_url FROM profiles WHERE id = ${id}`,
    sql`
      SELECT player1_id, player2_id, player3_id, player4_id,
             score_player1, score_player2, match_type, winner_id
      FROM matches
      WHERE player1_id = ${id} OR player2_id = ${id}
         OR player3_id = ${id} OR player4_id = ${id}
    `,
  ]);

  const player = rows[0];
  if (!player) notFound();

  // Head-to-head is from the viewer's perspective: only matches the logged-in
  // user and this player both took part in, scored as the viewer's W/L/D.
  const headToHeadMatches = matches.filter((m) =>
    m.player1_id === userId || m.player2_id === userId || m.player3_id === userId || m.player4_id === userId
  );

  function getResultForViewer(m: (typeof matches)[0]): 'W' | 'L' | 'D' {
    if (m.match_type === 'unfinished') return 'D';
    const viewerIsTeam1 = m.player1_id === userId || m.player3_id === userId;
    const winnerId = m.winner_id as string | null;
    if (winnerId) {
      return (winnerId === m.player1_id) === viewerIsTeam1 ? 'W' : 'L';
    }
    const s1 = m.score_player1 as number;
    const s2 = m.score_player2 as number;
    const my = viewerIsTeam1 ? s1 : s2;
    const their = viewerIsTeam1 ? s2 : s1;
    return my > their ? 'W' : my < their ? 'L' : 'D';
  }

  const timesPlayed = headToHeadMatches.length;
  const headToHeadWins = headToHeadMatches.filter((m) => getResultForViewer(m) === 'W').length;
  const headToHeadLosses = headToHeadMatches.filter((m) => getResultForViewer(m) === 'L').length;
  const headToHeadDraws = timesPlayed - headToHeadWins - headToHeadLosses;
  const headToHeadPct = (n: number) => timesPlayed === 0 ? '0%' : Math.round((n / timesPlayed) * 100) + '%';

  const name = [player.title, player.first_name, player.last_name].filter(Boolean).join(' ');

  return (
    <div className="max-w-md mx-auto">
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">{name}</h1>
            <BackButton />
          </div>
          <PlayerAvatar
            name={name}
            avatarUrl={(player.avatar_url as string) ?? null}
            size="lg"
          />
        </div>
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
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-0.5">
                {player.phone ? 'Phone' : 'Email'}
              </p>
              {player.phone ? (
                <a href={`tel:${player.phone as string}`} className="text-sm text-green-700 hover:underline">
                  {player.phone as string}
                </a>
              ) : (
                <a href={`mailto:${player.email as string}`} className="text-sm text-green-700 hover:underline">
                  {player.email as string}
                </a>
              )}
            </div>
          </>
        )}

        {!showContactDetails && !player.is_injured && (
          <p className="text-sm text-gray-400">Join a shared tournament to see contact details.</p>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6 mt-4 space-y-2">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Head to Head Record</h2>
        {timesPlayed === 0 ? (
          <p className="text-sm text-gray-400">You haven&apos;t played each other yet.</p>
        ) : (
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Times Played</span>
              <span className="font-semibold text-gray-800">{timesPlayed}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Wins</span>
              <span className="font-semibold text-green-700">{headToHeadWins} <span className="text-xs text-green-600">({headToHeadPct(headToHeadWins)})</span></span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Draws</span>
              <span className="font-semibold text-yellow-500">{headToHeadDraws} <span className="text-xs text-yellow-400">({headToHeadPct(headToHeadDraws)})</span></span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Losses</span>
              <span className="font-semibold text-red-500">{headToHeadLosses} <span className="text-xs text-red-400">({headToHeadPct(headToHeadLosses)})</span></span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

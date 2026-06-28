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

  function getResult(m: (typeof matches)[0]): 'W' | 'L' | 'D' {
    const isTeam1 = m.player1_id === id || m.player3_id === id;
    const winnerId = m.winner_id as string | null;
    if (winnerId) {
      return (winnerId === m.player1_id) === isTeam1 ? 'W' : 'L';
    }
    const s1 = m.score_player1 as number;
    const s2 = m.score_player2 as number;
    const my = isTeam1 ? s1 : s2;
    const their = isTeam1 ? s2 : s1;
    return my > their ? 'W' : my < their ? 'L' : 'D';
  }

  const singlesMatches = matches.filter((m) => !m.player3_id && !m.player4_id);
  const doublesMatches = matches.filter((m) => m.player3_id || m.player4_id);

  function calcStats(ms: typeof matches) {
    const total = ms.length;
    const wins = ms.filter((m) => getResult(m) === 'W').length;
    const losses = ms.filter((m) => getResult(m) === 'L').length;
    const draws = total - wins - losses;
    const pct = (n: number) => total === 0 ? '0%' : Math.round((n / total) * 100) + '%';
    return { total, wins, losses, draws, pct };
  }

  const singles = calcStats(singlesMatches);
  const doubles = calcStats(doublesMatches);
  const hasDoubles = doublesMatches.length > 0;
  const hasSingles = singlesMatches.length > 0;

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

      <div className="bg-white rounded-xl border border-gray-200 p-6 mt-4 space-y-5">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Overall Stats</h2>
        {!hasSingles && !hasDoubles ? (
          <p className="text-sm text-gray-400">No matches played yet.</p>
        ) : (
          <>
            {hasSingles && (
              <div>
                {hasDoubles && <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Singles</p>}
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Played</span>
                    <span className="font-semibold text-gray-800">{singles.total}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Wins</span>
                    <span className="font-semibold text-green-700">{singles.wins} <span className="text-xs text-green-600">({singles.pct(singles.wins)})</span></span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Losses</span>
                    <span className="font-semibold text-red-500">{singles.losses} <span className="text-xs text-red-400">({singles.pct(singles.losses)})</span></span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Draws</span>
                    <span className="font-semibold text-yellow-500">{singles.draws} <span className="text-xs text-yellow-400">({singles.pct(singles.draws)})</span></span>
                  </div>
                </div>
              </div>
            )}
            {hasDoubles && (
              <div>
                {hasSingles && <div className="border-t border-gray-100 pt-4" />}
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Doubles</p>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Played</span>
                    <span className="font-semibold text-gray-800">{doubles.total}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Wins</span>
                    <span className="font-semibold text-green-700">{doubles.wins} <span className="text-xs text-green-600">({doubles.pct(doubles.wins)})</span></span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Losses</span>
                    <span className="font-semibold text-red-500">{doubles.losses} <span className="text-xs text-red-400">({doubles.pct(doubles.losses)})</span></span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Draws</span>
                    <span className="font-semibold text-yellow-500">{doubles.draws} <span className="text-xs text-yellow-400">({doubles.pct(doubles.draws)})</span></span>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

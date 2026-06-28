import { auth } from '@/auth';
import sql from '@/lib/db';
import Link from 'next/link';
import InjuryToggle from './InjuryToggle';
import ProfileForm from './ProfileForm';
import AvatarUpload from './AvatarUpload';

export default async function ProfilePage() {
  const session = await auth();
  const userId = session!.user.id;

  const [rows, matches] = await Promise.all([
    sql`SELECT first_name, last_name, email, phone, is_injured, gender, avatar_url FROM profiles WHERE id = ${userId}`,
    sql`
      SELECT player1_id, player2_id, player3_id, player4_id,
             score_player1, score_player2, match_type, winner_id
      FROM matches
      WHERE player1_id = ${userId} OR player2_id = ${userId}
         OR player3_id = ${userId} OR player4_id = ${userId}
    `,
  ]);

  const profile = rows[0];

  function getResult(m: (typeof matches)[0]): 'W' | 'L' | 'D' {
    const isTeam1 = m.player1_id === userId || m.player3_id === userId;
    const winnerId = m.winner_id as string | null;
    if (winnerId) return (winnerId === m.player1_id) === isTeam1 ? 'W' : 'L';
    const my = (isTeam1 ? m.score_player1 : m.score_player2) as number;
    const their = (isTeam1 ? m.score_player2 : m.score_player1) as number;
    return my > their ? 'W' : my < their ? 'L' : 'D';
  }

  const singlesMatches = matches.filter((m) => !m.player3_id && !m.player4_id);
  const doublesMatches = matches.filter((m) => m.player3_id || m.player4_id);
  const hasSingles = singlesMatches.length > 0;
  const hasDoubles = doublesMatches.length > 0;

  function calcStats(ms: typeof matches) {
    const total = ms.length;
    const wins = ms.filter((m) => getResult(m) === 'W').length;
    const losses = ms.filter((m) => getResult(m) === 'L').length;
    const draws = total - wins - losses;
    const pct = (n: number) => total === 0 ? '0%' : Math.round((n / total) * 100) + '%';
    return { total, wins, losses, draws, pct };
  }

  const singles = calcStats(singlesMatches);
  const dbl = calcStats(doublesMatches);

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">My Profile</h1>

      <div className="flex flex-col sm:flex-row gap-6 items-start">
        <div className="w-full sm:flex-1">
          <ProfileForm
            initialFirstName={(profile.first_name as string) ?? ''}
            initialLastName={(profile.last_name as string) ?? ''}
            initialEmail={profile.email as string}
            initialPhone={(profile.phone as string) ?? ''}
            initialGender={(profile.gender as string) ?? ''}
          />
        </div>

        <div className="w-full sm:w-80 space-y-4 shrink-0">
          <AvatarUpload
            name={`${(profile.first_name as string) ?? ''} ${(profile.last_name as string) ?? ''}`.trim()}
            initialAvatarUrl={(profile.avatar_url as string) ?? null}
          />
          <InjuryToggle initialIsInjured={(profile.is_injured as boolean) ?? false} />
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">My Overall Stats</h2>
            {!hasSingles && !hasDoubles ? (
              <p className="text-sm text-gray-400">No matches played yet.</p>
            ) : (
              <>
                {hasSingles && (
                  <div>
                    {hasDoubles && <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Singles</p>}
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between"><span className="text-gray-500">Played</span><span className="font-semibold text-gray-800">{singles.total}</span></div>
                      <div className="flex justify-between"><span className="text-gray-500">Wins</span><span className="font-semibold text-green-700">{singles.wins} <span className="text-xs text-green-600">({singles.pct(singles.wins)})</span></span></div>
                      <div className="flex justify-between"><span className="text-gray-500">Losses</span><span className="font-semibold text-red-500">{singles.losses} <span className="text-xs text-red-400">({singles.pct(singles.losses)})</span></span></div>
                      <div className="flex justify-between"><span className="text-gray-500">Draws</span><span className="font-semibold text-yellow-500">{singles.draws} <span className="text-xs text-yellow-400">({singles.pct(singles.draws)})</span></span></div>
                    </div>
                  </div>
                )}
                {hasDoubles && (
                  <div>
                    {hasSingles && <div className="border-t border-gray-100 pt-3" />}
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Doubles</p>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between"><span className="text-gray-500">Played</span><span className="font-semibold text-gray-800">{dbl.total}</span></div>
                      <div className="flex justify-between"><span className="text-gray-500">Wins</span><span className="font-semibold text-green-700">{dbl.wins} <span className="text-xs text-green-600">({dbl.pct(dbl.wins)})</span></span></div>
                      <div className="flex justify-between"><span className="text-gray-500">Losses</span><span className="font-semibold text-red-500">{dbl.losses} <span className="text-xs text-red-400">({dbl.pct(dbl.losses)})</span></span></div>
                      <div className="flex justify-between"><span className="text-gray-500">Draws</span><span className="font-semibold text-yellow-500">{dbl.draws} <span className="text-xs text-yellow-400">({dbl.pct(dbl.draws)})</span></span></div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          <Link
            href="/matches"
            className="block w-full text-center text-sm bg-white border border-gray-200 hover:border-green-400 text-green-700 font-medium px-4 py-2.5 rounded-xl transition-colors"
          >
            View my matches →
          </Link>
        </div>
      </div>
    </div>
  );
}

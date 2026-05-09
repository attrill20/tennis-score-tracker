import { auth } from '@/auth';
import sql from '@/lib/db';
import Link from 'next/link';
import ProfileForm from './ProfileForm';

export default async function ProfilePage() {
  const session = await auth();
  const userId = session!.user.id;

  const [rows, matches] = await Promise.all([
    sql`SELECT title, first_name, last_name, email FROM profiles WHERE id = ${userId}`,
    sql`
      SELECT player1_id, player2_id, score_player1, score_player2
      FROM matches
      WHERE player1_id = ${userId} OR player2_id = ${userId}
    `,
  ]);

  const profile = rows[0];

  const total = matches.length;
  const wins = matches.filter((m) => {
    const isP1 = m.player1_id === userId;
    const my = isP1 ? m.score_player1 as number : m.score_player2 as number;
    const their = isP1 ? m.score_player2 as number : m.score_player1 as number;
    return my > their;
  }).length;
  const losses = matches.filter((m) => {
    const isP1 = m.player1_id === userId;
    const my = isP1 ? m.score_player1 as number : m.score_player2 as number;
    const their = isP1 ? m.score_player2 as number : m.score_player1 as number;
    return their > my;
  }).length;
  const draws = total - wins - losses;
  const pct = (n: number) => total === 0 ? '0%' : Math.round((n / total) * 100) + '%';

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">My Profile</h1>

      <div className="flex flex-col sm:flex-row gap-6 items-start">
        <div className="w-full sm:flex-1">
          <ProfileForm
            initialTitle={(profile.title as string) ?? ''}
            initialFirstName={(profile.first_name as string) ?? ''}
            initialLastName={(profile.last_name as string) ?? ''}
            initialEmail={profile.email as string}
          />
        </div>

        <div className="w-full sm:w-80 space-y-4 shrink-0">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">My Overall Stats</h2>
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

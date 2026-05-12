import { auth } from '@/auth';
import sql from '@/lib/db';
import { notFound } from 'next/navigation';

export default async function PlayerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const userId = session!.user.id;

  // Only allow viewing if the viewer shares a league with this player
  const shared = await sql`
    SELECT 1
    FROM league_players lp1
    JOIN league_players lp2 ON lp1.league_id = lp2.league_id
    WHERE lp1.player_id = ${userId} AND lp2.player_id = ${id}
    LIMIT 1
  `;

  if (shared.length === 0 && id !== userId) notFound();

  const rows = await sql`
    SELECT first_name, last_name, title, email, phone, is_injured
    FROM profiles
    WHERE id = ${id}
  `;

  const player = rows[0];
  if (!player) notFound();

  const name = [player.title, player.first_name, player.last_name].filter(Boolean).join(' ');

  return (
    <div className="max-w-md mx-auto">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">{name}</h1>

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
      </div>
    </div>
  );
}

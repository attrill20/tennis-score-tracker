import { auth } from '@/auth';
import sql from '@/lib/db';
import { redirect } from 'next/navigation';
import DisputeResolveForm from './DisputeResolveForm';

export default async function AdminDisputesPage() {
  const session = await auth();
  if (session?.user?.role !== 'admin' && session?.user?.role !== 'super_admin') {
    redirect('/dashboard');
  }

  const [open, resolved] = await Promise.all([
    sql`
      SELECT
        d.id, d.reason, d.status, d.match_id,
        m.score_player1, m.score_player2, m.played_at, m.league_id,
        (p1.first_name || ' ' || p1.last_name) AS player1_name,
        (p2.first_name || ' ' || p2.last_name) AS player2_name,
        (rb.first_name || ' ' || rb.last_name) AS raised_by_name,
        l.name AS league_name
      FROM disputes d
      JOIN matches m ON m.id = d.match_id
      JOIN profiles p1 ON p1.id = m.player1_id
      JOIN profiles p2 ON p2.id = m.player2_id
      JOIN profiles rb ON rb.id = d.raised_by
      JOIN leagues l ON l.id = m.league_id
      WHERE d.status = 'open'
      ORDER BY m.played_at DESC
    `,
    sql`
      SELECT
        d.id, d.reason, d.status, d.match_id,
        m.score_player1, m.score_player2, m.played_at, m.league_id,
        (p1.first_name || ' ' || p1.last_name) AS player1_name,
        (p2.first_name || ' ' || p2.last_name) AS player2_name,
        (rb.first_name || ' ' || rb.last_name) AS raised_by_name,
        l.name AS league_name
      FROM disputes d
      JOIN matches m ON m.id = d.match_id
      JOIN profiles p1 ON p1.id = m.player1_id
      JOIN profiles p2 ON p2.id = m.player2_id
      JOIN profiles rb ON rb.id = d.raised_by
      JOIN leagues l ON l.id = m.league_id
      WHERE d.status = 'resolved'
      ORDER BY m.played_at DESC
    `,
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-800 mb-1">Admin - Disputes</h1>
        <p className="text-sm text-gray-400">{open.length} open dispute{open.length !== 1 ? 's' : ''}</p>
      </div>

      {open.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400 text-sm">
          No open disputes.
        </div>
      ) : (
        <div className="space-y-4">
          {open.map((d) => (
            <div key={d.id as string} className="bg-white rounded-xl border border-red-200 p-5">
              <div className="flex items-start justify-between gap-4 mb-3">
                <div>
                  <p className="text-sm font-medium text-gray-800">
                    {d.player1_name as string} <span className="font-bold">{d.score_player1 as number}-{d.score_player2 as number}</span> {d.player2_name as string}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {d.league_name as string} · {new Date(d.played_at as string).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })}
                  </p>
                </div>
                <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full shrink-0">Open</span>
              </div>
              <p className="text-sm text-gray-600 bg-gray-50 rounded-lg px-3 py-2 mb-4">
                <span className="font-medium">{d.raised_by_name as string}:</span> "{d.reason as string}"
              </p>
              <DisputeResolveForm
                disputeId={d.id as string}
                matchId={d.match_id as string}
                currentScore={`${d.score_player1}-${d.score_player2}`}
                player1Name={d.player1_name as string}
                player2Name={d.player2_name as string}
              />
            </div>
          ))}
        </div>
      )}

      {resolved.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Resolved</h2>
          <div className="space-y-2">
            {resolved.map((d) => (
              <div key={d.id as string} className="bg-white rounded-xl border border-gray-200 p-4 text-sm text-gray-500">
                <span className="font-medium text-gray-700">{d.player1_name as string} vs {d.player2_name as string}</span>
                {' · '}{d.league_name as string}
                {' · '}<span className="text-green-600">Resolved</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

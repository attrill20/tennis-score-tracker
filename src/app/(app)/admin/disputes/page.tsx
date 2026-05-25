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
        d.requested_score_player1, d.requested_score_player2, d.requested_set_scores,
        m.score_player1, m.score_player2, m.set_scores, m.played_at, m.league_id,
        m.player1_id, m.player2_id,
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
          {open.map((d) => {
            const originalSets = (d.set_scores ?? null) as [number, number][] | null;
            const requestedSets = (d.requested_set_scores ?? null) as [number, number][] | null;
            const hasRequest = d.requested_score_player1 != null && d.requested_score_player2 != null;

            return (
              <div key={d.id as string} className="bg-white rounded-xl border border-red-200 p-5 space-y-5">
                {/* Header */}
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{d.player1_name as string} vs {d.player2_name as string}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {d.league_name as string} · {new Date(d.played_at as string).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })}
                    </p>
                  </div>
                  <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full shrink-0">Open</span>
                </div>

                {/* Scores side by side */}
                <div className={`grid gap-4 ${hasRequest ? 'grid-cols-2' : 'grid-cols-1'}`}>
                  {/* Original score */}
                  <div className="bg-gray-50 rounded-xl p-4">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Original score</p>
                    <ScoreGrid
                      player1Name={d.player1_name as string}
                      player2Name={d.player2_name as string}
                      score1={d.score_player1 as number}
                      score2={d.score_player2 as number}
                      sets={originalSets}
                    />
                  </div>

                  {/* Requested correction */}
                  {hasRequest && (
                    <div className="bg-amber-50 rounded-xl p-4">
                      <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide mb-3">Requested correction</p>
                      <p className="text-xs text-amber-700 mb-2">Raised by {d.raised_by_name as string}</p>
                      <ScoreGrid
                        player1Name={d.player1_name as string}
                        player2Name={d.player2_name as string}
                        score1={d.requested_score_player1 as number}
                        score2={d.requested_score_player2 as number}
                        sets={requestedSets}
                      />
                    </div>
                  )}
                </div>

                {!hasRequest && (
                  <p className="text-sm text-gray-600 bg-gray-50 rounded-lg px-3 py-2">
                    <span className="font-medium">{d.raised_by_name as string}:</span> &quot;{d.reason as string}&quot;
                  </p>
                )}

                <DisputeResolveForm
                  disputeId={d.id as string}
                  matchId={d.match_id as string}
                  player1Name={d.player1_name as string}
                  player2Name={d.player2_name as string}
                  originalScore1={d.score_player1 as number}
                  originalScore2={d.score_player2 as number}
                  requestedScore1={hasRequest ? d.requested_score_player1 as number : null}
                  requestedScore2={hasRequest ? d.requested_score_player2 as number : null}
                  requestedSets={requestedSets}
                />
              </div>
            );
          })}
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

function ScoreGrid({ player1Name, player2Name, score1, score2, sets }: {
  player1Name: string;
  player2Name: string;
  score1: number;
  score2: number;
  sets: [number, number][] | null;
}) {
  const p1Won = score1 > score2;
  return (
    <div>
      {sets && sets.length > 0 ? (
        <>
          <div className="flex items-center gap-2 mb-1 pl-[72px]">
            {sets.map((_, i) => (
              <span key={i} className="flex-1 text-center text-xs text-gray-400">S{i + 1}</span>
            ))}
          </div>
          <div className="flex items-center gap-2 mb-1">
            <span className={`w-[64px] text-xs truncate font-medium ${p1Won ? 'text-gray-800' : 'text-gray-400'}`}>{player1Name.split(' ')[0]}</span>
            {sets.map(([p1, p2], i) => (
              <div key={i} className={`flex-1 text-center text-sm font-semibold py-1 rounded-lg ${p1 > p2 ? 'bg-green-100 text-green-700' : 'bg-white text-gray-400'}`}>{p1}</div>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <span className={`w-[64px] text-xs truncate font-medium ${!p1Won ? 'text-gray-800' : 'text-gray-400'}`}>{player2Name.split(' ')[0]}</span>
            {sets.map(([p1, p2], i) => (
              <div key={i} className={`flex-1 text-center text-sm font-semibold py-1 rounded-lg ${p2 > p1 ? 'bg-green-100 text-green-700' : 'bg-white text-gray-400'}`}>{p2}</div>
            ))}
          </div>
        </>
      ) : (
        <p className={`text-2xl font-bold text-center ${p1Won ? 'text-gray-800' : 'text-gray-400'}`}>
          {score1} - {score2}
        </p>
      )}
    </div>
  );
}

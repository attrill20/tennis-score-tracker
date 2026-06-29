import { auth } from '@/auth';
import sql from '@/lib/db';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import GenerateRoundButton from './GenerateRoundButton';
import TournamentSettingsForm from './TournamentSettingsForm';
import DeleteTournamentButton from './DeleteTournamentButton';

type Tournament = {
  id: string;
  name: string;
  format: string;
  status: string;
  num_divisions: number;
  num_promoted: number;
  num_relegated: number;
  num_rounds: number;
  final_end: string | null;
  description: string | null;
  round_dates_text: string[] | null;
  final_end_text: string | null;
};

type Division = {
  id: string;
  name: string;
  status: string;
  division_order: number;
  round_number: number;
  player_count: string;
};

export default async function AdminMultiTournamentPage({ params }: { params: Promise<{ tid: string }> }) {
  const { tid } = await params;
  const session = await auth();
  if (session?.user?.role !== 'admin' && session?.user?.role !== 'super_admin') {
    redirect('/dashboard');
  }

  const tRows = await sql`
    SELECT *, round_dates::text[] AS round_dates_text, final_end::text AS final_end_text
    FROM tournaments WHERE id = ${tid}
  `;
  if (tRows.length === 0) notFound();
  const tournament = tRows[0] as unknown as Tournament;

  const [{ current_round }] = await sql`
    SELECT COALESCE(MAX(round_number), 1) AS current_round FROM leagues WHERE tournament_id = ${tid}
  `;

  const divisions = (await sql`
    SELECT
      l.id, l.name, l.status, l.division_order, l.round_number,
      (SELECT COUNT(*) FROM league_players WHERE league_id = l.id) AS player_count
    FROM leagues l
    WHERE l.tournament_id = ${tid} AND l.round_number = ${current_round}
    ORDER BY l.division_order ASC
  `) as unknown as Division[];

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/tournaments" className="text-sm text-green-700 hover:underline">&larr; All tournaments</Link>
        <h1 className="text-2xl font-bold text-gray-800 mt-2">{tournament.name}</h1>
        <p className="text-sm text-gray-400 mt-1">
          Multi-league tournament - {tournament.num_divisions} divisions, promote {tournament.num_promoted} / relegate {tournament.num_relegated}.
          Round {String(current_round)} of {tournament.num_rounds}.
        </p>
        <Link href={`/tournaments/multi/${tournament.id}`} className="inline-block mt-2 text-xs text-green-700 hover:underline">
          View public page
        </Link>
      </div>

      <TournamentSettingsForm
        tid={tournament.id}
        initialName={tournament.name}
        initialDescription={tournament.description ?? ''}
        initialRoundDates={tournament.round_dates_text ?? []}
        initialFinalEnd={tournament.final_end_text ?? ''}
        initialPromoted={tournament.num_promoted}
        initialRelegated={tournament.num_relegated}
      />

      {Number(current_round) < tournament.num_rounds && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h2 className="text-base font-semibold text-gray-700 mb-1">Next round</h2>
          <p className="text-sm text-gray-400 mb-3">
            Round {Number(current_round) + 1}{' '}generates automatically on its scheduled start date. You can also trigger it now,
            then adjust each division&apos;s players below.
          </p>
          <GenerateRoundButton tid={tournament.id} nextRound={Number(current_round) + 1} />
        </div>
      )}

      <div>
        <h2 className="text-base font-semibold text-gray-700 mb-3">Round {String(current_round)} divisions</h2>
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
          {divisions.map((d) => (
            <div key={d.id} className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-800">{d.name}</span>
                <span className="text-xs text-gray-400">{Number(d.player_count)} players</span>
              </div>
              <div className="flex items-center gap-3">
                <Link href={`/tournaments/${d.id}`} className="text-xs text-green-700 hover:underline">View</Link>
                <Link href={`/admin/tournaments/${d.id}`} className="text-xs text-blue-600 hover:underline">Manage division</Link>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-red-200 p-4">
        <h2 className="text-base font-semibold text-red-700 mb-1">Danger zone</h2>
        <p className="text-sm text-gray-400 mb-3">
          Deleting the tournament removes every division and round along with all of their matches, players and disputes. This cannot be undone.
        </p>
        <DeleteTournamentButton tid={tournament.id} tournamentName={tournament.name} />
      </div>
    </div>
  );
}

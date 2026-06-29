'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import MatchScoreInputs, { MatchType, TbEntry, isTiebreakSet, toFormSets, toFormTiebreaks } from '@/components/MatchScoreInputs';

type Player = { id: string; full_name: string };

type AdminMatchRow = {
  id: string;
  player1_id: string;
  player2_id: string;
  player1_name: string;
  player2_name: string;
  score_player1: number;
  score_player2: number;
  set_scores: [number, number][] | null;
  tiebreak_scores: ([number, number] | null)[] | null;
  played_at: string;
  match_type: string;
  winner_id: string | null;
  status: string;
};

function emptyTbEntries(): TbEntry[] {
  return [{ my: '', their: '' }, { my: '', their: '' }, { my: '', their: '' }];
}

function getInitialWalkoverId(match: AdminMatchRow): 'me' | 'them' {
  // 'them' = player2 didn't appear = player1 won
  // 'me' = player1 didn't appear = player2 won
  return match.winner_id === match.player1_id ? 'them' : 'me';
}

function formatMatchScore(match: AdminMatchRow): string {
  if (match.match_type === 'walkover') return 'Walkover';
  if (match.match_type === 'retirement') return 'Retirement';
  if (!match.set_scores?.length) return `${match.score_player1}-${match.score_player2}`;
  return match.set_scores.map(([p1, p2]) => `${p1}-${p2}`).join(', ');
}

function MatchForm({
  leagueId,
  players,
  leagueType = 'singles',
  matchId,
  initialPlayer1Id = '',
  initialPlayer2Id = '',
  initialSets = emptyTbEntries(),
  initialTiebreaks = emptyTbEntries(),
  initialPlayedAt = new Date().toISOString().split('T')[0],
  initialMatchType = 'normal',
  initialWalkoverId = 'them',
  initialRetiredPlayer = 'them',
  onSuccess,
  onCancel,
}: {
  leagueId: string;
  players: Player[];
  leagueType?: string;
  matchId?: string;
  initialPlayer1Id?: string;
  initialPlayer2Id?: string;
  initialSets?: TbEntry[];
  initialTiebreaks?: TbEntry[];
  initialPlayedAt?: string;
  initialMatchType?: MatchType;
  initialWalkoverId?: 'me' | 'them';
  initialRetiredPlayer?: 'me' | 'them';
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const isDoubles = leagueType === 'doubles';
  const isEdit = !!matchId;
  const [player1Id, setPlayer1Id] = useState(initialPlayer1Id);
  const [player2Id, setPlayer2Id] = useState(initialPlayer2Id);
  const [player3Id, setPlayer3Id] = useState('');
  const [player4Id, setPlayer4Id] = useState('');
  const [matchType, setMatchType] = useState<MatchType>(initialMatchType);
  const [walkoverId, setWalkoverId] = useState<'me' | 'them'>(initialWalkoverId);
  const [retiredPlayer, setRetiredPlayer] = useState<'me' | 'them'>(initialRetiredPlayer);
  const [sets, setSets] = useState<TbEntry[]>(initialSets);
  const [tiebreaks, setTiebreaks] = useState<TbEntry[]>(initialTiebreaks);
  const [playedAt, setPlayedAt] = useState(initialPlayedAt);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function updateSet(index: number, field: 'my' | 'their', value: string) {
    if (value !== '' && !/^\d+$/.test(value)) return;
    setSets((prev) => prev.map((s, i) => (i === index ? { ...s, [field]: value } : s)));
    setTiebreaks((prev) => prev.map((t, i) => {
      if (i !== index) return t;
      const updated = { ...sets[index], [field]: value };
      return isTiebreakSet(parseInt(updated.my), parseInt(updated.their)) ? t : { my: '', their: '' };
    }));
  }

  function updateTiebreak(index: number, field: 'my' | 'their', value: string) {
    if (value !== '' && !/^\d+$/.test(value)) return;
    setTiebreaks((prev) => prev.map((t, i) => (i === index ? { ...t, [field]: value } : t)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!isEdit && (!player1Id || !player2Id)) {
      setError('Please select both players.');
      return;
    }

    if (!isEdit && isDoubles && (!player3Id || !player4Id)) {
      setError('Please select all four players for a doubles match.');
      return;
    }

    const playedIndices = sets.reduce<number[]>((acc, s, i) => {
      if (s.my !== '' && s.their !== '') acc.push(i);
      return acc;
    }, []);

    if (matchType === 'normal' && playedIndices.length < 2) {
      setError('At least 2 sets must be entered.');
      return;
    }

    for (const s of sets) {
      if ((s.my === '') !== (s.their === '')) {
        setError('Each set needs scores for both players.');
        return;
      }
    }

    const playedSets = playedIndices.map((i) => [parseInt(sets[i].my), parseInt(sets[i].their)]);
    const playedTiebreaks = playedIndices.map((i) => {
      const my = parseInt(sets[i].my);
      const their = parseInt(sets[i].their);
      if (!isTiebreakSet(my, their)) return null;
      const tbMy = tiebreaks[i].my !== '' ? parseInt(tiebreaks[i].my) : null;
      const tbTheir = tiebreaks[i].their !== '' ? parseInt(tiebreaks[i].their) : null;
      if (tbMy === null && tbTheir === null) return null;
      return [tbMy ?? 0, tbTheir ?? 0];
    });

    setLoading(true);

    const url = isEdit ? `/api/admin/matches/${matchId}` : '/api/admin/matches';
    const method = isEdit ? 'PATCH' : 'POST';
    const body = {
      ...(isEdit ? {} : {
        leagueId, player1Id, player2Id,
        ...(isDoubles && !isEdit ? { player3Id, player4Id } : {}),
      }),
      sets: matchType === 'walkover' ? [] : playedSets,
      tiebreaks: matchType === 'walkover' ? [] : playedTiebreaks,
      playedAt,
      matchType,
      ...(matchType === 'walkover' ? { walkoverId } : {}),
      ...(matchType === 'retirement' ? { retiredPlayer } : {}),
    };

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error || 'Something went wrong');
      return;
    }

    onSuccess();
  }

  const player1First = players.find((p) => p.id === player1Id)?.full_name?.split(' ')[0] ?? 'Player 1';
  const player2First = players.find((p) => p.id === player2Id)?.full_name?.split(' ')[0] ?? 'Player 2';
  const player3First = players.find((p) => p.id === player3Id)?.full_name?.split(' ')[0];
  const player4First = players.find((p) => p.id === player4Id)?.full_name?.split(' ')[0];
  const myName = isDoubles && player3First ? `${player1First} / ${player3First}` : player1First;
  const theirName = isDoubles && player4First ? `${player2First} / ${player4First}` : player2First;

  return (
    <form onSubmit={handleSubmit} className="space-y-4 pt-4 border-t border-gray-100 mt-2">
      {!isEdit && !isDoubles && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="admin-player1" className="block text-sm font-medium text-gray-700 mb-1">Player 1</label>
            <select
              id="admin-player1"
              value={player1Id}
              onChange={(e) => setPlayer1Id(e.target.value)}
              required
              className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
            >
              <option value="">Select...</option>
              {players.filter((p) => p.id !== player2Id).map((p) => (
                <option key={p.id} value={p.id}>{p.full_name}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="admin-player2" className="block text-sm font-medium text-gray-700 mb-1">Player 2</label>
            <select
              id="admin-player2"
              value={player2Id}
              onChange={(e) => setPlayer2Id(e.target.value)}
              required
              className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
            >
              <option value="">Select...</option>
              {players.filter((p) => p.id !== player1Id).map((p) => (
                <option key={p.id} value={p.id}>{p.full_name}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {!isEdit && isDoubles && (
        <div className="space-y-3">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Team 1</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="admin-player1" className="block text-sm font-medium text-gray-700 mb-1">Player 1</label>
              <select
                id="admin-player1"
                value={player1Id}
                onChange={(e) => setPlayer1Id(e.target.value)}
                required
                className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
              >
                <option value="">Select...</option>
                {players.filter((p) => p.id !== player2Id && p.id !== player3Id && p.id !== player4Id).map((p) => (
                  <option key={p.id} value={p.id}>{p.full_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="admin-player3" className="block text-sm font-medium text-gray-700 mb-1">Player 1's partner</label>
              <select
                id="admin-player3"
                value={player3Id}
                onChange={(e) => setPlayer3Id(e.target.value)}
                required
                className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
              >
                <option value="">Select...</option>
                {players.filter((p) => p.id !== player1Id && p.id !== player2Id && p.id !== player4Id).map((p) => (
                  <option key={p.id} value={p.id}>{p.full_name}</option>
                ))}
              </select>
            </div>
          </div>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide pt-1">Team 2</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="admin-player2" className="block text-sm font-medium text-gray-700 mb-1">Player 2</label>
              <select
                id="admin-player2"
                value={player2Id}
                onChange={(e) => setPlayer2Id(e.target.value)}
                required
                className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
              >
                <option value="">Select...</option>
                {players.filter((p) => p.id !== player1Id && p.id !== player3Id && p.id !== player4Id).map((p) => (
                  <option key={p.id} value={p.id}>{p.full_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="admin-player4" className="block text-sm font-medium text-gray-700 mb-1">Player 2's partner</label>
              <select
                id="admin-player4"
                value={player4Id}
                onChange={(e) => setPlayer4Id(e.target.value)}
                required
                className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
              >
                <option value="">Select...</option>
                {players.filter((p) => p.id !== player1Id && p.id !== player2Id && p.id !== player3Id).map((p) => (
                  <option key={p.id} value={p.id}>{p.full_name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      <MatchScoreInputs
        myName={myName}
        opponentName={theirName}
        matchType={matchType}
        setMatchType={setMatchType}
        walkoverId={walkoverId}
        setWalkoverId={setWalkoverId}
        retiredPlayer={retiredPlayer}
        setRetiredPlayer={setRetiredPlayer}
        sets={sets}
        updateSet={updateSet}
        tiebreaks={tiebreaks}
        updateTiebreak={updateTiebreak}
        playedAt={playedAt}
        setPlayedAt={setPlayedAt}
      />

      {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={loading}
          className="flex-1 bg-green-700 hover:bg-green-800 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg transition-colors text-sm"
        >
          {loading ? 'Saving...' : isEdit ? 'Save changes' : 'Add result'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2.5 border border-gray-300 text-gray-600 hover:border-gray-400 rounded-lg transition-colors text-sm"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

export default function AdminMatchesSection({
  leagueId,
  players,
  matches,
  leagueType = 'singles',
}: {
  leagueId: string;
  players: Player[];
  matches: AdminMatchRow[];
  leagueType?: string;
}) {
  const router = useRouter();
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingMatchId, setEditingMatchId] = useState<string | null>(null);

  function onSuccess() {
    setShowAddForm(false);
    setEditingMatchId(null);
    router.refresh();
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-gray-700">Results</h2>
        <button
          onClick={() => { setShowAddForm(!showAddForm); setEditingMatchId(null); }}
          className="text-sm text-green-700 hover:underline font-medium"
        >
          {showAddForm ? 'Cancel' : '+ Add result'}
        </button>
      </div>

      {showAddForm && (
        <MatchForm
          leagueId={leagueId}
          players={players}
          leagueType={leagueType}
          onSuccess={onSuccess}
          onCancel={() => setShowAddForm(false)}
        />
      )}

      {matches.length === 0 && !showAddForm && (
        <p className="text-sm text-gray-400 text-center py-4">No results yet</p>
      )}

      {matches.length > 0 && (
        <div className="space-y-0 mt-2">
          {matches.map((match, idx) => (
            <div key={match.id} className={idx < matches.length - 1 ? 'border-b border-gray-100' : ''}>
              {editingMatchId === match.id ? (
                <div className="py-3">
                  <p className="text-sm font-medium text-gray-700 mb-1">
                    {match.player1_name} vs {match.player2_name}
                  </p>
                  <MatchForm
                    leagueId={leagueId}
                    players={players}
                    matchId={match.id}
                    initialPlayer1Id={match.player1_id}
                    initialPlayer2Id={match.player2_id}
                    initialSets={toFormSets(match.set_scores)}
                    initialTiebreaks={toFormTiebreaks(match.tiebreak_scores)}
                    initialPlayedAt={new Date(match.played_at).toISOString().split('T')[0]}
                    initialMatchType={(match.match_type as MatchType) ?? 'normal'}
                    initialWalkoverId={match.match_type === 'walkover' ? getInitialWalkoverId(match) : 'them'}
                    initialRetiredPlayer={match.match_type === 'retirement' ? getInitialWalkoverId(match) : 'them'}
                    onSuccess={onSuccess}
                    onCancel={() => setEditingMatchId(null)}
                  />
                </div>
              ) : (
                <div className="flex items-center justify-between py-3 gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-gray-800">
                      <span className={match.winner_id === match.player1_id || (!match.winner_id && match.score_player1 > match.score_player2) ? 'font-semibold' : ''}>{match.player1_name}</span>
                      <span className="text-gray-400 mx-1">vs</span>
                      <span className={match.winner_id === match.player2_id || (!match.winner_id && match.score_player2 > match.score_player1) ? 'font-semibold' : ''}>{match.player2_name}</span>
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {formatMatchScore(match)}
                      {' · '}
                      {new Date(match.played_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })}
                      {match.status === 'overridden' && (
                        <span className="ml-1.5 text-amber-600">overridden</span>
                      )}
                      {match.status === 'disputed' && (
                        <span className="ml-1.5 text-red-500">disputed</span>
                      )}
                      {match.status === 'pending_edit' && (
                        <span className="ml-1.5 text-amber-600">edit pending</span>
                      )}
                    </p>
                  </div>
                  <button
                    onClick={() => { setEditingMatchId(match.id); setShowAddForm(false); }}
                    className="text-xs text-blue-600 hover:underline shrink-0"
                  >
                    Edit
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import TennisBallCelebration from '@/components/TennisBallCelebration';
import MatchScoreInputs, { MatchType, isTiebreakSet, TbEntry } from '@/components/MatchScoreInputs';

type Player = { id: string; full_name: string };

function firstName(name: string) {
  return name.split(' ')[0];
}

export default function SubmitScoreForm({ userName }: { userName: string }) {
  const { id: leagueId } = useParams<{ id: string }>();
  const router = useRouter();

  const [players, setPlayers] = useState<Player[]>([]);
  const [leagueType, setLeagueType] = useState<'singles' | 'doubles'>('singles');

  // Singles
  const [opponent, setOpponent] = useState('');

  // Doubles — partner fixed from league, opponents selected as a pair
  const [myPartnerId, setMyPartnerId] = useState('');
  const [myPartnerName, setMyPartnerName] = useState('');
  type OpponentPair = { p1Id: string; p2Id: string; label: string; fullLabel: string };
  const [opponentPairs, setOpponentPairs] = useState<OpponentPair[]>([]);
  const [selectedPairKey, setSelectedPairKey] = useState('');
  // Keep opponent1/opponent2 derived from selectedPairKey
  const [opponent1, setOpponent1] = useState('');
  const [opponent2, setOpponent2] = useState('');

  const [matchType, setMatchType] = useState<MatchType>('normal');
  const [walkoverId, setWalkoverId] = useState<'me' | 'them'>('them');
  const [retiredPlayer, setRetiredPlayer] = useState<'me' | 'them'>('them');
  const [sets, setSets] = useState<TbEntry[]>([
    { my: '', their: '' },
    { my: '', their: '' },
    { my: '', their: '' },
  ]);
  const [tiebreaks, setTiebreaks] = useState<TbEntry[]>([
    { my: '', their: '' },
    { my: '', their: '' },
    { my: '', their: '' },
  ]);
  const [playedAt, setPlayedAt] = useState(new Date().toISOString().split('T')[0]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [celebrationOrigin, setCelebrationOrigin] = useState<{ x: number; y: number } | null>(null);

  const submitButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    fetch(`/api/leagues/${leagueId}/players`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else {
          setPlayers(data.players ?? []);
          setLeagueType(data.leagueType ?? 'singles');
          if (data.leagueType === 'doubles') {
            setMyPartnerId(data.myPartnerId ?? '');
            setMyPartnerName(data.myPartnerName ?? '');
            setOpponentPairs(data.opponentPairs ?? []);
          }
        }
      })
      .catch(() => setError('Failed to load players'));
  }, [leagueId]);

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

    if (leagueType === 'doubles') {
      if (!selectedPairKey || !opponent1 || !opponent2) {
        setError('Please select the opposing pair.');
        return;
      }
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

    let mySetsWon = 0;
    for (const [p1, p2] of playedSets) {
      if (p1 > p2) mySetsWon++;
    }
    const iWon = matchType === 'walkover'
      ? walkoverId === 'them'
      : matchType === 'retirement'
      ? retiredPlayer === 'them'
      : mySetsWon > (playedSets.length - mySetsWon);

    setLoading(true);
    const res = await fetch('/api/matches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        leagueId,
        opponentId: leagueType === 'doubles' ? opponent1 : opponent,
        player3Id: leagueType === 'doubles' ? myPartnerId : undefined,
        player4Id: leagueType === 'doubles' ? opponent2 : undefined,
        sets: matchType === 'walkover' ? [] : playedSets,
        tiebreaks: matchType === 'walkover' ? [] : playedTiebreaks,
        playedAt,
        matchType,
        retiredPlayer: matchType === 'retirement' ? retiredPlayer : undefined,
        walkoverId: matchType === 'walkover' ? walkoverId : undefined,
      }),
    });
    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error || 'Something went wrong');
      return;
    }

    if (iWon) {
      const btn = submitButtonRef.current;
      if (btn) {
        const rect = btn.getBoundingClientRect();
        setCelebrationOrigin({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
      } else {
        router.push(`/leagues/${leagueId}`);
      }
    } else {
      router.push(`/leagues/${leagueId}`);
    }
  }

  const myDisplayName = leagueType === 'doubles' && myPartnerName
    ? `${firstName(userName)} / ${firstName(myPartnerName)}`
    : userName;

  const selectedPair = opponentPairs.find((p) => `${p.p1Id}:${p.p2Id}` === selectedPairKey);
  const opponentDisplayName = leagueType === 'doubles'
    ? selectedPair ? selectedPair.label : 'Opponents'
    : players.find((p) => p.id === opponent)?.full_name ?? 'Opponent';

  return (
    <>
      {celebrationOrigin && (
        <TennisBallCelebration
          origin={celebrationOrigin}
          onDone={() => router.push(`/leagues/${leagueId}`)}
        />
      )}

      <div className="max-w-lg mx-auto">
        <h1 className="text-2xl font-bold text-gray-800 mb-6">Submit a result</h1>

        <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-6 sm:p-8 space-y-6">
          {leagueType === 'singles' ? (
            <div>
              <label htmlFor="opponent" className="block text-sm font-medium text-gray-700 mb-1">Opponent</label>
              <select
                id="opponent"
                value={opponent}
                onChange={(e) => setOpponent(e.target.value)}
                required
                className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
              >
                <option value="">
                  {players.length === 0 ? 'No remaining opponents' : 'Select opponent...'}
                </option>
                {players.map((p) => (
                  <option key={p.id} value={p.id}>{p.full_name}</option>
                ))}
              </select>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <p className="block text-sm font-medium text-gray-700 mb-1">Your partner</p>
                <div className="px-4 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-sm text-gray-700">
                  {myPartnerName || <span className="text-gray-400">No partner assigned</span>}
                </div>
              </div>
              <div>
                <label htmlFor="opponentPair" className="block text-sm font-medium text-gray-700 mb-1">Opponents</label>
                <select
                  id="opponentPair"
                  value={selectedPairKey}
                  onChange={(e) => {
                    const key = e.target.value;
                    setSelectedPairKey(key);
                    const pair = opponentPairs.find((p) => `${p.p1Id}:${p.p2Id}` === key);
                    setOpponent1(pair?.p1Id ?? '');
                    setOpponent2(pair?.p2Id ?? '');
                  }}
                  required
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                >
                  <option value="">
                    {opponentPairs.length === 0 ? 'No opponents available' : 'Select opponents...'}
                  </option>
                  {opponentPairs.map((p) => (
                    <option key={`${p.p1Id}:${p.p2Id}`} value={`${p.p1Id}:${p.p2Id}`}>{p.fullLabel}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <MatchScoreInputs
            myName={myDisplayName}
            opponentName={opponentDisplayName}
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

          <button
            ref={submitButtonRef}
            type="submit"
            disabled={loading}
            className="w-full bg-green-700 hover:bg-green-800 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg transition-colors text-sm"
          >
            {loading ? 'Submitting...' : 'Submit result'}
          </button>
        </form>
      </div>
    </>
  );
}

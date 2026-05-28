'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import TennisBallCelebration from '@/components/TennisBallCelebration';

type Player = { id: string; full_name: string };
type MatchType = 'normal' | 'walkover' | 'retirement';

function isTiebreakSet(set: { my: string; their: string }) {
  const my = parseInt(set.my);
  const their = parseInt(set.their);
  return (my === 7 && their === 6) || (my === 6 && their === 7);
}

export default function SubmitScoreForm({ userName }: { userName: string }) {
  const { id: leagueId } = useParams<{ id: string }>();
  const router = useRouter();

  const [players, setPlayers] = useState<Player[]>([]);
  const [opponent, setOpponent] = useState('');
  const [matchType, setMatchType] = useState<MatchType>('normal');
  const [retiredPlayer, setRetiredPlayer] = useState<'me' | 'them'>('them');
  const [walkoverId, setWalkoverId] = useState<'me' | 'them'>('them');
  const [sets, setSets] = useState([
    { my: '', their: '' },
    { my: '', their: '' },
    { my: '', their: '' },
  ]);
  const [tiebreaks, setTiebreaks] = useState([
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
        else setPlayers(data.players ?? []);
      })
      .catch(() => setError('Failed to load players'));
  }, [leagueId]);

  function updateSet(index: number, field: 'my' | 'their', value: string) {
    if (value !== '' && !/^\d+$/.test(value)) return;
    setSets((prev) => prev.map((s, i) => (i === index ? { ...s, [field]: value } : s)));
    setTiebreaks((prev) => prev.map((t, i) => {
      if (i !== index) return t;
      const updated = { ...sets[index], [field]: value };
      return isTiebreakSet(updated) ? t : { my: '', their: '' };
    }));
  }

  function updateTiebreak(index: number, field: 'my' | 'their', value: string) {
    if (value !== '' && !/^\d+$/.test(value)) return;
    setTiebreaks((prev) => prev.map((t, i) => (i === index ? { ...t, [field]: value } : t)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    const playedIndices = sets.reduce<number[]>((acc, s, i) => {
      if (s.my !== '' && s.their !== '') acc.push(i);
      return acc;
    }, []);

    // Validate normal matches need at least 2 sets
    if (matchType === 'normal' && playedIndices.length < 2) {
      setError('At least 2 sets must be entered.');
      return;
    }

    // Validate partial sets aren't half-filled
    for (const s of sets) {
      if ((s.my === '') !== (s.their === '')) {
        setError('Each set needs scores for both players.');
        return;
      }
    }

    const playedSets = playedIndices.map((i) => [parseInt(sets[i].my), parseInt(sets[i].their)]);
    const playedTiebreaks = playedIndices.map((i) => {
      const set = sets[i];
      if (!isTiebreakSet(set)) return null;
      const my = tiebreaks[i].my !== '' ? parseInt(tiebreaks[i].my) : null;
      const their = tiebreaks[i].their !== '' ? parseInt(tiebreaks[i].their) : null;
      if (my === null && their === null) return null;
      return [my ?? 0, their ?? 0];
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
        opponentId: opponent,
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
        setCelebrationOrigin({
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2,
        });
      } else {
        router.push(`/leagues/${leagueId}`);
      }
    } else {
      router.push(`/leagues/${leagueId}`);
    }
  }

  const opponentName = players.find((p) => p.id === opponent)?.full_name ?? 'Opponent';
  const anyTiebreak = sets.some(isTiebreakSet);

  const matchTypeLabels: Record<MatchType, string> = {
    normal: 'Normal',
    walkover: 'Walkover',
    retirement: 'Retirement',
  };

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

          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Match type</p>
            <div className="flex rounded-lg overflow-hidden border border-gray-300">
              {(['normal', 'walkover', 'retirement'] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setMatchType(type)}
                  className={`flex-1 py-2 text-sm font-medium transition-colors ${
                    matchType === type
                      ? 'bg-green-700 text-white'
                      : 'bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {matchTypeLabels[type]}
                </button>
              ))}
            </div>
          </div>

          {matchType === 'walkover' && (
            <div>
              <label htmlFor="walkoverId" className="block text-sm font-medium text-gray-700 mb-1">Who won?</label>
              <select
                id="walkoverId"
                value={walkoverId}
                onChange={(e) => setWalkoverId(e.target.value as 'me' | 'them')}
                className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
              >
                <option value="them">I won ({opponentName === 'Opponent' ? 'opponent' : opponentName} did not appear)</option>
                <option value="me">{opponentName === 'Opponent' ? 'Opponent' : opponentName} won (I did not appear)</option>
              </select>
            </div>
          )}

          {matchType !== 'walkover' && (
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="flex-1" />
                <span className="w-14 text-center text-xs text-gray-400 font-medium">Set 1</span>
                <span className="w-14 text-center text-xs text-gray-400 font-medium">Set 2</span>
                <span className="w-14 text-center text-xs text-gray-400 font-medium">Set 3</span>
              </div>

              <div className="flex items-center gap-3 mb-3">
                <span className="flex-1 text-sm font-medium text-gray-800 truncate">{userName}</span>
                {sets.map((set, i) => (
                  <input
                    key={i}
                    type="text"
                    inputMode="numeric"
                    value={set.my}
                    onChange={(e) => updateSet(i, 'my', e.target.value)}
                    className="w-14 px-2 py-2.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm text-center"
                    placeholder="-"
                  />
                ))}
              </div>

              <div className="flex items-center gap-3">
                <span className="flex-1 text-sm text-gray-500 truncate">{opponentName}</span>
                {sets.map((set, i) => (
                  <input
                    key={i}
                    type="text"
                    inputMode="numeric"
                    value={set.their}
                    onChange={(e) => updateSet(i, 'their', e.target.value)}
                    className="w-14 px-2 py-2.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm text-center"
                    placeholder="-"
                  />
                ))}
              </div>

              {matchType === 'retirement' && (
                <p className="mt-2 text-xs text-gray-400">Enter the sets completed before retirement. Partial sets are not counted.</p>
              )}

              {anyTiebreak && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <div className="flex items-start gap-3">
                    <span className="flex-1 text-xs text-gray-400 pt-1">Tiebreak</span>
                    {sets.map((set, i) => (
                      <div key={i} className="w-14">
                        {isTiebreakSet(set) ? (
                          <div className="space-y-1">
                            <input
                              type="text"
                              inputMode="numeric"
                              value={tiebreaks[i].my}
                              onChange={(e) => updateTiebreak(i, 'my', e.target.value)}
                              className="w-full px-1 py-1 rounded border border-gray-300 focus:outline-none focus:ring-1 focus:ring-green-500 text-xs text-center"
                              placeholder="Me"
                              maxLength={2}
                            />
                            <input
                              type="text"
                              inputMode="numeric"
                              value={tiebreaks[i].their}
                              onChange={(e) => updateTiebreak(i, 'their', e.target.value)}
                              className="w-full px-1 py-1 rounded border border-gray-300 focus:outline-none focus:ring-1 focus:ring-green-500 text-xs text-center"
                              placeholder="Opp"
                              maxLength={2}
                            />
                          </div>
                        ) : <div />}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {matchType === 'retirement' && (
            <div>
              <label htmlFor="retiredPlayer" className="block text-sm font-medium text-gray-700 mb-1">Who won?</label>
              <select
                id="retiredPlayer"
                value={retiredPlayer}
                onChange={(e) => setRetiredPlayer(e.target.value as 'me' | 'them')}
                className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
              >
                <option value="them">I won ({opponentName === 'Opponent' ? 'opponent' : opponentName} retired)</option>
                <option value="me">{opponentName === 'Opponent' ? 'Opponent' : opponentName} won (I retired)</option>
              </select>
            </div>
          )}

          <div>
            <label htmlFor="playedAt" className="block text-sm font-medium text-gray-700 mb-1">Date played</label>
            <input
              id="playedAt"
              type="date"
              value={playedAt}
              onChange={(e) => setPlayedAt(e.target.value)}
              required
              className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
          )}

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

'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Link from 'next/link';
import BackButton from '@/components/BackButton';
import MatchScoreInputs, {
  MatchType,
  isTiebreakSet,
  toFormSets,
  toFormTiebreaks,
} from '@/components/MatchScoreInputs';

export default function EditMatchForm({
  matchId,
  leagueId,
  leagueName,
  myId,
  myName,
  opponentId,
  opponentName,
  playedAt: initialPlayedAt,
  currentMyScore,
  currentTheirScore,
  setScores,
  tiebreakScores,
  existingMatchType,
  existingWinnerId,
  isSubmitter,
}: {
  matchId: string;
  leagueId: string;
  leagueName: string;
  myId: string;
  myName: string;
  opponentId: string;
  opponentName: string;
  playedAt: string;
  currentMyScore: number;
  currentTheirScore: number;
  setScores: [number, number][] | null;
  tiebreakScores: ([number, number] | null)[] | null;
  existingMatchType: string | null;
  existingWinnerId: string | null;
  isSubmitter: boolean;
}) {
  const router = useRouter();
  const [confirmed, setConfirmed] = useState(!isSubmitter);

  const formattedDate = new Date(initialPlayedAt + 'T00:00:00Z').toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
  });

  // Derive initial walkover/retirement selection from existing winner
  const initialWinnerChoice: 'me' | 'them' = existingWinnerId === myId ? 'them' : 'me';

  const [matchType, setMatchType] = useState<MatchType>((existingMatchType as MatchType | null) ?? 'normal');
  const [walkoverId, setWalkoverId] = useState<'me' | 'them'>(initialWinnerChoice);
  const [retiredPlayer, setRetiredPlayer] = useState<'me' | 'them'>(initialWinnerChoice);
  const [sets, setSets] = useState(toFormSets(setScores));
  const [tiebreaks, setTiebreaks] = useState(toFormTiebreaks(tiebreakScores));
  const [playedAt, setPlayedAt] = useState(initialPlayedAt);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

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

    const playedIndices = sets.reduce<number[]>((acc, s, i) => {
      if (s.my !== '' && s.their !== '') acc.push(i);
      return acc;
    }, []);
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

    if (matchType !== 'walkover' && playedSets.length < 2) {
      setError('At least 2 sets must be entered.');
      return;
    }

    setLoading(true);
    const body = isSubmitter
      ? {
          sets: matchType === 'walkover' ? [] : playedSets,
          tiebreaks: matchType === 'walkover' ? [] : playedTiebreaks,
          playedAt,
          matchType,
          walkoverId: matchType === 'walkover' ? walkoverId : undefined,
          retiredPlayer: matchType === 'retirement' ? retiredPlayer : undefined,
        }
      : {
          action: 'suggest-edit',
          sets: matchType === 'walkover' ? [] : playedSets,
          tiebreaks: matchType === 'walkover' ? [] : playedTiebreaks,
          playedAt,
          matchType,
          walkoverId: matchType === 'walkover' ? walkoverId : undefined,
          retiredPlayer: matchType === 'retirement' ? retiredPlayer : undefined,
        };

    const res = await fetch(`/api/matches/${matchId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error || 'Something went wrong');
      return;
    }

    router.push(isSubmitter ? `/leagues/${leagueId}` : `/leagues/${leagueId}/matches/${matchId}`);
  }

  async function handleDelete() {
    setDeleting(true);
    const res = await fetch(`/api/matches/${matchId}`, { method: 'DELETE' });
    setDeleting(false);
    if (res.ok) {
      router.push(`/leagues/${leagueId}`);
    } else {
      const data = await res.json();
      setError(data.error || 'Failed to delete match');
    }
  }

  const myWon = currentMyScore > currentTheirScore;

  return (
    <div className="max-w-lg mx-auto">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">
            {isSubmitter ? 'Edit result' : 'Suggest a correction'}
          </h1>
          <BackButton />
        </div>
        <Link href={`/leagues/${leagueId}`} className="text-sm text-green-700 hover:underline shrink-0 mt-1">
          {leagueName}
        </Link>
      </div>

      {/* Current result */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
              {isSubmitter ? 'Submitted result' : 'Current result'}
            </p>
            {existingMatchType === 'walkover' && (
              <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">Walkover</span>
            )}
            {existingMatchType === 'retirement' && (
              <span className="text-xs bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full">Retirement</span>
            )}
          </div>
          <span className="text-xs text-gray-400">{formattedDate}</span>
        </div>

        {existingMatchType === 'walkover' ? (
          <p className="text-sm text-center text-gray-500 py-1">
            {myWon ? 'You won' : `${opponentName} won`} by walkover
          </p>
        ) : (
          <>
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-1" />
              <span className="w-14 text-center text-xs text-gray-400 font-medium">Set 1</span>
              <span className="w-14 text-center text-xs text-gray-400 font-medium">Set 2</span>
              <span className="w-14 text-center text-xs text-gray-400 font-medium">Set 3</span>
            </div>

            <div className="flex items-center gap-3 mb-2">
              <Link href={`/players/${myId}`} className={`flex-1 text-sm font-medium truncate hover:underline ${myWon ? 'text-gray-800' : 'text-gray-400'}`}>{myName}</Link>
              {[0, 1, 2].map((i) => {
                const myTb = tiebreakScores?.[i] != null ? tiebreakScores![i]![0] : null;
                return (
                  <div key={i} className={`relative w-14 py-2 rounded-lg text-sm text-center font-medium ${
                    setScores?.[i]
                      ? setScores[i][0] > setScores[i][1] ? 'bg-green-50 text-green-700' : 'bg-gray-50 text-gray-400'
                      : 'text-gray-200'
                  }`}>
                    {setScores?.[i] ? setScores[i][0] : '-'}
                    {myTb !== null && (
                      <span className="absolute top-1 right-1.5 text-[10px] font-normal leading-none opacity-60">{myTb}</span>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex items-center gap-3">
              <Link href={`/players/${opponentId}`} className={`flex-1 text-sm font-medium truncate hover:underline ${!myWon ? 'text-gray-800' : 'text-gray-400'}`}>{opponentName}</Link>
              {[0, 1, 2].map((i) => {
                const theirTb = tiebreakScores?.[i] != null ? tiebreakScores![i]![1] : null;
                return (
                  <div key={i} className={`relative w-14 py-2 rounded-lg text-sm text-center font-medium ${
                    setScores?.[i]
                      ? setScores[i][1] > setScores[i][0] ? 'bg-green-50 text-green-700' : 'bg-gray-50 text-gray-400'
                      : 'text-gray-200'
                  }`}>
                    {setScores?.[i] ? setScores[i][1] : '-'}
                    {theirTb !== null && (
                      <span className="absolute top-1 right-1.5 text-[10px] font-normal leading-none opacity-60">{theirTb}</span>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}

        {!confirmed && (
          <button
            onClick={() => setConfirmed(true)}
            className="w-full mt-6 text-sm border border-gray-300 hover:border-red-400 hover:text-red-600 text-gray-600 font-medium py-2.5 rounded-lg transition-colors"
          >
            {isSubmitter ? 'Edit this result' : 'Suggest a correction'}
          </button>
        )}
      </div>

      {confirmed && (
        <>
          {isSubmitter ? (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3 mb-4 text-sm text-yellow-800">
              Are you sure you want to edit this previously submitted result?
            </div>
          ) : (
            <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 mb-4 text-sm text-blue-800">
              Enter the correct result below. {opponentName} will be asked to accept or decline.
            </div>
          )}

          <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-6 sm:p-8 space-y-6">

            <MatchScoreInputs
              myName={myName}
              opponentName={opponentName}
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
              {isSubmitter && (
                <button
                  type="button"
                  onClick={() => setConfirmed(false)}
                  className="flex-1 text-sm border border-gray-300 hover:border-gray-400 text-gray-600 font-medium py-2.5 rounded-lg transition-colors"
                >
                  Cancel
                </button>
              )}
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-green-700 hover:bg-green-800 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg transition-colors text-sm"
              >
                {loading
                  ? (isSubmitter ? 'Saving...' : 'Sending...')
                  : (isSubmitter ? 'Save changes' : `Send correction to ${opponentName}`)}
              </button>
            </div>
          </form>
        </>
      )}

      {isSubmitter && (
        <div className="mt-6 pt-5 border-t border-gray-200 px-6">
          {!deleteConfirm ? (
            <button onClick={() => setDeleteConfirm(true)} className="w-full text-sm border border-red-300 hover:border-red-500 text-red-500 hover:text-red-700 font-medium py-2.5 rounded-lg transition-colors">
              Delete this match
            </button>
          ) : (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-3">
              <p className="text-sm text-red-800 font-medium">Delete this match permanently?</p>
              <p className="text-xs text-red-600">This cannot be undone. The result will be removed from the league table.</p>
              {error && <p className="text-xs text-red-600">{error}</p>}
              <div className="flex gap-2">
                <button onClick={() => setDeleteConfirm(false)} disabled={deleting} className="flex-1 text-sm border border-gray-300 hover:border-gray-400 text-gray-600 font-medium py-2 rounded-lg transition-colors disabled:opacity-50">
                  Cancel
                </button>
                <button onClick={handleDelete} disabled={deleting} className="flex-1 text-sm bg-red-600 hover:bg-red-700 text-white font-medium py-2 rounded-lg transition-colors disabled:opacity-50">
                  {deleting ? 'Deleting...' : 'Yes, delete'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

'use client';

export type MatchType = 'normal' | 'walkover' | 'retirement';
export type TbEntry = { my: string; their: string };

export function isTiebreakSet(my: number, their: number): boolean {
  return (my === 7 && their === 6) || (my === 6 && their === 7);
}

function isSuspiciousScore(a: number, b: number): boolean {
  const winner = Math.max(a, b);
  const loser = Math.min(a, b);
  if (winner === 6 && loser <= 4) return false;  // 6-0 to 6-4
  if (winner === 7 && loser === 5) return false;  // 7-5
  if (winner === 7 && loser === 6) return false;  // 7-6 tiebreak
  return true;
}

export function toFormSets(setScores: [number, number][] | null): TbEntry[] {
  const base: TbEntry[] = [{ my: '', their: '' }, { my: '', their: '' }, { my: '', their: '' }];
  if (!setScores) return base;
  return base.map((_, i) =>
    setScores[i] ? { my: String(setScores[i][0]), their: String(setScores[i][1]) } : { my: '', their: '' }
  );
}

export function toFormTiebreaks(tiebreakScores: ([number, number] | null)[] | null): TbEntry[] {
  const base: TbEntry[] = [{ my: '', their: '' }, { my: '', their: '' }, { my: '', their: '' }];
  if (!tiebreakScores) return base;
  return base.map((_, i) =>
    tiebreakScores[i]
      ? { my: String(tiebreakScores[i]![0]), their: String(tiebreakScores[i]![1]) }
      : { my: '', their: '' }
  );
}

export default function MatchScoreInputs({
  myName,
  opponentName,
  matchType,
  setMatchType,
  walkoverId,
  setWalkoverId,
  retiredPlayer,
  setRetiredPlayer,
  sets,
  updateSet,
  tiebreaks,
  updateTiebreak,
  playedAt,
  setPlayedAt,
}: {
  myName: string;
  opponentName: string;
  matchType: MatchType;
  setMatchType: (t: MatchType) => void;
  walkoverId: 'me' | 'them';
  setWalkoverId: (v: 'me' | 'them') => void;
  retiredPlayer: 'me' | 'them';
  setRetiredPlayer: (v: 'me' | 'them') => void;
  sets: TbEntry[];
  updateSet: (i: number, field: 'my' | 'their', value: string) => void;
  tiebreaks: TbEntry[];
  updateTiebreak: (i: number, field: 'my' | 'their', value: string) => void;
  playedAt: string;
  setPlayedAt: (v: string) => void;
}) {
  const anyTiebreak = sets.some((s) => isTiebreakSet(parseInt(s.my), parseInt(s.their)));

  return (
    <>
      <div>
        <p className="text-sm font-medium text-gray-700 mb-2">Match type</p>
        <div className="flex rounded-lg overflow-hidden border border-gray-300">
          {(['normal', 'walkover', 'retirement'] as const).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setMatchType(type)}
              className={`flex-1 py-2 text-sm font-medium transition-colors ${
                matchType === type ? 'bg-green-700 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              {type.charAt(0).toUpperCase() + type.slice(1)}
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
            <option value="them">{myName} won ({opponentName} did not appear)</option>
            <option value="me">{opponentName} won ({myName} did not appear)</option>
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
            <span className="flex-1 text-sm font-medium text-gray-800 truncate">{myName}</span>
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
          {(() => {
            const suspicious = sets
              .map((s, i) => ({ i, my: parseInt(s.my), their: parseInt(s.their) }))
              .filter(({ my, their }) => !isNaN(my) && !isNaN(their) && isSuspiciousScore(my, their));
            if (!suspicious.length) return null;
            return (
              <div className="mt-3 flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5">
                <svg className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                </svg>
                <div>
                  <p className="text-xs font-medium text-amber-800">Double-check your scores</p>
                  <p className="text-xs text-amber-700 mt-0.5">
                    Sets are normally played to 6 games (or 7-5 / 7-6).{' '}
                    {suspicious.map(({ i, my, their }) => `Set ${i + 1}: ${my}-${their}`).join(', ')} {suspicious.length === 1 ? 'looks' : 'look'} unusual. If the match wasn&apos;t completed, use the <span className="font-medium">Retirement</span> match type instead.
                  </p>
                </div>
              </div>
            );
          })()}
          {anyTiebreak && (
            <div className="mt-3 pt-3 border-t border-gray-100">
              <div className="flex items-start gap-3">
                <span className="flex-1 text-xs text-gray-400 pt-1">Tiebreak</span>
                {sets.map((set, i) => {
                  const my = parseInt(set.my);
                  const their = parseInt(set.their);
                  return (
                    <div key={i} className="w-14">
                      {isTiebreakSet(my, their) ? (
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
                  );
                })}
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
            <option value="them">{myName} won ({opponentName} retired)</option>
            <option value="me">{opponentName} won ({myName} retired)</option>
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
    </>
  );
}

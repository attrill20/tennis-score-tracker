/**
 * Given the final standings of each division in a completed round (best player first,
 * divisions ordered top -> bottom), work out the membership of each division for the
 * next round after applying promotion and relegation.
 *
 * - The top `numPromoted` of each division (except the top division) move up one.
 * - The bottom `numRelegated` of each division (except the bottom division) move down one.
 * - Everyone else stays put.
 *
 * Pure and side-effect free so it can be unit tested without a database.
 */
export function computePromotionMoves(
  standings: string[][],
  numPromoted: number,
  numRelegated: number
): string[][] {
  const N = standings.length;
  const promotedOut: string[][] = [];
  const relegatedOut: string[][] = [];
  const stays: string[][] = [];

  for (let d = 0; d < N; d++) {
    const arr = standings[d];
    const pOut = d > 0 ? arr.slice(0, numPromoted) : [];
    const pSet = new Set(pOut);
    const remaining = arr.filter((id) => !pSet.has(id));
    const rOut = d < N - 1 ? remaining.slice(Math.max(0, remaining.length - numRelegated)) : [];
    const rSet = new Set(rOut);
    promotedOut[d] = pOut;
    relegatedOut[d] = rOut;
    stays[d] = remaining.filter((id) => !rSet.has(id));
  }

  const next: string[][] = [];
  for (let d = 0; d < N; d++) {
    const relegatedInFromAbove = d > 0 ? relegatedOut[d - 1] : [];
    const promotedInFromBelow = d < N - 1 ? promotedOut[d + 1] : [];
    next[d] = [...relegatedInFromAbove, ...stays[d], ...promotedInFromBelow];
  }
  return next;
}

export type ZeroMatchesPolicy = 'relegate' | 'double_relegate' | 'remove';

/**
 * Same as `computePromotionMoves`, but with a tournament-wide policy for players who
 * played zero matches in their division during the completed round - regardless of
 * where the normal standings sort happened to place them:
 *
 * - 'relegate': forced down one division, same destination as a normally-relegated player.
 * - 'double_relegate': forced down two divisions.
 * - 'remove': dropped from the tournament entirely - not carried into any division.
 *
 * A no-show occupies one of the division's existing `numRelegated` slots (as if ranked
 * last), topped up with the worst-ranked players who actually played if there's room left -
 * it never takes an *extra* slot on top of the normal count. A no-show is also never eligible
 * for promotion, regardless of how a tiebreaker might otherwise rank them. But every no-show is
 * still handled per the policy in full, however many there are - a division with more no-shows
 * than `numRelegated` doesn't cap out at the configured count, since the whole point is that no
 * non-participant is left undisturbed.
 *
 * Skipping a division ('double_relegate') or dropping out entirely ('remove') can leave a gap:
 * a division ends up with fewer players than it "should" have, because either it expected a
 * relegated arrival that skipped past it, or it lost more players (via a relegation slot no-show
 * took, uncapped) than the tournament's own promotion/relegation balance anticipates. Any such
 * gap is backfilled by promoting extra players - the next-best after the normal promotion
 * cutoff - up from the division below, cascading down through as many divisions as it takes.
 * "Should have" is judged against a baseline: what `computePromotionMoves` would produce if every
 * no-show were simply treated as an ordinary player finishing in their standings position - this
 * captures whatever a division's size naturally is under this tournament's own numPromoted/
 * numRelegated configuration (which can already differ a little from its starting size when the
 * two aren't equal, independent of this feature entirely), so the policy only ever corrects
 * drift it introduces, never any pre-existing asymmetry.
 *
 * For 'relegate'/'double_relegate' nobody actually leaves the tournament, so this cascade always
 * fully resolves - every division ends up exactly at its baseline size, including the bottom one.
 * For 'remove', the tournament's total population genuinely shrinks, so the cascade can only ever
 * partially resolve: whichever division runs out of players below it to pull from (typically the
 * bottom) permanently absorbs the shortfall, same as if those players had withdrawn.
 */
export function computePromotionMovesWithNoShows(
  standings: { id: string; played: number }[][],
  numPromoted: number,
  numRelegated: number,
  noShowPolicy: ZeroMatchesPolicy
): string[][] {
  const N = standings.length;
  const playedByDivision = standings.map((division) => division.filter((p) => p.played > 0).map((p) => p.id));
  const noShowsByDivision = standings.map((division) => division.filter((p) => p.played === 0).map((p) => p.id));

  // What each division's size would naturally be if no-shows were just ordinary players -
  // the target this function restores to wherever the no-show policy creates a shortfall.
  const baselineSizes = computePromotionMoves(
    standings.map((division) => division.map((p) => p.id)),
    numPromoted,
    numRelegated
  ).map((division) => division.length);

  // Only players who actually played are ever eligible for promotion.
  const promotedOut: string[][] = playedByDivision.map((ids, d) => (d > 0 ? ids.slice(0, numPromoted) : []));

  // Players who actually played and were relegated (no-shows are carved out separately below
  // and routed per-policy, so they're excluded here even though they occupy one of the slots).
  const relegatedPlayedOut: string[][] = [];
  const stays: string[][] = [];
  for (let d = 0; d < N; d++) {
    const promoted = new Set(promotedOut[d]);
    const remainingPlayed = playedByDivision[d].filter((id) => !promoted.has(id));
    if (d === N - 1) {
      // Bottom division never relegates out. Its own no-shows have nowhere lower to go, so they
      // simply stay put - unless the policy removes them from the tournament outright.
      relegatedPlayedOut[d] = [];
      stays[d] = noShowPolicy === 'remove' ? remainingPlayed : [...remainingPlayed, ...noShowsByDivision[d]];
      continue;
    }
    const slotsForPlayed = Math.max(0, numRelegated - noShowsByDivision[d].length);
    const playedRelegated = remainingPlayed.slice(Math.max(0, remainingPlayed.length - slotsForPlayed));
    const playedRelegatedSet = new Set(playedRelegated);
    relegatedPlayedOut[d] = playedRelegated;
    stays[d] = remainingPlayed.filter((id) => !playedRelegatedSet.has(id));
  }

  const next: string[][] = [];
  for (let d = 0; d < N; d++) {
    const relegatedInFromAbove = d > 0 ? relegatedPlayedOut[d - 1] : [];
    const promotedInFromBelow = d < N - 1 ? promotedOut[d + 1] : [];
    next[d] = [...relegatedInFromAbove, ...stays[d], ...promotedInFromBelow];
  }

  // Route each division's no-shows per policy, in full - uncapped, regardless of numRelegated.
  for (let d = 0; d < N - 1; d++) {
    const noShows = noShowsByDivision[d];
    if (noShows.length === 0 || noShowPolicy === 'remove') continue;
    const hop = noShowPolicy === 'double_relegate' ? 2 : 1;
    const target = Math.min(d + hop, N - 1);
    next[target].push(...noShows);
  }

  // Backfill top-down: whatever a division is short of its baseline size gets pulled up from the
  // division below (its next-best players, immediately after the normal promotion cutoff).
  // Consuming from `stays[d + 1]` means a division that donates upward here will, in its own
  // turn, see the resulting shortfall and pull up from the division below it in turn - the
  // cascade that lets a gap anywhere ripple down to wherever there's still slack to absorb it.
  for (let d = 0; d < N - 1; d++) {
    const deficit = baselineSizes[d] - next[d].length;
    if (deficit <= 0) continue;
    const extra = stays[d + 1].splice(0, deficit);
    const extraSet = new Set(extra);
    next[d + 1] = next[d + 1].filter((id) => !extraSet.has(id));
    next[d].push(...extra);
  }

  return next;
}

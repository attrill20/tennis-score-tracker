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

import { computePromotionMoves } from '@/lib/promotion';

// Standings are best-first within each division; divisions are ordered top -> bottom.
describe('computePromotionMoves', () => {
  it('promotes the top N up and relegates the bottom N down between three divisions', () => {
    const standings = [
      ['a1', 'a2', 'a3', 'a4'], // Division 1 (top)
      ['b1', 'b2', 'b3', 'b4'], // Division 2 (middle)
      ['c1', 'c2', 'c3', 'c4'], // Division 3 (bottom)
    ];

    const next = computePromotionMoves(standings, 1, 1);

    // Div 1: keeps top 3, loses a4 (relegated), gains b1 (promoted up from Div 2).
    expect(next[0]).toEqual(['a1', 'a2', 'a3', 'b1']);
    // Div 2: gains a4 from above, keeps b2/b3, loses b1 (up) and b4 (down), gains c1 from below.
    expect(next[1]).toEqual(['a4', 'b2', 'b3', 'c1']);
    // Div 3 (bottom): gains b4 from above, loses c1 (promoted up), keeps c2..c4.
    expect(next[2]).toEqual(['b4', 'c2', 'c3', 'c4']);
  });

  it('top division never promotes out and bottom division never relegates out', () => {
    const standings = [
      ['a1', 'a2', 'a3'],
      ['b1', 'b2', 'b3'],
    ];

    const next = computePromotionMoves(standings, 1, 1);

    // Div 1 keeps its top 2 (no promotion above), gains b1 from below, loses a3 down.
    expect(next[0]).toEqual(['a1', 'a2', 'b1']);
    // Div 2 gains a3 from above, keeps b2/b3 (b3 cannot relegate further), loses b1 up.
    expect(next[1]).toEqual(['a3', 'b2', 'b3']);
    // No player is lost or duplicated overall.
    expect([...next[0], ...next[1]].sort()).toEqual(['a1', 'a2', 'a3', 'b1', 'b2', 'b3']);
  });

  it('with promoted=0 and relegated=0 everyone stays put', () => {
    const standings = [
      ['a1', 'a2'],
      ['b1', 'b2'],
    ];
    expect(computePromotionMoves(standings, 0, 0)).toEqual(standings);
  });

  it('promotes/relegates two at a time', () => {
    const standings = [
      ['a1', 'a2', 'a3', 'a4', 'a5'],
      ['b1', 'b2', 'b3', 'b4', 'b5'],
    ];

    const next = computePromotionMoves(standings, 2, 2);

    // Div 1: keeps a1..a3, loses a4/a5 down, gains b1/b2 up.
    expect(next[0]).toEqual(['a1', 'a2', 'a3', 'b1', 'b2']);
    // Div 2: gains a4/a5 from above, keeps b3 (b1/b2 promoted, b4/b5 cannot relegate further).
    expect(next[1]).toEqual(['a4', 'a5', 'b3', 'b4', 'b5']);
    // Conservation: same multiset of players.
    expect([...next[0], ...next[1]].sort()).toEqual(
      [...standings[0], ...standings[1]].sort()
    );
  });

  it('does not promote and relegate the same player when a division is small', () => {
    const standings = [
      ['a1', 'a2'],
      ['b1', 'b2'],
      ['c1', 'c2'],
    ];

    const next = computePromotionMoves(standings, 1, 1);
    const flat = [...next[0], ...next[1], ...next[2]];
    // Every player appears exactly once across all divisions.
    expect(flat.sort()).toEqual(['a1', 'a2', 'b1', 'b2', 'c1', 'c2']);
    expect(new Set(flat).size).toBe(6);
  });
});

import { computePromotionMoves, computePromotionMovesWithNoShows } from '@/lib/promotion';

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

// Standings here are {id, played} best-first per division, same division ordering as above.
describe('computePromotionMovesWithNoShows', () => {
  function p(id: string, played: number) {
    return { id, played };
  }

  const threeDivisions = [
    [p('a1', 5), p('a2', 0), p('a3', 3), p('a4', 2)],
    [p('b1', 4), p('b2', 4), p('b3', 4), p('b4', 4)],
    [p('c1', 4), p('c2', 4), p('c3', 4), p('c4', 4)],
  ];

  it('relegate: forces a zero-match player down one division, occupying one of the existing relegation slots (not an extra one)', () => {
    const next = computePromotionMovesWithNoShows(threeDivisions, 1, 1, 'relegate');

    // a2 (no-show) takes the division's one relegation slot, so no played player is relegated
    // alongside them - a3/a4 both stay, exactly as if a2 had simply finished bottom.
    expect(next[0]).toEqual(['a1', 'a3', 'a4', 'b1']);
    expect(next[1]).toEqual(['b2', 'b3', 'c1', 'a2']);
    expect(next[2]).toEqual(['b4', 'c2', 'c3', 'c4']);
    // Every division keeps its original size (4 -> 4 -> 4): no drift from the no-show.
    expect(next.map((d) => d.length)).toEqual([4, 4, 4]);
  });

  it('double_relegate: forces a zero-match player down two divisions, and the landing division promotes an extra player up to the skipped division to keep sizes balanced', () => {
    const next = computePromotionMovesWithNoShows(threeDivisions, 1, 1, 'double_relegate');

    expect(next[0]).toEqual(['a1', 'a3', 'a4', 'b1']);
    // Division 2 (skipped over by a2) is short one arrival from above, so division 3 (where a2
    // landed) sends its next-best player (c2, immediately after the normally-promoted c1) up to
    // compensate - "3rd place" effectively also gets promoted.
    expect(next[1]).toEqual(['b2', 'b3', 'c1', 'c2']);
    expect(next[2]).toEqual(['b4', 'c3', 'c4', 'a2']);
    // Every division keeps its original size (4 -> 4 -> 4) despite the two-division skip.
    expect(next.map((d) => d.length)).toEqual([4, 4, 4]);
  });

  it('remove: drops a zero-match player from the tournament entirely', () => {
    const next = computePromotionMovesWithNoShows(threeDivisions, 1, 1, 'remove');
    const flat = [...next[0], ...next[1], ...next[2]];

    expect(flat).not.toContain('a2');
    expect(flat.sort()).toEqual(['a1', 'a3', 'a4', 'b1', 'b2', 'b3', 'b4', 'c1', 'c2', 'c3', 'c4'].sort());
  });

  it('clamps a relegated/double-relegated zero-match player at the bottom division', () => {
    const twoDivisionsWithBottomNoShow = [
      [p('a1', 4), p('a2', 4)],
      [p('b1', 4), p('b2', 0)],
    ];

    const relegated = computePromotionMovesWithNoShows(twoDivisionsWithBottomNoShow, 0, 0, 'relegate');
    expect(relegated[1]).toContain('b2');

    const doubleRelegated = computePromotionMovesWithNoShows(twoDivisionsWithBottomNoShow, 0, 0, 'double_relegate');
    expect(doubleRelegated[1]).toContain('b2');
  });

  it('relegate: more no-shows than relegation slots all still relegate, and the source division is fully backfilled from below', () => {
    const withExcessNoShows = [
      [p('a1', 4), p('a2', 0), p('a3', 0), p('a4', 0), p('a5', 4)],
      [p('b1', 4), p('b2', 4)],
    ];

    const next = computePromotionMovesWithNoShows(withExcessNoShows, 0, 1, 'relegate');

    // All 3 no-shows relegate down together, even though numRelegated is only 1 - the policy
    // applies to every zero-match player, not just up to the configured relegation count. That
    // leaves division 0 three short of its baseline size (4) instead of the usual one, so both
    // of division 1's players get pulled up to fully restore it.
    expect(next[0]).toEqual(['a1', 'a5', 'b1', 'b2']);
    expect(next[1]).toEqual(['a2', 'a3', 'a4']);
    expect(next.map((d) => d.length)).toEqual([4, 3]);
  });

  it('double_relegate: an unusually large batch of no-shows cascades a full backfill through as many divisions as it takes', () => {
    const fourDivisionsWithExcessNoShows = [
      [p('o1', 4), p('o2', 4), p('o3', 4), p('o4', 4)],
      [p('p1', 4), p('p2', 4), p('p3', 4), p('n1', 0), p('n2', 0), p('n3', 0), p('n4', 0), p('n5', 0)],
      [p('c1', 4), p('c2', 4), p('c3', 4), p('c4', 4), p('c5', 4), p('c6', 4), p('c7', 4), p('c8', 4)],
      [p('e1', 4), p('e2', 4), p('e3', 4), p('e4', 4), p('e5', 4), p('e6', 4), p('e7', 4), p('e8', 4)],
    ];

    const next = computePromotionMovesWithNoShows(fourDivisionsWithExcessNoShows, 1, 2, 'double_relegate');

    // Division 1 (the source) loses all 5 no-shows plus its usual promoted-out player - far more
    // than its usual 3 departures - so it's backfilled from division 2's next-best players.
    expect(next[1]).toEqual(['o3', 'o4', 'p2', 'p3', 'c1', 'c2', 'c3', 'c4']);
    // Division 2 (skipped over by all 5 no-shows) is, in turn, backfilled from division 3.
    expect(next[2]).toEqual(['c5', 'c6', 'e1', 'e2', 'e3', 'e4', 'e5', 'e6']);
    // All 5 no-shows land in division 3, and it donated 5 players upward to cover the cascade -
    // it's below its own baseline size, exactly matching what this tournament's numPromoted(1)/
    // numRelegated(2) asymmetry would naturally produce anyway, unrelated to the no-shows.
    expect(next[3]).toEqual(['c7', 'c8', 'e7', 'e8', 'n1', 'n2', 'n3', 'n4', 'n5']);
    // Every division matches this tournament's own baseline sizing (computePromotionMoves with no
    // no-shows at all) - the drift caused by the no-shows themselves is fully absorbed, leaving
    // only the pre-existing, unrelated asymmetry from numPromoted != numRelegated at the bottom.
    const baseline = computePromotionMoves(
      fourDivisionsWithExcessNoShows.map((division) => division.map((pl) => pl.id)),
      1,
      2
    ).map((division) => division.length);
    expect(next.map((d) => d.length)).toEqual(baseline);
    expect(baseline).toEqual([3, 8, 8, 9]);
  });

  it('remove: backfills gaps from below, cascading until the bottom division absorbs the population loss', () => {
    const threeDivisionsWithRemovals = [
      [p('a1', 4), p('a2', 4), p('a3', 4), p('a4', 4)],
      [p('b1', 4), p('b2', 0), p('b3', 0), p('b4', 4)],
      [p('c1', 4), p('c2', 4), p('c3', 4), p('c4', 4)],
    ];

    const next = computePromotionMovesWithNoShows(threeDivisionsWithRemovals, 1, 1, 'remove');
    const flat = [...next[0], ...next[1], ...next[2]];

    expect(flat).not.toContain('b2');
    expect(flat).not.toContain('b3');
    // Division 1 (the source) loses both removed players but is fully backfilled from division 2.
    expect(next[1].length).toBe(4);
    // The two removed players permanently shrink the tournament by 2 - that loss surfaces at the
    // bottom division, which has nothing below it to backfill from.
    expect(next[2].length).toBe(2);
    expect(next.map((d) => d.length)).toEqual([4, 4, 2]);
    // Total population conserved minus the two removed players (12 - 2 = 10).
    expect(flat.length).toBe(10);
  });

  it('double_relegate: compensates the correct skipped division when the no-show is not in the top division', () => {
    const fourDivisions = [
      [p('a1', 4), p('a2', 4)],
      [p('b1', 4), p('b2', 0), p('b3', 4)],
      [p('c1', 4), p('c2', 4), p('c3', 4)],
      [p('d1', 4), p('d2', 4), p('d3', 4)],
    ];

    const next = computePromotionMovesWithNoShows(fourDivisions, 1, 1, 'double_relegate');

    expect(next[0]).toEqual(['a1', 'b1']);
    expect(next[1]).toEqual(['a2', 'b3', 'c1']);
    // Division index 2 is the one skipped over by b2 - it gets d2 promoted up to compensate.
    expect(next[2]).toEqual(['c2', 'd1', 'd2']);
    // Division index 3 is where b2 lands.
    expect(next[3]).toEqual(['c3', 'd3', 'b2']);
    expect(next.map((d) => d.length)).toEqual([2, 3, 3, 3]);
  });

  it('players who played at least one match are unaffected by the policy', () => {
    const noNoShows = [
      [p('a1', 3), p('a2', 2)],
      [p('b1', 1), p('b2', 1)],
    ];

    expect(computePromotionMovesWithNoShows(noNoShows, 1, 1, 'remove')).toEqual(
      computePromotionMoves([['a1', 'a2'], ['b1', 'b2']], 1, 1)
    );
  });
});

import { computeSuggestedDivisions, type RegistrationForRanking } from '@/lib/registration';

function reg(id: string, ability: RegistrationForRanking['ability_level']): RegistrationForRanking {
  return { id, ability_level: ability };
}

describe('computeSuggestedDivisions', () => {
  it('sorts strongest ability level into the top division', () => {
    const regs = [
      reg('beginner-1', 'beginner'),
      reg('top-1', 'parks_1sts_b'),
      reg('mid-1', 'intermediate'),
      reg('upper-mid-1', 'parks_c_e'),
    ];

    const result = computeSuggestedDivisions(regs, 4);

    expect(result.get('top-1')).toBe(1);
    expect(result.get('upper-mid-1')).toBe(2);
    expect(result.get('mid-1')).toBe(3);
    expect(result.get('beginner-1')).toBe(4);
  });

  it('ranks improver between beginner and intermediate', () => {
    const regs = [
      reg('beginner-1', 'beginner'),
      reg('improver-1', 'improver'),
      reg('intermediate-1', 'intermediate'),
    ];

    const result = computeSuggestedDivisions(regs, 3);

    expect(result.get('intermediate-1')).toBe(1);
    expect(result.get('improver-1')).toBe(2);
    expect(result.get('beginner-1')).toBe(3);
  });

  it('splits into roughly-equal groups, giving earlier divisions the extra when uneven', () => {
    const regs = Array.from({ length: 7 }, (_, i) => reg(`p${i}`, 'intermediate'));

    const result = computeSuggestedDivisions(regs, 3);
    const counts = [1, 2, 3].map((d) => [...result.values()].filter((v) => v === d).length);

    expect(counts).toEqual([3, 2, 2]);
    expect(result.size).toBe(7);
  });

  it('returns an empty map for no registrations', () => {
    expect(computeSuggestedDivisions([], 3).size).toBe(0);
  });
});

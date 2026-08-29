import { computeSuggestedDivisions, type RegistrationForRanking } from '@/lib/registration';

function reg(id: string, ability: RegistrationForRanking['ability_level'], previousDivision?: string | null): RegistrationForRanking {
  return { id, ability_level: ability, previous_division: previousDivision ?? null };
}

describe('computeSuggestedDivisions', () => {
  it('maps the strongest and weakest ability levels to the top and bottom divisions', () => {
    const regs = [reg('top', 'parks_thursdays'), reg('bottom', 'beginner')];

    const result = computeSuggestedDivisions(regs, 10);

    expect(result.get('top')).toBe(1);
    expect(result.get('bottom')).toBe(10);
  });

  it('does not cluster registrants together just because divisions are under-subscribed', () => {
    // Only two registrants across a 10-division tournament - each should still land at their
    // own intrinsic level, not be pulled together into divisions 1 and 2.
    const regs = [reg('top', 'parks_thursdays'), reg('bottom', 'beginner')];

    const result = computeSuggestedDivisions(regs, 10);

    expect(result.get('top')).toBe(1);
    expect(result.get('bottom')).toBe(10);
  });

  it('scales intermediate ability levels proportionally across the division count', () => {
    const regs = [
      reg('beginner-1', 'beginner'),
      reg('improver-1', 'improver'),
      reg('intermediate-1', 'intermediate'),
      reg('tuesdays-1', 'parks_tuesdays'),
      reg('wednesdays-1', 'parks_wednesdays'),
      reg('thursdays-1', 'parks_thursdays'),
    ];

    // 6 ability levels onto 6 divisions maps one-to-one, strongest -> 1.
    const result = computeSuggestedDivisions(regs, 6);

    expect(result.get('thursdays-1')).toBe(1);
    expect(result.get('wednesdays-1')).toBe(2);
    expect(result.get('tuesdays-1')).toBe(3);
    expect(result.get('intermediate-1')).toBe(4);
    expect(result.get('improver-1')).toBe(5);
    expect(result.get('beginner-1')).toBe(6);
  });

  it('uses a valid previous_division answer directly, overriding the ability-based estimate', () => {
    const regs = [reg('was-in-3', 'beginner', '3')];

    const result = computeSuggestedDivisions(regs, 10);

    expect(result.get('was-in-3')).toBe(3);
  });

  it('clamps an out-of-range previous_division answer into the current division count', () => {
    const regs = [reg('was-in-15', 'intermediate', '15')];

    const result = computeSuggestedDivisions(regs, 5);

    expect(result.get('was-in-15')).toBe(5);
  });

  it('falls back to the ability-based estimate when previous_division is missing or invalid', () => {
    const regs = [reg('no-answer', 'beginner'), reg('garbage-answer', 'beginner', 'not-a-number')];

    const result = computeSuggestedDivisions(regs, 10);

    expect(result.get('no-answer')).toBe(10);
    expect(result.get('garbage-answer')).toBe(10);
  });

  it('returns an empty map for no registrations or no divisions', () => {
    expect(computeSuggestedDivisions([], 5).size).toBe(0);
    expect(computeSuggestedDivisions([reg('p1', 'intermediate')], 0).size).toBe(0);
  });
});

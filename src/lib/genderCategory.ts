export type GenderCategory = 'mens' | 'womens' | 'either' | 'mixed' | 'open';

export const SINGLES_GENDER_OPTIONS: [GenderCategory, string][] = [
  ['either', 'Either'],
  ['mens', "Men's"],
  ['womens', "Women's"],
];

export const DOUBLES_GENDER_OPTIONS: [GenderCategory, string][] = [
  ['open', 'Open'],
  ['mens', "Men's"],
  ['womens', "Women's"],
  ['mixed', 'Mixed'],
];

export const GENDER_CATEGORY_LABELS: Record<GenderCategory, string> = {
  mens: "Men's",
  womens: "Women's",
  either: 'Either',
  mixed: 'Mixed',
  open: 'Open',
};

export function defaultGenderCategory(leagueType: string): GenderCategory {
  return leagueType === 'doubles' ? 'open' : 'either';
}

export function validGenderCategories(leagueType: string): GenderCategory[] {
  return (leagueType === 'doubles' ? DOUBLES_GENDER_OPTIONS : SINGLES_GENDER_OPTIONS).map(([v]) => v);
}

/** Individual eligibility - a single player's gender against a league's category. */
export function individualEligible(
  category: string,
  gender: string | null,
  playerName?: string
): { eligible: boolean; reason?: string } {
  if (category === 'either' || category === 'open') return { eligible: true };

  const who = playerName ? `${playerName} - ` : '';

  if (category === 'mens' || category === 'womens') {
    const label = GENDER_CATEGORY_LABELS[category as GenderCategory];
    if (!gender) return { eligible: false, reason: `${who}this is a ${label} league. Please set your gender in your profile to confirm eligibility.` };
    return gender === category
      ? { eligible: true }
      : { eligible: false, reason: `${who}this is a ${label} league.` };
  }

  if (category === 'mixed') {
    if (!gender) return { eligible: false, reason: `${who}this is a Mixed doubles league. Please set your gender in your profile to confirm eligibility.` };
    return { eligible: true };
  }

  return { eligible: true };
}

/** Pair eligibility - only Mixed doubles imposes a rule (one of each gender). */
export function pairEligible(
  category: string,
  genderA: string | null,
  genderB: string | null
): { eligible: boolean; reason?: string } {
  if (category !== 'mixed') return { eligible: true };
  if (!genderA || !genderB) {
    return { eligible: false, reason: "Mixed doubles pairs need one Men's and one Women's player - one or both players haven't set a gender." };
  }
  return genderA !== genderB
    ? { eligible: true }
    : { eligible: false, reason: "Mixed doubles pairs need one Men's and one Women's player." };
}

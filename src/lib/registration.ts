export type AbilityLevel = 'beginner' | 'improver' | 'intermediate' | 'parks_tuesdays' | 'parks_wednesdays' | 'parks_thursdays';

// Ordered weakest -> strongest so array index doubles as a rank.
export const ABILITY_LEVELS: [AbilityLevel, string][] = [
  ['beginner', 'Beginner'],
  ['improver', 'Improver'],
  ['intermediate', 'Intermediate'],
  ['parks_tuesdays', 'Parks League Tuesdays'],
  ['parks_wednesdays', 'Parks League Wednesdays'],
  ['parks_thursdays', 'Parks League Thursdays'],
];

export const ABILITY_LEVEL_LABELS: Record<AbilityLevel, string> = Object.fromEntries(ABILITY_LEVELS) as Record<AbilityLevel, string>;

export function isValidAbilityLevel(value: unknown): value is AbilityLevel {
  return typeof value === 'string' && ABILITY_LEVELS.some(([v]) => v === value);
}

function abilityRank(level: AbilityLevel): number {
  return ABILITY_LEVELS.findIndex(([v]) => v === level);
}

export type RegistrationForRanking = {
  id: string;
  ability_level: AbilityLevel;
  // Answer to the DEFAULT_REGISTRATION_QUESTIONS 'previous_division' question below, if the
  // tournament asked it and the player answered - a lower number is a stronger recent finish.
  previous_division?: string | null;
};

/** Parses a 'previous_division' answer into a division number, clamped into range - or null if absent/invalid. */
function parsePreviousDivision(value: string | null | undefined, numDivisions: number): number | null {
  const n = value ? parseInt(value, 10) : NaN;
  if (!Number.isFinite(n) || n < 1) return null;
  return Math.min(numDivisions, n);
}

/** Scales the fixed 6-level ability spectrum proportionally onto however many divisions this tournament has. */
function abilityToDivision(level: AbilityLevel, numDivisions: number): number {
  if (numDivisions <= 1) return 1;
  const maxRank = ABILITY_LEVELS.length - 1;
  const rank = abilityRank(level);
  // rank 0 (beginner, weakest) -> bottom division; maxRank (strongest) -> division 1 (top).
  const scaled = Math.round(((maxRank - rank) / maxRank) * (numDivisions - 1)) + 1;
  return Math.min(numDivisions, Math.max(1, scaled));
}

/**
 * Suggests each registration's best-fit division purely on its own merits - the division their
 * ability intrinsically suggests they belong in - regardless of how many other people have
 * registered so far or how full divisions currently are. A lightly-subscribed round should still
 * place a beginner near the bottom and a strong player at the top, leaving gaps in between for
 * admins to fill in manually, rather than clustering everyone into whichever divisions happen to
 * have registrants purely because there's room.
 *
 * When available, the 'previous_division' answer (which division they actually finished in last
 * season, if the tournament asked) is used directly as their target - a far more precise signal
 * than the coarse 6-level `ability_level`. Otherwise ability_level is scaled proportionally
 * across however many divisions this tournament has.
 *
 * This never checks division capacity - it's a best-fit suggestion, not a bin-packing solver. If
 * several registrants land on the same division, the admin resolves that by hand (drag-and-drop,
 * or the "+ Add player" picker) same as any other manual adjustment.
 *
 * Pure and side-effect free so it can be unit tested without a database.
 */
export function computeSuggestedDivisions(
  registrations: RegistrationForRanking[],
  numDivisions: number
): Map<string, number> {
  const result = new Map<string, number>();
  if (numDivisions < 1) return result;

  for (const r of registrations) {
    const division = parsePreviousDivision(r.previous_division, numDivisions) ?? abilityToDivision(r.ability_level, numDivisions);
    result.set(r.id, division);
  }

  return result;
}

// --- Custom registration questions ---
// Ability level (above) is always asked and is not part of this list. Everything else on the
// form is admin-configurable per tournament and stored as this ordered question list.

export type QuestionType = 'single_choice' | 'short_text' | 'long_text';

export type RegistrationQuestion = {
  id: string;
  type: QuestionType;
  label: string;
  options?: string[];
  required: boolean;
};

export const DEFAULT_REGISTRATION_QUESTIONS: RegistrationQuestion[] = [
  {
    id: 'previous_division',
    type: 'single_choice',
    label: 'If you played Winter League last season, which division did you finish in',
    options: ['10', '9', '8', '7', '6', '5', '4', '3', '2', '1'],
    required: false,
  },
  { id: 'similar_player_1', type: 'short_text', label: 'My standard of tennis is similar to this QPTC member', required: false },
  { id: 'similar_player_2', type: 'short_text', label: 'My standard of tennis is similar to this QPTC member', required: false },
  { id: 'similar_player_3', type: 'short_text', label: 'My standard of tennis is similar to this QPTC member', required: false },
  { id: 'notes', type: 'long_text', label: 'Any other notes', required: false },
];

const QUESTION_TYPES: QuestionType[] = ['single_choice', 'short_text', 'long_text'];

/** Validates an admin-submitted set of custom registration questions. Returns 'invalid' on any problem. */
export function validateRegistrationQuestions(value: unknown): RegistrationQuestion[] | 'invalid' {
  if (!Array.isArray(value)) return 'invalid';

  const cleaned: RegistrationQuestion[] = [];
  const seenIds = new Set<string>();

  for (const raw of value) {
    if (!raw || typeof raw !== 'object') return 'invalid';
    const { id, type, label, options, required } = raw as Record<string, unknown>;

    if (typeof id !== 'string' || id.trim() === '' || seenIds.has(id)) return 'invalid';
    if (typeof type !== 'string' || !QUESTION_TYPES.includes(type as QuestionType)) return 'invalid';
    if (typeof label !== 'string' || label.trim() === '') return 'invalid';

    let cleanOptions: string[] | undefined;
    if (type === 'single_choice') {
      if (!Array.isArray(options)) return 'invalid';
      cleanOptions = options.filter((o): o is string => typeof o === 'string' && o.trim() !== '').map((o) => o.trim());
      if (cleanOptions.length < 2) return 'invalid';
    }

    seenIds.add(id);
    cleaned.push({ id, type: type as QuestionType, label: label.trim(), options: cleanOptions, required: required === true });
  }

  return cleaned;
}

/** Validates a member's submitted answers against the tournament's question definitions, returning cleaned answers ready to store. */
export function validateAnswers(questions: RegistrationQuestion[], value: unknown): Record<string, string> | 'invalid' {
  if (typeof value !== 'object' || value === null) return 'invalid';
  const input = value as Record<string, unknown>;
  const cleaned: Record<string, string> = {};

  for (const q of questions) {
    const raw = input[q.id];
    const answer = typeof raw === 'string' ? raw.trim() : '';

    if (q.required && answer === '') return 'invalid';
    if (answer === '') continue;
    if (q.type === 'single_choice' && !(q.options ?? []).includes(answer)) return 'invalid';

    cleaned[q.id] = answer;
  }

  return cleaned;
}

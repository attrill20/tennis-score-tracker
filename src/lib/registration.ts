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

export type RegistrationForRanking = { id: string; ability_level: AbilityLevel };

/**
 * Suggests which division each pending registration might best fit, purely as a hint for
 * the admin doing the actual assignment. Ability level is the one question every registration
 * form always asks, so it's the only thing this ranks on - sorts strongest-first, then splits
 * the sorted list into `numDivisions` roughly-equal groups.
 *
 * Pure and side-effect free so it can be unit tested without a database.
 */
export function computeSuggestedDivisions(
  registrations: RegistrationForRanking[],
  numDivisions: number
): Map<string, number> {
  const sorted = [...registrations].sort((a, b) => abilityRank(b.ability_level) - abilityRank(a.ability_level));

  const result = new Map<string, number>();
  const n = sorted.length;
  if (n === 0 || numDivisions < 1) return result;

  const baseSize = Math.floor(n / numDivisions);
  const remainder = n % numDivisions;

  let index = 0;
  for (let division = 1; division <= numDivisions && index < n; division++) {
    // Earlier divisions absorb the one extra registrant each when it doesn't divide evenly.
    const size = baseSize + (division <= remainder ? 1 : 0);
    for (let i = 0; i < size && index < n; i++, index++) {
      result.set(sorted[index].id, division);
    }
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

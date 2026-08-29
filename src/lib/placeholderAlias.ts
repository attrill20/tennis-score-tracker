const NUMBERED_ALIAS = /^Placeholder Player (\d+)$/;

/**
 * Suggests the next "Placeholder Player N" alias, filling the lowest gap left by any
 * previously-used number rather than always incrementing off the highest. Ignores aliases
 * that don't match this exact numbered pattern (custom aliases don't consume a number).
 */
export function suggestPlaceholderAlias(existingAliases: (string | null | undefined)[]): string {
  const taken = new Set<number>();
  for (const alias of existingAliases) {
    const match = alias?.match(NUMBERED_ALIAS);
    if (match) taken.add(Number(match[1]));
  }
  let n = 1;
  while (taken.has(n)) n++;
  return `Placeholder Player ${n}`;
}

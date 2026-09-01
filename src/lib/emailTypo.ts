const COMMON_EMAIL_DOMAINS = [
  'gmail.com',
  'googlemail.com',
  'yahoo.com',
  'yahoo.co.uk',
  'hotmail.com',
  'hotmail.co.uk',
  'outlook.com',
  'live.com',
  'live.co.uk',
  'icloud.com',
  'me.com',
  'aol.com',
  'msn.com',
  'btinternet.com',
  'sky.com',
  'virginmedia.com',
  'talktalk.net',
  'ntlworld.com',
];

function levenshteinDistance(a: string, b: string): number {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const dist: number[][] = Array.from({ length: rows }, () => new Array(cols).fill(0));

  for (let i = 0; i < rows; i++) dist[i][0] = i;
  for (let j = 0; j < cols; j++) dist[0][j] = j;

  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dist[i][j] = Math.min(
        dist[i - 1][j] + 1,
        dist[i][j - 1] + 1,
        dist[i - 1][j - 1] + cost
      );
    }
  }

  return dist[rows - 1][cols - 1];
}

/**
 * Suggests a corrected domain for a likely-misspelt common email provider
 * (e.g. "gamil.com" -> "gmail.com"). Returns the full corrected email, or
 * null if the domain looks fine or no confident suggestion is found.
 */
export function suggestEmailCorrection(email: string): string | null {
  const trimmed = email.trim().toLowerCase();
  const atIndex = trimmed.lastIndexOf('@');
  if (atIndex === -1 || atIndex === trimmed.length - 1) return null;

  const localPart = trimmed.slice(0, atIndex);
  const domain = trimmed.slice(atIndex + 1);
  if (!domain || COMMON_EMAIL_DOMAINS.includes(domain)) return null;

  let bestMatch: string | null = null;
  let bestDistance = Infinity;

  for (const candidate of COMMON_EMAIL_DOMAINS) {
    const distance = levenshteinDistance(domain, candidate);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestMatch = candidate;
    }
  }

  if (!bestMatch || bestDistance === 0 || bestDistance > 2) return null;

  return `${localPart}@${bestMatch}`;
}

export const LEAGUE_COLOR_KEYS = ['blue', 'purple', 'orange', 'pink', 'teal', 'indigo', 'cyan', 'rose', 'yellow', 'green', 'lime', 'violet', 'amber', 'sky'] as const;
export type LeagueColorKey = typeof LEAGUE_COLOR_KEYS[number];

const LEAGUE_BORDER_COLORS: Record<LeagueColorKey, string> = {
  blue:   'border-l-blue-300',
  purple: 'border-l-purple-300',
  orange: 'border-l-orange-300',
  pink:   'border-l-pink-300',
  teal:   'border-l-teal-300',
  indigo: 'border-l-indigo-300',
  cyan:   'border-l-cyan-300',
  rose:   'border-l-rose-300',
  yellow: 'border-l-yellow-300',
  green:  'border-l-green-300',
  lime:   'border-l-lime-300',
  violet: 'border-l-violet-300',
  amber:  'border-l-amber-300',
  sky:    'border-l-sky-300',
};

const LEAGUE_RIGHT_BORDER_COLORS: Record<LeagueColorKey, string> = {
  blue:   'border-r-blue-300',
  purple: 'border-r-purple-300',
  orange: 'border-r-orange-300',
  pink:   'border-r-pink-300',
  teal:   'border-r-teal-300',
  indigo: 'border-r-indigo-300',
  cyan:   'border-r-cyan-300',
  rose:   'border-r-rose-300',
  yellow: 'border-r-yellow-300',
  green:  'border-r-green-300',
  lime:   'border-r-lime-300',
  violet: 'border-r-violet-300',
  amber:  'border-r-amber-300',
  sky:    'border-r-sky-300',
};

function resolveKey(leagueId: string, color?: string | null): LeagueColorKey {
  if (color && LEAGUE_COLOR_KEYS.includes(color as LeagueColorKey)) {
    return color as LeagueColorKey;
  }
  const hash = leagueId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return LEAGUE_COLOR_KEYS[hash % LEAGUE_COLOR_KEYS.length];
}

export function leagueBorderColor(leagueId: string, color?: string | null): string {
  return LEAGUE_BORDER_COLORS[resolveKey(leagueId, color)];
}

export function leagueRightBorderColor(leagueId: string, color?: string | null): string {
  return LEAGUE_RIGHT_BORDER_COLORS[resolveKey(leagueId, color)];
}

export const LEAGUE_COLOR_SWATCHES: { key: LeagueColorKey; bg: string; ring: string; label: string }[] = [
  { key: 'blue',   bg: 'bg-blue-300',   ring: 'ring-blue-400',   label: 'Blue' },
  { key: 'sky',    bg: 'bg-sky-300',    ring: 'ring-sky-400',    label: 'Sky' },
  { key: 'cyan',   bg: 'bg-cyan-300',   ring: 'ring-cyan-400',   label: 'Cyan' },
  { key: 'teal',   bg: 'bg-teal-300',   ring: 'ring-teal-400',   label: 'Teal' },
  { key: 'green',  bg: 'bg-green-300',  ring: 'ring-green-400',  label: 'Green' },
  { key: 'lime',   bg: 'bg-lime-300',   ring: 'ring-lime-400',   label: 'Lime' },
  { key: 'yellow', bg: 'bg-yellow-300', ring: 'ring-yellow-400', label: 'Yellow' },
  { key: 'amber',  bg: 'bg-amber-300',  ring: 'ring-amber-400',  label: 'Amber' },
  { key: 'orange', bg: 'bg-orange-300', ring: 'ring-orange-400', label: 'Orange' },
  { key: 'rose',   bg: 'bg-rose-300',   ring: 'ring-rose-400',   label: 'Rose' },
  { key: 'pink',   bg: 'bg-pink-300',   ring: 'ring-pink-400',   label: 'Pink' },
  { key: 'violet', bg: 'bg-violet-300', ring: 'ring-violet-400', label: 'Violet' },
  { key: 'purple', bg: 'bg-purple-300', ring: 'ring-purple-400', label: 'Purple' },
  { key: 'indigo', bg: 'bg-indigo-300', ring: 'ring-indigo-400', label: 'Indigo' },
];

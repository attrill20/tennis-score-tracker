export const SCORING_METHOD_LABELS: Record<string, string> = {
  '1_set_tiebreak': '1 set only (allow tiebreaker)',
  '1_set_no_tiebreak': '1 set only (no tiebreaker)',
  best_of_3_tiebreak: 'Best of 3 sets (allow tiebreaker)',
  best_of_3_no_tiebreak: 'Best of 3 sets (no tiebreaker)',
  best_of_5_tiebreak: 'Best of 5 sets (allow tiebreaker)',
  best_of_5_no_tiebreak: 'Best of 5 sets (no tiebreaker)',
};

export type PlayerStanding = {
  id: string;
  name: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  setsFor: number;
  setsAgainst: number;
  points: number;
};

type Match = {
  player1_id: string;
  player2_id: string;
  player3_id?: string | null;
  player4_id?: string | null;
  score_player1: number;
  score_player2: number;
  status: string;
  match_type?: string | null;
  winner_id?: string | null;
};

export type Tiebreaker = 'head_to_head' | 'most_sets_won' | 'set_difference';

export type PointsConfig = {
  winStraightSets: number;
  loseStraightSets: number;
  winDecider: number;
  loseDecider: number;
  draw: number;
};

export const DEFAULT_POINTS_CONFIG: PointsConfig = {
  winStraightSets: 3,
  loseStraightSets: 0,
  winDecider: 3,
  loseDecider: 0,
  draw: 1,
};

export const CLASSIC_POINTS: PointsConfig = DEFAULT_POINTS_CONFIG;
export const SPLIT_POINTS: PointsConfig = { winStraightSets: 5, loseStraightSets: 1, winDecider: 4, loseDecider: 2, draw: 3 };

function sameConfig(a: PointsConfig, b: PointsConfig) {
  return a.winStraightSets === b.winStraightSets
    && a.loseStraightSets === b.loseStraightSets
    && a.winDecider === b.winDecider
    && a.loseDecider === b.loseDecider
    && a.draw === b.draw;
}

export function presetForConfig(config: PointsConfig | null): 'classic' | 'split' | 'custom' {
  if (!config) return 'classic';
  if (sameConfig(config, CLASSIC_POINTS)) return 'classic';
  if (sameConfig(config, SPLIT_POINTS)) return 'split';
  return 'custom';
}

const POINTS_CONFIG_KEYS = ['winStraightSets', 'loseStraightSets', 'winDecider', 'loseDecider', 'draw'] as const;

/** Returns `null` (classic scoring), a valid PointsConfig, or `'invalid'` if malformed. */
export function parsePointsConfig(input: unknown): PointsConfig | null | 'invalid' {
  if (input === null || input === undefined) return null;
  if (typeof input !== 'object') return 'invalid';
  const obj = input as Record<string, unknown>;
  const result = {} as PointsConfig;
  for (const key of POINTS_CONFIG_KEYS) {
    const n = Number(obj[key]);
    if (!Number.isFinite(n) || n < 0 || n > 20) return 'invalid';
    result[key] = n;
  }
  return result;
}

export function calculateStandings(
  players: { id: string; full_name: string }[],
  matches: Match[],
  tiebreaker: Tiebreaker = 'head_to_head',
  pointsConfig: PointsConfig = DEFAULT_POINTS_CONFIG
): PlayerStanding[] {
  const standings: Record<string, PlayerStanding> = {};

  for (const p of players) {
    standings[p.id] = {
      id: p.id,
      name: p.full_name,
      played: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      setsFor: 0,
      setsAgainst: 0,
      points: 0,
    };
  }

  const playedMatches = matches.filter((m) => m.status !== 'disputed');

  for (const match of playedMatches) {
    // Team 1 = player1 + optional player3; Team 2 = player2 + optional player4
    const team1Ids = [match.player1_id, match.player3_id].filter((id): id is string => !!id);
    const team2Ids = [match.player2_id, match.player4_id].filter((id): id is string => !!id);

    const team1 = team1Ids.map((id) => standings[id]).filter(Boolean) as PlayerStanding[];
    const team2 = team2Ids.map((id) => standings[id]).filter(Boolean) as PlayerStanding[];

    if (!standings[match.player1_id] || !standings[match.player2_id]) continue;

    [...team1, ...team2].forEach((p) => p.played++);

    if (match.winner_id) {
      const winnerIsTeam1 = match.winner_id === match.player1_id;
      const winners = winnerIsTeam1 ? team1 : team2;
      const losers = winnerIsTeam1 ? team2 : team1;
      const loserSets = winnerIsTeam1 ? match.score_player2 : match.score_player1;
      const straightSets = loserSets === 0;
      winners.forEach((p) => { p.won++; p.points += straightSets ? pointsConfig.winStraightSets : pointsConfig.winDecider; });
      losers.forEach((p) => { p.lost++; p.points += straightSets ? pointsConfig.loseStraightSets : pointsConfig.loseDecider; });
      if (match.match_type === 'retirement') {
        team1.forEach((p) => { p.setsFor += match.score_player1; p.setsAgainst += match.score_player2; });
        team2.forEach((p) => { p.setsFor += match.score_player2; p.setsAgainst += match.score_player1; });
      }
    } else {
      team1.forEach((p) => { p.setsFor += match.score_player1; p.setsAgainst += match.score_player2; });
      team2.forEach((p) => { p.setsFor += match.score_player2; p.setsAgainst += match.score_player1; });

      // An unfinished match always splits points evenly, however many sets were recorded for the record.
      const isDraw = match.match_type === 'unfinished' || match.score_player1 === match.score_player2;

      if (!isDraw) {
        const team1Wins = match.score_player1 > match.score_player2;
        const winners = team1Wins ? team1 : team2;
        const losers = team1Wins ? team2 : team1;
        const loserSets = team1Wins ? match.score_player2 : match.score_player1;
        const straightSets = loserSets === 0;
        winners.forEach((p) => { p.won++; p.points += straightSets ? pointsConfig.winStraightSets : pointsConfig.winDecider; });
        losers.forEach((p) => { p.lost++; p.points += straightSets ? pointsConfig.loseStraightSets : pointsConfig.loseDecider; });
      } else {
        [...team1, ...team2].forEach((p) => { p.drawn++; p.points += pointsConfig.draw; });
      }
    }
  }

  return Object.values(standings).sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.won !== a.won) return b.won - a.won;

    if (tiebreaker === 'head_to_head') {
      const match = playedMatches.find(
        (m) =>
          m.match_type !== 'unfinished' &&
          ((m.player1_id === a.id && m.player2_id === b.id) ||
            (m.player1_id === b.id && m.player2_id === a.id))
      );
      if (match) {
        const aIsP1 = match.player1_id === a.id;
        const aScore = aIsP1 ? match.score_player1 : match.score_player2;
        const bScore = aIsP1 ? match.score_player2 : match.score_player1;
        if (aScore !== bScore) return bScore - aScore;
      }
    } else if (tiebreaker === 'most_sets_won') {
      if (b.setsFor !== a.setsFor) return b.setsFor - a.setsFor;
    } else {
      const aSetDiff = a.setsFor - a.setsAgainst;
      const bSetDiff = b.setsFor - b.setsAgainst;
      if (aSetDiff !== bSetDiff) return bSetDiff - aSetDiff;
    }

    return 0;
  });
}

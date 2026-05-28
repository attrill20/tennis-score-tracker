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
  score_player1: number;
  score_player2: number;
  status: string;
};

export type Tiebreaker = 'head_to_head' | 'most_sets_won' | 'set_difference';

export function calculateStandings(
  players: { id: string; full_name: string }[],
  matches: Match[],
  tiebreaker: Tiebreaker = 'head_to_head'
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
    const p1 = standings[match.player1_id];
    const p2 = standings[match.player2_id];
    if (!p1 || !p2) continue;

    p1.played++;
    p2.played++;
    p1.setsFor += match.score_player1;
    p1.setsAgainst += match.score_player2;
    p2.setsFor += match.score_player2;
    p2.setsAgainst += match.score_player1;

    if (match.score_player1 > match.score_player2) {
      p1.won++;
      p1.points += 3;
      p2.lost++;
    } else if (match.score_player2 > match.score_player1) {
      p2.won++;
      p2.points += 3;
      p1.lost++;
    } else {
      p1.drawn++;
      p2.drawn++;
      p1.points += 1;
      p2.points += 1;
    }
  }

  return Object.values(standings).sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.won !== a.won) return b.won - a.won;

    if (tiebreaker === 'head_to_head') {
      const match = playedMatches.find(
        (m) =>
          (m.player1_id === a.id && m.player2_id === b.id) ||
          (m.player1_id === b.id && m.player2_id === a.id)
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

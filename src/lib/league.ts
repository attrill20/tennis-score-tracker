export type PlayerStanding = {
  id: string;
  name: string;
  played: number;
  won: number;
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

export function calculateStandings(players: { id: string; full_name: string }[], matches: Match[]): PlayerStanding[] {
  const standings: Record<string, PlayerStanding> = {};

  for (const p of players) {
    standings[p.id] = {
      id: p.id,
      name: p.full_name,
      played: 0,
      won: 0,
      lost: 0,
      setsFor: 0,
      setsAgainst: 0,
      points: 0,
    };
  }

  for (const match of matches) {
    if (match.status === 'disputed') continue;

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
    } else {
      p2.won++;
      p2.points += 3;
      p1.lost++;
    }
  }

  return Object.values(standings).sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.won !== a.won) return b.won - a.won;
    const aSetDiff = a.setsFor - a.setsAgainst;
    const bSetDiff = b.setsFor - b.setsAgainst;
    return bSetDiff - aSetDiff;
  });
}

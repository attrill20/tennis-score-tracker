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
      winners.forEach((p) => { p.won++; p.points += 3; });
      losers.forEach((p) => p.lost++);
      if (match.match_type === 'retirement') {
        team1.forEach((p) => { p.setsFor += match.score_player1; p.setsAgainst += match.score_player2; });
        team2.forEach((p) => { p.setsFor += match.score_player2; p.setsAgainst += match.score_player1; });
      }
    } else {
      team1.forEach((p) => { p.setsFor += match.score_player1; p.setsAgainst += match.score_player2; });
      team2.forEach((p) => { p.setsFor += match.score_player2; p.setsAgainst += match.score_player1; });

      if (match.score_player1 > match.score_player2) {
        team1.forEach((p) => { p.won++; p.points += 3; });
        team2.forEach((p) => p.lost++);
      } else if (match.score_player2 > match.score_player1) {
        team2.forEach((p) => { p.won++; p.points += 3; });
        team1.forEach((p) => p.lost++);
      } else {
        [...team1, ...team2].forEach((p) => { p.drawn++; p.points += 1; });
      }
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

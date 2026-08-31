const mockSql = jest.fn();

jest.mock('@/lib/db', () => ({ __esModule: true, default: (...args: unknown[]) => mockSql(...args) }));

import { materializeDraftsForLeagues, getCurrentRoundDivisions, deleteLeagueCascade, resizeCurrentRoundDivisions } from '@/lib/divisionDrafts';

describe('materializeDraftsForLeagues', () => {
  beforeEach(() => jest.clearAllMocks());

  it('does nothing for an empty league list', async () => {
    await materializeDraftsForLeagues([]);
    expect(mockSql).not.toHaveBeenCalled();
  });

  it('copies drafts into league_players, sets assigned_league_id, then clears the drafts', async () => {
    mockSql.mockResolvedValue([]);

    await materializeDraftsForLeagues(['league-1', 'league-2']);

    const calls = mockSql.mock.calls.map((c) => (c[0] as TemplateStringsArray).join('?'));
    expect(calls[0]).toContain('BEGIN');
    expect(calls.some((c) => c.includes('INSERT INTO league_players') && c.includes('FROM league_player_drafts'))).toBe(true);
    expect(calls.some((c) => c.includes('UPDATE tournament_registrations') && c.includes('assigned_league_id'))).toBe(true);
    expect(calls.some((c) => c.includes('DELETE FROM league_player_drafts'))).toBe(true);
    expect(calls[calls.length - 1]).toContain('COMMIT');
  });

  it('rolls back if materialization fails', async () => {
    mockSql
      .mockResolvedValueOnce([]) // BEGIN
      .mockRejectedValueOnce(new Error('db exploded')); // the insert/update

    await expect(materializeDraftsForLeagues(['league-1'])).rejects.toThrow('db exploded');

    const calls = mockSql.mock.calls.map((c) => (c[0] as TemplateStringsArray).join('?'));
    expect(calls.some((c) => c.includes('ROLLBACK'))).toBe(true);
  });
});

describe('getCurrentRoundDivisions', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns the divisions for a tournament', async () => {
    const divisions = [{ id: 'league-1', name: 'Division 1', division_order: 1, max_players: 8, league_type: 'singles', status: 'upcoming' }];
    mockSql.mockResolvedValueOnce(divisions);

    const result = await getCurrentRoundDivisions('tournament-1');

    expect(result).toEqual(divisions);
    expect(mockSql).toHaveBeenCalledTimes(1);
  });
});

describe('deleteLeagueCascade', () => {
  beforeEach(() => jest.clearAllMocks());

  it('deletes disputes, matches, league_players, league_player_drafts, clears registration links, then the league', async () => {
    mockSql.mockResolvedValue([]);

    await deleteLeagueCascade('league-1');

    const calls = mockSql.mock.calls.map((c) => (c[0] as TemplateStringsArray).join('?'));
    expect(calls[0]).toContain('DELETE FROM disputes');
    expect(calls[1]).toContain('DELETE FROM matches');
    expect(calls[2]).toContain('DELETE FROM league_players');
    expect(calls[3]).toContain('DELETE FROM league_player_drafts');
    expect(calls[4]).toContain('UPDATE tournament_registrations');
    expect(calls[4]).toContain('assigned_league_id = ?');
    expect(calls[5]).toContain('DELETE FROM leagues');
  });
});

describe('resizeCurrentRoundDivisions', () => {
  const threeDivisions = [
    { id: 'div-1', name: 'Division 1', division_order: 1, max_players: 8, league_type: 'singles', status: 'upcoming' },
    { id: 'div-2', name: 'Division 2', division_order: 2, max_players: 8, league_type: 'singles', status: 'upcoming' },
    { id: 'div-3', name: 'Division 3', division_order: 3, max_players: 8, league_type: 'singles', status: 'upcoming' },
  ];

  beforeEach(() => jest.clearAllMocks());

  it('errors when the tournament has no current-round divisions', async () => {
    mockSql.mockResolvedValueOnce([]);
    const result = await resizeCurrentRoundDivisions('t-1', 4, false);
    expect(result).toEqual({ status: 'error', message: 'This tournament has no current-round divisions' });
  });

  it('errors when the current round has already started', async () => {
    mockSql.mockResolvedValueOnce([{ ...threeDivisions[0], status: 'active' }, threeDivisions[1], threeDivisions[2]]);
    const result = await resizeCurrentRoundDivisions('t-1', 4, false);
    if (result.status !== 'error') throw new Error('expected an error result');
    expect(result.message).toMatch(/has not started yet/i);
  });

  it('does nothing when the requested count matches the current count', async () => {
    mockSql.mockResolvedValueOnce(threeDivisions);
    const result = await resizeCurrentRoundDivisions('t-1', 3, false);
    expect(result).toEqual({ status: 'ok', created: 0, removed: 0 });
    expect(mockSql).toHaveBeenCalledTimes(1);
  });

  it('creates new divisions cloning the bottom division, and updates num_divisions', async () => {
    mockSql
      .mockResolvedValueOnce(threeDivisions) // getCurrentRoundDivisions
      .mockResolvedValueOnce([{ round_number: 1 }]) // MAX(round_number)
      .mockResolvedValueOnce([{ // template row (from div-3, the bottom division)
        season_start: '2026-01-01', season_end: '2026-03-01', max_players: 8, scoring_method: 'best_of_3_tiebreak',
        num_promoted: 1, num_relegated: 1, tiebreaker: 'head_to_head', is_public: true, league_type: 'singles',
        color: 'blue', points_config: null, gender_category: 'either',
      }])
      .mockResolvedValue([]); // insert(s) + tournaments update

    const result = await resizeCurrentRoundDivisions('t-1', 4, false);

    expect(result).toEqual({ status: 'ok', created: 1, removed: 0 });
    const calls = mockSql.mock.calls.map((c) => (c[0] as TemplateStringsArray).join('?'));
    const insertCall = mockSql.mock.calls.find((c) => (c[0] as TemplateStringsArray).join('?').includes('INSERT INTO leagues'));
    expect(insertCall?.slice(1)).toEqual(expect.arrayContaining(['Division 4']));
    expect(calls.some((c) => c.includes('UPDATE tournaments') && c.includes('num_divisions'))).toBe(true);
  });

  it('asks for confirmation when a division to be removed still has drafted players', async () => {
    mockSql
      .mockResolvedValueOnce(threeDivisions) // getCurrentRoundDivisions
      .mockResolvedValueOnce([{ count: '2' }]); // drafted-count check for div-3 (the only one removed for 3->2)

    const result = await resizeCurrentRoundDivisions('t-1', 2, false);

    if (result.status !== 'needs_confirmation') throw new Error('expected a needs_confirmation result');
    expect(result.message).toMatch(/2 players.*Division 3/i);
    expect(mockSql).toHaveBeenCalledTimes(2); // never reaches any delete
  });

  it('removes the bottom divisions immediately when none have drafted players', async () => {
    mockSql
      .mockResolvedValueOnce(threeDivisions) // getCurrentRoundDivisions
      .mockResolvedValueOnce([{ count: '0' }]) // drafted-count check for div-3
      .mockResolvedValue([]); // deleteLeagueCascade calls + tournaments update

    const result = await resizeCurrentRoundDivisions('t-1', 2, false);

    expect(result).toEqual({ status: 'ok', created: 0, removed: 1 });
    const calls = mockSql.mock.calls.map((c) => (c[0] as TemplateStringsArray).join('?'));
    expect(calls.some((c) => c.includes('DELETE FROM leagues'))).toBe(true);
    expect(calls.some((c) => c.includes('UPDATE tournaments') && c.includes('num_divisions'))).toBe(true);
  });

  it('removes divisions and returns their drafted players to the pool when forced', async () => {
    mockSql
      .mockResolvedValueOnce(threeDivisions) // getCurrentRoundDivisions
      .mockResolvedValue([]); // deleteLeagueCascade calls (skips the count check when forced) + tournaments update

    const result = await resizeCurrentRoundDivisions('t-1', 2, true);

    expect(result).toEqual({ status: 'ok', created: 0, removed: 1 });
    const calls = mockSql.mock.calls.map((c) => (c[0] as TemplateStringsArray).join('?'));
    expect(calls.some((c) => c.includes('DELETE FROM league_player_drafts'))).toBe(true);
    expect(calls.some((c) => c.includes('DELETE FROM leagues'))).toBe(true);
  });
});

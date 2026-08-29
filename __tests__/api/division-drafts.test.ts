const mockSql = jest.fn();

jest.mock('@/lib/db', () => ({ __esModule: true, default: (...args: unknown[]) => mockSql(...args) }));

import { materializeDraftsForLeagues, getCurrentRoundDivisions } from '@/lib/divisionDrafts';

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

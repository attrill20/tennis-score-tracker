const mockSql = jest.fn();

jest.mock('@/lib/db', () => ({ __esModule: true, default: (...args: unknown[]) => mockSql(...args) }));

import {
  splitFullName,
  createPlaceholder,
  updatePlaceholder,
  retirePlaceholder,
  mergePlaceholderIntoAccount,
  MergeConflictError,
  getPlaceholderNameMatches,
  getPlaceholderNameMatchesForTournament,
  findPlaceholderTournamentNameConflict,
} from '@/lib/placeholders';

describe('splitFullName', () => {
  it('splits on the first space', () => {
    expect(splitFullName('Bob Smith')).toEqual({ firstName: 'Bob', lastName: 'Smith' });
  });

  it('keeps middle names in the last name', () => {
    expect(splitFullName('Bob James Smith')).toEqual({ firstName: 'Bob', lastName: 'James Smith' });
  });

  it('leaves last name empty for a single word', () => {
    expect(splitFullName('Bob')).toEqual({ firstName: 'Bob', lastName: '' });
  });

  it('collapses repeated whitespace', () => {
    expect(splitFullName('  Bob   Smith  ')).toEqual({ firstName: 'Bob', lastName: 'Smith' });
  });
});

describe('createPlaceholder', () => {
  beforeEach(() => jest.clearAllMocks());

  it('inserts a placeholder profile and returns its id', async () => {
    mockSql.mockResolvedValueOnce([{ id: 'ph-1' }]);

    const id = await createPlaceholder({ fullName: 'Bob Smith', alias: 'Guest 1', anonymized: true });

    expect(id).toBe('ph-1');
    expect(mockSql).toHaveBeenCalledTimes(1);
    const values = mockSql.mock.calls[0].slice(1);
    expect(values).toEqual(expect.arrayContaining(['Bob Smith', 'Bob', 'Smith', 'Guest 1', true]));
    expect(values.some((v: unknown) => typeof v === 'string' && v.startsWith('placeholder-') && v.endsWith('@placeholder.internal'))).toBe(true);
  });
});

describe('updatePlaceholder', () => {
  beforeEach(() => jest.clearAllMocks());

  it('splits the new full name and updates alias/anonymize fields', async () => {
    mockSql.mockResolvedValueOnce([]);

    await updatePlaceholder('ph-1', { fullName: 'Carl Jones', alias: null, anonymized: false });

    const values = mockSql.mock.calls[0].slice(1);
    expect(values).toEqual(expect.arrayContaining(['Carl Jones', 'Carl', 'Jones', null, false, 'ph-1']));
  });
});

describe('retirePlaceholder', () => {
  beforeEach(() => jest.clearAllMocks());

  it('soft-deletes the placeholder profile', async () => {
    mockSql.mockResolvedValueOnce([]);
    await retirePlaceholder('ph-1');
    expect(mockSql).toHaveBeenCalledTimes(1);
    expect(mockSql.mock.calls[0].slice(1)).toEqual(['ph-1']);
  });
});

describe('mergePlaceholderIntoAccount', () => {
  beforeEach(() => jest.clearAllMocks());

  it('throws when the placeholder does not exist', async () => {
    mockSql.mockResolvedValueOnce([]); // placeholder lookup

    await expect(mergePlaceholderIntoAccount('ph-1', 'real-1')).rejects.toThrow('Placeholder not found');
    expect(mockSql).toHaveBeenCalledTimes(1);
  });

  it('throws when the target account does not exist', async () => {
    mockSql
      .mockResolvedValueOnce([{ id: 'ph-1' }]) // placeholder found
      .mockResolvedValueOnce([]); // real account not found

    await expect(mergePlaceholderIntoAccount('ph-1', 'real-1')).rejects.toThrow('Target account not found');
    expect(mockSql).toHaveBeenCalledTimes(2);
  });

  it('refuses to merge when the target already shares a league with the placeholder', async () => {
    mockSql
      .mockResolvedValueOnce([{ id: 'ph-1' }])
      .mockResolvedValueOnce([{ id: 'real-1' }])
      .mockResolvedValueOnce([{ league_id: 'league-1' }]); // conflict

    await expect(mergePlaceholderIntoAccount('ph-1', 'real-1')).rejects.toThrow(MergeConflictError);
    expect(mockSql).toHaveBeenCalledTimes(3); // never reaches BEGIN
  });

  it('re-points matches, league_players and league_player_drafts onto the real account, then retires the placeholder', async () => {
    mockSql
      .mockResolvedValueOnce([{ id: 'ph-1' }]) // placeholder found
      .mockResolvedValueOnce([{ id: 'real-1' }]) // real account found
      .mockResolvedValueOnce([]) // no conflicts
      .mockResolvedValue([]); // BEGIN / updates / COMMIT

    await mergePlaceholderIntoAccount('ph-1', 'real-1');

    const calls = mockSql.mock.calls.map((c) => (c[0] as TemplateStringsArray).join('?'));
    expect(calls.some((c) => c.includes('BEGIN'))).toBe(true);
    expect(calls.some((c) => c.includes('COMMIT'))).toBe(true);
    expect(calls.some((c) => c.includes('UPDATE matches') && c.includes('player1_id'))).toBe(true);
    expect(calls.some((c) => c.includes('UPDATE league_players') && c.includes('partner_id'))).toBe(true);
    expect(calls.some((c) => c.includes('UPDATE league_player_drafts') && c.includes('player_id') && !c.includes('partner_id'))).toBe(true);
    expect(calls.some((c) => c.includes('UPDATE league_player_drafts') && c.includes('partner_id'))).toBe(true);
    expect(calls.some((c) => c.includes('UPDATE profiles') && c.includes('deleted_at'))).toBe(true);
  });

  it('checks league_player_drafts for conflicts alongside league_players', async () => {
    mockSql
      .mockResolvedValueOnce([{ id: 'ph-1' }])
      .mockResolvedValueOnce([{ id: 'real-1' }])
      .mockResolvedValueOnce([{ league_id: 'league-2' }]); // conflict found only in the drafts half of the query

    await expect(mergePlaceholderIntoAccount('ph-1', 'real-1')).rejects.toThrow(MergeConflictError);

    const conflictCall = mockSql.mock.calls[2];
    const sqlText = (conflictCall[0] as TemplateStringsArray).join('?');
    expect(sqlText).toContain('league_player_drafts');
    expect(sqlText).toContain('league_players');
  });

  it('rolls back if a transaction step fails', async () => {
    mockSql
      .mockResolvedValueOnce([{ id: 'ph-1' }])
      .mockResolvedValueOnce([{ id: 'real-1' }])
      .mockResolvedValueOnce([]) // no conflicts
      .mockResolvedValueOnce([]) // BEGIN
      .mockRejectedValueOnce(new Error('db exploded')); // first UPDATE fails

    await expect(mergePlaceholderIntoAccount('ph-1', 'real-1')).rejects.toThrow('db exploded');

    const calls = mockSql.mock.calls.map((c) => (c[0] as TemplateStringsArray).join('?'));
    expect(calls.some((c) => c.includes('ROLLBACK'))).toBe(true);
  });
});

describe('getPlaceholderNameMatches', () => {
  beforeEach(() => jest.clearAllMocks());

  it('maps matched rows into camelCase PlaceholderMatch objects', async () => {
    mockSql.mockResolvedValueOnce([{
      placeholder_id: 'ph-1', placeholder_full_name: 'Bob Smith',
      placeholder_alias: 'Guest 1', placeholder_anonymized: true,
      member_id: 'real-1', member_full_name: 'Bob Smith', member_email_verified: false,
    }]);

    const matches = await getPlaceholderNameMatches();

    expect(matches).toEqual([{
      placeholderId: 'ph-1', placeholderFullName: 'Bob Smith',
      placeholderAlias: 'Guest 1', placeholderAnonymized: true,
      memberId: 'real-1', memberFullName: 'Bob Smith', memberEmailVerified: false,
    }]);
    const sqlText = (mockSql.mock.calls[0][0] as TemplateStringsArray).join('?');
    expect(sqlText).toContain('is_placeholder = true');
    expect(sqlText).toContain('is_placeholder = false');
  });

  it('returns an empty array when nothing matches', async () => {
    mockSql.mockResolvedValueOnce([]);
    expect(await getPlaceholderNameMatches()).toEqual([]);
  });
});

describe('getPlaceholderNameMatchesForTournament', () => {
  beforeEach(() => jest.clearAllMocks());

  it('scopes the match query to placeholders playing in the given tournament', async () => {
    mockSql.mockResolvedValueOnce([{
      placeholder_id: 'ph-1', placeholder_full_name: 'Carl Jones',
      placeholder_alias: null, placeholder_anonymized: false,
      member_id: 'real-2', member_full_name: 'Carl Jones', member_email_verified: true,
    }]);

    const matches = await getPlaceholderNameMatchesForTournament('tournament-1');

    expect(matches).toEqual([{
      placeholderId: 'ph-1', placeholderFullName: 'Carl Jones',
      placeholderAlias: null, placeholderAnonymized: false,
      memberId: 'real-2', memberFullName: 'Carl Jones', memberEmailVerified: true,
    }]);
    const call = mockSql.mock.calls[0];
    const sqlText = (call[0] as TemplateStringsArray).join('?');
    expect(sqlText).toContain('league_player_drafts');
    expect(sqlText).toContain('l.tournament_id');
    expect(call.slice(1)).toContain('tournament-1');
  });
});

describe('findPlaceholderTournamentNameConflict', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns the conflicting player when someone else in the tournament already has that name', async () => {
    mockSql.mockResolvedValueOnce([{ id: 'real-1', full_name: 'Bob Smith' }]);

    const conflict = await findPlaceholderTournamentNameConflict('ph-1', 'tournament-1');

    expect(conflict).toEqual({ id: 'real-1', fullName: 'Bob Smith' });
    const sqlText = (mockSql.mock.calls[0][0] as TemplateStringsArray).join('?');
    expect(sqlText).toContain('is_placeholder = true');
    expect(sqlText).toContain('p2.id != p1.id');
  });

  it('returns null when there is no conflict', async () => {
    mockSql.mockResolvedValueOnce([]);
    expect(await findPlaceholderTournamentNameConflict('ph-1', 'tournament-1')).toBeNull();
  });
});

const mockSql = jest.fn();

jest.mock('@/lib/db', () => ({ __esModule: true, default: (...args: unknown[]) => mockSql(...args) }));

import {
  splitFullName,
  createPlaceholder,
  updatePlaceholder,
  retirePlaceholder,
  mergePlaceholderIntoAccount,
  MergeConflictError,
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

  it('re-points matches and league_players onto the real account, then retires the placeholder', async () => {
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
    expect(calls.some((c) => c.includes('UPDATE profiles') && c.includes('deleted_at'))).toBe(true);
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

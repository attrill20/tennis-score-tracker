const mockSql = jest.fn();

jest.mock('@/lib/db', () => ({
  __esModule: true,
  default: (...args: unknown[]) => mockSql(...args),
}));

const mockPut = jest.fn();
const mockList = jest.fn();
const mockDel = jest.fn();

jest.mock('@vercel/blob', () => ({
  put: (...args: unknown[]) => mockPut(...args),
  list: (...args: unknown[]) => mockList(...args),
  del: (...args: unknown[]) => mockDel(...args),
}));

import { backupProdDatabase } from '@/lib/backupProdDb';

describe('backupProdDatabase', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSql.mockResolvedValue([]);
    mockPut.mockResolvedValue({ url: 'https://blob.example/backups/prod/fake.json' });
    mockList.mockResolvedValue({ blobs: [] });
  });

  it('dumps every table and uploads the result as a private blob', async () => {
    mockSql
      .mockResolvedValueOnce([{ id: 'p1' }]) // profiles
      .mockResolvedValueOnce([]) // tournaments
      .mockResolvedValueOnce([]) // leagues
      .mockResolvedValueOnce([]) // league_players
      .mockResolvedValueOnce([{ id: 'm1' }, { id: 'm2' }]) // matches
      .mockResolvedValueOnce([]); // disputes

    const result = await backupProdDatabase();

    expect(mockPut).toHaveBeenCalledTimes(1);
    const [pathname, body, options] = mockPut.mock.calls[0];
    expect(pathname).toMatch(/^backups\/prod\/.*\.json$/);
    expect(options).toMatchObject({ access: 'private', contentType: 'application/json' });

    const uploaded = JSON.parse(body as string);
    expect(uploaded.profiles).toEqual([{ id: 'p1' }]);
    expect(uploaded.matches).toEqual([{ id: 'm1' }, { id: 'm2' }]);

    expect(result.rowCounts).toEqual({
      profiles: 1,
      tournaments: 0,
      leagues: 0,
      league_players: 0,
      matches: 2,
      disputes: 0,
    });
  });

  it('prunes backups beyond the retention count, keeping the newest ones', async () => {
    const blobs = Array.from({ length: 16 }, (_, i) => ({
      url: `https://blob.example/backups/prod/backup-${i}.json`,
      uploadedAt: new Date(2026, 0, i + 1),
    }));
    mockList.mockResolvedValue({ blobs });

    const result = await backupProdDatabase();

    expect(mockDel).toHaveBeenCalledTimes(1);
    const deletedUrls = mockDel.mock.calls[0][0] as string[];
    expect(deletedUrls).toHaveLength(2);
    // Oldest two (day 1 and day 2) should be the ones pruned.
    expect(deletedUrls).toEqual(
      expect.arrayContaining([
        'https://blob.example/backups/prod/backup-0.json',
        'https://blob.example/backups/prod/backup-1.json',
      ])
    );
    expect(result.pruned).toBe(2);
  });

  it('does not prune anything when within the retention count', async () => {
    mockList.mockResolvedValue({
      blobs: [{ url: 'https://blob.example/backups/prod/only.json', uploadedAt: new Date() }],
    });

    const result = await backupProdDatabase();

    expect(mockDel).not.toHaveBeenCalled();
    expect(result.pruned).toBe(0);
  });
});

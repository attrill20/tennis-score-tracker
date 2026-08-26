import { NextRequest } from 'next/server';

const mockBackupProdDatabase = jest.fn();

jest.mock('@/lib/backupProdDb', () => ({
  backupProdDatabase: () => mockBackupProdDatabase(),
}));

import { GET } from '@/app/api/cron/backup-prod-db/route';

function makeRequest(authHeader?: string) {
  return new NextRequest('http://localhost/api/cron/backup-prod-db', {
    headers: authHeader ? { authorization: authHeader } : undefined,
  });
}

describe('GET /api/cron/backup-prod-db', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv, CRON_SECRET: 'correct-secret' };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('rejects requests with no authorization header', async () => {
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
    expect(mockBackupProdDatabase).not.toHaveBeenCalled();
  });

  it('rejects requests with the wrong secret', async () => {
    const res = await GET(makeRequest('Bearer wrong-secret'));
    expect(res.status).toBe(401);
    expect(mockBackupProdDatabase).not.toHaveBeenCalled();
  });

  it('runs the backup when the secret is correct', async () => {
    mockBackupProdDatabase.mockResolvedValue({
      url: 'https://blob.example/backups/prod/fake.json',
      tables: ['profiles'],
      rowCounts: { profiles: 1 },
      pruned: 0,
    });

    const res = await GET(makeRequest('Bearer correct-secret'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(mockBackupProdDatabase).toHaveBeenCalledTimes(1);
    expect(body).toEqual({
      backedUp: true,
      url: 'https://blob.example/backups/prod/fake.json',
      tables: ['profiles'],
      rowCounts: { profiles: 1 },
      pruned: 0,
    });
  });
});

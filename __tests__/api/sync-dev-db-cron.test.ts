import { NextRequest } from 'next/server';

const mockResetDevBranchFromProd = jest.fn();
const mockAnonymizeDevDatabase = jest.fn();

jest.mock('@/lib/neonApi', () => ({
  resetDevBranchFromProd: () => mockResetDevBranchFromProd(),
}));
jest.mock('@/lib/anonymizeDevDb', () => ({
  anonymizeDevDatabase: () => mockAnonymizeDevDatabase(),
}));

import { GET } from '@/app/api/cron/sync-dev-db/route';

function makeRequest(authHeader?: string) {
  return new NextRequest('http://localhost/api/cron/sync-dev-db', {
    headers: authHeader ? { authorization: authHeader } : undefined,
  });
}

describe('GET /api/cron/sync-dev-db', () => {
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
    expect(mockResetDevBranchFromProd).not.toHaveBeenCalled();
  });

  it('rejects requests with the wrong secret', async () => {
    const res = await GET(makeRequest('Bearer wrong-secret'));
    expect(res.status).toBe(401);
    expect(mockAnonymizeDevDatabase).not.toHaveBeenCalled();
  });

  it('resets and anonymizes the dev branch when the secret is correct', async () => {
    mockAnonymizeDevDatabase.mockResolvedValue({
      anonymizedProfiles: 5,
      devPassword: 'devpassword123',
    });

    const res = await GET(makeRequest('Bearer correct-secret'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(mockResetDevBranchFromProd).toHaveBeenCalledTimes(1);
    expect(mockAnonymizeDevDatabase).toHaveBeenCalledTimes(1);
    expect(body).toEqual({ synced: true, anonymizedProfiles: 5, devPassword: 'devpassword123' });
  });
});

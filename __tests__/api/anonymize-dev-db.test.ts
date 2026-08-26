const mockSql = jest.fn();

jest.mock('@neondatabase/serverless', () => ({
  neon: jest.fn(() => mockSql),
}));

import { anonymizeDevDatabase, DEV_DATABASE_PASSWORD } from '@/lib/anonymizeDevDb';

describe('anonymizeDevDatabase', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('refuses to run when DEV_DATABASE_URL is not set', async () => {
    delete process.env.DEV_DATABASE_URL;
    process.env.DATABASE_URL = 'postgresql://prod';

    await expect(anonymizeDevDatabase()).rejects.toThrow('DEV_DATABASE_URL is not set');
    expect(mockSql).not.toHaveBeenCalled();
  });

  it('refuses to run when DEV_DATABASE_URL matches DATABASE_URL', async () => {
    process.env.DATABASE_URL = 'postgresql://same-db';
    process.env.DEV_DATABASE_URL = 'postgresql://same-db';

    await expect(anonymizeDevDatabase()).rejects.toThrow(
      'DEV_DATABASE_URL matches DATABASE_URL'
    );
    expect(mockSql).not.toHaveBeenCalled();
  });

  it('anonymizes profiles and reports the dev password when the URLs differ', async () => {
    process.env.DATABASE_URL = 'postgresql://prod';
    process.env.DEV_DATABASE_URL = 'postgresql://dev-branch';
    mockSql.mockResolvedValue([{ id: '1' }, { id: '2' }, { id: '3' }]);

    const result = await anonymizeDevDatabase();

    expect(mockSql).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ anonymizedProfiles: 3, devPassword: DEV_DATABASE_PASSWORD });
  });
});

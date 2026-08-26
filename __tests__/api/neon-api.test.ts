import { resetDevBranchFromProd } from '@/lib/neonApi';

describe('resetDevBranchFromProd', () => {
  const originalEnv = process.env;
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      NEON_API_KEY: 'test-key',
      NEON_PROJECT_ID: 'test-project',
      NEON_PROD_BRANCH_ID: 'br-prod',
      NEON_DEV_BRANCH_ID: 'br-dev',
    };
    global.fetch = jest.fn();
  });

  afterAll(() => {
    process.env = originalEnv;
    global.fetch = originalFetch;
  });

  it('refuses to reset the branch onto itself', async () => {
    process.env.NEON_DEV_BRANCH_ID = 'br-prod';

    await expect(resetDevBranchFromProd()).rejects.toThrow(
      'NEON_DEV_BRANCH_ID matches NEON_PROD_BRANCH_ID'
    );
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('refuses to run when either branch id is missing', async () => {
    delete process.env.NEON_DEV_BRANCH_ID;

    await expect(resetDevBranchFromProd()).rejects.toThrow(
      'NEON_DEV_BRANCH_ID and NEON_PROD_BRANCH_ID must both be set'
    );
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('restores the dev branch from prod and waits for the operation to finish', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ operations: [{ id: 'op-1' }] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ operation: { id: 'op-1', status: 'finished' } }),
      });

    await resetDevBranchFromProd();

    expect(global.fetch).toHaveBeenCalledTimes(2);
    const [restoreUrl, restoreInit] = (global.fetch as jest.Mock).mock.calls[0];
    expect(restoreUrl).toBe(
      'https://console.neon.tech/api/v2/projects/test-project/branches/br-dev/restore'
    );
    expect(JSON.parse(restoreInit.body)).toEqual({ source_branch_id: 'br-prod' });
  });

  it('throws if the Neon operation fails', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ operations: [{ id: 'op-1' }] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ operation: { id: 'op-1', status: 'failed' } }),
      });

    await expect(resetDevBranchFromProd()).rejects.toThrow('Neon operation op-1 failed');
  });
});

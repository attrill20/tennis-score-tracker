const mockSql = jest.fn();
const mockAuth = jest.fn();

jest.mock('@/lib/db', () => ({ __esModule: true, default: (...args: unknown[]) => mockSql(...args) }));
jest.mock('@/auth', () => ({ auth: () => mockAuth() }));

import { GET, POST, DELETE } from '@/app/api/admin/tournaments/[tournamentId]/admins/route';

function makeRequest(body: unknown) {
  return { json: async () => body } as unknown as Request;
}

const params = Promise.resolve({ tournamentId: 'tournament-1' });

describe('/api/admin/tournaments/[id]/admins', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: 'admin-1', role: 'admin' } });
  });

  describe('GET', () => {
    it('rejects non-admins', async () => {
      mockAuth.mockResolvedValue({ user: { id: 'member-1', role: 'member' } });
      const res = await GET({} as never, { params } as never);
      expect(res.status).toBe(403);
    });

    it('returns the current co-admin ids', async () => {
      mockSql.mockResolvedValueOnce([{ admin_id: 'admin-2' }, { admin_id: 'admin-3' }]);
      const res = await GET({} as never, { params } as never);
      const data = await res.json();
      expect(data).toEqual({ adminIds: ['admin-2', 'admin-3'] });
    });
  });

  describe('POST', () => {
    it('rejects non-admins', async () => {
      mockAuth.mockResolvedValue({ user: { id: 'member-1', role: 'member' } });
      const res = await POST(makeRequest({ adminId: 'admin-2' }) as never, { params } as never);
      expect(res.status).toBe(403);
    });

    it('rejects a missing adminId', async () => {
      const res = await POST(makeRequest({}) as never, { params } as never);
      expect(res.status).toBe(400);
    });

    it('404s when the tournament does not exist', async () => {
      mockSql.mockResolvedValueOnce([]);
      const res = await POST(makeRequest({ adminId: 'admin-2' }) as never, { params } as never);
      expect(res.status).toBe(404);
    });

    it('rejects adding the tournament creator as a co-admin', async () => {
      mockSql.mockResolvedValueOnce([{ created_by: 'admin-2' }]);
      const res = await POST(makeRequest({ adminId: 'admin-2' }) as never, { params } as never);
      const data = await res.json();
      expect(res.status).toBe(400);
      expect(data.error).toMatch(/already manages/);
    });

    it('rejects a target who is not an admin', async () => {
      mockSql
        .mockResolvedValueOnce([{ created_by: 'admin-1' }])
        .mockResolvedValueOnce([{ role: 'member' }]);
      const res = await POST(makeRequest({ adminId: 'member-2' }) as never, { params } as never);
      const data = await res.json();
      expect(res.status).toBe(400);
      expect(data.error).toMatch(/not an admin/);
    });

    it('adds a valid admin as a co-admin', async () => {
      mockSql
        .mockResolvedValueOnce([{ created_by: 'admin-1' }])
        .mockResolvedValueOnce([{ role: 'admin' }])
        .mockResolvedValueOnce([]);
      const res = await POST(makeRequest({ adminId: 'admin-2' }) as never, { params } as never);
      expect(res.status).toBe(201);
      expect(mockSql).toHaveBeenCalledTimes(3);
    });
  });

  describe('DELETE', () => {
    it('rejects non-admins', async () => {
      mockAuth.mockResolvedValue({ user: { id: 'member-1', role: 'member' } });
      const res = await DELETE(makeRequest({ adminId: 'admin-2' }) as never, { params } as never);
      expect(res.status).toBe(403);
    });

    it('removes the co-admin row', async () => {
      mockSql.mockResolvedValueOnce([]);
      const res = await DELETE(makeRequest({ adminId: 'admin-2' }) as never, { params } as never);
      expect(res.status).toBe(200);
      expect(mockSql).toHaveBeenCalledTimes(1);
    });
  });
});

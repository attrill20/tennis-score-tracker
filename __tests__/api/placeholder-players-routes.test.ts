const mockSql = jest.fn();
const mockAuth = jest.fn();
const mockCreatePlaceholder = jest.fn();
const mockUpdatePlaceholder = jest.fn();
const mockRetirePlaceholder = jest.fn();
const mockMerge = jest.fn();

jest.mock('@/lib/db', () => ({ __esModule: true, default: (...args: unknown[]) => mockSql(...args) }));
jest.mock('@/auth', () => ({ auth: () => mockAuth() }));
jest.mock('@/lib/placeholders', () => {
  const actual = jest.requireActual('@/lib/placeholders');
  return {
    ...actual,
    createPlaceholder: (...args: unknown[]) => mockCreatePlaceholder(...args),
    updatePlaceholder: (...args: unknown[]) => mockUpdatePlaceholder(...args),
    retirePlaceholder: (...args: unknown[]) => mockRetirePlaceholder(...args),
    mergePlaceholderIntoAccount: (...args: unknown[]) => mockMerge(...args),
  };
});

import { GET, POST } from '@/app/api/admin/placeholder-players/route';
import { PATCH, DELETE } from '@/app/api/admin/placeholder-players/[id]/route';
import { POST as MERGE } from '@/app/api/admin/placeholder-players/[id]/merge/route';
import { MergeConflictError } from '@/lib/placeholders';

function makeRequest(body: unknown) {
  return { json: async () => body } as unknown as Request;
}

const params = Promise.resolve({ id: 'ph-1' });

describe('placeholder-players API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: 'admin-1', role: 'admin' } });
  });

  describe('GET/POST /api/admin/placeholder-players', () => {
    it('rejects non-admins', async () => {
      mockAuth.mockResolvedValue({ user: { id: 'm-1', role: 'member' } });
      const res = await GET();
      expect(res.status).toBe(403);
    });

    it('lists placeholders for an admin', async () => {
      mockSql.mockResolvedValueOnce([{ id: 'ph-1', full_name: 'Bob Smith' }]);
      const res = await GET();
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual([{ id: 'ph-1', full_name: 'Bob Smith' }]);
    });

    it('rejects creating a placeholder with no full name', async () => {
      const res = await POST(makeRequest({ fullName: '  ' }) as never);
      expect(res.status).toBe(400);
      expect(mockCreatePlaceholder).not.toHaveBeenCalled();
    });

    it('requires an alias when anonymized', async () => {
      const res = await POST(makeRequest({ fullName: 'Bob Smith', anonymized: true }) as never);
      expect(res.status).toBe(400);
      expect((await res.json()).error).toMatch(/alias/i);
    });

    it('creates a placeholder', async () => {
      mockCreatePlaceholder.mockResolvedValueOnce('ph-1');
      const res = await POST(makeRequest({ fullName: ' Bob Smith ', alias: 'Guest', anonymized: true }) as never);
      expect(res.status).toBe(201);
      expect(mockCreatePlaceholder).toHaveBeenCalledWith({ fullName: 'Bob Smith', alias: 'Guest', anonymized: true });
    });
  });

  describe('PATCH/DELETE /api/admin/placeholder-players/[id]', () => {
    it('rejects non-admins', async () => {
      mockAuth.mockResolvedValue({ user: { id: 'm-1', role: 'member' } });
      const res = await PATCH(makeRequest({ fullName: 'X' }) as never, { params } as never);
      expect(res.status).toBe(403);
    });

    it('updates a placeholder', async () => {
      const res = await PATCH(makeRequest({ fullName: 'New Name', alias: null, anonymized: false }) as never, { params } as never);
      expect(res.status).toBe(200);
      expect(mockUpdatePlaceholder).toHaveBeenCalledWith('ph-1', { fullName: 'New Name', alias: null, anonymized: false });
    });

    it('retires a placeholder', async () => {
      const res = await DELETE({} as never, { params } as never);
      expect(res.status).toBe(200);
      expect(mockRetirePlaceholder).toHaveBeenCalledWith('ph-1');
    });
  });

  describe('POST /api/admin/placeholder-players/[id]/merge', () => {
    it('requires a target account', async () => {
      const res = await MERGE(makeRequest({}) as never, { params } as never);
      expect(res.status).toBe(400);
      expect(mockMerge).not.toHaveBeenCalled();
    });

    it('merges into the target account', async () => {
      mockMerge.mockResolvedValueOnce(undefined);
      const res = await MERGE(makeRequest({ realAccountId: 'real-1' }) as never, { params } as never);
      expect(res.status).toBe(200);
      expect(mockMerge).toHaveBeenCalledWith('ph-1', 'real-1');
    });

    it('surfaces a conflict as 409', async () => {
      mockMerge.mockRejectedValueOnce(new MergeConflictError('already in that league'));
      const res = await MERGE(makeRequest({ realAccountId: 'real-1' }) as never, { params } as never);
      expect(res.status).toBe(409);
      expect((await res.json()).error).toMatch(/already in that league/i);
    });
  });
});

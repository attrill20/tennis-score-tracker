const mockSql = jest.fn();
const mockAuth = jest.fn();

jest.mock('@/lib/db', () => ({ __esModule: true, default: (...args: unknown[]) => mockSql(...args) }));
jest.mock('@/auth', () => ({ auth: () => mockAuth() }));

import { POST } from '@/app/api/admin/tournaments/route';

function makeRequest(body: unknown) {
  return { json: async () => body } as unknown as Request;
}

const basePayload = {
  format: 'single',
  name: 'Test Tournament',
  startDate: '2099-01-01',
  endDate: '2099-02-01',
  scoringMethod: 'best_of_3_tiebreak',
  leagueType: 'singles',
  maxPlayers: 4,
  isPublic: true,
  hasRegistrationForm: false,
};

describe('POST /api/admin/tournaments - additional admins at creation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: 'creator-1', role: 'admin' } });
  });

  it('seeds tournament_admins for valid, non-creator admin ids and skips the rest', async () => {
    mockSql
      .mockResolvedValueOnce([{ id: 'tournament-1' }]) // tournaments insert
      .mockResolvedValueOnce([{ id: 'division-1' }]) // leagues insert
      .mockResolvedValueOnce([{ id: 'admin-2' }]) // validAdmins select (only admin-2 passes the role/deleted_at filter)
      .mockResolvedValueOnce([]); // tournament_admins insert for admin-2

    const res = await POST(makeRequest({
      ...basePayload,
      additionalAdminIds: ['admin-2', 'creator-1', 'not-a-real-admin'],
    }) as never);

    expect(res.status).toBe(201);
    expect(mockSql).toHaveBeenCalledTimes(4);

    const validAdminsCall = (mockSql.mock.calls[2][0] as TemplateStringsArray).join('?');
    expect(validAdminsCall).toContain('SELECT id FROM profiles');
    const insertCall = (mockSql.mock.calls[3][0] as TemplateStringsArray).join('?');
    expect(insertCall).toContain('INSERT INTO tournament_admins');
  });

  it('skips the co-admin step entirely when no additional admins are provided', async () => {
    mockSql
      .mockResolvedValueOnce([{ id: 'tournament-1' }])
      .mockResolvedValueOnce([{ id: 'division-1' }]);

    const res = await POST(makeRequest(basePayload) as never);

    expect(res.status).toBe(201);
    expect(mockSql).toHaveBeenCalledTimes(2);
  });

  it('skips the co-admin step when every id is filtered out (only the creator was passed)', async () => {
    mockSql
      .mockResolvedValueOnce([{ id: 'tournament-1' }])
      .mockResolvedValueOnce([{ id: 'division-1' }]);

    const res = await POST(makeRequest({ ...basePayload, additionalAdminIds: ['creator-1'] }) as never);

    expect(res.status).toBe(201);
    expect(mockSql).toHaveBeenCalledTimes(2);
  });
});

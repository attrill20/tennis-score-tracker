const mockSql = jest.fn();
const mockAuth = jest.fn();

jest.mock('@/lib/db', () => ({ __esModule: true, default: (...args: unknown[]) => mockSql(...args) }));
jest.mock('@/auth', () => ({ auth: () => mockAuth() }));

import { GET, POST, DELETE } from '@/app/api/admin/leagues/[id]/players/route';

function makeRequest(body: unknown) {
  return { json: async () => body } as unknown as Request;
}

const params = Promise.resolve({ id: 'league-1' });

function callsAsText() {
  return mockSql.mock.calls.map((c) => (c[0] as TemplateStringsArray).join('?'));
}

describe('/api/admin/leagues/[id]/players - draft-aware branching', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: 'admin-1', role: 'admin' } });
  });

  describe('GET', () => {
    it('reads from league_player_drafts when the league is upcoming', async () => {
      mockSql
        .mockResolvedValueOnce([{ league_type: 'singles', status: 'upcoming' }])
        .mockResolvedValueOnce([{ player_id: 'p1' }]);

      const res = await GET({} as never, { params } as never);
      const data = await res.json();

      expect(data).toEqual({ playerIds: ['p1'], isDraft: true });
      expect(callsAsText()[1]).toContain('league_player_drafts');
    });

    it('reads from league_players when the league is active', async () => {
      mockSql
        .mockResolvedValueOnce([{ league_type: 'singles', status: 'active' }])
        .mockResolvedValueOnce([{ player_id: 'p1' }]);

      const res = await GET({} as never, { params } as never);
      const data = await res.json();

      expect(data.isDraft).toBe(false);
      expect(callsAsText()[1]).toContain('FROM league_players');
    });
  });

  describe('POST singles', () => {
    it('drafts the assignment and leaves tournament_registrations untouched when upcoming', async () => {
      mockSql
        .mockResolvedValueOnce([{ gender_category: 'either', status: 'upcoming' }])
        .mockResolvedValueOnce([]);

      const res = await POST(makeRequest({ playerIds: ['p1'], force: true }) as never, { params } as never);

      expect(res.status).toBe(201);
      expect(mockSql).toHaveBeenCalledTimes(2);
      expect(callsAsText()[1]).toContain('INSERT INTO league_player_drafts');
      expect(callsAsText().some((c) => c.includes('tournament_registrations'))).toBe(false);
    });

    it('assigns for real and updates tournament_registrations when active', async () => {
      mockSql
        .mockResolvedValueOnce([{ gender_category: 'either', status: 'active' }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const res = await POST(makeRequest({ playerIds: ['p1'], force: true }) as never, { params } as never);

      expect(res.status).toBe(201);
      expect(mockSql).toHaveBeenCalledTimes(3);
      expect(callsAsText()[1]).toContain('INSERT INTO league_players');
      expect(callsAsText()[2]).toContain('tournament_registrations');
    });
  });

  describe('POST - placeholder tournament name conflicts', () => {
    it('blocks adding a placeholder whose name already exists in the tournament (singles)', async () => {
      mockSql
        .mockResolvedValueOnce([{ gender_category: 'either', status: 'upcoming', tournament_id: 'tournament-1' }])
        .mockResolvedValueOnce([{ id: 'real-1', full_name: 'Bob Smith' }]); // conflict found

      const res = await POST(makeRequest({ playerIds: ['ph-1'], force: true }) as never, { params } as never);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toMatch(/Bob Smith is already in this tournament/i);
      expect(mockSql).toHaveBeenCalledTimes(2); // never reaches the insert
    });

    it('blocks adding a placeholder whose name already exists in the tournament (doubles pair)', async () => {
      mockSql
        .mockResolvedValueOnce([{ gender_category: 'either', status: 'upcoming', tournament_id: 'tournament-1' }])
        .mockResolvedValueOnce([{ id: 'real-1', full_name: 'Bob Smith' }]); // conflict on p1Id

      const res = await POST(makeRequest({ pairs: [{ p1Id: 'ph-1', p2Id: 'p2' }], force: true }) as never, { params } as never);

      expect(res.status).toBe(400);
      expect(mockSql).toHaveBeenCalledTimes(2);
    });

    it('allows adding when there is no name conflict in the tournament', async () => {
      mockSql
        .mockResolvedValueOnce([{ gender_category: 'either', status: 'upcoming', tournament_id: 'tournament-1' }])
        .mockResolvedValueOnce([]) // no conflict
        .mockResolvedValueOnce([]); // insert

      const res = await POST(makeRequest({ playerIds: ['ph-1'], force: true }) as never, { params } as never);

      expect(res.status).toBe(201);
    });

    it('skips the conflict check entirely when the league has no tournament_id', async () => {
      mockSql
        .mockResolvedValueOnce([{ gender_category: 'either', status: 'upcoming' }]) // no tournament_id
        .mockResolvedValueOnce([]); // insert

      const res = await POST(makeRequest({ playerIds: ['ph-1'], force: true }) as never, { params } as never);

      expect(res.status).toBe(201);
      expect(mockSql).toHaveBeenCalledTimes(2);
    });
  });

  describe('DELETE singles', () => {
    it('deletes from league_player_drafts and skips tournament_registrations when upcoming', async () => {
      mockSql
        .mockResolvedValueOnce([{ status: 'upcoming' }])
        .mockResolvedValueOnce([]);

      const res = await DELETE(makeRequest({ playerId: 'p1' }) as never, { params } as never);

      expect(res.status).toBe(200);
      expect(mockSql).toHaveBeenCalledTimes(2);
      expect(callsAsText()[1]).toContain('DELETE FROM league_player_drafts');
    });

    it('deletes from league_players and clears assigned_league_id when active', async () => {
      mockSql
        .mockResolvedValueOnce([{ status: 'active' }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const res = await DELETE(makeRequest({ playerId: 'p1' }) as never, { params } as never);

      expect(res.status).toBe(200);
      expect(mockSql).toHaveBeenCalledTimes(3);
      expect(callsAsText()[1]).toContain('DELETE FROM league_players');
      expect(callsAsText()[2]).toContain('tournament_registrations');
    });
  });
});

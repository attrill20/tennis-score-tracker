const mockSql = jest.fn();
const mockAuth = jest.fn();

jest.mock('@/lib/db', () => ({ __esModule: true, default: (...args: unknown[]) => mockSql(...args) }));
jest.mock('@/auth', () => ({ auth: () => mockAuth() }));

import { GET } from '@/app/api/admin/tournaments/[tournamentId]/assign-divisions/route';
import { POST as SUGGEST } from '@/app/api/admin/tournaments/[tournamentId]/assign-divisions/suggest/route';
import { POST as MOVE } from '@/app/api/admin/tournaments/[tournamentId]/assign-divisions/move/route';
import { POST as PAIR } from '@/app/api/admin/tournaments/[tournamentId]/assign-divisions/pair/route';
import { POST as CONFIRM } from '@/app/api/admin/tournaments/[tournamentId]/assign-divisions/confirm/route';
import { POST as RESTORE } from '@/app/api/admin/tournaments/[tournamentId]/assign-divisions/restore/route';

function makeRequest(body: unknown) {
  return { json: async () => body } as unknown as Request;
}

const params = Promise.resolve({ tournamentId: 'tournament-1' });

function callsAsText() {
  return mockSql.mock.calls.map((c) => (c[0] as TemplateStringsArray).join('?'));
}

const singlesDivisions = [
  { id: 'league-1', name: 'Division 1', division_order: 1, max_players: 8, league_type: 'singles', status: 'upcoming' },
  { id: 'league-2', name: 'Division 2', division_order: 2, max_players: 8, league_type: 'singles', status: 'upcoming' },
];
const doublesDivision = [
  { id: 'league-1', name: 'Division 1', division_order: 1, max_players: 8, league_type: 'doubles', status: 'upcoming' },
];

describe('assign-divisions API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: 'admin-1', role: 'admin' } });
  });

  describe('GET', () => {
    it('rejects non-admins', async () => {
      mockAuth.mockResolvedValue({ user: { id: 'm-1', role: 'member' } });
      const res = await GET({} as never, { params } as never);
      expect(res.status).toBe(403);
    });

    it('rejects a non-multi tournament', async () => {
      mockSql.mockResolvedValueOnce([{ format: 'single' }]);
      const res = await GET({} as never, { params } as never);
      expect(res.status).toBe(400);
    });

    it('returns divisions, registrations, drafts and every addable player', async () => {
      mockSql
        .mockResolvedValueOnce([{ format: 'multi' }])
        .mockResolvedValueOnce(singlesDivisions)
        .mockResolvedValueOnce([{ id: 'reg-1', player_id: 'p1', full_name: 'Alice', ability_level: 'intermediate', answers: {} }])
        .mockResolvedValueOnce([{ league_id: 'league-1', player_id: 'p1', partner_id: null, confirmed: false }])
        .mockResolvedValueOnce([{ id: 'p1', full_name: 'Alice', is_placeholder: false, placeholder_alias: null, placeholder_anonymized: false }]);

      const res = await GET({} as never, { params } as never);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.divisions).toEqual(singlesDivisions);
      expect(data.registrations).toHaveLength(1);
      expect(data.drafts).toHaveLength(1);
      expect(data.players).toHaveLength(1);
    });

    it('includes unverified members in the addable-players list, flagged as unverified', async () => {
      mockSql
        .mockResolvedValueOnce([{ format: 'multi' }])
        .mockResolvedValueOnce(singlesDivisions)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ id: 'p1', full_name: 'New Member', is_placeholder: false, placeholder_alias: null, placeholder_anonymized: false, is_unverified: true }]);

      const res = await GET({} as never, { params } as never);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.players).toEqual([{ id: 'p1', full_name: 'New Member', is_placeholder: false, placeholder_alias: null, placeholder_anonymized: false, is_unverified: true }]);

      const playersSql = (mockSql.mock.calls[4][0] as TemplateStringsArray).join('?');
      expect(playersSql).not.toContain("role != 'unverified'");
      expect(playersSql).toContain("role = 'unverified' AS is_unverified");
    });
  });

  describe('suggest', () => {
    it('replaces existing drafts with a fresh suggestion and returns the pre-allocation snapshot', async () => {
      const previousDrafts = [{ league_id: 'league-1', player_id: 'p1', partner_id: null, confirmed: false }];
      mockSql
        .mockResolvedValueOnce(singlesDivisions) // getCurrentRoundDivisions
        .mockResolvedValueOnce([
          { id: 'reg-1', player_id: 'p1', ability_level: 'intermediate' },
          { id: 'reg-2', player_id: 'p2', ability_level: 'beginner' },
        ])
        .mockResolvedValueOnce(previousDrafts) // snapshot taken before wiping drafts
        .mockResolvedValue([]); // BEGIN / DELETE / INSERT*n / COMMIT

      const res = await SUGGEST({} as never, { params } as never);
      const data = await res.json();
      expect(res.status).toBe(200);
      expect(data.previousDrafts).toEqual(previousDrafts);

      const calls = callsAsText();
      expect(calls.some((c) => c.includes('BEGIN'))).toBe(true);
      expect(calls.some((c) => c.includes('DELETE FROM league_player_drafts'))).toBe(true);
      expect(calls.some((c) => c.includes('INSERT INTO league_player_drafts'))).toBe(true);
      expect(calls.some((c) => c.includes('COMMIT'))).toBe(true);
    });

    it('refuses when the tournament has no current-round divisions', async () => {
      mockSql.mockResolvedValueOnce([]);
      const res = await SUGGEST({} as never, { params } as never);
      expect(res.status).toBe(400);
    });
  });

  describe('restore', () => {
    it('replaces the current arrangement with the given snapshot', async () => {
      mockSql
        .mockResolvedValueOnce(singlesDivisions) // getCurrentRoundDivisions
        .mockResolvedValue([]); // BEGIN / DELETE / INSERT*n / COMMIT

      const snapshot = [{ league_id: 'league-1', player_id: 'p1', partner_id: null, confirmed: false }];
      const res = await RESTORE(makeRequest({ drafts: snapshot }) as never, { params } as never);

      expect(res.status).toBe(200);
      const calls = callsAsText();
      expect(calls.some((c) => c.includes('BEGIN'))).toBe(true);
      expect(calls.some((c) => c.includes('DELETE FROM league_player_drafts'))).toBe(true);
      expect(calls.some((c) => c.includes('INSERT INTO league_player_drafts'))).toBe(true);
    });

    it('ignores snapshot rows outside this round', async () => {
      mockSql
        .mockResolvedValueOnce(singlesDivisions)
        .mockResolvedValue([]);

      const snapshot = [{ league_id: 'not-in-round', player_id: 'p1', partner_id: null, confirmed: false }];
      await RESTORE(makeRequest({ drafts: snapshot }) as never, { params } as never);

      const calls = callsAsText();
      expect(calls.some((c) => c.includes('INSERT INTO league_player_drafts'))).toBe(false);
    });

    it('requires a drafts array', async () => {
      const res = await RESTORE(makeRequest({}) as never, { params } as never);
      expect(res.status).toBe(400);
    });
  });

  describe('move', () => {
    it('drafts a player into a division', async () => {
      mockSql
        .mockResolvedValueOnce(singlesDivisions) // getCurrentRoundDivisions
        .mockResolvedValueOnce([]) // existing draft lookup (none)
        .mockResolvedValueOnce([]) // placeholder tournament name conflict check (none)
        .mockResolvedValueOnce([]) // delete
        .mockResolvedValueOnce([]); // insert

      const res = await MOVE(makeRequest({ playerId: 'p1', targetLeagueId: 'league-2' }) as never, { params } as never);

      expect(res.status).toBe(200);
      const calls = callsAsText();
      expect(calls.some((c) => c.includes('DELETE FROM league_player_drafts'))).toBe(true);
      expect(calls.some((c) => c.includes('INSERT INTO league_player_drafts'))).toBe(true);
    });

    it('unassigns a player when targetLeagueId is null', async () => {
      mockSql
        .mockResolvedValueOnce(singlesDivisions)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const res = await MOVE(makeRequest({ playerId: 'p1', targetLeagueId: null }) as never, { params } as never);

      expect(res.status).toBe(200);
      expect(mockSql).toHaveBeenCalledTimes(3);
    });

    it('rejects a target division outside this round', async () => {
      mockSql.mockResolvedValueOnce(singlesDivisions);
      const res = await MOVE(makeRequest({ playerId: 'p1', targetLeagueId: 'not-in-round' }) as never, { params } as never);
      expect(res.status).toBe(400);
    });

    it('blocks moving a placeholder into a division when the name already exists in the tournament', async () => {
      mockSql
        .mockResolvedValueOnce(singlesDivisions) // getCurrentRoundDivisions
        .mockResolvedValueOnce([]) // existing draft lookup (none)
        .mockResolvedValueOnce([{ id: 'real-1', full_name: 'Bob Smith' }]); // conflict found

      const res = await MOVE(makeRequest({ playerId: 'ph-1', targetLeagueId: 'league-2' }) as never, { params } as never);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toMatch(/Bob Smith is already in this tournament/i);
      expect(mockSql).toHaveBeenCalledTimes(3); // never reaches delete/insert
    });
  });

  describe('pair', () => {
    it('pairs two players in a doubles division', async () => {
      mockSql
        .mockResolvedValueOnce(doublesDivision)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const res = await PAIR(makeRequest({ leagueId: 'league-1', p1Id: 'p1', p2Id: 'p2' }) as never, { params } as never);

      expect(res.status).toBe(200);
      expect(mockSql).toHaveBeenCalledTimes(3);
    });

    it('refuses to pair in a singles division', async () => {
      mockSql.mockResolvedValueOnce(singlesDivisions);
      const res = await PAIR(makeRequest({ leagueId: 'league-1', p1Id: 'p1', p2Id: 'p2' }) as never, { params } as never);
      expect(res.status).toBe(400);
    });

    it('unpairs when p2Id is null', async () => {
      mockSql
        .mockResolvedValueOnce(doublesDivision)
        .mockResolvedValueOnce([{ partner_id: 'p2' }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const res = await PAIR(makeRequest({ leagueId: 'league-1', p1Id: 'p1', p2Id: null }) as never, { params } as never);

      expect(res.status).toBe(200);
      expect(mockSql).toHaveBeenCalledTimes(4);
    });
  });

  describe('confirm', () => {
    it('marks all current-round drafts confirmed', async () => {
      mockSql
        .mockResolvedValueOnce(singlesDivisions)
        .mockResolvedValueOnce([]);

      const res = await CONFIRM({} as never, { params } as never);

      expect(res.status).toBe(200);
      expect(callsAsText()[1]).toContain('confirmed = true');
    });
  });
});

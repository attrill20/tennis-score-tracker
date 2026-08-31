const mockSql = jest.fn();
const mockAuth = jest.fn();

jest.mock('@/lib/db', () => ({ __esModule: true, default: (...args: unknown[]) => mockSql(...args) }));
jest.mock('@/auth', () => ({ auth: () => mockAuth() }));

import { DELETE } from '@/app/api/leagues/[id]/route';

const params = Promise.resolve({ id: 'league-1' });

function callsAsText() {
  return mockSql.mock.calls.map((c) => (c[0] as TemplateStringsArray).join('?'));
}

describe('DELETE /api/leagues/[id]', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: 'admin-1', role: 'super_admin' } });
  });

  it('rejects non-super-admins', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'a-1', role: 'admin' } });
    const res = await DELETE({} as never, { params } as never);
    expect(res.status).toBe(403);
    expect(mockSql).not.toHaveBeenCalled();
  });

  it('cleans up disputes, matches, league_players, league_player_drafts and registration links before deleting the league', async () => {
    mockSql
      .mockResolvedValueOnce([{ tournament_id: 'tournament-1' }]) // lookup
      .mockResolvedValue([]); // every DELETE/UPDATE below

    const res = await DELETE({} as never, { params } as never);

    expect(res.status).toBe(200);
    const calls = callsAsText();
    expect(calls.some((c) => c.includes('DELETE FROM disputes'))).toBe(true);
    expect(calls.some((c) => c.includes('DELETE FROM matches'))).toBe(true);
    expect(calls.some((c) => c.includes('DELETE FROM league_players') && !c.includes('drafts'))).toBe(true);
    expect(calls.some((c) => c.includes('DELETE FROM league_player_drafts'))).toBe(true);
    expect(calls.some((c) => c.includes('UPDATE tournament_registrations') && c.includes('assigned_league_id = ?'))).toBe(true);
    expect(calls.some((c) => c.includes('DELETE FROM leagues'))).toBe(true);
  });

  it('also deletes the parent tournament once it has no divisions left', async () => {
    mockSql
      .mockResolvedValueOnce([{ tournament_id: 'tournament-1' }])
      .mockResolvedValue([]);

    await DELETE({} as never, { params } as never);

    const calls = callsAsText();
    expect(calls.some((c) => c.includes('DELETE FROM tournaments'))).toBe(true);
  });

  it('does not try to delete a tournament when the league had none (orphan league)', async () => {
    mockSql
      .mockResolvedValueOnce([{ tournament_id: null }])
      .mockResolvedValue([]);

    await DELETE({} as never, { params } as never);

    const calls = callsAsText();
    expect(calls.some((c) => c.includes('DELETE FROM tournaments'))).toBe(false);
  });
});

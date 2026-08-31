const mockAuth = jest.fn();
const mockResize = jest.fn();

jest.mock('@/auth', () => ({ auth: () => mockAuth() }));
jest.mock('@/lib/divisionDrafts', () => ({ resizeCurrentRoundDivisions: (...args: unknown[]) => mockResize(...args) }));

import { POST } from '@/app/api/admin/tournaments/[tournamentId]/assign-divisions/resize/route';

function makeRequest(body: unknown) {
  return { json: async () => body } as unknown as Request;
}

const params = Promise.resolve({ tournamentId: 'tournament-1' });

describe('POST /api/admin/tournaments/[tournamentId]/assign-divisions/resize', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: 'admin-1', role: 'admin' } });
  });

  it('rejects non-admins', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'm-1', role: 'member' } });
    const res = await POST(makeRequest({ numDivisions: 4 }) as never, { params } as never);
    expect(res.status).toBe(403);
    expect(mockResize).not.toHaveBeenCalled();
  });

  it('rejects a number of divisions outside 2-10', async () => {
    const res = await POST(makeRequest({ numDivisions: 1 }) as never, { params } as never);
    expect(res.status).toBe(400);
    expect(mockResize).not.toHaveBeenCalled();
  });

  it('rejects a non-integer number of divisions', async () => {
    const res = await POST(makeRequest({ numDivisions: 4.5 }) as never, { params } as never);
    expect(res.status).toBe(400);
    expect(mockResize).not.toHaveBeenCalled();
  });

  it('passes numDivisions and force through to resizeCurrentRoundDivisions', async () => {
    mockResize.mockResolvedValue({ status: 'ok', created: 2, removed: 0 });

    const res = await POST(makeRequest({ numDivisions: 5, force: true }) as never, { params } as never);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toEqual({ success: true, created: 2, removed: 0 });
    expect(mockResize).toHaveBeenCalledWith('tournament-1', 5, true);
  });

  it('defaults force to false when omitted', async () => {
    mockResize.mockResolvedValue({ status: 'ok', created: 0, removed: 1 });
    await POST(makeRequest({ numDivisions: 4 }) as never, { params } as never);
    expect(mockResize).toHaveBeenCalledWith('tournament-1', 4, false);
  });

  it('surfaces a needs_confirmation result as 409', async () => {
    mockResize.mockResolvedValue({ status: 'needs_confirmation', message: '3 players will be returned to the pool' });

    const res = await POST(makeRequest({ numDivisions: 2 }) as never, { params } as never);
    const data = await res.json();

    expect(res.status).toBe(409);
    expect(data).toEqual({ error: '3 players will be returned to the pool', needsConfirmation: true });
  });

  it('surfaces an error result as 400', async () => {
    mockResize.mockResolvedValue({ status: 'error', message: 'The current round has already started' });

    const res = await POST(makeRequest({ numDivisions: 2 }) as never, { params } as never);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data).toEqual({ error: 'The current round has already started' });
  });
});

const mockSql = jest.fn();
const mockAuth = jest.fn();

jest.mock('@/lib/db', () => ({ __esModule: true, default: (...args: unknown[]) => mockSql(...args) }));
jest.mock('@/auth', () => ({ auth: () => mockAuth() }));

import { POST, DELETE } from '@/app/api/tournaments/[tournamentId]/register/route';

function makeRequest(body: unknown) {
  return { json: async () => body } as unknown as Request;
}

const params = Promise.resolve({ tournamentId: 't-1' });
const noQuestions: unknown[] = [];

describe('POST /api/tournaments/[tournamentId]/register', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: 'player-1', role: 'member' } });
  });

  it('rejects when the tournament has no registration form', async () => {
    mockSql.mockResolvedValueOnce([{ format: 'single', status: 'upcoming', has_registration_form: false, max_registrations: null, registration_questions: noQuestions }]);

    const res = await POST(makeRequest({ abilityLevel: 'intermediate', answers: {} }) as never, { params } as never);

    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/does not have a registration form/i);
  });

  it('rejects an invalid ability level', async () => {
    mockSql.mockResolvedValueOnce([{ format: 'single', status: 'upcoming', has_registration_form: true, max_registrations: null, registration_questions: noQuestions }]);

    const res = await POST(makeRequest({ abilityLevel: 'pro', answers: {} }) as never, { params } as never);

    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/ability level/i);
  });

  it('rejects when a required custom question is left unanswered', async () => {
    const questions = [{ id: 'q1', type: 'short_text', label: 'Required thing', required: true }];
    mockSql.mockResolvedValueOnce([{ format: 'single', status: 'upcoming', has_registration_form: true, max_registrations: null, registration_questions: questions }]);

    const res = await POST(makeRequest({ abilityLevel: 'intermediate', answers: {} }) as never, { params } as never);

    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/required question/i);
  });

  it('rejects a new registration once the multi-format capacity is reached', async () => {
    mockSql
      .mockResolvedValueOnce([{ format: 'multi', status: 'upcoming', has_registration_form: true, max_registrations: 10, registration_questions: noQuestions }]) // tournament
      .mockResolvedValueOnce([]) // no existing registration
      .mockResolvedValueOnce([{ count: '10' }]); // current registration count

    const res = await POST(makeRequest({ abilityLevel: 'intermediate', answers: {} }) as never, { params } as never);

    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/full/i);
  });

  it('allows editing an existing unassigned registration even when at capacity', async () => {
    mockSql
      .mockResolvedValueOnce([{ format: 'multi', status: 'upcoming', has_registration_form: true, max_registrations: 10, registration_questions: noQuestions }]) // tournament
      .mockResolvedValueOnce([{ id: 'reg-1', assigned_league_id: null }]) // existing registration, unassigned
      .mockResolvedValueOnce([{}]); // the upsert

    const res = await POST(makeRequest({ abilityLevel: 'beginner', answers: {} }) as never, { params } as never);

    expect(res.status).toBe(200);
    // Capacity count query should never run since they're already registered.
    expect(mockSql).toHaveBeenCalledTimes(3);
  });

  it('rejects editing once the registration has already been assigned to a division', async () => {
    mockSql
      .mockResolvedValueOnce([{ format: 'multi', status: 'upcoming', has_registration_form: true, max_registrations: null, registration_questions: noQuestions }]) // tournament
      .mockResolvedValueOnce([{ id: 'reg-1', assigned_league_id: 'league-1' }]); // already assigned

    const res = await POST(makeRequest({ abilityLevel: 'beginner', answers: {} }) as never, { params } as never);

    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/already been placed/i);
  });

  it('rejects registration once the tournament is no longer upcoming', async () => {
    mockSql.mockResolvedValueOnce([{ format: 'single', status: 'active', has_registration_form: true, max_registrations: null, registration_questions: noQuestions }]);

    const res = await POST(makeRequest({ abilityLevel: 'intermediate', answers: {} }) as never, { params } as never);

    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/closed/i);
  });
});

describe('DELETE /api/tournaments/[tournamentId]/register', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: 'player-1', role: 'member' } });
  });

  it('withdraws an unassigned registration while the tournament is upcoming', async () => {
    mockSql
      .mockResolvedValueOnce([{ status: 'upcoming' }]) // tournament
      .mockResolvedValueOnce([{ assigned_league_id: null }]) // existing registration
      .mockResolvedValueOnce([{}]); // the delete

    const res = await DELETE({} as never, { params } as never);

    expect(res.status).toBe(200);
  });

  it('rejects when the tournament is no longer upcoming', async () => {
    mockSql.mockResolvedValueOnce([{ status: 'active' }]);

    const res = await DELETE({} as never, { params } as never);

    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/upcoming/i);
  });

  it('rejects when there is no registration to withdraw', async () => {
    mockSql
      .mockResolvedValueOnce([{ status: 'upcoming' }])
      .mockResolvedValueOnce([]); // no existing registration

    const res = await DELETE({} as never, { params } as never);

    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/not registered/i);
  });

  it('rejects withdrawing a registration that has already been assigned to a division', async () => {
    mockSql
      .mockResolvedValueOnce([{ status: 'upcoming' }])
      .mockResolvedValueOnce([{ assigned_league_id: 'league-1' }]);

    const res = await DELETE({} as never, { params } as never);

    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/already been placed/i);
  });

  it('rejects an unauthenticated request', async () => {
    mockAuth.mockResolvedValue(null);

    const res = await DELETE({} as never, { params } as never);

    expect(res.status).toBe(401);
  });
});

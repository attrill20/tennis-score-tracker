const mockSql = jest.fn();
const mockSendVerificationEmail = jest.fn();

jest.mock('@/lib/db', () => ({ __esModule: true, default: (...args: unknown[]) => mockSql(...args) }));
jest.mock('@/lib/mailer', () => ({ sendVerificationEmail: (...args: unknown[]) => mockSendVerificationEmail(...args) }));

import { POST } from '@/app/api/register/route';

function makeRequest(body: unknown) {
  return { json: async () => body } as unknown as Request;
}

const validBody = {
  email: 'newmember@example.com',
  password: 'password123',
  firstName: 'John',
  lastName: 'Smith',
  phone: null,
  gender: 'mens',
};

describe('POST /api/register', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSendVerificationEmail.mockResolvedValue(undefined);
  });

  it('blocks registration when the name matches an existing real member', async () => {
    mockSql
      .mockResolvedValueOnce([]) // email check - no existing account
      .mockResolvedValueOnce([{ id: 'real-1' }]); // name clash - a real member has this name

    const res = await POST(makeRequest(validBody) as never);

    expect(res.status).toBe(409);
    expect((await res.json()).error).toMatch(/already registered/i);
    expect(mockSql).toHaveBeenCalledTimes(2);
  });

  it('excludes placeholders from the name-clash check, letting registration succeed', async () => {
    mockSql
      .mockResolvedValueOnce([]) // email check
      .mockResolvedValueOnce([]) // name clash - none, since placeholders are excluded
      .mockResolvedValueOnce([]); // insert

    const res = await POST(makeRequest(validBody) as never);

    expect(res.status).toBe(201);

    const nameClashCall = mockSql.mock.calls[1];
    const sqlText = (nameClashCall[0] as TemplateStringsArray).join('?');
    expect(sqlText).toContain('is_placeholder = false');

    expect(mockSendVerificationEmail).toHaveBeenCalledWith('newmember@example.com', expect.any(String));
  });

  it('still blocks on a duplicate email regardless of name', async () => {
    mockSql.mockResolvedValueOnce([{ id: 'existing-1' }]); // email already exists

    const res = await POST(makeRequest(validBody) as never);

    expect(res.status).toBe(409);
    expect((await res.json()).error).toMatch(/account with this email already exists/i);
    expect(mockSql).toHaveBeenCalledTimes(1);
  });
});

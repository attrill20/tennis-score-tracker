import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AssignDivisionsPanel from '@/components/AssignDivisionsPanel';

const mockRefresh = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}));

const division = { id: 'div-1', name: 'Division 1', division_order: 1, max_players: 8, league_type: 'singles', status: 'upcoming' };

function boardResponse(players: Array<{ id: string; full_name: string; is_placeholder: boolean; placeholder_alias: string | null; placeholder_anonymized: boolean }> = []) {
  return { divisions: [division], registrations: [], drafts: [], players };
}

function mockFetch(players: Parameters<typeof boardResponse>[0] = []) {
  return jest.fn((url: string, opts?: RequestInit) => {
    const method = opts?.method ?? 'GET';
    if (url.endsWith('/assign-divisions') && method === 'GET') {
      return Promise.resolve({ ok: true, json: async () => boardResponse(players) });
    }
    if (url === '/api/admin/placeholder-players' && method === 'POST') {
      return Promise.resolve({ ok: true, json: async () => ({ id: 'ph-new' }) });
    }
    if (url.endsWith('/assign-divisions/move') && method === 'POST') {
      return Promise.resolve({ ok: true, json: async () => ({ success: true }) });
    }
    return Promise.resolve({ ok: true, json: async () => ({}) });
  }) as unknown as typeof fetch;
}

async function openCreatePlaceholderForm() {
  await waitFor(() => screen.getByText('Division 1'));
  await userEvent.click(screen.getByText('+ Add player'));
  await userEvent.click(screen.getByText('+ Create new placeholder'));
}

describe('AssignDivisionsPanel inline placeholder creation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates a placeholder and immediately assigns it to the division', async () => {
    global.fetch = mockFetch();
    render(<AssignDivisionsPanel tournamentId="tournament-1" />);
    await openCreatePlaceholderForm();

    const nameInput = screen.getByPlaceholderText('Full name');
    await userEvent.type(nameInput, 'Carl Newguest');
    await userEvent.click(screen.getByText('Add to division'));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/admin/placeholder-players',
        expect.objectContaining({ method: 'POST', body: expect.stringContaining('Carl Newguest') })
      );
    });
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/admin/tournaments/tournament-1/assign-divisions/move',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ playerId: 'ph-new', targetLeagueId: 'div-1' }),
        })
      );
    });

    // Picker closes back to its collapsed state once the placeholder is created and assigned.
    await waitFor(() => expect(screen.getByText('+ Add player')).toBeInTheDocument());
  });

  it('pre-fills the alias with the next available numbered placeholder name', async () => {
    global.fetch = mockFetch([
      { id: 'existing-ph', full_name: 'Existing Guest', is_placeholder: true, placeholder_alias: 'Placeholder Player 1', placeholder_anonymized: false },
    ]);
    render(<AssignDivisionsPanel tournamentId="tournament-1" />);
    await openCreatePlaceholderForm();

    const aliasInput = screen.getByPlaceholderText('Alias (shown when anonymized)') as HTMLInputElement;
    expect(aliasInput.value).toBe('Placeholder Player 2');
  });

  it('requires an alias when anonymizing a new placeholder', async () => {
    global.fetch = mockFetch();
    render(<AssignDivisionsPanel tournamentId="tournament-1" />);
    await openCreatePlaceholderForm();

    await userEvent.type(screen.getByPlaceholderText('Full name'), 'Carl Newguest');
    await userEvent.clear(screen.getByPlaceholderText('Alias (shown when anonymized)'));
    await userEvent.click(screen.getByText(/anonymize/i));
    await userEvent.click(screen.getByText('Add to division'));

    expect(await screen.findByText(/alias is required/i)).toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalledWith('/api/admin/placeholder-players', expect.anything());
  });

  it('returns to the search list without creating anything when Back is clicked', async () => {
    global.fetch = mockFetch();
    render(<AssignDivisionsPanel tournamentId="tournament-1" />);
    await openCreatePlaceholderForm();

    await userEvent.click(screen.getByText('Back'));

    expect(screen.getByPlaceholderText('Search...')).toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalledWith('/api/admin/placeholder-players', expect.anything());
  });
});

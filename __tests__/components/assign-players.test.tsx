import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AssignPlayersForm from '@/app/(app)/admin/tournaments/AssignPlayersForm';

const mockRefresh = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}));

const mockLeagues = [
  { id: 'league-1', name: 'Division 1', status: 'upcoming' },
  { id: 'league-2', name: 'Division 2', status: 'active' },
];

const mockMembers = [
  { id: 'player-1', full_name: 'Alice Smith' },
  { id: 'player-2', full_name: 'Bob Jones' },
  { id: 'player-3', full_name: 'Charlie Brown' },
];

describe('AssignPlayersForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
  });

  it('renders league dropdown with all leagues', () => {
    render(<AssignPlayersForm leagues={mockLeagues} members={mockMembers} />);
    expect(screen.getByLabelText(/tournament/i)).toBeInTheDocument();
    expect(screen.getByText('Division 1')).toBeInTheDocument();
    expect(screen.getByText('Division 2')).toBeInTheDocument();
  });

  it('does not show player list before a league is selected', () => {
    render(<AssignPlayersForm leagues={mockLeagues} members={mockMembers} />);
    expect(screen.queryByPlaceholderText(/search players/i)).not.toBeInTheDocument();
    expect(screen.queryByText('Alice Smith')).not.toBeInTheDocument();
  });

  it('loads and shows players after selecting a league', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => [],
    });

    render(<AssignPlayersForm leagues={mockLeagues} members={mockMembers} />);
    fireEvent.change(screen.getByLabelText(/tournament/i), { target: { value: 'league-1' } });

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/search players/i)).toBeInTheDocument();
      expect(screen.getByText('Alice Smith')).toBeInTheDocument();
      expect(screen.getByText('Bob Jones')).toBeInTheDocument();
      expect(screen.getByText('Charlie Brown')).toBeInTheDocument();
    });
  });

  it('fetches existing players for the league and pre-ticks them', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ['player-1', 'player-3'],
    });

    render(<AssignPlayersForm leagues={mockLeagues} members={mockMembers} />);
    fireEvent.change(screen.getByLabelText(/tournament/i), { target: { value: 'league-1' } });

    await waitFor(() => {
      const checkboxes = screen.getAllByRole('checkbox');
      const alice = checkboxes.find((cb) => cb.closest('label')?.textContent?.includes('Alice Smith')) as HTMLInputElement;
      const bob = checkboxes.find((cb) => cb.closest('label')?.textContent?.includes('Bob Jones')) as HTMLInputElement;
      const charlie = checkboxes.find((cb) => cb.closest('label')?.textContent?.includes('Charlie Brown')) as HTMLInputElement;
      expect(alice.checked).toBe(true);
      expect(bob.checked).toBe(false);
      expect(charlie.checked).toBe(true);
    });
  });

  it('filters players by search input', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => [],
    });

    render(<AssignPlayersForm leagues={mockLeagues} members={mockMembers} />);
    fireEvent.change(screen.getByLabelText(/tournament/i), { target: { value: 'league-1' } });

    await waitFor(() => screen.getByPlaceholderText(/search players/i));
    await userEvent.type(screen.getByPlaceholderText(/search players/i), 'alice');

    expect(screen.getByText('Alice Smith')).toBeInTheDocument();
    expect(screen.queryByText('Bob Jones')).not.toBeInTheDocument();
    expect(screen.queryByText('Charlie Brown')).not.toBeInTheDocument();
  });

  it('shows "No players found" when search has no matches', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => [],
    });

    render(<AssignPlayersForm leagues={mockLeagues} members={mockMembers} />);
    fireEvent.change(screen.getByLabelText(/tournament/i), { target: { value: 'league-1' } });

    await waitFor(() => screen.getByPlaceholderText(/search players/i));
    await userEvent.type(screen.getByPlaceholderText(/search players/i), 'zzz');

    expect(screen.getByText(/no players found/i)).toBeInTheDocument();
  });

  it('immediately POSTs when a player is ticked', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: true, json: async () => [] }) // GET existing players
      .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true }) }); // POST

    render(<AssignPlayersForm leagues={mockLeagues} members={mockMembers} />);
    fireEvent.change(screen.getByLabelText(/tournament/i), { target: { value: 'league-1' } });

    await waitFor(() => screen.getByText('Alice Smith'));
    fireEvent.click(screen.getByText('Alice Smith').closest('label')!);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/admin/leagues/league-1/players',
        expect.objectContaining({ method: 'POST' })
      );
    });
  });

  it('immediately DELETEs when a pre-ticked player is unticked', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: true, json: async () => ['player-1', 'player-2'] }) // GET existing
      .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true }) }); // DELETE

    render(<AssignPlayersForm leagues={mockLeagues} members={mockMembers} />);
    fireEvent.change(screen.getByLabelText(/tournament/i), { target: { value: 'league-1' } });

    await waitFor(() => screen.getByText('Bob Jones'));
    fireEvent.click(screen.getByText('Bob Jones').closest('label')!);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/admin/leagues/league-1/players',
        expect.objectContaining({
          method: 'DELETE',
          body: expect.stringContaining('player-2'),
        })
      );
    });
  });

  it('shows an error and reverts the checkbox if the API call fails', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: true, json: async () => [] }) // GET
      .mockResolvedValueOnce({ ok: false, json: async () => ({ error: 'Server error' }) }); // POST fails

    render(<AssignPlayersForm leagues={mockLeagues} members={mockMembers} />);
    fireEvent.change(screen.getByLabelText(/tournament/i), { target: { value: 'league-1' } });

    await waitFor(() => screen.getByText('Alice Smith'));
    fireEvent.click(screen.getByText('Alice Smith').closest('label')!);

    await waitFor(() => {
      expect(screen.getByText(/server error/i)).toBeInTheDocument();
      // Checkbox should be reverted back to unchecked
      const checkboxes = screen.getAllByRole('checkbox');
      const alice = checkboxes.find((cb) => cb.closest('label')?.textContent?.includes('Alice Smith')) as HTMLInputElement;
      expect(alice.checked).toBe(false);
    });
  });

  it('resets player list when a different league is selected', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: true, json: async () => ['player-1'] })
      .mockResolvedValueOnce({ ok: true, json: async () => [] });

    render(<AssignPlayersForm leagues={mockLeagues} members={mockMembers} />);
    fireEvent.change(screen.getByLabelText(/tournament/i), { target: { value: 'league-1' } });

    await waitFor(() => screen.getByText('Alice Smith'));

    fireEvent.change(screen.getByLabelText(/tournament/i), { target: { value: 'league-2' } });

    await waitFor(() => {
      const checkboxes = screen.getAllByRole('checkbox');
      checkboxes.forEach((cb) => expect((cb as HTMLInputElement).checked).toBe(false));
    });
  });
});

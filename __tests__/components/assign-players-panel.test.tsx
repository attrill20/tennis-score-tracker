import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AssignPlayersPanel from '@/components/AssignPlayersPanel';

const mockRefresh = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}));

const mockMembers = [
  { id: 'player-1', full_name: 'Alice Smith' },
  { id: 'player-2', full_name: 'Bob Guest', is_placeholder: true, placeholder_alias: 'Guest 1', placeholder_anonymized: true },
];

describe('AssignPlayersPanel placeholders', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => [] });
  });

  it('badges a placeholder member with their alias', async () => {
    render(<AssignPlayersPanel leagueId="league-1" leagueType="singles" members={mockMembers} />);

    await waitFor(() => screen.getByText('Alice Smith'));
    expect(screen.getByText('Bob Guest')).toBeInTheDocument();
    expect(screen.getByText(/Placeholder - shown as "Guest 1"/)).toBeInTheDocument();
  });

  it('pre-fills the alias with the next available numbered placeholder name', async () => {
    render(<AssignPlayersPanel leagueId="league-1" leagueType="singles" members={mockMembers} />);
    await waitFor(() => screen.getByText('Alice Smith'));

    await userEvent.click(screen.getByText('+ Add placeholder player'));

    const [aliasInput] = screen.getAllByPlaceholderText('Alias (shown when anonymized)') as HTMLInputElement[];
    // "Guest 1" doesn't match the numbered pattern, so the first free number is still 1.
    expect(aliasInput.value).toBe('Placeholder Player 1');
  });

  it('opens the inline placeholder form and creates one', async () => {
    render(<AssignPlayersPanel leagueId="league-1" leagueType="singles" members={mockMembers} />);
    await waitFor(() => screen.getByText('Alice Smith'));

    await userEvent.click(screen.getByText('+ Add placeholder player'));

    const [nameInput] = screen.getAllByPlaceholderText('Full name');
    await userEvent.type(nameInput, 'Carl Newguest');

    (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'ph-new' }) });

    await userEvent.click(screen.getByText('Add and assign below'));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/admin/placeholder-players',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('Carl Newguest'),
        })
      );
      expect(mockRefresh).toHaveBeenCalled();
    });
  });

  it('requires an alias when anonymizing a new placeholder', async () => {
    render(<AssignPlayersPanel leagueId="league-1" leagueType="singles" members={mockMembers} />);
    await waitFor(() => screen.getByText('Alice Smith'));

    await userEvent.click(screen.getByText('+ Add placeholder player'));
    const [nameInput] = screen.getAllByPlaceholderText('Full name');
    await userEvent.type(nameInput, 'Carl Newguest');
    const [aliasInput] = screen.getAllByPlaceholderText('Alias (shown when anonymized)');
    await userEvent.clear(aliasInput);
    await userEvent.click(screen.getByText(/anonymize/i));
    await userEvent.click(screen.getByText('Add and assign below'));

    expect(await screen.findByText(/alias is required/i)).toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalledWith('/api/admin/placeholder-players', expect.anything());
  });
});

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CreateLeagueForm from '@/app/(app)/admin/leagues/CreateLeagueForm';

const mockRefresh = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}));

describe('CreateLeagueForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
  });

  it('renders all form fields', () => {
    render(<CreateLeagueForm />);
    expect(screen.getByLabelText(/league name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/start date/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/end date/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/scoring method/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/number of players/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/number promoted/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/number relegated/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/status/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create league/i })).toBeInTheDocument();
  });

  it('has correct default values', () => {
    render(<CreateLeagueForm />);
    expect(screen.getByLabelText(/scoring method/i)).toHaveValue('best_of_3_tiebreak');
    expect(screen.getByLabelText(/number of players/i)).toHaveValue('8');
    expect(screen.getByLabelText(/number promoted/i)).toHaveValue('2');
    expect(screen.getByLabelText(/number relegated/i)).toHaveValue('2');
    expect(screen.getByLabelText(/status/i)).toHaveValue('upcoming');
  });

  it('scoring method dropdown has all 6 options', () => {
    render(<CreateLeagueForm />);
    const select = screen.getByLabelText(/scoring method/i);
    const options = Array.from((select as HTMLSelectElement).options).map((o) => o.value);
    expect(options).toEqual([
      '1_set_tiebreak',
      '1_set_no_tiebreak',
      'best_of_3_tiebreak',
      'best_of_3_no_tiebreak',
      'best_of_5_tiebreak',
      'best_of_5_no_tiebreak',
    ]);
  });

  it('number of players dropdown has options 2 to 12', () => {
    render(<CreateLeagueForm />);
    const select = screen.getByLabelText(/number of players/i);
    const values = Array.from((select as HTMLSelectElement).options).map((o) => Number(o.value));
    expect(values).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });

  it('number promoted and relegated dropdowns have options 0 to 5', () => {
    render(<CreateLeagueForm />);
    const promoted = screen.getByLabelText(/number promoted/i);
    const relegated = screen.getByLabelText(/number relegated/i);
    const expectedValues = [0, 1, 2, 3, 4, 5];
    expect(Array.from((promoted as HTMLSelectElement).options).map((o) => Number(o.value))).toEqual(expectedValues);
    expect(Array.from((relegated as HTMLSelectElement).options).map((o) => Number(o.value))).toEqual(expectedValues);
  });

  it('submits all fields to the API', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });

    render(<CreateLeagueForm />);

    await userEvent.type(screen.getByLabelText(/league name/i), 'Division 1 Spring 2026');
    fireEvent.change(screen.getByLabelText(/start date/i), { target: { value: '2026-05-01' } });
    fireEvent.change(screen.getByLabelText(/end date/i), { target: { value: '2026-07-01' } });
    fireEvent.change(screen.getByLabelText(/scoring method/i), { target: { value: 'best_of_5_tiebreak' } });
    fireEvent.change(screen.getByLabelText(/number of players/i), { target: { value: '6' } });
    fireEvent.change(screen.getByLabelText(/number promoted/i), { target: { value: '1' } });
    fireEvent.change(screen.getByLabelText(/number relegated/i), { target: { value: '1' } });
    fireEvent.click(screen.getByRole('button', { name: /create league/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/admin/leagues', expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('Division 1 Spring 2026'),
      }));
      const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
      expect(body.scoringMethod).toBe('best_of_5_tiebreak');
      expect(body.maxPlayers).toBe(6);
      expect(body.numPromoted).toBe(1);
      expect(body.numRelegated).toBe(1);
    });
  });

  it('shows an error message if the API returns an error', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Unauthorised' }),
    });

    render(<CreateLeagueForm />);

    await userEvent.type(screen.getByLabelText(/league name/i), 'Test League');
    fireEvent.change(screen.getByLabelText(/start date/i), { target: { value: '2026-05-01' } });
    fireEvent.change(screen.getByLabelText(/end date/i), { target: { value: '2026-07-01' } });
    fireEvent.click(screen.getByRole('button', { name: /create league/i }));

    await waitFor(() => {
      expect(screen.getByText(/unauthorised/i)).toBeInTheDocument();
    });
  });

  it('refreshes the page after successful creation', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });

    render(<CreateLeagueForm />);

    await userEvent.type(screen.getByLabelText(/league name/i), 'New League');
    fireEvent.change(screen.getByLabelText(/start date/i), { target: { value: '2026-05-01' } });
    fireEvent.change(screen.getByLabelText(/end date/i), { target: { value: '2026-07-01' } });
    fireEvent.click(screen.getByRole('button', { name: /create league/i }));

    await waitFor(() => {
      expect(mockRefresh).toHaveBeenCalled();
    });
  });
});

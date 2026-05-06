import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CreateLeagueForm from '@/app/(app)/admin/leagues/CreateLeagueForm';

// Mock next/navigation
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
    expect(screen.getByLabelText(/status/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create league/i })).toBeInTheDocument();
  });

  it('submits correct data to the API', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });

    render(<CreateLeagueForm />);

    await userEvent.type(screen.getByLabelText(/league name/i), 'Division 1 Spring 2026');
    fireEvent.change(screen.getByLabelText(/start date/i), { target: { value: '2026-05-01' } });
    fireEvent.change(screen.getByLabelText(/end date/i), { target: { value: '2026-07-01' } });
    fireEvent.click(screen.getByRole('button', { name: /create league/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/admin/leagues', expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('Division 1 Spring 2026'),
      }));
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

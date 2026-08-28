import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RegistrationForm from '@/components/RegistrationForm';
import type { RegistrationQuestion } from '@/lib/registration';

const mockRefresh = jest.fn();
const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mockRefresh, push: mockPush }),
}));

const profile = { fullName: 'Alice Smith', phone: '07700 900000', email: 'alice@example.com' };
const redirectHref = '/tournaments/multi/t-1';

const questions: RegistrationQuestion[] = [
  { id: 'previous_division', type: 'single_choice', label: 'Previous division', options: ['1', '2', '3'], required: false },
  { id: 'similar_player_1', type: 'short_text', label: 'Similar player', required: false },
  { id: 'notes', type: 'long_text', label: 'Any other notes', required: false },
];

describe('RegistrationForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
  });

  it('shows the read-only profile details, the fixed ability toggle, and each custom question', () => {
    render(<RegistrationForm tournamentId="t-1" profile={profile} questions={questions} initial={null} redirectHref={redirectHref} />);

    expect(screen.getByText(/Alice Smith/)).toBeInTheDocument();
    expect(screen.getByText(/07700 900000/)).toBeInTheDocument();
    expect(screen.queryByText(/alice@example.com/)).not.toBeInTheDocument();

    expect(screen.getByRole('button', { name: 'Beginner' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Parks League Thursdays' })).toBeInTheDocument();

    expect(screen.getByText(/Previous division/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '2' })).toBeInTheDocument();
    expect(screen.getByLabelText(/similar player/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/any other notes/i)).toBeInTheDocument();
  });

  it('falls back to showing email when the player has no phone number on file', () => {
    render(<RegistrationForm tournamentId="t-1" profile={{ ...profile, phone: null }} questions={questions} initial={null} redirectHref={redirectHref} />);

    expect(screen.getByText(/alice@example.com/)).toBeInTheDocument();
    expect(screen.queryByText(/07700 900000/)).not.toBeInTheDocument();
  });

  it('requires an ability level before submitting', async () => {
    render(<RegistrationForm tournamentId="t-1" profile={profile} questions={questions} initial={null} redirectHref={redirectHref} />);

    fireEvent.click(screen.getByRole('button', { name: /^register$/i }));

    await waitFor(() => {
      expect(screen.getByText(/select your ability level/i)).toBeInTheDocument();
    });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('submits the ability level and custom answers to the API', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({ success: true }) });

    render(<RegistrationForm tournamentId="t-1" profile={profile} questions={questions} initial={null} redirectHref={redirectHref} />);

    fireEvent.click(screen.getByRole('button', { name: 'Parks League Tuesdays' }));
    fireEvent.click(screen.getByRole('button', { name: '3' }));
    await userEvent.type(screen.getByLabelText(/similar player/i), 'Bob Jones');
    await userEvent.type(screen.getByLabelText(/any other notes/i), 'Happy to play any day');
    fireEvent.click(screen.getByRole('button', { name: /^register$/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/tournaments/t-1/register', expect.objectContaining({ method: 'POST' }));
    });
    const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    expect(body.abilityLevel).toBe('parks_tuesdays');
    expect(body.answers).toEqual({
      previous_division: '3',
      similar_player_1: 'Bob Jones',
      notes: 'Happy to play any day',
    });
  });

  it('shows the saved confirmation then redirects back to the tournament home page', async () => {
    jest.useFakeTimers({ legacyFakeTimers: false, doNotFake: ['queueMicrotask'] });
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({ success: true }) });

    render(<RegistrationForm tournamentId="t-1" profile={profile} questions={questions} initial={null} redirectHref={redirectHref} />);

    fireEvent.click(screen.getByRole('button', { name: 'Beginner' }));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^register$/i }));
    });

    expect(screen.getByText(/registration saved/i)).toBeInTheDocument();
    expect(mockPush).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(1200);
    });

    expect(mockPush).toHaveBeenCalledWith(redirectHref);
    jest.useRealTimers();
  });

  it('pre-fills from an existing registration and shows "Update registration"', () => {
    render(
      <RegistrationForm
        tournamentId="t-1"
        profile={profile}
        questions={questions}
        redirectHref={redirectHref}
        initial={{
          abilityLevel: 'beginner',
          answers: { previous_division: '2', similar_player_1: 'Charlie' },
        }}
      />
    );

    expect(screen.getByRole('button', { name: 'Beginner' })).toHaveClass('bg-green-900');
    expect(screen.getByRole('button', { name: '2' })).toHaveClass('bg-green-900');
    expect(screen.getByDisplayValue('Charlie')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /update registration/i })).toBeInTheDocument();
  });

  it('shows an error message if the API returns an error', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: false, json: async () => ({ error: 'Registration is full' }) });

    render(<RegistrationForm tournamentId="t-1" profile={profile} questions={questions} initial={null} redirectHref={redirectHref} />);

    fireEvent.click(screen.getByRole('button', { name: 'Beginner' }));
    fireEvent.click(screen.getByRole('button', { name: /^register$/i }));

    await waitFor(() => {
      expect(screen.getByText(/registration is full/i)).toBeInTheDocument();
    });
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('renders no extra questions when the tournament has none configured', () => {
    render(<RegistrationForm tournamentId="t-1" profile={profile} questions={[]} initial={null} redirectHref={redirectHref} />);
    expect(screen.getByRole('button', { name: 'Beginner' })).toBeInTheDocument();
    expect(screen.queryByText('Previous division')).not.toBeInTheDocument();
  });
});

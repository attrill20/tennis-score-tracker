import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RegistrationsPanel from '@/components/RegistrationsPanel';

const mockRefresh = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}));

const divisions = [
  { id: 'div-1', name: 'Division 1', order: 1 },
  { id: 'div-2', name: 'Division 2', order: 2 },
];

const baseRegistration = {
  id: 'reg-1',
  player_id: 'player-1',
  full_name: 'Alice Smith',
  phone: null,
  email: 'alice@example.com',
  ability_level: 'intermediate',
  answers: {},
  suggested_division: null,
};

describe('RegistrationsPanel - currently assigned draft division', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true }) });
  });

  it('shows a badge for a registrant already drafted into a division, and labels the button "Move"', async () => {
    render(
      <RegistrationsPanel
        registrations={[{ ...baseRegistration, current_division_id: 'div-1', current_division_name: 'Division 1' }]}
        registrationCount={1}
        maxRegistrations={null}
        divisions={divisions}
        questions={[]}
        tournamentId="tournament-1"
        isDraft
      />
    );

    await userEvent.click(screen.getByText('Registrations'));

    expect(screen.getByText(/Currently assigned: Division 1/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Move' })).toBeInTheDocument();
  });

  it('does not show the badge, and labels the button "Assign", for an unassigned registrant', async () => {
    render(
      <RegistrationsPanel
        registrations={[baseRegistration]}
        registrationCount={1}
        maxRegistrations={null}
        divisions={divisions}
        questions={[]}
        tournamentId="tournament-1"
        isDraft
      />
    );

    await userEvent.click(screen.getByText('Registrations'));

    expect(screen.queryByText(/Currently assigned/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Assign' })).toBeInTheDocument();
  });

  it('moving an already-drafted registrant to a new division calls the assign-divisions move endpoint (isDraft)', async () => {
    render(
      <RegistrationsPanel
        registrations={[{ ...baseRegistration, current_division_id: 'div-1', current_division_name: 'Division 1' }]}
        registrationCount={1}
        maxRegistrations={null}
        divisions={divisions}
        questions={[]}
        tournamentId="tournament-1"
        isDraft
      />
    );

    await userEvent.click(screen.getByText('Registrations'));
    await userEvent.selectOptions(screen.getByLabelText('Division for Alice Smith'), 'div-2');
    await userEvent.click(screen.getByRole('button', { name: 'Move' }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/admin/tournaments/tournament-1/assign-divisions/move',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ playerId: 'player-1', targetLeagueId: 'div-2' }),
        })
      );
      expect(mockRefresh).toHaveBeenCalled();
    });
  });

  it('assigning a registrant once the round is active calls the plain leagues/players endpoint, not move', async () => {
    render(
      <RegistrationsPanel
        registrations={[baseRegistration]}
        registrationCount={1}
        maxRegistrations={null}
        divisions={divisions}
        questions={[]}
        tournamentId="tournament-1"
        isDraft={false}
      />
    );

    await userEvent.click(screen.getByText('Registrations'));
    await userEvent.selectOptions(screen.getByLabelText('Division for Alice Smith'), 'div-1');
    await userEvent.click(screen.getByRole('button', { name: 'Assign' }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/admin/leagues/div-1/players',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ playerIds: ['player-1'] }),
        })
      );
      expect(mockRefresh).toHaveBeenCalled();
    });
  });
});

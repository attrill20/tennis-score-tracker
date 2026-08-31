import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PlaceholderMatchNotice from '@/components/PlaceholderMatchNotice';

const mockRefresh = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}));

const props = {
  placeholderId: 'ph-1',
  placeholderFullName: 'Bob Smith',
  placeholderAlias: 'Guest 1',
  placeholderAnonymized: true,
  memberId: 'real-1',
  memberFullName: 'Bob Smith',
  memberEmailVerified: false,
};

describe('PlaceholderMatchNotice', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true }) });
    window.confirm = jest.fn().mockReturnValue(true);
  });

  it('shows both names and the placeholder alias', () => {
    render(<PlaceholderMatchNotice {...props} />);
    expect(screen.getAllByText('Bob Smith')).toHaveLength(2);
    expect(screen.getByText(/shown as "Guest 1"/)).toBeInTheDocument();
    expect(screen.getByText(/email is not verified yet/)).toBeInTheDocument();
  });

  it('confirms, then swaps the member into the placeholder via the merge endpoint', async () => {
    render(<PlaceholderMatchNotice {...props} />);

    await userEvent.click(screen.getByText('Swap in'));

    expect(window.confirm).toHaveBeenCalled();
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/admin/placeholder-players/ph-1/merge',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ realAccountId: 'real-1' }),
        })
      );
    });
    await waitFor(() => expect(mockRefresh).toHaveBeenCalled());
  });

  it('does not call the merge endpoint if the confirmation is cancelled', async () => {
    window.confirm = jest.fn().mockReturnValue(false);
    render(<PlaceholderMatchNotice {...props} />);

    await userEvent.click(screen.getByText('Swap in'));

    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('shows the API error message when the swap fails', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, json: async () => ({ error: 'Already in the same league' }) });
    render(<PlaceholderMatchNotice {...props} />);

    await userEvent.click(screen.getByText('Swap in'));

    expect(await screen.findByText('Already in the same league')).toBeInTheDocument();
    expect(mockRefresh).not.toHaveBeenCalled();
  });

  it('dismisses the notice locally without calling the merge endpoint', async () => {
    render(<PlaceholderMatchNotice {...props} />);

    await userEvent.click(screen.getByText('Not now'));

    expect(screen.queryByText('Swap in')).not.toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

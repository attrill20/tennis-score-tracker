import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SwitchPlaceholderControl from '@/components/SwitchPlaceholderControl';

const realMembers = [
  { id: 'real-1', full_name: 'Alice Smith' },
  { id: 'real-2', full_name: 'Bob Jones' },
];

const props = {
  placeholderId: 'ph-1',
  placeholderFullName: 'Guest Player',
  realMembers,
};

describe('SwitchPlaceholderControl', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true }) });
    window.confirm = jest.fn().mockReturnValue(true);
  });

  it('shows a search list of real members once opened', async () => {
    const onSwapped = jest.fn();
    render(<SwitchPlaceholderControl {...props} onSwapped={onSwapped} />);

    await userEvent.click(screen.getByText('Switch to real member'));

    expect(screen.getByText('Alice Smith')).toBeInTheDocument();
    expect(screen.getByText('Bob Jones')).toBeInTheDocument();
  });

  it('filters candidates by search text', async () => {
    render(<SwitchPlaceholderControl {...props} onSwapped={jest.fn()} />);
    await userEvent.click(screen.getByText('Switch to real member'));

    await userEvent.type(screen.getByPlaceholderText('Search real members...'), 'Alice');

    expect(screen.getByText('Alice Smith')).toBeInTheDocument();
    expect(screen.queryByText('Bob Jones')).not.toBeInTheDocument();
  });

  it('confirms, then merges the picked real member via the merge endpoint', async () => {
    const onSwapped = jest.fn();
    render(<SwitchPlaceholderControl {...props} onSwapped={onSwapped} />);
    await userEvent.click(screen.getByText('Switch to real member'));

    await userEvent.click(screen.getByText('Alice Smith'));

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
    await waitFor(() => expect(onSwapped).toHaveBeenCalled());
  });

  it('does not call the merge endpoint if the confirmation is cancelled', async () => {
    window.confirm = jest.fn().mockReturnValue(false);
    render(<SwitchPlaceholderControl {...props} onSwapped={jest.fn()} />);
    await userEvent.click(screen.getByText('Switch to real member'));

    await userEvent.click(screen.getByText('Alice Smith'));

    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('shows the API error message when the switch fails', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, json: async () => ({ error: 'Target account not found' }) });
    const onSwapped = jest.fn();
    render(<SwitchPlaceholderControl {...props} onSwapped={onSwapped} />);
    await userEvent.click(screen.getByText('Switch to real member'));

    await userEvent.click(screen.getByText('Alice Smith'));

    expect(await screen.findByText('Target account not found')).toBeInTheDocument();
    expect(onSwapped).not.toHaveBeenCalled();
  });

  it('closes without swapping on Cancel', async () => {
    render(<SwitchPlaceholderControl {...props} onSwapped={jest.fn()} />);
    await userEvent.click(screen.getByText('Switch to real member'));

    await userEvent.click(screen.getByText('Cancel'));

    expect(screen.getByText('Switch to real member')).toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

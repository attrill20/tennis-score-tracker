import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AssignDivisionsPanel, { buildAllocationsCsv, divisionEntryLines, filenameSafeName } from '@/components/AssignDivisionsPanel';

const mockRefresh = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}));

// jspdf ships an ESM-only build that Jest can't parse under node_modules by default, so it's
// mocked wholesale rather than fighting transformIgnorePatterns across its own ESM dependencies.
const mockPdfText = jest.fn();
const mockPdfSave = jest.fn();
const mockPdfAddImage = jest.fn();
const mockPdfSplitTextToSize = jest.fn((text: string) => [text]);
jest.mock('jspdf', () => {
  class MockJsPDF {
    internal = { pageSize: { getWidth: () => 297, getHeight: () => 210 } };
    setFont = jest.fn();
    setFontSize = jest.fn();
    text = mockPdfText;
    splitTextToSize = mockPdfSplitTextToSize;
    setDrawColor = jest.fn();
    line = jest.fn();
    addImage = mockPdfAddImage;
    save = mockPdfSave;
  }
  return { __esModule: true, default: MockJsPDF };
});

// jsdom's Image never actually fires onload/onerror for a real asset, so exportPdf's
// `await loadImage(...)` would hang forever without this - resolves on the next microtask,
// same as a real (fast, same-origin) image load would in practice.
class MockImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  private _src = '';
  get src() { return this._src; }
  set src(value: string) {
    this._src = value;
    queueMicrotask(() => this.onload?.());
  }
}
global.Image = MockImage as unknown as typeof Image;

const division = { id: 'div-1', name: 'Division 1', division_order: 1, max_players: 8, league_type: 'singles', status: 'upcoming' };

function boardResponse(
  players: Array<{ id: string; full_name: string; is_placeholder: boolean; placeholder_alias: string | null; placeholder_anonymized: boolean }> = [],
  drafts: Array<{ league_id: string; player_id: string; partner_id: string | null; confirmed: boolean }> = []
) {
  return { divisions: [division], registrations: [], drafts, players };
}

function mockFetch(
  players: Parameters<typeof boardResponse>[0] = [],
  drafts: Parameters<typeof boardResponse>[1] = []
) {
  return jest.fn((url: string, opts?: RequestInit) => {
    const method = opts?.method ?? 'GET';
    if (url.endsWith('/assign-divisions') && method === 'GET') {
      return Promise.resolve({ ok: true, json: async () => boardResponse(players, drafts) });
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

function mockFetchWithFailingMove(moveError: string) {
  return jest.fn((url: string, opts?: RequestInit) => {
    const method = opts?.method ?? 'GET';
    if (url.endsWith('/assign-divisions') && method === 'GET') {
      return Promise.resolve({ ok: true, json: async () => boardResponse() });
    }
    if (url === '/api/admin/placeholder-players' && method === 'POST') {
      return Promise.resolve({ ok: true, json: async () => ({ id: 'ph-new' }) });
    }
    if (url.endsWith('/assign-divisions/move') && method === 'POST') {
      return Promise.resolve({ ok: false, json: async () => ({ error: moveError }) });
    }
    return Promise.resolve({ ok: true, json: async () => ({}) });
  }) as unknown as typeof fetch;
}

// The "Assign divisions" section is collapsed by default (like every other CollapsibleSection),
// so its content isn't in the DOM until expanded.
async function renderAssignDivisionsPanel() {
  const utils = render(<AssignDivisionsPanel tournamentId="tournament-1" tournamentName="Winter League" />);
  await userEvent.click(screen.getByText('Assign divisions'));
  return utils;
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
    await renderAssignDivisionsPanel();
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
    await renderAssignDivisionsPanel();
    await openCreatePlaceholderForm();

    const aliasInput = screen.getByPlaceholderText('Alias (shown when anonymized)') as HTMLInputElement;
    expect(aliasInput.value).toBe('Placeholder Player 2');
  });

  it('requires an alias when anonymizing a new placeholder', async () => {
    global.fetch = mockFetch();
    await renderAssignDivisionsPanel();
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
    await renderAssignDivisionsPanel();
    await openCreatePlaceholderForm();

    await userEvent.click(screen.getByText('Back'));

    expect(screen.getByPlaceholderText('Search...')).toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalledWith('/api/admin/placeholder-players', expect.anything());
  });

  it('keeps the create form open and shows the error inline when assigning the new placeholder fails', async () => {
    global.fetch = mockFetchWithFailingMove('Bob Smith is already in this tournament with the same name - rename one of them to tell them apart before adding.');
    await renderAssignDivisionsPanel();
    await openCreatePlaceholderForm();

    await userEvent.type(screen.getByPlaceholderText('Full name'), 'Bob Smith');
    await userEvent.click(screen.getByText('Add to division'));

    expect(await screen.findByText(/already in this tournament/i)).toBeInTheDocument();
    // Stays on the create form rather than closing back to the collapsed picker.
    expect(screen.getByText('Add to division')).toBeInTheDocument();
    // move() was called with { silent: true }, so the panel-level error banner shouldn't also duplicate the message.
    expect(screen.getAllByText(/already in this tournament/i)).toHaveLength(1);
  });
});

describe('AssignDivisionsPanel unverified members', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('badges an unverified member on their card and still offers the "+ Add player" picker for them', async () => {
    const players = [
      { id: 'p1', full_name: 'Carl Newguy', is_placeholder: false, placeholder_alias: null, placeholder_anonymized: false, is_unverified: true },
    ];
    const drafts = [{ league_id: 'div-1', player_id: 'p1', partner_id: null, confirmed: false }];
    global.fetch = mockFetch(players, drafts);

    await renderAssignDivisionsPanel();
    await waitFor(() => screen.getByText('Carl Newguy'));

    expect(screen.getByText('Unverified')).toBeInTheDocument();
  });

  it('shows an unverified badge for an unassigned candidate in the "+ Add player" picker', async () => {
    const players = [
      { id: 'p1', full_name: 'Carl Newguy', is_placeholder: false, placeholder_alias: null, placeholder_anonymized: false, is_unverified: true },
    ];
    global.fetch = mockFetch(players, []);

    await renderAssignDivisionsPanel();
    await waitFor(() => screen.getByText('Division 1'));
    await userEvent.click(screen.getByText('+ Add player'));

    expect(screen.getByText('Carl Newguy')).toBeInTheDocument();
    expect(screen.getByText('Unverified')).toBeInTheDocument();
  });
});

describe('AssignDivisionsPanel switch-to-real-member', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('offers "Switch to real member" on a placeholder card and merges the picked member', async () => {
    const players = [
      { id: 'ph-1', full_name: 'Guest Player', is_placeholder: true, placeholder_alias: null, placeholder_anonymized: false },
      { id: 'real-1', full_name: 'Alice Smith', is_placeholder: false, placeholder_alias: null, placeholder_anonymized: false },
    ];
    const drafts = [{ league_id: 'div-1', player_id: 'ph-1', partner_id: null, confirmed: false }];
    global.fetch = jest.fn((url: string, opts?: RequestInit) => {
      const method = opts?.method ?? 'GET';
      if (url.endsWith('/assign-divisions') && method === 'GET') {
        return Promise.resolve({ ok: true, json: async () => boardResponse(players, drafts) });
      }
      if (url === '/api/admin/placeholder-players/ph-1/merge' && method === 'POST') {
        return Promise.resolve({ ok: true, json: async () => ({ success: true }) });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    }) as unknown as typeof fetch;
    window.confirm = jest.fn().mockReturnValue(true);

    await renderAssignDivisionsPanel();
    await waitFor(() => screen.getByText('Guest Player'));

    await userEvent.click(screen.getByText('Switch'));
    await userEvent.click(screen.getByRole('button', { name: 'Alice Smith' }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/admin/placeholder-players/ph-1/merge',
        expect.objectContaining({ method: 'POST', body: JSON.stringify({ realAccountId: 'real-1' }) })
      );
    });
  });

  it('does not show the switch control on a non-placeholder card', async () => {
    const players = [
      { id: 'real-1', full_name: 'Alice Smith', is_placeholder: false, placeholder_alias: null, placeholder_anonymized: false },
    ];
    const drafts = [{ league_id: 'div-1', player_id: 'real-1', partner_id: null, confirmed: false }];
    global.fetch = mockFetch(players, drafts);

    await renderAssignDivisionsPanel();
    await waitFor(() => screen.getByText('Alice Smith'));

    expect(screen.queryByText('Switch')).not.toBeInTheDocument();
  });

  it('styles the Switch trigger as a badge matching the other tags on the card', async () => {
    const players = [
      { id: 'ph-1', full_name: 'Guest Player', is_placeholder: true, placeholder_alias: null, placeholder_anonymized: false },
    ];
    const drafts = [{ league_id: 'div-1', player_id: 'ph-1', partner_id: null, confirmed: false }];
    global.fetch = mockFetch(players, drafts);

    await renderAssignDivisionsPanel();
    await waitFor(() => screen.getByText('Guest Player'));

    const switchButton = screen.getByRole('button', { name: 'Switch' });
    const placeholderBadge = screen.getByText('Placeholder');
    // Same text size/weight and pill padding as its sibling badges, so the row's height doesn't
    // depend on whether this card happens to be a placeholder.
    for (const cls of ['text-xs', 'font-medium', 'px-1.5', 'py-0.5', 'rounded-full']) {
      expect(switchButton).toHaveClass(cls);
      expect(placeholderBadge).toHaveClass(cls);
    }
  });
});

describe('buildAllocationsCsv', () => {
  const divisions = [
    { id: 'div-1', name: 'Division 1', division_order: 1, max_players: 8, league_type: 'singles', status: 'upcoming' },
    { id: 'div-2', name: 'Division 2', division_order: 2, max_players: 8, league_type: 'doubles', status: 'upcoming' },
  ];

  it('includes each drafted player under their division, with ability level and type, sorted by name', () => {
    const drafts = [
      { league_id: 'div-1', player_id: 'p2', partner_id: null, confirmed: true },
      { league_id: 'div-1', player_id: 'p1', partner_id: null, confirmed: false },
    ];
    const playerById = new Map([
      ['p2', { id: 'p2', full_name: 'Guest Player', is_placeholder: true, placeholder_alias: null, placeholder_anonymized: false, is_unverified: false }],
    ]);
    const registrationByPlayer = new Map([
      ['p1', { id: 'reg-1', player_id: 'p1', full_name: 'Alice Smith', ability_level: 'intermediate' as const, answers: {} }],
    ]);

    const csv = buildAllocationsCsv(divisions, drafts, playerById, registrationByPlayer);
    const rows = csv.split('\r\n');

    expect(rows[0]).toBe('Division,Player,Type,Ability Level,Partner');
    // Sorted alphabetically within the division: Alice before Guest.
    expect(rows[1]).toBe('Division 1,Alice Smith,Member,Intermediate,');
    expect(rows[2]).toBe('Division 1,Guest Player,Placeholder,,');
  });

  it('includes the partner name for a doubles pairing', () => {
    const drafts = [{ league_id: 'div-2', player_id: 'p3', partner_id: 'p4', confirmed: false }];
    const playerById = new Map([
      ['p3', { id: 'p3', full_name: 'Carl Jones', is_placeholder: false, placeholder_alias: null, placeholder_anonymized: false, is_unverified: false }],
      ['p4', { id: 'p4', full_name: 'Dana White', is_placeholder: false, placeholder_alias: null, placeholder_anonymized: false, is_unverified: false }],
    ]);

    const csv = buildAllocationsCsv(divisions, drafts, playerById, new Map());

    expect(csv).toContain('Division 2,Carl Jones,Member,,Dana White');
  });

  it('quotes and escapes names containing commas or quotes', () => {
    const drafts = [{ league_id: 'div-1', player_id: 'p5', partner_id: null, confirmed: false }];
    const playerById = new Map([
      ['p5', { id: 'p5', full_name: 'Smith, "The Ace"', is_placeholder: false, placeholder_alias: null, placeholder_anonymized: false, is_unverified: false }],
    ]);

    const csv = buildAllocationsCsv([divisions[0]], drafts, playerById, new Map());

    expect(csv).toContain('"Smith, ""The Ace"""');
  });

  it('leaves out unassigned registrants entirely', () => {
    const csv = buildAllocationsCsv(divisions, [], new Map(), new Map());
    expect(csv).toBe('Division,Player,Type,Ability Level,Partner');
  });
});

describe('AssignDivisionsPanel export as CSV', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('disables the export button when there is nothing drafted', async () => {
    global.fetch = mockFetch();
    await renderAssignDivisionsPanel();
    await waitFor(() => screen.getByText('Division 1'));

    expect(screen.getByText('Export as CSV')).toBeDisabled();
  });

  it('downloads a CSV file of the current allocations when clicked', async () => {
    const players = [
      { id: 'p1', full_name: 'Alice Smith', is_placeholder: false, placeholder_alias: null, placeholder_anonymized: false },
    ];
    const drafts = [{ league_id: 'div-1', player_id: 'p1', partner_id: null, confirmed: false }];
    global.fetch = mockFetch(players, drafts);

    const createObjectURL = jest.fn().mockReturnValue('blob:mock-url');
    const revokeObjectURL = jest.fn();
    global.URL.createObjectURL = createObjectURL;
    global.URL.revokeObjectURL = revokeObjectURL;
    let downloadedFilename = '';
    const clickSpy = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      downloadedFilename = this.download;
    });

    await renderAssignDivisionsPanel();
    await waitFor(() => screen.getByText('Alice Smith'));

    await userEvent.click(screen.getByText('Export as CSV'));

    expect(createObjectURL).toHaveBeenCalled();
    const blobArg = createObjectURL.mock.calls[0][0] as Blob;
    expect(blobArg.type).toBe('text/csv;charset=utf-8;');
    expect(clickSpy).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
    expect(downloadedFilename).toBe('league-allocations-winter league.csv');

    clickSpy.mockRestore();
  });
});

describe('filenameSafeName', () => {
  it('lowercases the name', () => {
    expect(filenameSafeName('Winter League')).toBe('winter league');
  });

  it('strips filesystem-unsafe characters', () => {
    expect(filenameSafeName('Summer/Autumn: "Cup" <2026>')).toBe('summerautumn cup 2026');
  });

  it('trims surrounding whitespace', () => {
    expect(filenameSafeName('  Spring League  ')).toBe('spring league');
  });
});

describe('divisionEntryLines', () => {
  const division = { id: 'div-1', name: 'Division 1', division_order: 1, max_players: 8, league_type: 'doubles', status: 'upcoming' };

  it('lists singles players sorted by name', () => {
    const drafts = [
      { league_id: 'div-1', player_id: 'p2', partner_id: null, confirmed: false },
      { league_id: 'div-1', player_id: 'p1', partner_id: null, confirmed: false },
    ];
    const playerById = new Map([
      ['p1', { id: 'p1', full_name: 'Alice Smith', is_placeholder: false, placeholder_alias: null, placeholder_anonymized: false, is_unverified: false }],
      ['p2', { id: 'p2', full_name: 'Bob Jones', is_placeholder: false, placeholder_alias: null, placeholder_anonymized: false, is_unverified: false }],
    ]);

    expect(divisionEntryLines(division, drafts, playerById, new Map())).toEqual(['Alice Smith', 'Bob Jones']);
  });

  it('collapses a doubles pair onto a single "A / B" line instead of listing both sides', () => {
    const drafts = [
      { league_id: 'div-1', player_id: 'p1', partner_id: 'p2', confirmed: false },
      { league_id: 'div-1', player_id: 'p2', partner_id: 'p1', confirmed: false },
    ];
    const playerById = new Map([
      ['p1', { id: 'p1', full_name: 'Alice Smith', is_placeholder: false, placeholder_alias: null, placeholder_anonymized: false, is_unverified: false }],
      ['p2', { id: 'p2', full_name: 'Bob Jones', is_placeholder: false, placeholder_alias: null, placeholder_anonymized: false, is_unverified: false }],
    ]);

    expect(divisionEntryLines(division, drafts, playerById, new Map())).toEqual(['Alice Smith / Bob Jones']);
  });

  it('returns an empty list when nothing is drafted into the division', () => {
    expect(divisionEntryLines(division, [], new Map(), new Map())).toEqual([]);
  });
});

describe('AssignDivisionsPanel download PDF', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('disables the download button when there is nothing drafted', async () => {
    global.fetch = mockFetch();
    await renderAssignDivisionsPanel();
    await waitFor(() => screen.getByText('Division 1'));

    expect(screen.getByText('Download PDF')).toBeDisabled();
  });

  it('generates and saves a landscape PDF named for the tournament when clicked', async () => {
    const players = [
      { id: 'p1', full_name: 'Alice Smith', is_placeholder: false, placeholder_alias: null, placeholder_anonymized: false },
    ];
    const drafts = [{ league_id: 'div-1', player_id: 'p1', partner_id: null, confirmed: false }];
    global.fetch = mockFetch(players, drafts);

    await renderAssignDivisionsPanel();
    await waitFor(() => screen.getByText('Alice Smith'));

    await userEvent.click(screen.getByText('Download PDF'));

    await waitFor(() => expect(mockPdfSave).toHaveBeenCalledWith('league-allocations-winter league.pdf'));
    expect(mockPdfText).toHaveBeenCalledWith('Winter League', expect.any(Number), expect.any(Number));
    expect(mockPdfText).toHaveBeenCalledWith('League Allocations', expect.any(Number), expect.any(Number));
    expect(mockPdfText).toHaveBeenCalledWith(expect.stringContaining('Alice Smith'), expect.any(Number), expect.any(Number));
    // Logo drawn top-right: x + logo size should land at/near the page's right edge (297mm wide).
    expect(mockPdfAddImage).toHaveBeenCalledWith(expect.anything(), 'JPEG', expect.any(Number), expect.any(Number), 16, 16);
    const [, , logoX] = mockPdfAddImage.mock.calls[0];
    expect(logoX + 16).toBeCloseTo(297 - 8, 5);
  });

  it('still produces and saves the PDF if the logo fails to load', async () => {
    global.Image = class {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_value: string) { queueMicrotask(() => this.onerror?.()); }
    } as unknown as typeof Image;

    const players = [
      { id: 'p1', full_name: 'Alice Smith', is_placeholder: false, placeholder_alias: null, placeholder_anonymized: false },
    ];
    const drafts = [{ league_id: 'div-1', player_id: 'p1', partner_id: null, confirmed: false }];
    global.fetch = mockFetch(players, drafts);

    await renderAssignDivisionsPanel();
    await waitFor(() => screen.getByText('Alice Smith'));

    await userEvent.click(screen.getByText('Download PDF'));

    await waitFor(() => expect(mockPdfSave).toHaveBeenCalledWith('league-allocations-winter league.pdf'));
    expect(mockPdfAddImage).not.toHaveBeenCalled();

    global.Image = MockImage as unknown as typeof Image;
  });

  it('sizes each division column to fit the landscape page width for up to 10 divisions', async () => {
    const manyDivisions = Array.from({ length: 10 }, (_, i) => ({
      id: `div-${i + 1}`, name: `Division ${i + 1}`, division_order: i + 1, max_players: 8, league_type: 'singles', status: 'upcoming',
    }));
    global.fetch = jest.fn((url: string, opts?: RequestInit) => {
      const method = opts?.method ?? 'GET';
      if (url.endsWith('/assign-divisions') && method === 'GET') {
        return Promise.resolve({ ok: true, json: async () => ({ divisions: manyDivisions, registrations: [], drafts: [
          { league_id: 'div-1', player_id: 'p1', partner_id: null, confirmed: false },
        ], players: [
          { id: 'p1', full_name: 'Alice Smith', is_placeholder: false, placeholder_alias: null, placeholder_anonymized: false },
        ] }) });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    }) as unknown as typeof fetch;

    await renderAssignDivisionsPanel();
    await waitFor(() => screen.getByText('Alice Smith'));

    await userEvent.click(screen.getByText('Download PDF'));

    await waitFor(() => expect(mockPdfSave).toHaveBeenCalledWith('league-allocations-winter league.pdf'));

    // One splitTextToSize/text call per division heading (10), plus the page title and the one
    // drafted player's line - confirms it laid out all 10 columns without throwing.
    expect(mockPdfSplitTextToSize.mock.calls.length).toBeGreaterThanOrEqual(10);
    expect(mockPdfText.mock.calls.length).toBeGreaterThanOrEqual(11);

    // 10 divisions wrap into a 5-per-row grid (2 rows of 5) rather than 10 ever-narrower columns
    // squeezed into one row. The heading is passed through splitTextToSize first, so it arrives
    // as a single-element array.
    const headingCalls = mockPdfText.mock.calls
      .filter((call) => {
        const value = call[0];
        const text = Array.isArray(value) ? value[0] : value;
        return typeof text === 'string' && text.startsWith('Division ');
      })
      .map((call) => ({ x: call[1] as number, y: call[2] as number }));

    expect(headingCalls).toHaveLength(10);
    expect(new Set(headingCalls.map((c) => c.x)).size).toBe(5);
    expect(new Set(headingCalls.map((c) => c.y)).size).toBe(2);
    // Division 1 and Division 6 land in the same column (row-wrapped) but different rows.
    expect(headingCalls[0].x).toBeCloseTo(headingCalls[5].x, 5);
    expect(headingCalls[0].y).not.toBeCloseTo(headingCalls[5].y, 5);
  });

  it('keeps a small number of divisions on a single row using the full page width, not a forced 5-column grid', async () => {
    const threeDivisions = Array.from({ length: 3 }, (_, i) => ({
      id: `div-${i + 1}`, name: `Division ${i + 1}`, division_order: i + 1, max_players: 8, league_type: 'singles', status: 'upcoming',
    }));
    global.fetch = jest.fn((url: string, opts?: RequestInit) => {
      const method = opts?.method ?? 'GET';
      if (url.endsWith('/assign-divisions') && method === 'GET') {
        return Promise.resolve({ ok: true, json: async () => ({ divisions: threeDivisions, registrations: [], drafts: [
          { league_id: 'div-1', player_id: 'p1', partner_id: null, confirmed: false },
        ], players: [
          { id: 'p1', full_name: 'Alice Smith', is_placeholder: false, placeholder_alias: null, placeholder_anonymized: false },
        ] }) });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    }) as unknown as typeof fetch;

    await renderAssignDivisionsPanel();
    await waitFor(() => screen.getByText('Alice Smith'));

    await userEvent.click(screen.getByText('Download PDF'));

    await waitFor(() => expect(mockPdfSave).toHaveBeenCalledWith('league-allocations-winter league.pdf'));

    const headingCalls = mockPdfText.mock.calls
      .filter((call) => {
        const value = call[0];
        const text = Array.isArray(value) ? value[0] : value;
        return typeof text === 'string' && text.startsWith('Division ');
      })
      .map((call) => ({ x: call[1] as number, y: call[2] as number }));

    expect(headingCalls).toHaveLength(3);
    // All 3 on one row: 3 distinct x positions (one column each), a single shared y (row).
    expect(new Set(headingCalls.map((c) => c.x)).size).toBe(3);
    expect(new Set(headingCalls.map((c) => c.y)).size).toBe(1);
    // Each of the 3 columns spans (297mm - 16mm margins) / 3 ≈ 93.7mm - much wider than the
    // ~27.7mm a naive one-row-of-10 layout would give, which is the point of the 5-per-row cap.
    const xs = headingCalls.map((c) => c.x).sort((a, b) => a - b);
    expect(xs[1] - xs[0]).toBeCloseTo((297 - 8 * 2) / 3, 1);
  });

  it('packs the second row tightly under small divisions instead of leaving a huge fixed gap', async () => {
    // 7 small divisions (1 player each) - row-wraps into 5 + 2 at the 5-per-row cap.
    const sevenDivisions = Array.from({ length: 7 }, (_, i) => ({
      id: `div-${i + 1}`, name: `Division ${i + 1}`, division_order: i + 1, max_players: 8, league_type: 'singles', status: 'upcoming',
    }));
    const players = Array.from({ length: 7 }, (_, i) => ({
      id: `p${i + 1}`, full_name: `Player ${i + 1}`, is_placeholder: false, placeholder_alias: null, placeholder_anonymized: false,
    }));
    const drafts = sevenDivisions.map((d, i) => ({ league_id: d.id, player_id: `p${i + 1}`, partner_id: null, confirmed: false }));
    global.fetch = jest.fn((url: string, opts?: RequestInit) => {
      const method = opts?.method ?? 'GET';
      if (url.endsWith('/assign-divisions') && method === 'GET') {
        return Promise.resolve({ ok: true, json: async () => ({ divisions: sevenDivisions, registrations: [], drafts, players }) });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    }) as unknown as typeof fetch;

    await renderAssignDivisionsPanel();
    await waitFor(() => screen.getByText('Player 1'));

    await userEvent.click(screen.getByText('Download PDF'));

    await waitFor(() => expect(mockPdfSave).toHaveBeenCalledWith('league-allocations-winter league.pdf'));

    const headingCalls = mockPdfText.mock.calls
      .filter((call) => {
        const value = call[0];
        const text = Array.isArray(value) ? value[0] : value;
        return typeof text === 'string' && text.startsWith('Division ');
      })
      .map((call) => call[2] as number);

    // Row 2 (divisions 6-7) starts right after row 1's one-line-heading + one-player content
    // (heading 4.5mm + 4mm gap + one 4.5mm player line = 13mm) plus the row gap (10mm) - not a
    // huge fixed band sized for the whole remaining page height.
    const row2Y = headingCalls[5];
    expect(row2Y).toBeCloseTo(32 + 13 + 10, 1);
  });
});

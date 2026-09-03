import { formatDateOrRange } from '@/lib/format';

describe('formatDateOrRange', () => {
  it('collapses to a single date when start and end are the same day', () => {
    expect(formatDateOrRange('2026-09-20', '2026-09-20')).toBe('20 Sept 2026');
  });

  it('omits the year on the start date when both dates fall in the same year', () => {
    expect(
      formatDateOrRange(
        '2026-10-28T00:00:00.000Z',
        '2026-12-23T00:00:00.000Z',
        { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' },
        { day: 'numeric', month: 'short', timeZone: 'UTC' }
      )
    ).toBe('28 Oct - 23 Dec 2026');
  });

  it('shows the year on the start date too when the range crosses a year boundary', () => {
    expect(
      formatDateOrRange(
        '2026-12-24T00:00:00.000Z',
        '2027-01-15T00:00:00.000Z',
        { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' },
        { day: 'numeric', month: 'short', timeZone: 'UTC' }
      )
    ).toBe('24 Dec 2026 - 15 Jan 2027');
  });

  it('leaves an explicit year on startOptions untouched even across a year boundary', () => {
    expect(
      formatDateOrRange(
        '2026-12-24T00:00:00.000Z',
        '2027-01-15T00:00:00.000Z',
        { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' },
        { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }
      )
    ).toBe('24 Dec 2026 - 15 Jan 2027');
  });

  it('returns just the available side when one date is missing', () => {
    expect(formatDateOrRange(null, '2026-09-20')).toBe('20 Sept 2026');
    expect(formatDateOrRange('2026-09-20', null)).toBe('20 Sept 2026');
    expect(formatDateOrRange(null, null)).toBe('');
  });
});

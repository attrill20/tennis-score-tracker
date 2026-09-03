export function truncateName(name: string, maxLength = 20): string {
  return name.length > maxLength ? `${name.slice(0, maxLength - 1)}…` : name;
}

/**
 * Formats a date range, collapsing to a single date when start and end fall on the same day
 * (as a one-day tournament/round does) instead of showing "X - X".
 */
export function formatDateOrRange(
  start: string | Date | null | undefined,
  end: string | Date | null | undefined,
  endOptions: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' },
  startOptions: Intl.DateTimeFormatOptions = endOptions
): string {
  const endText = end ? new Date(end).toLocaleDateString('en-GB', endOptions) : '';
  const startText = start ? new Date(start).toLocaleDateString('en-GB', startOptions) : '';
  if (!start || !end) return endText || startText;

  const isSameDay = new Date(start).toLocaleDateString('en-GB', endOptions) === endText;
  if (isSameDay) return endText;

  // If the range crosses a year boundary, the start date needs its year shown too -
  // otherwise "24 Dec - 15 Jan 2027" misleadingly reads as if both dates are in 2027.
  const yearOptions: Intl.DateTimeFormatOptions = { year: 'numeric', timeZone: endOptions.timeZone };
  const crossesYear = new Date(start).toLocaleDateString('en-GB', yearOptions) !== new Date(end).toLocaleDateString('en-GB', yearOptions);
  const finalStartText = crossesYear && !startOptions.year
    ? new Date(start).toLocaleDateString('en-GB', { ...startOptions, year: 'numeric' })
    : startText;

  return `${finalStartText} - ${endText}`;
}

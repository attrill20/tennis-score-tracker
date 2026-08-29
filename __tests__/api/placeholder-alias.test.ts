import { suggestPlaceholderAlias } from '@/lib/placeholderAlias';

describe('suggestPlaceholderAlias', () => {
  it('suggests "Placeholder Player 1" when there are no existing numbered aliases', () => {
    expect(suggestPlaceholderAlias([])).toBe('Placeholder Player 1');
    expect(suggestPlaceholderAlias(['Guest 1', null, undefined])).toBe('Placeholder Player 1');
  });

  it('increments off the highest existing number when there are no gaps', () => {
    expect(suggestPlaceholderAlias(['Placeholder Player 1', 'Placeholder Player 2'])).toBe('Placeholder Player 3');
  });

  it('fills the lowest available gap left by a retired/renamed placeholder', () => {
    expect(suggestPlaceholderAlias(['Placeholder Player 1', 'Placeholder Player 3'])).toBe('Placeholder Player 2');
  });

  it('ignores aliases that do not match the exact numbered pattern', () => {
    expect(suggestPlaceholderAlias(['Placeholder Player 1', 'Mystery Player', 'placeholder player 2'])).toBe('Placeholder Player 2');
  });
});

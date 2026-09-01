import { suggestEmailCorrection } from '@/lib/emailTypo';

describe('suggestEmailCorrection', () => {
  it('suggests gmail.com for a common misspelling', () => {
    expect(suggestEmailCorrection('jane@gamil.com')).toBe('jane@gmail.com');
    expect(suggestEmailCorrection('jane@gmial.com')).toBe('jane@gmail.com');
    expect(suggestEmailCorrection('jane@gmai.com')).toBe('jane@gmail.com');
  });

  it('suggests other common UK providers', () => {
    expect(suggestEmailCorrection('jane@hotmial.com')).toBe('jane@hotmail.com');
    expect(suggestEmailCorrection('jane@yaho.com')).toBe('jane@yahoo.com');
    expect(suggestEmailCorrection('jane@btinternet.con')).toBe('jane@btinternet.com');
  });

  it('preserves the local part and lowercases the result', () => {
    expect(suggestEmailCorrection('Jane.Doe@GAMIL.com')).toBe('jane.doe@gmail.com');
  });

  it('returns null for a correctly-spelt common domain', () => {
    expect(suggestEmailCorrection('jane@gmail.com')).toBeNull();
    expect(suggestEmailCorrection('jane@outlook.com')).toBeNull();
  });

  it('returns null for an unrecognised but plausible domain', () => {
    expect(suggestEmailCorrection('jane@qptc.co.uk')).toBeNull();
    expect(suggestEmailCorrection('jane@somecompany.com')).toBeNull();
  });

  it('returns null for an invalid email with no domain', () => {
    expect(suggestEmailCorrection('not-an-email')).toBeNull();
    expect(suggestEmailCorrection('jane@')).toBeNull();
  });
});

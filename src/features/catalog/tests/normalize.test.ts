import { normalize } from '../search/normalize';

describe('normalize', () => {
  test('strips acute accent and lowers case', () => {
    expect(normalize('Café')).toBe('cafe');
  });

  test('handles uppercase diacritics', () => {
    expect(normalize('AÇAÍ')).toBe('acai');
  });

  test('trims whitespace and strips tilde', () => {
    expect(normalize(' Limão ')).toBe('limao');
  });

  test('handles multiple diacritics in one word', () => {
    expect(normalize('coração')).toBe('coracao');
  });

  test('preserves digits and spaces', () => {
    expect(normalize('Pet 600ml')).toBe('pet 600ml');
  });

  test('preserves punctuation', () => {
    expect(normalize('Refri-Cola')).toBe('refri-cola');
  });

  test('empty string yields empty string', () => {
    expect(normalize('')).toBe('');
  });

  test('is idempotent', () => {
    const once = normalize('Café Torrado');
    expect(normalize(once)).toBe(once);
  });
});

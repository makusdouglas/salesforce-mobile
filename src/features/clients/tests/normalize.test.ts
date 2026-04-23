import { normalize } from '../search/normalize';

describe('normalize (clients)', () => {
  test('empty string returns empty string', () => {
    expect(normalize('')).toBe('');
  });

  test('strips diacritics and lowercases', () => {
    expect(normalize('São Paulo')).toBe('sao paulo');
  });

  test('strips multiple diacritics', () => {
    expect(normalize('açaí')).toBe('acai');
  });

  test('handles common Portuguese diacritics', () => {
    expect(normalize('Limão')).toBe('limao');
  });

  test('folds uppercase with diacritics', () => {
    expect(normalize('ÁRVORE')).toBe('arvore');
  });

  test('trims surrounding whitespace', () => {
    expect(normalize('  Loja  ')).toBe('loja');
  });
});

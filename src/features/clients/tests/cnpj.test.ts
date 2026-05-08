import { isValidFormat, normalize } from '../cnpj/cnpj';

describe('cnpj.normalize', () => {
  test('strips dots, slashes, dashes', () => {
    expect(normalize('12.345.678/0001-99')).toBe('12345678000199');
  });

  test('leaves bare digits alone', () => {
    expect(normalize('12345678000199')).toBe('12345678000199');
  });

  test('empty input returns empty', () => {
    expect(normalize('')).toBe('');
  });

  test('strips arbitrary punctuation and spaces', () => {
    expect(normalize(' 12 345 678 / 0001 - 99 ')).toBe('12345678000199');
  });

  test('strips letters', () => {
    expect(normalize('abc12345678000199xyz')).toBe('12345678000199');
  });
});

describe('cnpj.isValidFormat', () => {
  test('accepts canonical formatted CNPJ', () => {
    expect(isValidFormat('12.345.678/0001-99')).toBe(true);
  });

  test('accepts bare 14 digits', () => {
    expect(isValidFormat('12345678000199')).toBe(true);
  });

  test('rejects 13 digits', () => {
    expect(isValidFormat('1234567800019')).toBe(false);
  });

  test('rejects 15 digits', () => {
    expect(isValidFormat('123456780001999')).toBe(false);
  });

  test('empty input is valid (CNPJ is optional per FR-008)', () => {
    expect(isValidFormat('')).toBe(true);
  });

  test('letters-only normalize to empty, which is valid', () => {
    expect(isValidFormat('abc')).toBe(true);
  });

  test('punctuation around a valid CNPJ is still valid', () => {
    expect(isValidFormat(' 12.345.678/0001-99 ')).toBe(true);
  });
});

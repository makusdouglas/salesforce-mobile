import { deriveGreetingName } from '../greeting/deriveGreetingName';

describe('deriveGreetingName', () => {
  test('simple email → local part', () => {
    expect(deriveGreetingName('markus@acme.com')).toBe('markus');
  });

  test('null email → null', () => {
    expect(deriveGreetingName(null)).toBeNull();
  });

  test('empty string → null', () => {
    expect(deriveGreetingName('')).toBeNull();
  });

  test('whitespace-only → null', () => {
    expect(deriveGreetingName('   ')).toBeNull();
  });

  test('no @ → defensive return of the whole trimmed string', () => {
    expect(deriveGreetingName('justaname')).toBe('justaname');
  });

  test('@ at position 0 → null', () => {
    expect(deriveGreetingName('@acme.com')).toBeNull();
  });

  test('unicode preserved in local part', () => {
    expect(deriveGreetingName('márcio@local.dev')).toBe('márcio');
    expect(deriveGreetingName('joão.silva@local.dev')).toBe('joão.silva');
  });

  test('leading/trailing whitespace is trimmed', () => {
    expect(deriveGreetingName('  markus@acme.com  ')).toBe('markus');
  });

  test('multiple @ signs → split at first', () => {
    expect(deriveGreetingName('quoted"@"part@acme.com')).toBe('quoted"');
  });
});

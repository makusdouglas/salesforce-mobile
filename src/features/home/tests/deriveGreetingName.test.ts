import { deriveGreetingName } from '../greeting/deriveGreetingName';

describe('deriveGreetingName (bare email — back-compat)', () => {
  test('simple email → local part', () => {
    expect(deriveGreetingName('markus@acme.com')).toBe('markus');
  });

  test('null → null', () => {
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
  });

  test('leading/trailing whitespace is trimmed', () => {
    expect(deriveGreetingName('  markus@acme.com  ')).toBe('markus');
  });
});

describe('deriveGreetingName (object input — name preferred)', () => {
  test('name + email → first name wins', () => {
    expect(deriveGreetingName({ name: 'Márcio Souza', email: 'marcio@acme.com' })).toBe('Márcio');
  });

  test('name null, email present → falls back to email local part', () => {
    expect(deriveGreetingName({ name: null, email: 'marcio@acme.com' })).toBe('marcio');
  });

  test('empty name, email present → falls back to email local part', () => {
    expect(deriveGreetingName({ name: '', email: 'marcio@acme.com' })).toBe('marcio');
  });

  test('whitespace name, email present → falls back to email local part', () => {
    expect(deriveGreetingName({ name: '   ', email: 'marcio@acme.com' })).toBe('marcio');
  });

  test('name present, email null → uses name', () => {
    expect(deriveGreetingName({ name: 'Ana', email: null })).toBe('Ana');
  });

  test('single-word name → returned as-is', () => {
    expect(deriveGreetingName({ name: 'Ana', email: null })).toBe('Ana');
  });

  test('multi-word name → returns first word only', () => {
    expect(deriveGreetingName({ name: 'João Pedro da Silva', email: null })).toBe('João');
  });

  test('both null → null', () => {
    expect(deriveGreetingName({ name: null, email: null })).toBeNull();
  });

  test('undefined fields → null', () => {
    expect(deriveGreetingName({})).toBeNull();
  });

  test('unicode in name preserved', () => {
    expect(deriveGreetingName({ name: 'Ávila Cícero', email: null })).toBe('Ávila');
  });
});

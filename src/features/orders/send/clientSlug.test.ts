import { clientSlug, isLikelyEmail } from './clientSlug';

describe('clientSlug', () => {
  test.each([
    ['Padaria Central', 'padaria-central'],
    ['Açaí do João', 'acai-do-joao'],
    ['   Mercado  São Paulo  ', 'mercado-sao-paulo'],
    ['!!!', 'cliente'],
    ['', 'cliente'],
    [null, 'cliente'],
    [undefined, 'cliente'],
    ['A'.repeat(100), 'a'.repeat(40)],
    ['Bar & Lanches da Esquina #1', 'bar-lanches-da-esquina-1'],
  ])('slug(%p) → %p', (input, expected) => {
    expect(clientSlug(input as string | null | undefined)).toBe(expected);
  });

  test('truncates long names without trailing dash', () => {
    const slug = clientSlug('Padaria ' + 'a'.repeat(80));
    expect(slug).not.toMatch(/-$/);
    expect(slug.length).toBeLessThanOrEqual(40);
  });
});

describe('isLikelyEmail', () => {
  test.each([
    ['joao@example.com', true],
    ['j@e.co', true],
    ['x.y+z@sub.example.co.uk', true],
    ['  a@b.co  ', true],
    ['joão@example.com', true], // accented local part accepted by minimal check
    [null, false],
    [undefined, false],
    ['', false],
    ['   ', false],
    ['x', false],
    ['x@y', false],
    ['x@y.', false],
    ['@y.co', false],
    ['x y@z.co', false],
  ])('isLikelyEmail(%p) === %p', (input, expected) => {
    expect(isLikelyEmail(input as string | null | undefined)).toBe(expected);
  });
});

import { splitContact } from '../contact/splitContact';

describe('splitContact', () => {
  test('empty input returns both null', () => {
    expect(splitContact('')).toEqual({ phone: null, email: null });
  });

  test('whitespace-only input returns both null', () => {
    expect(splitContact('   \n  \n ')).toEqual({ phone: null, email: null });
  });

  test('phone-only line goes to phone', () => {
    expect(splitContact('(11) 98765-4321')).toEqual({
      phone: '(11) 98765-4321',
      email: null,
    });
  });

  test('email-only line goes to email', () => {
    expect(splitContact('owner@loja.com.br')).toEqual({
      phone: null,
      email: 'owner@loja.com.br',
    });
  });

  test('phone on line 1 + email on line 2', () => {
    expect(splitContact('(11) 98765-4321\nowner@loja.com.br')).toEqual({
      phone: '(11) 98765-4321',
      email: 'owner@loja.com.br',
    });
  });

  test('email on line 1 + phone on line 2', () => {
    expect(splitContact('owner@loja.com.br\n(11) 98765-4321')).toEqual({
      phone: '(11) 98765-4321',
      email: 'owner@loja.com.br',
    });
  });

  test('multiple phone lines joined with space', () => {
    expect(splitContact('(11) 98765-4321\n(11) 3333-4444')).toEqual({
      phone: '(11) 98765-4321 (11) 3333-4444',
      email: null,
    });
  });

  test('@-bearing line routed to email even when phone follows', () => {
    expect(
      splitContact('owner@loja.com.br\n(11) 98765-4321\n(11) 3333-4444'),
    ).toEqual({
      phone: '(11) 98765-4321 (11) 3333-4444',
      email: 'owner@loja.com.br',
    });
  });

  test('per-line whitespace trimmed', () => {
    expect(splitContact('  (11) 98765-4321  \n  owner@loja.com.br  ')).toEqual({
      phone: '(11) 98765-4321',
      email: 'owner@loja.com.br',
    });
  });

  test('handles CRLF line endings', () => {
    expect(splitContact('(11) 98765-4321\r\nowner@loja.com.br')).toEqual({
      phone: '(11) 98765-4321',
      email: 'owner@loja.com.br',
    });
  });
});

import { resolveActiveSalesperson } from '../session/resolveActiveSalesperson';

const rows = [
  { id: 'sp-1', email: 'a@local.dev' },
  { id: 'sp-2', email: 'b@local.dev' },
];

describe('resolveActiveSalesperson', () => {
  test('returns ready with id when session email matches a row', () => {
    const result = resolveActiveSalesperson(rows, 'Authenticated', 'b@local.dev');
    expect(result).toEqual({ status: 'ready', salespersonId: 'sp-2' });
  });

  test('returns resolving when session is NotAuthenticated', () => {
    const result = resolveActiveSalesperson(rows, 'NotAuthenticated', null);
    expect(result).toEqual({ status: 'resolving', salespersonId: null });
  });

  test('returns resolving when session is RequiresRelogin', () => {
    const result = resolveActiveSalesperson(rows, 'RequiresRelogin', 'a@local.dev');
    expect(result).toEqual({ status: 'resolving', salespersonId: null });
  });

  test('returns resolving when authenticated but email is null', () => {
    const result = resolveActiveSalesperson(rows, 'Authenticated', null);
    expect(result).toEqual({ status: 'resolving', salespersonId: null });
  });

  test('returns missing when authenticated but no row matches', () => {
    const result = resolveActiveSalesperson(rows, 'Authenticated', 'nobody@local.dev');
    expect(result).toEqual({ status: 'missing', salespersonId: null });
  });

  test('returns missing when authenticated with empty rows', () => {
    const result = resolveActiveSalesperson([], 'Authenticated', 'a@local.dev');
    expect(result).toEqual({ status: 'missing', salespersonId: null });
  });

  test('returns ready for the first matching row when multiple would match', () => {
    const dup = [
      { id: 'sp-1', email: 'a@local.dev' },
      { id: 'sp-2', email: 'a@local.dev' },
    ];
    const result = resolveActiveSalesperson(dup, 'Authenticated', 'a@local.dev');
    expect(result).toEqual({ status: 'ready', salespersonId: 'sp-1' });
  });
});

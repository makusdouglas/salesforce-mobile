import { deriveConfirmModalShape } from '../shape';

describe('deriveConfirmModalShape', () => {
  test('destructive + cancelLabel → both buttons, red primary', () => {
    expect(
      deriveConfirmModalShape({
        cancelLabel: 'Cancelar',
        primaryVariant: 'destructive',
      }),
    ).toEqual({
      showCancel: true,
      primaryFill: '#DC2626',
      primaryTextColor: '#FFFFFF',
    });
  });

  test('default variant + cancelLabel → both buttons, dark primary', () => {
    expect(
      deriveConfirmModalShape({
        cancelLabel: 'Cancelar',
        primaryVariant: 'default',
      }),
    ).toEqual({
      showCancel: true,
      primaryFill: '#18181B',
      primaryTextColor: '#FFFFFF',
    });
  });

  test('no cancelLabel → info variant (single button)', () => {
    expect(deriveConfirmModalShape({ primaryVariant: 'default' })).toEqual({
      showCancel: false,
      primaryFill: '#18181B',
      primaryTextColor: '#FFFFFF',
    });
  });

  test('no cancelLabel + destructive → single red button (edge case)', () => {
    expect(
      deriveConfirmModalShape({ primaryVariant: 'destructive' }),
    ).toMatchObject({ showCancel: false, primaryFill: '#DC2626' });
  });

  test('no variant specified → default', () => {
    expect(
      deriveConfirmModalShape({ cancelLabel: 'Cancelar' }),
    ).toMatchObject({ primaryFill: '#18181B' });
  });

  test('empty input → info default', () => {
    expect(deriveConfirmModalShape({})).toEqual({
      showCancel: false,
      primaryFill: '#18181B',
      primaryTextColor: '#FFFFFF',
    });
  });
});

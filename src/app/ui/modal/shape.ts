/**
 * Pure derivation of the ConfirmModal's visual shape from its props.
 *
 * Kept separate from the component so it's testable in Node without a React
 * renderer — same convention 007 established with resolveActiveSalesperson.
 */

export type ConfirmModalShapeInput = {
  readonly cancelLabel?: string;
  readonly primaryVariant?: 'default' | 'destructive';
};

export type ConfirmModalShape = {
  readonly showCancel: boolean;
  readonly primaryFill: string;
  readonly primaryTextColor: string;
};

const PRIMARY_DEFAULT = '#18181B';
const PRIMARY_DESTRUCTIVE = '#DC2626';
const PRIMARY_TEXT = '#FFFFFF';

export function deriveConfirmModalShape(
  input: ConfirmModalShapeInput,
): ConfirmModalShape {
  const showCancel = input.cancelLabel !== undefined;
  const primaryFill =
    input.primaryVariant === 'destructive' ? PRIMARY_DESTRUCTIVE : PRIMARY_DEFAULT;
  return {
    showCancel,
    primaryFill,
    primaryTextColor: PRIMARY_TEXT,
  };
}

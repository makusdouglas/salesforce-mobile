// Re-export admin/products theme so the sellers module stays cohesive
// without duplicating tokens. Kept as its own file (instead of a deep
// import) so a future redesign can diverge one module at a time.

export { adminColors, adminFonts, adminRadii } from '../products/theme';

export const sellerColors = {
  dangerFill: '#FEE2E2',
  dangerStroke: '#FECACA',
  dangerText: '#B91C1C',
  successFill: '#DCFCE7',
  successText: '#166534',
  neutralBadgeFill: '#F4F4F5',
};

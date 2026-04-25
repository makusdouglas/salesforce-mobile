import { hasAdminGate, hasAnyAdminRole, impliesSuperuser } from './useAdminGate';

describe('useAdminGate — pure predicates', () => {
  describe('impliesSuperuser', () => {
    it('true for superuser', () => {
      expect(impliesSuperuser(['superuser'])).toBe(true);
    });

    it('true for legacy admin alias during migration window', () => {
      expect(impliesSuperuser(['admin'])).toBe(true);
    });

    it('false for manage-products only', () => {
      expect(impliesSuperuser(['manage-products'])).toBe(false);
    });

    it('false for seller only', () => {
      expect(impliesSuperuser(['seller'])).toBe(false);
    });

    it('false for empty roles', () => {
      expect(impliesSuperuser([])).toBe(false);
    });
  });

  describe('hasAdminGate — superuser implies every admin-grade role', () => {
    it.each([
      'manage-products',
      'manage-salespersons',
      'manage-clients',
      'superuser',
    ] as const)('superuser grants access to %s', (required) => {
      expect(hasAdminGate(['superuser'], required)).toBe(true);
    });

    it('legacy admin alias grants access to every admin-grade role', () => {
      expect(hasAdminGate(['admin'], 'manage-products')).toBe(true);
      expect(hasAdminGate(['admin'], 'superuser')).toBe(true);
    });
  });

  describe('hasAdminGate — module-specific roles only grant their own module', () => {
    it('manage-products grants access to manage-products', () => {
      expect(hasAdminGate(['manage-products'], 'manage-products')).toBe(true);
    });

    it('manage-products does NOT grant access to manage-salespersons', () => {
      expect(hasAdminGate(['manage-products'], 'manage-salespersons')).toBe(false);
    });

    it('manage-products does NOT grant access to superuser-only screens', () => {
      expect(hasAdminGate(['manage-products'], 'superuser')).toBe(false);
    });
  });

  describe('hasAdminGate — seller never grants admin access', () => {
    it.each([
      'manage-products',
      'manage-salespersons',
      'manage-clients',
      'superuser',
    ] as const)('seller-only role is denied %s', (required) => {
      expect(hasAdminGate(['seller'], required)).toBe(false);
    });

    it('empty roles are denied any admin gate', () => {
      expect(hasAdminGate([], 'manage-products')).toBe(false);
    });
  });

  describe('hasAdminGate — dual-role users', () => {
    it('seller + manage-products grants access to manage-products only', () => {
      const roles = ['seller', 'manage-products'] as const;
      expect(hasAdminGate(roles, 'manage-products')).toBe(true);
      expect(hasAdminGate(roles, 'manage-clients')).toBe(false);
    });

    it('seller + superuser grants access to every admin-grade role', () => {
      const roles = ['seller', 'superuser'] as const;
      expect(hasAdminGate(roles, 'manage-products')).toBe(true);
      expect(hasAdminGate(roles, 'manage-salespersons')).toBe(true);
      expect(hasAdminGate(roles, 'manage-clients')).toBe(true);
      expect(hasAdminGate(roles, 'superuser')).toBe(true);
    });
  });

  describe('hasAnyAdminRole — Admin-tab visibility gate', () => {
    it('true for superuser', () => {
      expect(hasAnyAdminRole(['superuser'])).toBe(true);
    });

    it('true for legacy admin', () => {
      expect(hasAnyAdminRole(['admin'])).toBe(true);
    });

    it.each([
      'manage-products',
      'manage-salespersons',
      'manage-clients',
    ] as const)('true for single %s role', (role) => {
      expect(hasAnyAdminRole([role])).toBe(true);
    });

    it('false for seller only', () => {
      expect(hasAnyAdminRole(['seller'])).toBe(false);
    });

    it('false for empty roles', () => {
      expect(hasAnyAdminRole([])).toBe(false);
    });

    it('true when seller coexists with an admin-grade role', () => {
      expect(hasAnyAdminRole(['seller', 'manage-clients'])).toBe(true);
    });
  });
});

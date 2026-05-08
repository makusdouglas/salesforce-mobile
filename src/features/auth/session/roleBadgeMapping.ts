import type { SessionRole } from './session';

// Single source of truth for role presentation across AdminUsersList,
// AdminUserRolesForm, and ProfileScreen's "Suas funções" section.
// Color mapping matches the design-system Badge variants:
//   destructive → superuser / admin (highest privilege, strong signal)
//   default     → manage-* (module-scoped admin)
//   secondary   → seller (field role, visual neutrality)

export type RoleBadgeStyle = 'default' | 'secondary' | 'destructive';

export interface RoleBadge {
  /** Portuguese label shown to the user. */
  label: string;
  style: RoleBadgeStyle;
}

const BADGES: Record<SessionRole, RoleBadge> = {
  superuser: { label: 'Super usuário', style: 'destructive' },
  admin: { label: 'Super usuário', style: 'destructive' },
  'manage-products': { label: 'Gerenciar produtos', style: 'default' },
  'manage-salespersons': { label: 'Gerenciar vendedores', style: 'default' },
  'manage-clients': { label: 'Gerenciar clientes', style: 'default' },
  seller: { label: 'Vendedor', style: 'secondary' },
};

export function roleBadge(role: SessionRole): RoleBadge {
  return BADGES[role];
}

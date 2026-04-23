/**
 * Public barrel for the clients feature.
 *
 * Exposes only the screen components that HomeStack registers. Hooks,
 * components, search primitives, CNPJ helpers, draft store, and viewport
 * primitives stay feature-internal per Structure Decision (plan.md).
 */

export { ClientsScreen } from './screens/ClientsScreen';
export { ClientFormScreen } from './screens/ClientFormScreen';
export { ClientProfileScreen } from './screens/ClientProfileScreen';
export { NewOrderStubScreen } from './screens/NewOrderStubScreen';

// Exposed for Home (008): the dashboard needs the active salesperson id to
// scope the clients count via clientsRepository.observeByOwner. See
// specs/008-home-dashboard/plan.md §Summary and contracts/summary-hooks.md.
export { useActiveSalespersonId } from './hooks/useActiveSalespersonId';
export type { ActiveSalespersonState } from './types';

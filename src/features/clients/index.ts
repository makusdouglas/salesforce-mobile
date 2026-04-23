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

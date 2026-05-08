import { useSyncExternalStore } from 'react';

import { sessionStore, type SessionRole } from '../session/session';

function getRoles(): readonly SessionRole[] {
  return sessionStore.getSnapshot().roles;
}

export function useRoles(): readonly SessionRole[] {
  return useSyncExternalStore(sessionStore.subscribe, getRoles);
}

export function useHasRole(role: SessionRole): boolean {
  const roles = useRoles();
  return roles.includes(role);
}

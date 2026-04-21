import React, { useEffect } from 'react';

import { startNetinfoBridge } from '../connectivity/netinfoBridge';

/**
 * Lifecycle owner for the sync feature.
 *
 * Mounts background subscriptions when the tree comes up and tears them down
 * when it goes away. Does not publish anything via React Context — the stores
 * are the shared state.
 */
export function SyncProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  useEffect(() => {
    const stopNet = startNetinfoBridge();
    // US1 (T021) adds: const stopLogin = startLoginTrigger();
    return () => {
      stopNet();
      // US1 (T021) adds: stopLogin();
    };
  }, []);

  return <>{children}</>;
}

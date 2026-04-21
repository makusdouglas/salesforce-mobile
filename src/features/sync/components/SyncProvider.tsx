import React, { useEffect } from 'react';

import { startNetinfoBridge } from '../connectivity/netinfoBridge';
import { startLoginTrigger } from '../triggers/loginTrigger';

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
    const stopLogin = startLoginTrigger();
    return () => {
      stopNet();
      stopLogin();
    };
  }, []);

  return <>{children}</>;
}

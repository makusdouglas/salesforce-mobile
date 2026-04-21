import { useEffect, useState, type ReactNode } from 'react';

import { lockBootstrap } from '../state/bootstrap';
import { startInactivityListener } from '../state/inactivity';

type LockProviderProps = {
  children: ReactNode;
};

export function LockProvider({ children }: LockProviderProps) {
  const [bootstrapped, setBootstrapped] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await lockBootstrap();
      if (cancelled) return;
      setBootstrapped(true);
    })();

    const stopInactivity = startInactivityListener();
    return () => {
      cancelled = true;
      stopInactivity();
    };
  }, []);

  if (!bootstrapped) return null;
  return <>{children}</>;
}

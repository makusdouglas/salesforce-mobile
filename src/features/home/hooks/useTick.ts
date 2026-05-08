import { useEffect, useState } from 'react';

/**
 * Forces a re-render every `intervalMs` so consumers that derive from a
 * clock (e.g. HomeSyncPill's "há N min" label, RecentActivityCard's
 * "há N min" meta) stay fresh between sparse store emissions.
 *
 * Returns the current `Date.now()`-ish value, but callers can ignore it
 * and use `Date.now()` directly inside the render — the return value is
 * just a cheap way to force re-render.
 */
export function useTick(intervalMs: number): number {
  const [tick, setTick] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setTick(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return tick;
}

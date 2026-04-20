type IsExpiredInput = {
  backgroundedAtMs: number | null;
  nowMs: number;
  timeoutMinutes: number;
};

/**
 * Pure policy function — no React Native dependency. Returns true when the
 * elapsed background time exceeds the configured timeout, false otherwise.
 * Clock skew (negative elapsed) is clamped to 0.
 *
 * Extracted from inactivity.ts so it can be unit-tested under Jest's
 * node environment without mocking the react-native AppState module.
 */
export function isInactivityExpired(input: IsExpiredInput): boolean {
  if (input.backgroundedAtMs === null) return false;
  const elapsedMs = Math.max(0, input.nowMs - input.backgroundedAtMs);
  const timeoutMs = input.timeoutMinutes * 60 * 1000;
  return elapsedMs > timeoutMs;
}

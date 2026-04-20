declare module 'react-native-privacy-snapshot' {
  /**
   * Native module exported by `react-native-privacy-snapshot`.
   * Imperative API — toggles OS-level task-switcher snapshot masking.
   *
   * iOS: adds a UIBlurEffect overlay on `applicationWillResignActive` when
   * enabled; removes it on `applicationDidBecomeActive`.
   * Android: respective windowFlags FLAG_SECURE behavior.
   */
  const PrivacySnapshot: {
    enabled(flag: boolean): void;
  };
  export default PrivacySnapshot;
}

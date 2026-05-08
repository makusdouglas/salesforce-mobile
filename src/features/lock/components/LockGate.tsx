import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { useLock } from '../hooks/useLock';
import { LockScreen } from '../screens/LockScreen';
import { PinSetupScreen } from '../screens/PinSetupScreen';

type LockGateProps = {
  children: ReactNode;
};

/**
 * Renders PinSetup or Lock on top of the HomeStack children based on
 * lockStore.status. Children stay mounted across Lock↔Unlocked transitions
 * (hidden via display:none) so in-memory screen state is preserved across
 * inactivity locks per FR-012.
 */
export function LockGate({ children }: LockGateProps) {
  const { status } = useLock();
  const showChildren = status === 'Unlocked';

  return (
    <View style={styles.root}>
      <View style={[styles.layer, { display: showChildren ? 'flex' : 'none' }]}>
        {children}
      </View>
      {status === 'NotSet' ? (
        <View style={styles.overlay} pointerEvents="auto">
          <PinSetupScreen />
        </View>
      ) : null}
      {status === 'Locked' ? (
        <View style={styles.overlay} pointerEvents="auto">
          <LockScreen />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  layer: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
});

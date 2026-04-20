import type { ReactNode } from 'react';
import { View, type ViewStyle, type StyleProp } from 'react-native';

import { colors, radii, spacing } from '../theme/tokens';

type CardProps = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function Card({ children, style }: CardProps) {
  return (
    <View
      style={[
        {
          backgroundColor: colors.background,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: radii.xl,
          padding: spacing['2xl'],
          gap: spacing.lg,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  Text,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { colors, font, fontSizes, radii, spacing } from '../theme/tokens';

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive';
type Size = 'md' | 'lg';

type ButtonProps = {
  children: ReactNode;
  onPress?: PressableProps['onPress'];
  variant?: Variant | undefined;
  size?: Size | undefined;
  disabled?: boolean | undefined;
  loading?: boolean | undefined;
  style?: StyleProp<ViewStyle>;
};

const heights: Record<Size, number> = { md: 40, lg: 46 };
const paddings: Record<Size, number> = { md: spacing.lg, lg: spacing.xl };
const fontSizesPerSize: Record<Size, number> = { md: fontSizes.base, lg: fontSizes.md };

function variantStyle(variant: Variant): {
  bg: string;
  fg: string;
  borderColor: string;
  borderWidth: number;
} {
  switch (variant) {
    case 'primary':
      return { bg: colors.primary, fg: colors.primaryForeground, borderColor: colors.primary, borderWidth: 0 };
    case 'secondary':
      return { bg: colors.muted, fg: colors.foreground, borderColor: colors.muted, borderWidth: 0 };
    case 'outline':
      return { bg: colors.background, fg: colors.foreground, borderColor: colors.border, borderWidth: 1 };
    case 'ghost':
      return { bg: 'transparent', fg: colors.mutedForeground, borderColor: 'transparent', borderWidth: 0 };
    case 'destructive':
      return {
        bg: colors.destructive,
        fg: colors.destructiveForeground,
        borderColor: colors.destructive,
        borderWidth: 0,
      };
  }
}

export function Button({
  children,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled,
  loading,
  style,
}: ButtonProps) {
  const v = variantStyle(variant);
  const isDisabled = disabled === true || loading === true;
  return (
    <Pressable
      onPress={isDisabled ? undefined : onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        {
          height: heights[size],
          paddingHorizontal: paddings[size],
          borderRadius: radii.lg,
          backgroundColor: v.bg,
          borderWidth: v.borderWidth,
          borderColor: v.borderColor,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          opacity: isDisabled ? 0.6 : pressed ? 0.85 : 1,
        },
        style,
      ]}
    >
      {loading === true ? (
        <ActivityIndicator color={v.fg} size="small" />
      ) : typeof children === 'string' ? (
        <Text
          style={{
            fontFamily: font.family,
            fontSize: fontSizesPerSize[size],
            fontWeight: font.weights.medium,
            color: v.fg,
          }}
        >
          {children}
        </Text>
      ) : (
        children
      )}
    </Pressable>
  );
}

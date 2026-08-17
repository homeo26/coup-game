/**
 * Pressy — a Pressable with tactile press feedback (scale + fade).
 * The universal building block for any interactive element.
 * A disabled Pressy renders dimmed (the animated opacity would
 * otherwise override any static `opacity` in the caller's style).
 */
import React from 'react';
import { Pressable, PressableProps, StyleProp, ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '../theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface Props extends Omit<PressableProps, 'style'> {
  style?: StyleProp<ViewStyle>;
  scaleTo?: number;
  /** Keep full opacity while disabled (for elements that are usually
   *  non-interactive, like table seats outside a targeting window). */
  noDimWhenDisabled?: boolean;
  children?: React.ReactNode;
}

export function Pressy({
  style,
  scaleTo = 0.95,
  onPressIn,
  onPressOut,
  disabled,
  noDimWhenDisabled,
  children,
  ...rest
}: Props) {
  const theme = useTheme();
  const pressed = useSharedValue(0);
  const dimTarget = disabled && !noDimWhenDisabled ? 1 : 0;
  const dim = useSharedValue(dimTarget);

  React.useEffect(() => {
    dim.value = withTiming(dimTarget, { duration: 150 });
  }, [dimTarget, dim]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - pressed.value * (1 - scaleTo) }],
    opacity: (1 - pressed.value * 0.2) * (1 - dim.value * 0.6),
  }));

  return (
    <AnimatedPressable
      style={[style, animStyle]}
      disabled={disabled}
      onPressIn={(e) => {
        pressed.value = withTiming(1, { duration: 80, easing: theme.motion.easing });
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        pressed.value = withTiming(0, { duration: 200, easing: theme.motion.easing });
        onPressOut?.(e);
      }}
      {...rest}
    >
      {children}
    </AnimatedPressable>
  );
}

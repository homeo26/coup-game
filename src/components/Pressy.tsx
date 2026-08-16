/**
 * Pressy — a Pressable with tactile press feedback (scale + fade).
 * The universal building block for any interactive element.
 */
import React from 'react';
import { Pressable, PressableProps, StyleProp, ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Theme, useStyles, useTheme } from '../theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface Props extends Omit<PressableProps, 'style'> {
  style?: StyleProp<ViewStyle>;
  scaleTo?: number;
  children?: React.ReactNode;
}

export function Pressy({ style, scaleTo = 0.95, onPressIn, onPressOut, children, ...rest }: Props) {
  const theme = useTheme();
  const pressed = useSharedValue(0);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - pressed.value * (1 - scaleTo) }],
    opacity: 1 - pressed.value * 0.2,
  }));

  return (
    <AnimatedPressable
      style={[style, animStyle]}
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

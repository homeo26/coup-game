/**
 * Hourglass — the waiting glyph, tipped over the way a real one is.
 *
 * It holds still, tips 180° in one crisp motion, then holds again. That
 * reads as "time is running" without anything moving continuously.
 */
import React, { useEffect } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

export function Hourglass({
  size = 14,
  color,
  outline,
  /** Milliseconds the glass rests between tips. */
  hold = 1500,
}: {
  size?: number;
  color: string;
  outline?: boolean;
  hold?: number;
}) {
  const turn = useSharedValue(0);
  useEffect(() => {
    // The icon is symmetric top-to-bottom, so snapping back to 0 at the end
    // of each loop is invisible — only the tip itself is seen.
    turn.value = 0;
    turn.value = withRepeat(
      withSequence(
        withDelay(hold, withTiming(1, { duration: 420, easing: Easing.out(Easing.cubic) })),
        // withRepeat does not rewind the value between iterations, so the
        // sequence has to snap back itself or every tip after the first
        // animates 1 -> 1 and nothing moves.
        withTiming(0, { duration: 0 }),
      ),
      -1,
      false,
    );
  }, [turn, hold]);
  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.value * 180}deg` }] }));

  return (
    <Animated.View style={style}>
      <Ionicons name={outline ? 'hourglass-outline' : 'hourglass'} size={size} color={color} />
    </Animated.View>
  );
}

/**
 * Breathing — the app's living backdrop: very dark diagonal gradient
 * washes in the five characters' colors, each layer slowly inhaling and
 * exhaling on its own phase. Deliberately faint so content stays crisp;
 * the motion reads as ambience, not animation.
 */
import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { roleColors } from '../theme';

const AnimatedGradient = Animated.createAnimatedComponent(LinearGradient);

interface LayerSpec {
  color: string;
  start: { x: number; y: number };
  end: { x: number; y: number };
  period: number;
  delay: number;
  peak: number;
}

const LAYERS: LayerSpec[] = [
  { color: roleColors.duke, start: { x: 0, y: 0 }, end: { x: 1, y: 1 }, period: 9000, delay: 0, peak: 0.16 },
  { color: roleColors.captain, start: { x: 1, y: 0 }, end: { x: 0, y: 1 }, period: 11000, delay: 2400, peak: 0.14 },
  { color: roleColors.contessa, start: { x: 0.2, y: 1 }, end: { x: 0.8, y: 0 }, period: 13000, delay: 5200, peak: 0.12 },
  { color: roleColors.ambassador, start: { x: 1, y: 0.7 }, end: { x: 0, y: 0.2 }, period: 15000, delay: 7600, peak: 0.1 },
];

function Layer({ spec }: { spec: LayerSpec }) {
  const breath = useSharedValue(0);
  useEffect(() => {
    breath.value = withDelay(
      spec.delay,
      withRepeat(
        withTiming(1, { duration: spec.period, easing: Easing.inOut(Easing.sin) }),
        -1,
        true,
      ),
    );
  }, [breath, spec]);
  const anim = useAnimatedStyle(() => ({ opacity: breath.value * spec.peak }));
  return (
    <AnimatedGradient
      colors={[spec.color, 'transparent', spec.color + '55']}
      start={spec.start}
      end={spec.end}
      style={[StyleSheet.absoluteFill, anim]}
      pointerEvents="none"
    />
  );
}

export function Breathing() {
  return (
    <>
      {LAYERS.map((l, i) => (
        <Layer key={i} spec={l} />
      ))}
    </>
  );
}

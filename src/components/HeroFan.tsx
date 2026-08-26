/**
 * HeroFan — the home screen's showpiece: the five character cards fanned
 * out, breathing gently. Tapping a card lifts it and the character says
 * their line, so the cast introduces itself before you've played a hand.
 */
import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { InfluenceCard } from './InfluenceCard';
import { Pressy } from './Pressy';
import { Role, ROLES } from '../engine/types';
import { play, roleVoice } from '../sound';
import * as haptics from '../haptics';

const CARD_W = 88;
/** Rotation + offset per seat in the fan, centre card upright. */
const LAYOUT: { rot: number; x: number; y: number }[] = [
  { rot: -24, x: -148, y: 28 },
  { rot: -12, x: -77, y: 7 },
  { rot: 0, x: 0, y: -2 },
  { rot: 12, x: 77, y: 7 },
  { rot: 24, x: 148, y: 28 },
];

function FanCard({
  role,
  index,
  lifted,
  onPress,
}: {
  role: Role;
  index: number;
  lifted: boolean;
  onPress: () => void;
}) {
  const spec = LAYOUT[index];
  const breathe = useSharedValue(0);
  const lift = useSharedValue(0);

  useEffect(() => {
    breathe.value = withDelay(
      index * 260,
      withRepeat(withTiming(1, { duration: 3600, easing: Easing.inOut(Easing.sin) }), -1, true),
    );
  }, [breathe, index]);

  useEffect(() => {
    lift.value = lifted
      ? withSequence(withTiming(1, { duration: 220 }), withTiming(0.55, { duration: 900 }))
      : withTiming(0, { duration: 300 });
  }, [lifted, lift]);

  const anim = useAnimatedStyle(() => ({
    transform: [
      { translateX: spec.x },
      { translateY: spec.y - breathe.value * 3.5 - lift.value * 24 },
      { rotate: `${spec.rot - lift.value * spec.rot * 0.6}deg` },
      { scale: 1 + lift.value * 0.1 },
    ],
    zIndex: lifted ? 10 : 5 - Math.abs(index - 2),
  }));

  return (
    <Animated.View style={[styles.card, anim]}>
      <Pressy scaleTo={0.94} onPress={onPress}>
        <InfluenceCard role={role} width={CARD_W} />
      </Pressy>
    </Animated.View>
  );
}

export function HeroFan() {
  const [lifted, setLifted] = useState<Role | null>(null);
  return (
    <View style={styles.wrap}>
      {ROLES.map((r, i) => (
        <FanCard
          key={r}
          role={r}
          index={i}
          lifted={lifted === r}
          onPress={() => {
            haptics.selection();
            play(roleVoice(r) ?? 'card');
            setLifted(r);
            setTimeout(() => setLifted((cur) => (cur === r ? null : cur)), 1400);
          }}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    height: Math.round(CARD_W * 1.42) + 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    position: 'absolute',
  },
});

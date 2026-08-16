/**
 * InfluenceCard — a proper playing card.
 *
 * Face: role-tinted gradient frame, corner emblem pip, oval portrait,
 * name plate. Back: dark court back with the star seal. A card that
 * flips from hidden to revealed plays a half-flip (turn-over) motion;
 * lost cards render dimmed with a strike.
 */
import React, { useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Polygon } from 'react-native-svg';
import { Role } from '../engine/types';
import { RoleArt } from './RoleArt';
import { RolePortrait } from './RolePortrait';
import { Theme, font, roleColors, useStyles } from '../theme';
import { t, TKey } from '../i18n';

interface Props {
  /** Role to show when face-up; undefined renders a face-down back. */
  role?: Role;
  /** Face-up but struck out (a lost influence). */
  dead?: boolean;
  width?: number;
  /** Highlight ring (e.g. selectable in a picker). */
  selected?: boolean;
  /** Slight rotation for a fanned-hand feel (degrees). */
  tilt?: number;
}

function starPoints(cx: number, cy: number, rOut: number, rIn: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? rOut : rIn;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    pts.push(`${cx + Math.cos(a) * r},${cy + Math.sin(a) * r}`);
  }
  return pts.join(' ');
}

export function InfluenceCard({ role, dead, width = 96, selected, tilt = 0 }: Props) {
  const styles = useStyles(makeStyles);
  const height = Math.round(width * 1.42);
  const faceUp = role !== undefined;

  // Turn-over: when the card first becomes face-up (opponent reveal) or
  // first becomes dead, play a calm half-flip.
  const prevFace = useRef(faceUp);
  const prevDead = useRef(dead);
  const flip = useSharedValue(0);
  useEffect(() => {
    if ((faceUp && !prevFace.current) || (dead && !prevDead.current)) {
      flip.value = 1;
      flip.value = withTiming(0, { duration: 380 });
    }
    prevFace.current = faceUp;
    prevDead.current = dead;
  }, [faceUp, dead, flip]);
  const anim = useAnimatedStyle(() => ({
    transform: [
      { perspective: 900 },
      { rotateY: `${interpolate(flip.value, [0, 1], [0, 80])}deg` },
      { rotateZ: `${tilt}deg` },
    ],
  }));

  const rc = role ? roleColors[role] : '#3a4150';

  return (
    <Animated.View
      style={[
        styles.card,
        { width, height, borderColor: faceUp ? rc + '77' : styles.card.borderColor },
        selected ? styles.selected : null,
        dead ? styles.dead : null,
        anim,
      ]}
    >
      {faceUp && role ? (
        <LinearGradient
          colors={[rc + '30', 'transparent', rc + '1c']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.face}
        >
          {/* inner frame like a printed card */}
          <View style={[styles.frame, { borderColor: rc + '55' }]} />
          {/* corner pip */}
          <View style={styles.pip}>
            <RoleArt role={role} size={Math.max(12, Math.round(width * 0.16))} />
          </View>
          <View style={styles.artWrap}>
            <RolePortrait role={role} size={Math.round(width * 0.58)} ring={2} />
          </View>
          <View style={[styles.namePlate, { borderColor: rc + '44' }]}>
            <Text
              numberOfLines={1}
              style={[styles.name, { color: rc, fontSize: Math.max(10, width * 0.13) }]}
            >
              {t(role as TKey)}
            </Text>
          </View>
          {dead ? <View style={styles.strike} /> : null}
        </LinearGradient>
      ) : (
        <LinearGradient
          colors={['#1c2028', '#14171d']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.face}
        >
          <View style={[styles.frame, { borderColor: 'rgba(200,210,230,0.14)' }]} />
          <View style={styles.backWrap}>
            <Svg width={width * 0.46} height={width * 0.46} viewBox="0 0 48 48">
              <Circle cx={24} cy={24} r={21} stroke="#59606e" strokeWidth={2.5} fill="none" />
              <Circle cx={24} cy={24} r={16} stroke="#59606e55" strokeWidth={1.5} fill="none" />
              <Polygon points={starPoints(24, 24, 11, 4.7)} fill="#59606e" />
            </Svg>
          </View>
        </LinearGradient>
      )}
    </Animated.View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    card: {
      borderRadius: 10,
      backgroundColor: theme.colors.surfaceElevated,
      borderWidth: 1.5,
      borderColor: theme.colors.border,
      overflow: 'hidden',
      ...theme.shadow.card,
    },
    face: {
      flex: 1,
    },
    frame: {
      position: 'absolute',
      top: 4,
      left: 4,
      right: 4,
      bottom: 4,
      borderWidth: 1,
      borderRadius: 7,
    },
    pip: {
      position: 'absolute',
      top: 7,
      left: 7,
      opacity: 0.95,
    },
    artWrap: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingBottom: 2,
    },
    namePlate: {
      marginHorizontal: 8,
      marginBottom: 8,
      borderWidth: 1,
      borderRadius: 6,
      paddingVertical: 1,
      alignItems: 'center',
      backgroundColor: 'rgba(10, 12, 16, 0.45)',
    },
    name: {
      fontFamily: font('bold'),
    },
    selected: {
      borderColor: theme.colors.goldLight,
      borderWidth: 2.5,
      ...theme.shadow.goldGlow,
    },
    dead: {
      opacity: 0.45,
    },
    strike: {
      position: 'absolute',
      left: '-12%',
      right: '-12%',
      top: '50%',
      height: 3,
      backgroundColor: theme.colors.danger,
      transform: [{ rotateZ: '-32deg' }],
    },
    backWrap: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });

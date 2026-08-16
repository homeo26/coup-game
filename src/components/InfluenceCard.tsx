/**
 * InfluenceCard — one influence card. Face-down shows the court back
 * (gold star seal); face-up shows the role art, name and color. A card
 * flipping from hidden → revealed animates a subtle flip-and-settle.
 * Revealed (lost) cards render dimmed with a strike.
 */
import React, { useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Polygon } from 'react-native-svg';
import { Role } from '../engine/types';
import { RoleArt } from './RoleArt';
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

export function InfluenceCard({ role, dead, width = 96, selected }: Props) {
  const styles = useStyles(makeStyles);
  const height = Math.round(width * 1.45);
  const faceUp = role !== undefined;

  // Animate the transition the first time this card flips to dead
  // (a reveal): quick tilt + settle.
  const wasDead = useRef(dead);
  const flip = useSharedValue(0);
  useEffect(() => {
    if (dead && !wasDead.current) {
      flip.value = 0;
      flip.value = withDelay(60, withTiming(1, { duration: 420 }));
    }
    wasDead.current = dead;
  }, [dead, flip]);
  const anim = useAnimatedStyle(() => ({
    transform: [
      { rotateZ: `${interpolate(flip.value, [0, 0.5, 1], [0, -6, 0])}deg` },
      { scale: interpolate(flip.value, [0, 0.5, 1], [1, 1.06, 1]) },
    ],
  }));

  return (
    <Animated.View
      style={[
        styles.card,
        { width, height },
        faceUp && role ? { borderColor: roleColors[role] + '66' } : null,
        selected ? styles.selected : null,
        dead ? styles.dead : null,
        anim,
      ]}
    >
      {faceUp && role ? (
        <>
          <View style={styles.artWrap}>
            <RoleArt role={role} size={Math.round(width * 0.52)} />
          </View>
          <Text
            numberOfLines={1}
            style={[styles.name, { color: roleColors[role], fontSize: Math.max(11, width * 0.14) }]}
          >
            {t(role as TKey)}
          </Text>
          {dead ? <View style={styles.strike} /> : null}
        </>
      ) : (
        <View style={styles.backWrap}>
          <Svg width={width * 0.5} height={width * 0.5} viewBox="0 0 48 48">
            <Circle cx={24} cy={24} r={21} stroke="#8c6828" strokeWidth={2.5} fill="none" />
            <Circle cx={24} cy={24} r={16} stroke="#8c682855" strokeWidth={1.5} fill="none" />
            <Polygon points={starPoints(24, 24, 11, 4.7)} fill="#8c6828" />
          </Svg>
        </View>
      )}
    </Animated.View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    card: {
      borderRadius: theme.radius.sm,
      backgroundColor: theme.colors.surfaceElevated,
      borderWidth: 1.5,
      borderColor: theme.colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    selected: {
      borderColor: theme.colors.gold,
      borderWidth: 2.5,
      ...theme.shadow.goldGlow,
    },
    dead: {
      opacity: 0.45,
      backgroundColor: theme.colors.surface,
    },
    artWrap: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    name: {
      fontFamily: font('bold'),
      paddingBottom: 6,
      paddingHorizontal: 4,
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

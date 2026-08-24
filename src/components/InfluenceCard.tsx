/**
 * InfluenceCard — a proper playing card.
 *
 * Face: cyber-circuit underlay, role-tinted gradient frame, corner
 * emblem pip, oval portrait, name plate. Back: circuit-filigree court
 * back with the mechanical-eye seal (scripts/gen-cards.py). A card that
 * flips from hidden to revealed plays a half-flip (turn-over) motion;
 * lost cards render dimmed with a strike.
 */
import React, { useEffect, useRef } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Role } from '../engine/types';
import { RoleArt } from './RoleArt';
import { RolePortrait } from './RolePortrait';
import { Theme, font, roleColors, useStyles } from '../theme';
import { t, TKey } from '../i18n';

/** Pre-rendered illustrated faces (scripts/gen-cards.py). */
const FACE_ART: Record<Role, number> = {
  duke: require('../../assets/cards/face-duke.png'),
  assassin: require('../../assets/cards/face-assassin.png'),
  captain: require('../../assets/cards/face-captain.png'),
  ambassador: require('../../assets/cards/face-ambassador.png'),
  contessa: require('../../assets/cards/face-contessa.png'),
};

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

export function InfluenceCard({ role, dead, width = 96, selected, tilt = 0 }: Props) {
  const styles = useStyles(makeStyles);
  const height = Math.round(width * 1.42);
  const faceUp = role !== undefined;

  // Turn-over: when the card first becomes face-up (opponent reveal),
  // first becomes dead, or CHANGES ROLE (exchange keep / proven-claim
  // replacement drawing a new card), play a calm half-flip.
  const prevFace = useRef(faceUp);
  const prevDead = useRef(dead);
  const prevRole = useRef(role);
  const flip = useSharedValue(0);
  useEffect(() => {
    const roleChanged =
      faceUp && prevFace.current && prevRole.current !== undefined && prevRole.current !== role;
    if ((faceUp && !prevFace.current) || (dead && !prevDead.current) || roleChanged) {
      flip.value = 1;
      flip.value = withTiming(0, { duration: 380 });
    }
    prevFace.current = faceUp;
    prevDead.current = dead;
    prevRole.current = role;
  }, [faceUp, dead, role, flip]);
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
        { width, height },
        selected ? styles.selected : null,
        dead ? styles.dead : null,
        anim,
      ]}
    >
      {faceUp && role ? (
        <View style={styles.face}>
          <Image source={FACE_ART[role]} style={{ width, height }} resizeMode="cover" />
          {/* the art leaves a plate for the localized name */}
          <View
            style={[
              styles.namePlate,
              {
                left: width * 0.11,
                right: width * 0.11,
                bottom: height * 0.093,
                height: height * 0.112,
              },
            ]}
          >
            <Text
              numberOfLines={1}
              style={[styles.name, { color: rc, fontSize: Math.max(8, width * 0.125) }]}
            >
              {t(role as TKey)}
            </Text>
          </View>
          {dead ? <View style={styles.strike} /> : null}
        </View>
      ) : (
        <Image
          source={require('../../assets/cards/back.png')}
          style={{ width, height }}
          resizeMode="cover"
        />
      )}
    </Animated.View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    card: {
      borderRadius: 10,
      overflow: 'hidden',
      ...theme.shadow.card,
    },
    face: {
      flex: 1,
    },
    namePlate: {
      position: 'absolute',
      alignItems: 'center',
      justifyContent: 'center',
    },
    name: {
      fontFamily: font('bold'),
    },
    selected: {
      // NOTE: no elevation/shadow here on purpose. This view uses
      // overflow:'hidden' for the card art, and toggling elevation on a
      // clipped view makes Fabric drop its contents — which showed up as
      // a card vanishing when it was de-selected in the exchange picker.
      borderColor: theme.colors.goldLight,
      borderWidth: 3,
    },
    dead: {
      // killed cards stay clearly readable — they are public information
      opacity: 0.88,
    },
    strike: {
      position: 'absolute',
      left: '-12%',
      right: '-12%',
      top: '50%',
      height: 4,
      backgroundColor: theme.colors.danger,
      opacity: 0.95,
      transform: [{ rotateZ: '-32deg' }],
    },
  });

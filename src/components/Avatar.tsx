/**
 * Avatar — a player's animal face in a tinted circle. Art: Kenney
 * "Animal Pack" (CC0). Legacy values (character-role avatars from older
 * clients) fall back to the role portrait so old rooms still render.
 */
import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { RolePortrait } from './RolePortrait';
import { Role, ROLES } from '../engine/types';

export const ANIMALS = [
  'bear',
  'panda',
  'owl',
  'penguin',
  'monkey',
  'elephant',
  'frog',
  'pig',
  'rabbit',
  'duck',
  'gorilla',
  'giraffe',
] as const;

export type Animal = (typeof ANIMALS)[number];

const ART: Record<Animal, number> = {
  bear: require('../../assets/avatars/bear.png'),
  panda: require('../../assets/avatars/panda.png'),
  owl: require('../../assets/avatars/owl.png'),
  penguin: require('../../assets/avatars/penguin.png'),
  monkey: require('../../assets/avatars/monkey.png'),
  elephant: require('../../assets/avatars/elephant.png'),
  frog: require('../../assets/avatars/frog.png'),
  pig: require('../../assets/avatars/pig.png'),
  rabbit: require('../../assets/avatars/rabbit.png'),
  duck: require('../../assets/avatars/duck.png'),
  gorilla: require('../../assets/avatars/gorilla.png'),
  giraffe: require('../../assets/avatars/giraffe.png'),
};

/** Distinct ring/backdrop tint per animal, so seats read at a glance. */
const TINT: Record<Animal, string> = {
  bear: '#b07a4a',
  panda: '#9aa4b2',
  owl: '#c28e5c',
  penguin: '#6d8fb5',
  monkey: '#b0774f',
  elephant: '#8f9bb3',
  frog: '#7aa85a',
  pig: '#d98ba0',
  rabbit: '#b5a8c9',
  duck: '#d9b64a',
  gorilla: '#7d8799',
  giraffe: '#cf9f52',
};

export function isAnimal(v?: string | null): v is Animal {
  return !!v && (ANIMALS as readonly string[]).includes(v);
}

export function Avatar({
  id,
  size,
  ring = 2,
}: {
  id?: string | null;
  size: number;
  ring?: number;
}) {
  if (isAnimal(id)) {
    const tint = TINT[id];
    return (
      <View
        style={[
          styles.circle,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth: ring,
            borderColor: tint,
            backgroundColor: '#232733', // solid backdrop — pops on any surface
          },
        ]}
      >
        <Image source={ART[id]} style={{ width: size * 0.84, height: size * 0.84 }} />
      </View>
    );
  }
  // Legacy character-portrait avatars from older clients
  if (id && (ROLES as readonly string[]).includes(id)) {
    return <RolePortrait role={id as Role} size={size} ring={ring} />;
  }
  return (
    <View
      style={[
        styles.circle,
        styles.fallback,
        { width: size, height: size, borderRadius: size / 2, borderWidth: ring },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  circle: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  fallback: {
    borderColor: '#5b6270',
    backgroundColor: '#2a2e37',
  },
});

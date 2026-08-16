/**
 * RolePortrait — circular character portrait (photographed card art)
 * ringed in the role's signature color.
 */
import React from 'react';
import { Image, View } from 'react-native';
import { Role } from '../engine/types';
import { roleColors } from '../theme';

const SRC: Record<Role, ReturnType<typeof require>> = {
  duke: require('../../assets/roles/duke.png'),
  assassin: require('../../assets/roles/assassin.png'),
  captain: require('../../assets/roles/captain.png'),
  ambassador: require('../../assets/roles/ambassador.png'),
  contessa: require('../../assets/roles/contessa.png'),
};

interface Props {
  role: Role;
  size?: number;
  /** Ring width; 0 disables the ring. */
  ring?: number;
}

export function RolePortrait({ role, size = 48, ring = 2 }: Props) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: ring,
        borderColor: roleColors[role],
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#0d0b09',
      }}
    >
      <Image
        source={SRC[role]}
        style={{
          width: size - ring * 2 - 2,
          height: size - ring * 2 - 2,
          borderRadius: (size - ring * 2 - 2) / 2,
        }}
        resizeMode="cover"
      />
    </View>
  );
}

/**
 * ActionGlyph — official instructional pictograms for the character
 * actions (white silhouettes), tinted per role/action color.
 */
import React from 'react';
import { Image } from 'react-native';
import { ActionType } from '../engine/types';

const GLYPHS: Partial<Record<ActionType, ReturnType<typeof require>>> = {
  tax: require('../../assets/glyphs/tax.png'),
  assassinate: require('../../assets/glyphs/assassinate.png'),
  steal: require('../../assets/glyphs/steal.png'),
  exchange: require('../../assets/glyphs/exchange.png'),
};

interface Props {
  action: ActionType;
  size?: number;
  color?: string;
}

export function ActionGlyph({ action, size = 20, color = '#f5d68c' }: Props) {
  const src = GLYPHS[action];
  if (!src) return null;
  return (
    <Image
      source={src}
      style={{ width: size, height: size, tintColor: color }}
      resizeMode="contain"
    />
  );
}

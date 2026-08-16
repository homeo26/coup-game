/**
 * RoleArt — vector character emblems in the spirit of the physical
 * game's role iconography: Duke = pentagram star, Captain = chevrons,
 * Assassin = skull, Contessa = crest, Ambassador = exchange diamonds.
 * Drawn as SVG so they stay crisp at any size and tint per role color.
 */
import React from 'react';
import Svg, { Circle, G, Path, Polygon, Rect } from 'react-native-svg';
import { Role } from '../engine/types';
import { roleColors } from '../theme';

interface Props {
  role: Role;
  size?: number;
  /** Emblem color override (defaults to the role's signature color). */
  color?: string;
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

export function RoleArt({ role, size = 48, color }: Props) {
  const c = color ?? roleColors[role];
  const s = size;
  switch (role) {
    case 'duke':
      // Pentagram star inside a ring
      return (
        <Svg width={s} height={s} viewBox="0 0 48 48">
          <Circle cx={24} cy={24} r={20} stroke={c} strokeWidth={3} fill="none" />
          <Polygon points={starPoints(24, 24, 14, 6)} fill={c} />
        </Svg>
      );
    case 'captain':
      // Two bold downward chevrons over a mast line
      return (
        <Svg width={s} height={s} viewBox="0 0 48 48">
          <Path d="M8 10 L24 22 L40 10 L40 20 L24 32 L8 20 Z" fill={c} />
          <Path d="M8 26 L24 38 L40 26 L40 34 L24 44 L8 34 Z" fill={c} opacity={0.55} />
          <Rect x={22} y={4} width={4} height={12} fill={c} opacity={0.8} />
        </Svg>
      );
    case 'assassin':
      // Skull with crossed eyes
      return (
        <Svg width={s} height={s} viewBox="0 0 48 48">
          <Path
            d="M24 4 C13 4 7 12 7 21 C7 27 10 31 14 34 L14 40 C14 42 16 44 18 44 L30 44 C32 44 34 42 34 40 L34 34 C38 31 41 27 41 21 C41 12 35 4 24 4 Z"
            fill={c}
          />
          {/* eye sockets: X marks */}
          <G stroke="#12100d" strokeWidth={3} strokeLinecap="round">
            <Path d="M13 18 L21 26 M21 18 L13 26" />
            <Path d="M27 18 L35 26 M35 18 L27 26" />
          </G>
          <Rect x={20} y={33} width={2.6} height={8} fill="#12100d" />
          <Rect x={25.4} y={33} width={2.6} height={8} fill="#12100d" />
        </Svg>
      );
    case 'contessa':
      // Crest: a diamond shield with three drop bars
      return (
        <Svg width={s} height={s} viewBox="0 0 48 48">
          <Path d="M24 3 L44 16 L24 45 L4 16 Z" fill={c} />
          <G fill="#12100d">
            <Rect x={15.5} y={15} width={4} height={14} rx={2} />
            <Rect x={22} y={13} width={4} height={19} rx={2} />
            <Rect x={28.5} y={15} width={4} height={14} rx={2} />
          </G>
        </Svg>
      );
    case 'ambassador':
      // Two diamonds trading places (exchange arrows implied)
      return (
        <Svg width={s} height={s} viewBox="0 0 48 48">
          <Polygon points="24,2 33,11 24,20 15,11" fill={c} />
          <Polygon points="24,28 33,37 24,46 15,37" fill={c} opacity={0.55} />
          <G stroke={c} strokeWidth={3} fill="none" strokeLinecap="round">
            <Path d="M8 30 C8 22 12 18 17 16" />
            <Path d="M40 18 C40 26 36 30 31 32" />
          </G>
          <Polygon points="17,12 21,17 14,19" fill={c} />
          <Polygon points="31,36 27,31 34,29" fill={c} />
        </Svg>
      );
  }
}

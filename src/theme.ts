/**
 * Coup theme — cyborg-noir palette: near-black chrome surfaces with neon
 * cyan accents (keys keep the historical 'gold' names), plus a
 * signature color per character (mirroring the physical game's role icons:
 * Duke's crimson star, Captain's blue chevrons, Assassin's black skull,
 * Contessa's scarlet crest, Ambassador's olive-gold exchange marks).
 *
 * The app is dark-only: the game's identity is a night-time court of
 * conspirators; a light mode would break the theme.
 */
import { Easing } from 'react-native-reanimated';
import { useMemo } from 'react';
import { StyleSheet } from 'react-native';

export const roleColors = {
  duke: '#c8355b',
  assassin: '#8b93a3',
  captain: '#4d8fdb',
  ambassador: '#a8b23e',
  contessa: '#e05a33',
} as const;

export const theme = {
  colors: {
    // Accent — polished silver, matching the game's coin token.
    // (Keys keep the historical 'gold' names to avoid a mass rename.)
    gold: '#22d3ee',
    goldDark: '#0e7490',
    goldLight: '#7ef0ff',
    inkOnGold: '#04141a',

    // Neutrals (cool near-black — lets the character colors breathe)
    background: '#080b11',
    surface: '#111721',
    surfaceElevated: '#161e2b',
    surfaceHover: '#1e2938',
    border: 'rgba(126, 240, 255, 0.14)',
    borderBright: 'rgba(126, 240, 255, 0.32)',

    // Text
    ink: '#eaf6ff',
    inkSoft: '#9fb3c8',
    inkFaint: '#5d6b7d',

    // Semantic
    success: '#3ddc97',
    danger: '#ff3d68',
    warning: '#ffb02e',

    // Tab bar
    tabBar: 'rgba(12, 14, 18, 0.97)',
    tabActive: '#22d3ee',
    tabInactive: '#646a76',
  },
  role: roleColors,
  gradients: {
    gold: ['#0e7490', '#22d3ee'] as [string, string],
    table: ['#0c1219', '#080b11'] as [string, string],
    card: ['#161e2b', '#111721'] as [string, string],
  },
  radius: { xs: 6, sm: 10, md: 16, lg: 20, xl: 28, pill: 999 },
  spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 },
  fonts: {
    // Arabic-capable primary + Latin companion
    arRegular: 'Cairo_400Regular',
    arSemibold: 'Cairo_600SemiBold',
    arBold: 'Cairo_700Bold',
    arBlack: 'Cairo_900Black',
    regular: 'Poppins_400Regular',
    semibold: 'Poppins_600SemiBold',
    bold: 'Poppins_700Bold',
    black: 'Poppins_900Black',
  },
  shadow: {
    card: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.35,
      shadowRadius: 12,
      elevation: 4,
    },
    goldGlow: {
      shadowColor: '#22d3ee',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.75,
      shadowRadius: 16,
      elevation: 8,
    },
  },
  motion: {
    fast: 140,
    base: 240,
    slow: 380,
    easing: Easing.bezier(0.4, 0, 0.2, 1),
  },
  statusBar: 'light' as const,
};

export type Theme = typeof theme;

/** Arabic-first font picker (Cairo renders Latin fine too). */
export function font(weight: 'regular' | 'semibold' | 'bold' | 'black'): string {
  const map = {
    regular: theme.fonts.arRegular,
    semibold: theme.fonts.arSemibold,
    bold: theme.fonts.arBold,
    black: theme.fonts.arBlack,
  } as const;
  return map[weight];
}

/** Poppins for standalone numerals / Latin labels. */
export function latinFont(weight: 'regular' | 'semibold' | 'bold' | 'black'): string {
  const map = {
    regular: theme.fonts.regular,
    semibold: theme.fonts.semibold,
    bold: theme.fonts.bold,
    black: theme.fonts.black,
  } as const;
  return map[weight];
}

export function useTheme(): Theme {
  return theme;
}

/** Build a themed StyleSheet: const styles = useStyles(makeStyles) */
export function useStyles<T extends StyleSheet.NamedStyles<T>>(make: (t: Theme) => T): T {
  return useMemo(() => make(theme), [make]);
}

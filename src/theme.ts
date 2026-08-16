/**
 * Coup theme — dystopian dark palette with antique gold accents, plus a
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
    // Brand
    gold: '#d4a854',
    goldDark: '#8c6828',
    goldLight: '#f5d68c',
    inkOnGold: '#18140e',

    // Neutrals (warm near-black court)
    background: '#12100d',
    surface: '#1e1a14',
    surfaceElevated: '#272219',
    surfaceHover: '#2f2920',
    border: 'rgba(245, 214, 140, 0.10)',
    borderBright: 'rgba(245, 214, 140, 0.22)',

    // Text
    ink: '#f0e8d8',
    inkSoft: '#b0a68e',
    inkFaint: '#6f675c',

    // Semantic
    success: '#5da860',
    danger: '#d9534f',
    warning: '#e8a33d',

    // Tab bar
    tabBar: 'rgba(22, 19, 15, 0.97)',
    tabActive: '#d4a854',
    tabInactive: '#6f675c',
  },
  role: roleColors,
  gradients: {
    gold: ['#8c6828', '#d4a854'] as [string, string],
    table: ['#1a1712', '#12100d'] as [string, string],
    card: ['#272219', '#1e1a14'] as [string, string],
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
      shadowColor: '#d4a854',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.35,
      shadowRadius: 14,
      elevation: 6,
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

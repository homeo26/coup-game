/**
 * Coin — the gold coin chip with an amount, used for player balances,
 * action costs, and the treasury. Pure SVG + text.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Polygon } from 'react-native-svg';
import { Theme, latinFont, useStyles } from '../theme';

function starPoints(cx: number, cy: number, rOut: number, rIn: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? rOut : rIn;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    pts.push(`${cx + Math.cos(a) * r},${cy + Math.sin(a) * r}`);
  }
  return pts.join(' ');
}

export function CoinIcon({ size = 18 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx={12} cy={12} r={11} fill="#d4a854" />
      <Circle cx={12} cy={12} r={10} fill="none" stroke="#f5d68c" strokeWidth={1.4} />
      <Circle cx={12} cy={12} r={8} fill="none" stroke="#8c6828" strokeWidth={0.9} />
      <Polygon points={starPoints(12, 12, 5.4, 2.3)} fill="#18140e" />
    </Svg>
  );
}

export function CoinCount({ amount, size = 18 }: { amount: number; size?: number }) {
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.row}>
      <CoinIcon size={size} />
      <Text style={[styles.amount, { fontSize: size * 0.82, lineHeight: size * 1.3 }]}>
        {amount}
      </Text>
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    amount: {
      fontFamily: latinFont('bold'),
      color: theme.colors.goldLight,
    },
  });

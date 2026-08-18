/**
 * Coin — the game's coin token (official token render) with an amount,
 * used for player balances, action costs, and the treasury.
 */
import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { Theme, latinFont, useStyles } from '../theme';

const COIN = require('../../assets/coin.png');

export function CoinIcon({ size = 18 }: { size?: number }) {
  return <Image source={COIN} style={{ width: size, height: size }} resizeMode="contain" />;
}

/**
 * Coin count. `chip` wraps it in a dark pill so the number stays legible
 * on busy backgrounds (felt, card art).
 */
export function CoinCount({
  amount,
  size = 18,
  chip,
}: {
  amount: number;
  size?: number;
  chip?: boolean;
}) {
  const styles = useStyles(makeStyles);
  return (
    <View style={[styles.row, chip && styles.chip]}>
      <CoinIcon size={size} />
      <Text
        style={[
          styles.amount,
          { fontSize: size * 0.95, lineHeight: size * 1.35 },
          chip && styles.amountChip,
        ]}
      >
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
    chip: {
      backgroundColor: 'rgba(8, 10, 14, 0.9)',
      borderRadius: theme.radius.pill,
      borderWidth: 1.5,
      borderColor: 'rgba(233, 235, 240, 0.35)',
      paddingHorizontal: 8,
      paddingVertical: 1,
      gap: 5,
    },
    amount: {
      fontFamily: latinFont('bold'),
      color: theme.colors.goldLight,
      textShadowColor: 'rgba(0,0,0,0.9)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 3,
    },
    amountChip: {
      color: '#f2f4f8',
    },
  });

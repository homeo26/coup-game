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

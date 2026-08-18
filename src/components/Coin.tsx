/**
 * Coin — the game's coin token (official token render) with an amount,
 * used for player balances, action costs, and the treasury.
 */
import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
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
      {chip ? (
        <LinearGradient
          colors={['rgba(58,63,74,0.95)', 'rgba(10,12,16,0.95)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
      <CoinIcon size={size} />
      <Text
        style={[
          styles.amount,
          { fontSize: size * 0.95, lineHeight: size * 1.3 },
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
      borderRadius: theme.radius.pill,
      borderWidth: 1,
      borderColor: 'rgba(233,235,240,0.28)',
      paddingHorizontal: 7,
      paddingVertical: 1,
      gap: 4,
      overflow: 'hidden',
    },
    amount: {
      fontFamily: latinFont('bold'),
      color: theme.colors.goldLight,
      textShadowColor: 'rgba(0,0,0,0.9)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 3,
    },
    amountChip: {
      color: '#ffffff',
    },
  });

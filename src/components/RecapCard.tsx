/**
 * RecapCard — the end of a game, as one shareable picture.
 *
 * It is a plain view, not a canvas: the same component is what the players
 * see on the results screen and what gets rasterised by react-native-view-shot,
 * so what you share is exactly what you saw. Everything it shows comes from
 * the finished GameState — the finish order from `standings()` and the totals
 * the reducer kept in `stats` (the log is capped, so it cannot be trusted for
 * a long game).
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { GameState, PlayerStats } from '../engine/types';
import { standings } from '../engine/engine';
import { Avatar } from './Avatar';
import { CoinIcon } from './Coin';
import { Theme, font, latinFont, useStyles, useTheme } from '../theme';
import { isRTL, t, TKey } from '../i18n';
import { skinOf } from '../skins';

const EMPTY: PlayerStats = {
  coinsGained: 0,
  stolen: 0,
  biggestSteal: 0,
  bluffsCalled: 0,
  challengesLost: 0,
  caughtBluffing: 0,
  blocks: 0,
  kills: 0,
};

interface Highlight {
  icon: keyof typeof Ionicons.glyphMap;
  labelKey: TKey;
  who: string;
  value: number;
}

/**
 * The three most interesting things that happened, if they happened at all.
 * A game where nobody bluffed simply shows fewer lines rather than zeros.
 */
export function highlightsOf(g: GameState, nameOf: (id: string) => string): Highlight[] {
  const rows = g.players.map((p) => ({ id: p.id, s: g.stats?.[p.id] ?? EMPTY }));
  const best = (pick: (s: PlayerStats) => number) =>
    rows.reduce((top, r) => (pick(r.s) > pick(top.s) ? r : top), rows[0]);

  const out: Highlight[] = [];
  const caller = best((s) => s.bluffsCalled);
  if (caller && caller.s.bluffsCalled > 0) {
    out.push({
      icon: 'flash',
      labelKey: 'recapBluffsCalled',
      who: nameOf(caller.id),
      value: caller.s.bluffsCalled,
    });
  }
  const thief = best((s) => s.biggestSteal);
  if (thief && thief.s.stolen > 0) {
    out.push({
      icon: 'cash-outline',
      labelKey: 'recapStolen',
      who: nameOf(thief.id),
      value: thief.s.stolen,
    });
  }
  const liar = best((s) => s.caughtBluffing);
  if (liar && liar.s.caughtBluffing > 0) {
    out.push({
      icon: 'eye-outline',
      labelKey: 'recapCaught',
      who: nameOf(liar.id),
      value: liar.s.caughtBluffing,
    });
  }
  const killer = best((s) => s.kills);
  if (out.length < 3 && killer && killer.s.kills > 0) {
    out.push({
      icon: 'skull',
      labelKey: 'recapKills',
      who: nameOf(killer.id),
      value: killer.s.kills,
    });
  }
  return out.slice(0, 3);
}

export function RecapCard({
  g,
  meId,
  avatarOf,
  skinId,
  code,
}: {
  g: GameState;
  meId: string;
  avatarOf: (id: string) => string | undefined;
  skinId?: string;
  /** Room code, or undefined for an offline table. */
  code?: string;
}) {
  const styles = useStyles(makeStyles);
  const theme = useTheme();
  const rtl = isRTL();
  const order = standings(g);
  const winner = order[0];
  const skin = skinOf(skinId);
  const nameOf = (id: string) => g.players.find((p) => p.id === id)?.name ?? '';
  const highlights = highlightsOf(g, nameOf);

  return (
    <View style={styles.card} collapsable={false}>
      <LinearGradient
        colors={[skin.cloth[0], skin.cloth[2]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.head, rtl && styles.rowReverse]}>
        <Text style={styles.brand}>COUP</Text>
        <Text style={styles.sub}>{code ? `#${code}` : t('offlineTable')}</Text>
      </View>

      <View style={[styles.winnerRow, rtl && styles.rowReverse]}>
        <Avatar id={avatarOf(winner.id)} size={54} ring={2.5} />
        <View style={styles.winnerText}>
          <Text style={[styles.winnerName, rtl && styles.rtlText]} numberOfLines={1}>
            {winner.name}
          </Text>
          <Text style={[styles.winnerLabel, rtl && styles.rtlText]}>{t('recapWins')}</Text>
        </View>
        <Ionicons name="trophy" size={30} color={theme.colors.goldLight} />
      </View>

      <View style={styles.rows}>
        {order.map((p, i) => (
          <View key={p.id} style={[styles.row, rtl && styles.rowReverse]}>
            <Text style={styles.place}>{i + 1}</Text>
            <Avatar id={avatarOf(p.id)} size={22} ring={1.2} />
            <Text style={[styles.rowName, rtl && styles.rtlText]} numberOfLines={1}>
              {p.name}
              {p.id === meId ? `  (${t('you')})` : ''}
            </Text>
            <View style={[styles.rowCoinBox, rtl && styles.rowReverse]}>
              <CoinIcon size={11} />
              <Text style={styles.rowCoins}>{g.stats?.[p.id]?.coinsGained ?? 0}</Text>
            </View>
          </View>
        ))}
      </View>

      {highlights.length > 0 ? (
        <View style={styles.highlights}>
          {highlights.map((h) => (
            <View key={h.labelKey} style={[styles.highlight, rtl && styles.rowReverse]}>
              <Ionicons name={h.icon} size={14} color={theme.colors.goldLight} />
              <Text style={[styles.highlightText, rtl && styles.rtlText]} numberOfLines={1}>
                {t(h.labelKey, { n: h.value, name: h.who })}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      <Text style={styles.footer}>{t('recapFooter')}</Text>
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    card: {
      width: 300,
      borderRadius: theme.radius.lg,
      overflow: 'hidden',
      borderWidth: 1.5,
      borderColor: theme.colors.borderBright,
      padding: 16,
      gap: 12,
    },
    rowReverse: { flexDirection: 'row-reverse' },
    rtlText: { textAlign: 'right', writingDirection: 'rtl' },
    head: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    brand: {
      fontSize: 17,
      letterSpacing: 3,
      fontFamily: latinFont('bold'),
      color: theme.colors.ink,
    },
    sub: {
      fontSize: 12,
      fontFamily: latinFont('bold'),
      color: 'rgba(255,255,255,0.6)',
    },
    winnerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: 'rgba(8,10,14,0.42)',
      borderRadius: theme.radius.md,
      borderWidth: 1,
      borderColor: theme.colors.goldLight + '55',
      padding: 10,
    },
    winnerText: { flex: 1, gap: 1 },
    winnerName: {
      fontSize: 18,
      fontFamily: font('bold'),
      color: theme.colors.goldLight,
    },
    winnerLabel: {
      fontSize: 12,
      fontFamily: font('semibold'),
      color: 'rgba(255,255,255,0.72)',
    },
    rows: { gap: 5 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: 'rgba(8,10,14,0.34)',
      borderRadius: theme.radius.sm,
      paddingHorizontal: 9,
      paddingVertical: 5,
    },
    place: {
      width: 14,
      fontSize: 12,
      fontFamily: latinFont('bold'),
      color: 'rgba(255,255,255,0.55)',
      textAlign: 'center',
    },
    rowName: {
      flex: 1,
      fontSize: 13,
      fontFamily: font('semibold'),
      color: theme.colors.ink,
    },
    /** Coins collected across the whole game — a rough measure of the run. */
    rowCoinBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
    },
    rowCoins: {
      fontSize: 12.5,
      fontFamily: latinFont('bold'),
      color: theme.colors.goldLight,
    },
    highlights: { gap: 4 },
    highlight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
    },
    highlightText: {
      flex: 1,
      fontSize: 12,
      fontFamily: font('semibold'),
      color: 'rgba(255,255,255,0.82)',
    },
    footer: {
      fontSize: 10.5,
      fontFamily: latinFont('bold'),
      color: 'rgba(255,255,255,0.45)',
      textAlign: 'center',
      letterSpacing: 0.6,
    },
  });

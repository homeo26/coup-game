/**
 * GameScreen — the Coup table.
 *
 * Layout (portrait): header (leave / room code / court count), the log
 * strip, opponent seats, then my area: hand, coins, and a context panel
 * that morphs by phase — action bar on my turn, challenge/block prompts
 * when I owe a response, card-loss picker, exchange picker, and a win
 * overlay at game end. Everything animates with short fades/springs.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeOut,
  FlipInEasyY,
  LinearTransition,
  SlideInDown,
  SlideOutDown,
  ZoomIn,
  ZoomOut,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { Theme, font, latinFont, roleColors, useStyles, useTheme } from '../theme';
import { Pressy } from '../components/Pressy';
import { InfluenceCard } from '../components/InfluenceCard';
import { CoinCount, CoinIcon } from '../components/Coin';
import { RoleArt } from '../components/RoleArt';
import { RolePortrait } from '../components/RolePortrait';
import { Avatar } from '../components/Avatar';
import { Breathing } from '../components/Breathing';
import { MessageSheet, SheetMessage } from '../components/MessageSheet';
import { useRoom } from '../net/RoomContext';
import { useSettings } from '../settings';
import { influence, isAlive, pendingResponders, standings } from '../engine/engine';
import {
  ACTION_ROLE,
  ActionType,
  BLOCK_ROLES,
  GameState,
  LogEntry,
  PlayerState,
  Role,
  ROLES,
} from '../engine/types';
import { t, TKey, isRTL } from '../i18n';
import * as haptics from '../haptics';
import * as sound from '../sound';

/* ------------------------------------------------------------------ */
/* Log formatting                                                      */
/* ------------------------------------------------------------------ */

const ACTION_LABEL: Record<ActionType, TKey> = {
  income: 'income',
  foreign_aid: 'foreign_aid',
  coup: 'coupAction',
  tax: 'tax',
  assassinate: 'assassinate',
  steal: 'steal',
  exchange: 'exchange',
};

function formatLog(e: LogEntry): string {
  const params: Record<string, string | number> = { ...(e.params ?? {}) };
  if (typeof params.r === 'string' && params.r in roleColors) {
    params.r = t(params.r as TKey);
  }
  if (typeof params.act === 'string' && params.act in ACTION_LABEL) {
    params.act = t(ACTION_LABEL[params.act as ActionType]);
  }
  return t(e.key as TKey, params);
}

/** Icon + accent per event type, so the history reads at a glance. */
function logMeta(e: LogEntry, th: Theme): { icon: keyof typeof Ionicons.glyphMap; color: string } {
  const roleColor =
    typeof e.params?.r === 'string' && e.params.r in roleColors
      ? roleColors[e.params.r as keyof typeof roleColors]
      : undefined;
  switch (e.key) {
    case 'logIncome':
    case 'logForeignAid':
    case 'logTax':
    case 'logSteal':
      return { icon: 'cash-outline', color: th.colors.goldLight };
    case 'logDeclared':
    case 'logForeignAidDeclared':
      return { icon: 'megaphone-outline', color: roleColor ?? th.colors.inkSoft };
    case 'logBlockDeclared':
    case 'logForeignAidBlocked':
    case 'logStealBlocked':
    case 'logAssassinateBlocked':
      return { icon: 'shield-half-outline', color: roleColor ?? th.colors.warning };
    case 'logChallenge':
      return { icon: 'flash', color: th.colors.warning };
    case 'logChallengeFailed':
      return { icon: 'shield-checkmark', color: th.colors.success };
    case 'logChallengeWon':
      return { icon: 'flash-off', color: th.colors.danger };
    case 'logCoup':
    case 'logAssassinate':
      return { icon: 'skull', color: th.colors.danger };
    case 'logLostCard':
      return { icon: 'close-circle', color: roleColor ?? th.colors.danger };
    case 'logEliminated':
    case 'logForfeit':
      return { icon: 'remove-circle', color: th.colors.inkFaint };
    case 'logExchange':
      return { icon: 'swap-horizontal', color: th.colors.goldLight };
    case 'logWinner':
      return { icon: 'trophy', color: th.colors.goldLight };
    default:
      return { icon: 'ellipse-outline', color: th.colors.inkSoft };
  }
}

/**
 * Events that always deserve a floating banner. On a crowded table the
 * routine coin actions are left to the log strip so the felt stays clear.
 */
const BANNER_ALWAYS = new Set([
  'logChallenge',
  'logChallengeFailed',
  'logChallengeWon',
  'logBlockDeclared',
  'logForeignAidBlocked',
  'logStealBlocked',
  'logAssassinateBlocked',
  'logCoup',
  'logAssassinate',
  'logLostCard',
  'logEliminated',
  'logForfeit',
  'logTimeout',
  'logWinner',
]);

/** Which cue a game event plays (null = silent). */
function logSound(key: string, role?: string): sound.SoundKey | null {
  // A claimed character announces itself in its own voice.
  if (key === 'logDeclared' && role && sound.ROLE_VOICE[role]) {
    return sound.ROLE_VOICE[role];
  }
  if (key === 'logBlockDeclared' && role === 'contessa') {
    return sound.ROLE_VOICE.contessa;
  }
  switch (key) {
    case 'logIncome':
    case 'logForeignAid':
    case 'logTax':
    case 'logSteal':
      return 'coins';
    case 'logDeclared':
    case 'logForeignAidDeclared':
      return 'claim';
    case 'logBlockDeclared':
    case 'logForeignAidBlocked':
    case 'logStealBlocked':
    case 'logAssassinateBlocked':
      return 'block';
    case 'logChallenge':
      return 'challenge';
    case 'logChallengeFailed':
    case 'logChallengeWon':
      return 'fail';
    case 'logCoup':
      return 'coupHit';
    case 'logAssassinate':
      return 'kill';
    case 'logLostCard':
      return 'reveal';
    case 'logEliminated':
    case 'logForfeit':
      return 'lose';
    case 'logExchange':
      return 'shuffle';
    default:
      return null;
  }
}

/* ------------------------------------------------------------------ */
/* Opponent seat                                                       */
/* ------------------------------------------------------------------ */

/** A "+3" / "-2" that drifts up and fades off a coin chip. */
function CoinDelta({ delta }: { delta: number }) {
  const styles = useStyles(makeStyles);
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withTiming(1, { duration: 900, easing: Easing.out(Easing.quad) });
  }, [t]);
  const st = useAnimatedStyle(() => ({
    opacity: 1 - Math.max(0, t.value - 0.55) / 0.45,
    transform: [{ translateY: -34 * t.value }, { scale: 0.85 + 0.35 * Math.min(1, t.value * 3) }],
  }));
  return (
    <Animated.View pointerEvents="none" style={[styles.deltaWrap, st]}>
      <Text style={[styles.deltaText, delta > 0 ? styles.deltaUp : styles.deltaDown]}>
        {delta > 0 ? `+${delta}` : delta}
      </Text>
    </Animated.View>
  );
}

/**
 * Influence shown as small pips instead of a card fan. On a crowded table
 * ten opponent cards is just noise — the pips say how much influence each
 * player still holds, and a lost one carries the dead character's colour
 * (the discard piles by the Court still show exactly what died).
 */
function InfluencePips({ cards }: { cards: { role: Role; revealed: boolean }[] }) {
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.pipRow}>
      {cards.map((c, i) =>
        c.revealed ? (
          <View
            key={i}
            style={[
              styles.pipDead,
              { borderColor: roleColors[c.role], backgroundColor: roleColors[c.role] + '33' },
            ]}
          >
            <RoleArt role={c.role} size={9} color={roleColors[c.role]} />
          </View>
        ) : (
          <View key={i} style={styles.pipAlive} />
        ),
      )}
    </View>
  );
}

/** Coin count that pulses whenever the amount changes, with a floating delta. */
function AnimatedCoins({
  amount,
  size,
  chip,
}: {
  amount: number;
  size: number;
  chip?: boolean;
}) {
  const scale = useSharedValue(1);
  const prev = useRef(amount);
  const [delta, setDelta] = useState<{ n: number; key: number } | null>(null);
  useEffect(() => {
    if (prev.current !== amount) {
      const diff = amount - prev.current;
      prev.current = amount;
      scale.value = withSequence(
        withTiming(1.35, { duration: 170 }),
        withTiming(1, { duration: 260 }),
      );
      const key = Date.now();
      setDelta({ n: diff, key });
      setTimeout(() => setDelta((d) => (d?.key === key ? null : d)), 950);
    }
  }, [amount, scale]);
  const st = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Animated.View style={st}>
      <CoinCount amount={amount} size={size} chip={chip} />
      {delta ? <CoinDelta key={delta.key} delta={delta.n} /> : null}
    </Animated.View>
  );
}

/**
 * One opponent = one full-width scoreboard row: turn state on the left,
 * name, influence cards, coins on the right. All opponents fit in a
 * single glance-friendly column — no grid to scan.
 */
/** Where seats sit around the table rim (fractions of the table box,
 *  anchoring each seat's center) — mirrors a real round table. */
const SEAT_ANCHORS: Record<number, { x: number; y: number }[]> = {
  1: [{ x: 0.5, y: -0.04 }],
  2: [{ x: 0.13, y: 0.38 }, { x: 0.87, y: 0.38 }],
  3: [{ x: 0.13, y: 0.42 }, { x: 0.5, y: -0.04 }, { x: 0.87, y: 0.42 }],
  4: [
    { x: 0.12, y: 0.5 },
    { x: 0.26, y: 0.07 },
    { x: 0.74, y: 0.07 },
    { x: 0.88, y: 0.5 },
  ],
  5: [
    { x: 0.12, y: 0.52 },
    { x: 0.22, y: 0.06 },
    { x: 0.5, y: -0.04 },
    { x: 0.78, y: 0.06 },
    { x: 0.88, y: 0.52 },
  ],
};

const SEAT_W = 104;

/** Ability reminder shown when a player peeks at their own card. */
const ROLE_BLURB: Record<Role, TKey> = {
  duke: 'dukeBlurb',
  assassin: 'assassinBlurb',
  captain: 'captainBlurb',
  ambassador: 'ambassadorBlurb',
  contessa: 'contessaBlurb',
};

/** A seat at the table: card fan behind the avatar, name and coins
 *  below, turn glow around the face — like sitting at a real table. */
function TableSeat({
  p,
  avatar,
  emote,
  isTurn,
  responding,
  targetable,
  onTarget,
  anchor,
  anchorBottom,
  showFaces,
  compact,
  claim,
  passed,
  dense,
}: {
  p: PlayerState;
  avatar?: string;
  emote?: string | null;
  isTurn: boolean;
  responding: boolean;
  targetable: boolean;
  onTarget: () => void;
  anchor: { x: number; y: number };
  /** Anchor from the felt's bottom edge instead of the top (0..1). */
  anchorBottom?: number;
  /** Render this seat's hidden cards face-up (the player's own seat). */
  showFaces?: boolean;
  /** Shrink the seat (used while the action sheet squeezes the table). */
  compact?: boolean;
  /** Character this player is currently claiming, pinned to their seat. */
  claim?: Role | null;
  /** They have already answered the open response window. */
  passed?: boolean;
  /** Crowded table: shrink, swap the card fan for pips, fold coins in. */
  dense?: boolean;
}) {
  const theme = useTheme();
  const styles = useStyles(makeStyles);
  const dead = !isAlive(p);
  const AV = compact ? (dense ? 38 : 44) : dense ? 48 : 58; // avatar size
  const CARD = compact ? 34 : 44; // fan card width
  const COIN = dense ? 13 : compact ? 14 : 18; // coin glyph size

  // A gentle scale nudge when the turn arrives at this seat
  const nudge = useSharedValue(1);
  const wasTurn = useRef(isTurn);
  useEffect(() => {
    if (isTurn && !wasTurn.current) {
      nudge.value = withSequence(
        withTiming(1.06, { duration: 220 }),
        withTiming(1, { duration: 320 }),
      );
    }
    wasTurn.current = isTurn;
  }, [isTurn, nudge]);

  // Smooth turn hand-off: a glow ring that fades between seats and
  // BREATHES while the turn is held — impossible to lose track of.
  const turnSv = useSharedValue(isTurn ? 1 : 0);
  const pulse = useSharedValue(0);
  useEffect(() => {
    turnSv.value = withTiming(isTurn ? 1 : 0, { duration: 550 });
    if (isTurn) {
      pulse.value = 0;
      pulse.value = withRepeat(
        withTiming(1, { duration: 900, easing: Easing.inOut(Easing.sin) }),
        -1,
        true,
      );
    }
  }, [isTurn, turnSv, pulse]);
  const ringStyle = useAnimatedStyle(() => ({
    opacity: turnSv.value * (0.55 + 0.45 * pulse.value),
    transform: [{ scale: nudge.value * (1 + 0.08 * pulse.value * turnSv.value) }],
  }));
  const nudgeStyle = useAnimatedStyle(() => ({ transform: [{ scale: nudge.value }] }));

  return (
    <View
      style={[
        styles.tableSeat,
        anchorBottom !== undefined
          ? {
              left: `${anchor.x * 100}%`,
              bottom: `${anchorBottom * 100}%`,
              marginLeft: -SEAT_W / 2,
            }
          : {
              left: `${anchor.x * 100}%`,
              top: `${anchor.y * 100}%`,
              marginLeft: -SEAT_W / 2,
            },
      ]}
    >
      <Pressy
        scaleTo={0.93}
        disabled={!targetable}
        noDimWhenDisabled
        onPress={onTarget}
        style={styles.seatInner}
      >
        {/* card fan peeking from behind the avatar; a killed character
            shows as a real face-up card at card proportions. On a crowded
            table the fan is replaced by pips under the name. */}
        <View style={[styles.fan, dense && !showFaces && styles.fanHidden]} pointerEvents="none">
          {p.cards.map((c, i) =>
            c.revealed || showFaces ? (
              <Animated.View
                key={i}
                entering={FlipInEasyY.duration(500)}
                style={{
                  transform: [{ rotate: `${i === 0 ? -15 : 15}deg` }, { translateY: -14 }],
                }}
              >
                <InfluenceCard role={c.role} dead={c.revealed} width={CARD} />
              </Animated.View>
            ) : (
              <View
                key={i}
                style={[
                  styles.fanCard,
                  { transform: [{ rotate: `${i === 0 ? -16 : 16}deg` }, { translateY: -3 }] },
                ]}
              >
                <Image
                  source={require('../../assets/cards/back.png')}
                  style={{ width: 21, height: 30 }}
                  resizeMode="cover"
                />
              </View>
            ),
          )}
        </View>
        <Animated.View style={nudgeStyle}>
          <View style={dead ? styles.seatDeadAvatar : undefined}>
            <Avatar id={avatar} size={AV} ring={2.5} />
          </View>
          {/* pulsing turn ring */}
          <Animated.View
            pointerEvents="none"
            style={[
              styles.turnRing,
              { width: AV + 8, height: AV + 8, borderRadius: (AV + 8) / 2 },
              ringStyle,
            ]}
          />
          {targetable ? (
            <View
              style={[
                styles.targetRing,
                { width: AV + 8, height: AV + 8, borderRadius: (AV + 8) / 2 },
              ]}
            >
              <Ionicons name="locate" size={15} color="#fff" />
            </View>
          ) : null}
          {dead ? (
            <View style={styles.deadBadge}>
              <Ionicons name="skull" size={13} color={theme.colors.inkFaint} />
            </View>
          ) : responding ? (
            <View style={styles.respondBadge}>
              <Ionicons name="hourglass" size={10} color={theme.colors.inkOnGold} />
            </View>
          ) : passed ? (
            <Animated.View entering={ZoomIn.duration(220)} style={styles.passedBadge}>
              <Ionicons name="checkmark" size={11} color="#0d1a12" />
            </Animated.View>
          ) : null}
        </Animated.View>
        <Animated.View
          layout={LinearTransition.duration(220)}
          style={[
            styles.seatNameChip,
            isTurn && !claim && styles.seatNameChipTurn,
            claim && { borderColor: roleColors[claim], backgroundColor: 'rgba(6,8,12,0.96)' },
            dead && { opacity: 0.6 },
          ]}
        >
          {claim ? (
            <Animated.View entering={ZoomIn.duration(200)} exiting={FadeOut.duration(160)}>
              <RolePortrait role={claim} size={15} ring={1} />
            </Animated.View>
          ) : null}
          <Text
            style={[
              styles.seatNameText,
              isTurn && !claim && styles.seatNameTextTurn,
              claim && { color: roleColors[claim] },
            ]}
            numberOfLines={1}
          >
            {claim ? `${p.name} · ${t(claim as TKey)}` : p.name}
          </Text>
          {dense && !dead ? (
            <>
              <View style={styles.chipDivider} />
              <CoinIcon size={12} />
              <Text style={styles.chipCoins}>{p.coins}</Text>
            </>
          ) : null}
        </Animated.View>
        {dense && !showFaces ? <InfluencePips cards={p.cards} /> : null}
        {dead ? (
          <Text style={styles.deadLabel}>{t('eliminated')}</Text>
        ) : dense ? null : (
          <AnimatedCoins amount={p.coins} size={COIN} chip />
        )}
      </Pressy>
      {emote ? (
        <Animated.View
          key={emote}
          entering={FadeInDown.duration(250)}
          exiting={FadeOut.duration(300)}
          pointerEvents="none"
          style={styles.emoteBubble}
        >
          <Text style={styles.emoteBubbleText}>{emote}</Text>
        </Animated.View>
      ) : null}
    </View>
  );
}

/**
 * A directional attack effect drawn between two seats: a coin streak for
 * a steal, a dagger arc for an assassination, a heavy impact for a coup.
 */
function AttackFx({
  kind,
  from,
  to,
}: {
  kind: 'steal' | 'assassinate' | 'coup';
  from: { x: number; y: number };
  to: { x: number; y: number };
}) {
  const theme = useTheme();
  const styles = useStyles(makeStyles);
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withTiming(1, { duration: kind === 'steal' ? 620 : 520, easing: Easing.inOut(Easing.cubic) });
  }, [t, kind]);
  const lift = kind === 'assassinate' ? 70 : 26;
  const st = useAnimatedStyle(() => ({
    left: from.x + (to.x - from.x) * t.value,
    top: from.y + (to.y - from.y) * t.value - Math.sin(t.value * Math.PI) * lift,
    opacity: t.value > 0.86 ? (1 - t.value) / 0.14 : 1,
    transform: [
      { scale: kind === 'coup' ? 1 + t.value * 0.6 : 1 },
      { rotate: kind === 'assassinate' ? `${-40 + t.value * 80}deg` : '0deg' },
    ],
  }));
  return (
    <Animated.View pointerEvents="none" style={[styles.fxWrap, st]}>
      {kind === 'steal' ? (
        <View style={styles.fxCoins}>
          <CoinIcon size={20} />
          <CoinIcon size={14} />
        </View>
      ) : kind === 'assassinate' ? (
        <Ionicons name="flash" size={30} color={roleColors.assassin} />
      ) : (
        <Ionicons name="skull" size={34} color={theme.colors.danger} />
      )}
    </Animated.View>
  );
}

/** A face-down card sails from the loser's seat to the discard piles. */
function FlyingCard({
  from,
  to,
  delay = 0,
  duration = 520,
}: {
  from: { x: number; y: number };
  to: { x: number; y: number };
  delay?: number;
  duration?: number;
}) {
  const styles = useStyles(makeStyles);
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withDelay(delay, withTiming(1, { duration, easing: Easing.inOut(Easing.cubic) }));
  }, [t, delay, duration]);
  const st = useAnimatedStyle(() => ({
    left: from.x + (to.x - from.x) * t.value,
    top: from.y + (to.y - from.y) * t.value - Math.sin(t.value * Math.PI) * 40,
    opacity: t.value === 0 ? 0 : 1 - Math.max(0, t.value - 0.8) * 5,
    transform: [{ rotate: `${t.value * 200}deg` }, { scale: 1 - 0.3 * t.value }],
  }));
  return (
    <Animated.View pointerEvents="none" style={[styles.flyingCard, st]}>
      <View style={styles.flyingCardFace}>
        <Image
          source={require('../../assets/cards/back.png')}
          style={{ width: 31, height: 45 }}
          resizeMode="cover"
        />
      </View>
    </Animated.View>
  );
}

/** The table graveyard: dead cards stack like solitaire foundations,
 *  one overlapping pile per character type. New kills flip in. */
function DiscardPiles({ g, onPress }: { g: GameState; onPress?: () => void }) {
  const styles = useStyles(makeStyles);
  const CARD_W = 34;
  const CARD_H = Math.round(CARD_W * 1.42);
  const STEP = 13;
  const piles = ROLES.map((r) => ({
    role: r,
    n: g.players.reduce(
      (k, p) => k + p.cards.filter((c) => c.revealed && c.role === r).length,
      0,
    ),
  })).filter((x) => x.n > 0);
  if (piles.length === 0) return null;
  return (
    <Pressy scaleTo={0.95} onPress={onPress} style={styles.pilesRow}>
      {piles.map(({ role, n }) => {
        // never cascade more than two cards — deep piles carry a count
        const shown = Math.min(n, 2);
        return (
          <View key={role} style={{ width: CARD_W, height: CARD_H + (shown - 1) * STEP }}>
            {Array.from({ length: shown }).map((_, i) => (
              <Animated.View
                key={i}
                entering={FlipInEasyY.duration(450)}
                style={{ position: 'absolute', top: i * STEP }}
              >
                <InfluenceCard role={role} dead width={CARD_W} />
              </Animated.View>
            ))}
            {n > 2 ? (
              <View style={styles.pileCount}>
                <Text style={styles.pileCountText}>{n}</Text>
              </View>
            ) : null}
          </View>
        );
      })}
    </Pressy>
  );
}

/* ------------------------------------------------------------------ */
/* Deck tracker — all 15 cards at a glance                             */
/* ------------------------------------------------------------------ */

function DeckTracker({ g, onClose }: { g: GameState; onClose: () => void }) {
  const theme = useTheme();
  const styles = useStyles(makeStyles);
  const rtl = isRTL();
  // Public knowledge: cards revealed (lost) by any player are dead.
  const deadByRole = new Map<Role, number>();
  for (const p of g.players) {
    for (const c of p.cards) {
      if (c.revealed) deadByRole.set(c.role, (deadByRole.get(c.role) ?? 0) + 1);
    }
  }
  const hiddenInHands = g.players.reduce(
    (n, p) => n + p.cards.filter((c) => !c.revealed).length,
    0,
  );
  return (
    <View style={styles.logModalBackdrop}>
      <Animated.View entering={ZoomIn.duration(240)} style={styles.logModal}>
        <Text style={styles.panelTitle}>{t('deckTrackerTitle')}</Text>
        <Text style={[styles.deckSummary, rtl && styles.rtlText]}>
          {t('deckTrackerSummary', { court: g.deck.length, hands: hiddenInHands })}
        </Text>
        {ROLES.map((r) => {
          const dead = deadByRole.get(r) ?? 0;
          return (
            <View key={r} style={[styles.trackerRow, rtl && styles.rowReverse]}>
              <RolePortrait role={r} size={36} ring={1.5} />
              <Text style={[styles.trackerName, rtl && styles.rtlText, { color: roleColors[r] }]}>
                {t(r as TKey)}
              </Text>
              <View style={[styles.trackerPips, rtl && styles.rowReverse]}>
                {[0, 1, 2].map((i) => {
                  const isDead = i < dead;
                  return (
                    <View
                      key={i}
                      style={[
                        styles.trackerPip,
                        isDead
                          ? { borderColor: theme.colors.danger + '77', backgroundColor: theme.colors.danger + '1c' }
                          : { borderColor: theme.colors.borderBright },
                      ]}
                    >
                      {isDead ? (
                        <Ionicons name="close" size={13} color={theme.colors.danger} />
                      ) : (
                        <Ionicons name="help" size={12} color={theme.colors.inkFaint} />
                      )}
                    </View>
                  );
                })}
              </View>
            </View>
          );
        })}
        <Text style={[styles.deckHint, rtl && styles.rtlText]}>{t('deckTrackerHint')}</Text>
        <Pressy scaleTo={0.95} style={styles.neutralBtn} onPress={onClose}>
          <Text style={styles.neutralBtnText}>{t('ok')}</Text>
        </Pressy>
      </Animated.View>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Main screen                                                         */
/* ------------------------------------------------------------------ */

export function GameScreen() {
  const theme = useTheme();
  const styles = useStyles(makeStyles);
  const { width, height: winH } = useWindowDimensions();
  const { lang } = useSettings();
  const { room, myId, move, leave, again } = useRoom();
  const [selAction, setSelAction] = useState<ActionType | null>(null);
  const [selTarget, setSelTarget] = useState<string | null>(null);
  const [loseIdx, setLoseIdx] = useState<number | null>(null);
  const [keepIdxs, setKeepIdxs] = useState<number[]>([]);
  const [sending, setSending] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [deckOpen, setDeckOpen] = useState(false);
  const [sheetH, setSheetH] = useState(0);
  const [myAreaH, setMyAreaH] = useState(0);
  const [tableBox, setTableBox] = useState({ w: 0, h: 0 });
  const [secsLeft, setSecsLeft] = useState<number | null>(null);
  const denseRef = useRef(false);
  const [peek, setPeek] = useState<Role | null>(null);
  const [fly, setFly] = useState<{ key: number; from: { x: number; y: number } } | null>(null);
  const [deals, setDeals] = useState<
    { key: string; to: { x: number; y: number }; delay: number }[]
  >([]);
  const [attack, setAttack] = useState<{
    key: number;
    kind: 'steal' | 'assassinate' | 'coup';
    from: { x: number; y: number };
    to: { x: number; y: number };
  } | null>(null);
  const shake = useSharedValue(0);
  const shakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shake.value }, { translateY: shake.value * 0.4 }],
  }));
  const [banner, setBanner] = useState<{ entry: LogEntry; key: number } | null>(null);
  const [notice, setNotice] = useState<SheetMessage | null>(null);
  void lang;

  const g = room?.game as GameState | undefined;
  const chat = room?.chat;

  // Floating emotes: latest emote/taunt per player from the last few
  // seconds of chat; a ticker clears them after they expire.
  const [emoteTick, setEmoteTick] = useState(0);
  const emotes = useMemo(() => {
    void emoteTick;
    const now = Date.now();
    const map = new Map<string, string>();
    for (const m of chat ?? []) {
      if ((m.k === 'emote' || m.k === 'taunt') && now - m.ts < 3500) {
        map.set(m.u, m.k === 'taunt' ? t(m.v as TKey) : m.v);
      }
    }
    return map;
  }, [chat, emoteTick]);
  useEffect(() => {
    if (emotes.size === 0) return;
    const timer = setInterval(() => setEmoteTick((x) => x + 1), 1200);
    return () => clearInterval(timer);
  }, [emotes.size]);
  const prevEmotes = useRef(0);
  useEffect(() => {
    if (emotes.size > prevEmotes.current) sound.play('emote');
    prevEmotes.current = emotes.size;
  }, [emotes.size]);
  const avatarOf = (id: string) => room?.roster.find((r) => r.id === id)?.avatar;

  /** Centre of a player's seat inside the table box, for flying effects. */
  const seatPoint = (id: string): { x: number; y: number } => {
    if (!g || tableBox.w === 0) return { x: 0, y: 0 };
    if (id === myId) return { x: tableBox.w * 0.5 - 16, y: tableBox.h * 0.74 };
    const opp = g.players.filter((p) => p.id !== myId);
    const i = opp.findIndex((p) => p.id === id);
    const a = SEAT_ANCHORS[opp.length]?.[i] ?? { x: 0.5, y: 0.1 };
    return { x: a.x * tableBox.w - 16, y: a.y * tableBox.h + 34 };
  };

  // Derivations (safe even while g flickers during snapshots)
  const me = useMemo(() => g?.players.find((p) => p.id === myId), [g, myId]);
  const responders = useMemo(() => (g ? pendingResponders(g) : []), [g]);
  const current = g ? g.players[g.turn] : undefined;
  const isMyTurn = !!(g && me && current?.id === me.id && g.phase === 'action');
  const iRespond = !!(me && responders.includes(me.id));
  const iLose = !!(g && me && g.phase === 'lose_card' && g.lossQueue[0]?.playerId === me.id);
  const iExchange = !!(g && me && g.phase === 'exchange' && g.pending?.actor === me.id);
  const mustCoup = isMyTurn && !!me && me.coins >= 10;
  const needsMe = isMyTurn || iRespond || iLose || iExchange;

  // A gentle nudge when the game starts waiting on me
  const needed = useRef(false);
  useEffect(() => {
    if (needsMe && !needed.current) {
      haptics.medium();
      sound.play(isMyTurn ? 'turn' : 'sheet');
    }
    needed.current = needsMe;
  }, [needsMe, isMyTurn]);

  // coins leaving my pile (a steal, a coup, an assassin's fee)
  const myCoins = me?.coins;
  const prevCoins = useRef(myCoins);
  useEffect(() => {
    if (prevCoins.current !== undefined && myCoins !== undefined && myCoins < prevCoins.current) {
      sound.play('coinLoss');
    }
    prevCoins.current = myCoins;
  }, [myCoins]);

  // Reset transient selections when the phase moves on
  useEffect(() => {
    setSelAction(null);
    setSelTarget(null);
    setLoseIdx(null);
    setKeepIdxs([]);
  }, [g?.version]);

  /**
   * Turn clock. Every client ticks the same deadline from the game
   * state; whoever owes the decision fires the timeout first, and any
   * other player may force it a moment later so an absent player can
   * never freeze the table.
   */
  const deadline = g?.deadlineMs ?? 0;
  const timerOn = !!g?.timerSec && deadline > 0 && g?.phase !== 'game_over';
  const firedFor = useRef(0);
  useEffect(() => {
    if (!timerOn) {
      setSecsLeft(null);
      return;
    }
    const tick = () => {
      const left = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setSecsLeft(left);
      if (left > 0 || firedFor.current === deadline) return;
      // grace period: the player on the clock fires immediately, others
      // only after 2s, so we don't race for the same write
      const grace = needsMe ? 0 : 2000;
      if (Date.now() >= deadline + grace) {
        firedFor.current = deadline;
        move({ type: 'timeout' }).catch(() => {});
      }
    };
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [timerOn, deadline, needsMe, move]);

  // A fresh game opens with a shuffle and a deal: two cards sail from
  // the Court to every seat around the table.
  const dealtFor = useRef<number>(-1);
  useEffect(() => {
    if (g && g.version === 0 && dealtFor.current !== 0 && g.phase !== 'game_over' && tableBox.w > 0) {
      dealtFor.current = 0;
      sound.play('shuffle');
      const opp = g.players.filter((pl) => pl.id !== myId);
      const seats: { x: number; y: number }[] = opp.map(
        (_, i) => SEAT_ANCHORS[opp.length]?.[i] ?? { x: 0.5, y: 0.1 },
      );
      const targets = [
        ...seats.map((a) => ({ x: a.x * tableBox.w - 17, y: a.y * tableBox.h + 30 })),
        { x: 0.5 * tableBox.w - 17, y: tableBox.h * 0.78 }, // me, bottom rim
      ];
      const round: { key: string; to: { x: number; y: number }; delay: number }[] = [];
      for (let pass = 0; pass < 2; pass++) {
        targets.forEach((to, i) => {
          round.push({ key: `d${pass}-${i}`, to, delay: (pass * targets.length + i) * 130 });
        });
      }
      setDeals(round);
      const total = round.length * 130 + 500;
      setTimeout(() => setDeals([]), total);
      round.forEach((_, i) => setTimeout(() => sound.play('card'), i * 130));
    }
    if (g && g.version > 0) dealtFor.current = g.version;
  }, [g, myId, tableBox]);

  // Every new game event floats an animated banner over the table, so
  // mid-game actions are impossible to miss.
  const logLen = g?.log.length ?? 0;
  const seenLen = useRef(logLen);
  useEffect(() => {
    const prev = seenLen.current;
    seenLen.current = logLen;
    if (logLen > prev && g) {
      const entry = g.log[logLen - 1];
      if (entry.key === 'logWinner') {
        sound.play(g.winner && g.winner === myId ? 'win' : 'lose');
      } else {
        const cue = logSound(entry.key, entry.params?.r as string | undefined);
        if (cue) sound.play(cue);
      }
      // directional attack visuals
      if (tableBox.w > 0 && entry.params?.a) {
        const actor = g.players.find((pl) => pl.name === entry.params!.a);
        const victim = g.players.find((pl) => pl.name === entry.params!.b);
        const kind =
          entry.key === 'logSteal'
            ? 'steal'
            : entry.key === 'logAssassinate'
              ? 'assassinate'
              : entry.key === 'logCoup'
                ? 'coup'
                : null;
        if (kind && actor && victim) {
          // a steal drags coins from the victim to the thief; the others
          // travel from the actor to their target
          const from = kind === 'steal' ? seatPoint(victim.id) : seatPoint(actor.id);
          const to = kind === 'steal' ? seatPoint(actor.id) : seatPoint(victim.id);
          setAttack({ key: logLen, kind, from, to });
          setTimeout(() => setAttack((a) => (a?.key === logLen ? null : a)), 700);
          if (kind === 'coup') {
            haptics.medium();
            shake.value = withSequence(
              withTiming(-9, { duration: 55 }),
              withTiming(8, { duration: 55 }),
              withTiming(-5, { duration: 50 }),
              withTiming(0, { duration: 70 }),
            );
          }
        }
      }
      if (entry.key === 'logLostCard' && entry.params?.a && tableBox.w > 0) {
        // Launch a card from the loser's seat toward the discard piles.
        const loser = g.players.find((pl) => pl.name === entry.params!.a);
        if (loser) {
          const opp = g.players.filter((pl) => pl.id !== myId);
          const idx = opp.findIndex((pl) => pl.id === loser.id);
          const anchor =
            loser.id === myId
              ? { x: 0.5, y: 0.64 }
              : SEAT_ANCHORS[opp.length]?.[idx] ?? { x: 0.5, y: 0.3 };
          setFly({
            key: logLen,
            from: { x: anchor.x * tableBox.w - 17, y: anchor.y * tableBox.h + 40 },
          });
          setTimeout(() => setFly((f) => (f?.key === logLen ? null : f)), 600);
        }
      }
      const bigEvent = BANNER_ALWAYS.has(entry.key);
      if (!denseRef.current || bigEvent) {
        setBanner({ entry, key: logLen });
        const timer = setTimeout(() => setBanner((b) => (b?.key === logLen ? null : b)), 2100);
        return () => clearTimeout(timer);
      }
    }
  }, [logLen, g]);

  if (!g || !me) return null;
  const rtl = isRTL();
  const opponents = g.players.filter((p) => p.id !== me.id);
  /** Crowded table (5-6 players): thin everything out. */
  const dense = opponents.length >= 4;
  denseRef.current = dense;

  const dispatch = async (m: Parameters<typeof move>[0]) => {
    if (sending) return;
    setSending(true);
    try {
      haptics.light();
      sound.play('tap');
      const err = await move(m);
      if (err) {
        sound.play('error');
        console.log('move rejected:', err);
      }
    } catch {
      setNotice({ icon: 'cloud-offline-outline', title: t('appName'), body: t('offline') });
    } finally {
      setSending(false);
    }
  };

  const needsTarget = (a: ActionType) => a === 'coup' || a === 'assassinate' || a === 'steal';

  /** Roles I actually hold (unrevealed) — used to flag bluffs honestly. */
  const myRoles = me
    ? me.cards.filter((c) => !c.revealed).map((c) => c.role)
    : [];

  const selectAction = (action: ActionType) => {
    haptics.selection();
    sound.play('select');
    setSelTarget(null);
    setSelAction((prev) => (prev === action ? null : action));
  };

  const confirmAction = () => {
    if (!selAction) return;
    if (needsTarget(selAction) && !selTarget) return;
    const action = selAction;
    const target = selTarget ?? undefined;
    setSelAction(null);
    setSelTarget(null);
    dispatch({ type: 'declare', action, ...(target ? { target } : {}) });
  };

  const onLeave = () => {
    setNotice({
      icon: 'exit-outline',
      title: t('leaveGameTitle'),
      body: t('leaveGameBody'),
      actionLabel: t('leave'),
      destructive: true,
      onAction: () => leave(),
    });
  };

  /**
   * The claim on the table right now: an action's character claim while it
   * can still be challenged, or a blocker's claim during its window.
   */
  const claimOf = (id: string): Role | null => {
    const p = g.pending;
    if (!p) return null;
    if (p.block && p.block.blocker === id) return p.block.role;
    if (
      p.actor === id &&
      p.claimedRole &&
      (g.phase === 'action_challenge' || g.phase === 'block' || g.phase === 'block_challenge')
    ) {
      return p.claimedRole;
    }
    return null;
  };
  const hasPassed = (id: string) =>
    !!g.pending &&
    (g.phase === 'action_challenge' || g.phase === 'block' || g.phase === 'block_challenge') &&
    g.pending.passed.includes(id);

  /* ----- context panel by phase ----- */

  const pending = g.pending;
  const actorName = pending ? g.players.find((p) => p.id === pending.actor)?.name ?? '' : '';
  const targetName = pending?.target
    ? g.players.find((p) => p.id === pending.target)?.name ?? ''
    : '';

  let panel: React.ReactNode = null;

  if (g.phase === 'game_over') {
    panel = null; // overlay below
  } else if (isMyTurn) {
    const actions: { a: ActionType; label: TKey; desc: TKey; cost?: number; role?: Role }[] = [
      { a: 'income', label: 'income', desc: 'incomeDesc' },
      { a: 'foreign_aid', label: 'foreign_aid', desc: 'foreignAidDesc' },
      { a: 'tax', label: 'tax', desc: 'taxDesc', role: 'duke' },
      { a: 'steal', label: 'steal', desc: 'stealDesc', role: 'captain' },
      { a: 'exchange', label: 'exchange', desc: 'exchangeDesc', role: 'ambassador' },
      { a: 'assassinate', label: 'assassinate', desc: 'assassinateDesc', cost: 3, role: 'assassin' },
      { a: 'coup', label: 'coupAction', desc: 'coupDesc', cost: 7 },
    ];
    const sel = actions.find((x) => x.a === selAction);
    const awaitingTarget = !!selAction && needsTarget(selAction) && !selTarget;
    const targetLabel = selTarget
      ? g.players.find((p) => p.id === selTarget)?.name ?? ''
      : '';
    panel = (
      <Animated.View entering={FadeIn.duration(180)} style={styles.panel}>
        <Text style={styles.panelTitle}>{mustCoup ? t('mustCoup') : t('chooseAction')}</Text>
        {/* Cap the list height so the seats above always stay visible
            and tappable (target picking must never be covered). */}
        <ScrollView
          style={{ maxHeight: Math.round(winH * 0.30) }}
          nestedScrollEnabled
          showsVerticalScrollIndicator={false}
        >
          <Animated.View style={styles.actionGrid} layout={LinearTransition.duration(220)}>
          {actions
            .filter(({ a }) => !selAction || a === selAction)
            .map(({ a, label, desc, cost, role }) => {
            const disabled =
              sending ||
              (cost !== undefined && me.coins < cost) ||
              (mustCoup && a !== 'coup') ||
              // steal needs someone with coins; coup/assassinate need a live target
              ((a === 'steal' || a === 'coup' || a === 'assassinate') &&
                !opponents.some((o) => isAlive(o) && (a !== 'steal' || o.coins > 0)));
            const isSel = selAction === a;
            const isBluff = !!role && !myRoles.includes(role);
            const color = role ? roleColors[role] : a === 'coup' ? theme.colors.danger : theme.colors.gold;
            return (
              <Animated.View
                key={a}
                entering={FadeIn.duration(180)}
                exiting={FadeOut.duration(140)}
                layout={LinearTransition.duration(220)}
              >
              <Pressy
                scaleTo={0.96}
                disabled={disabled}
                onPress={() => selectAction(a)}
                style={[
                  styles.actionRow,
                  { borderColor: isSel ? color : theme.colors.border },
                  isSel && { backgroundColor: color + '1e' },
                ]}
              >
                <View style={styles.actionIcon}>
                  {role ? (
                    <RolePortrait role={role} size={34} ring={1.5} />
                  ) : (
                    <Ionicons
                      name={a === 'coup' ? 'skull' : a === 'income' ? 'add-circle' : 'cash-outline'}
                      size={26}
                      color={color}
                    />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <View style={[styles.actionHead, rtl && styles.rowReverse]}>
                    <Text style={[styles.actionName, { color }]} numberOfLines={1}>
                      {t(label)}
                    </Text>
                    {cost !== undefined ? (
                      <View style={styles.costTag}>
                        <CoinIcon size={12} />
                        <Text style={styles.costText}>{cost}</Text>
                      </View>
                    ) : null}
                    {isBluff ? (
                      <View style={styles.bluffBadge}>
                        <Text style={styles.bluffText}>{t('bluff')}</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={[styles.actionDesc, rtl && styles.rtlText]} numberOfLines={1}>
                    {t(desc)}
                  </Text>
                </View>
              </Pressy>
              </Animated.View>
            );
          })}
          </Animated.View>
        </ScrollView>
        {sel ? (
          <Animated.View
            entering={FadeInDown.duration(200)}
            exiting={FadeOut.duration(150)}
            style={styles.confirmArea}
          >
            {sel.role && !myRoles.includes(sel.role) ? (
              <Text style={styles.bluffHint}>{t('bluffHint')}</Text>
            ) : null}
            {awaitingTarget ? (
              <Text style={styles.targetHint}>{t('chooseTarget')} ↑</Text>
            ) : (
              <Pressy
                scaleTo={0.97}
                disabled={sending}
                style={styles.goldBtn}
                onPress={confirmAction}
              >
                <Text style={styles.goldBtnText}>
                  {t('confirmAction', {
                    action: `${t(sel.label)}${targetLabel ? ` — ${targetLabel}` : ''}`,
                  })}
                </Text>
              </Pressy>
            )}
            <Pressy
              scaleTo={0.97}
              style={styles.cancelLink}
              onPress={() => {
                sound.play('cancel');
                setSelAction(null);
                setSelTarget(null);
              }}
            >
              <Text style={styles.cancelLinkText}>{t('cancel')}</Text>
            </Pressy>
          </Animated.View>
        ) : null}
      </Animated.View>
    );
  } else if (iRespond && pending) {
    const isBlockChallenge = g.phase === 'block_challenge';
    const claimer = isBlockChallenge
      ? g.players.find((p) => p.id === pending.block!.blocker)?.name ?? ''
      : actorName;
    const claimedRole = isBlockChallenge ? pending.block!.role : pending.claimedRole;
    const actionLabel = t(ACTION_LABEL[pending.action]);
    const blockRoles = g.phase === 'block' ? BLOCK_ROLES[pending.action] ?? [] : [];

    panel = (
      <Animated.View entering={FadeIn.duration(180)} style={styles.panel}>
        {claimedRole ? (
          <View style={styles.claimRow}>
            <RolePortrait role={claimedRole} size={44} ring={2} />
          </View>
        ) : null}
        <Text style={styles.panelTitle}>
          {g.phase === 'block'
            ? `${t('declares', { name: actorName, action: actionLabel })}${
                targetName ? ` — ${t('onPlayer', { name: targetName })}` : ''
              }`
            : t('claims', { name: claimer, role: t((claimedRole ?? 'duke') as TKey) })}
        </Text>
        {g.phase !== 'block' ? (
          <Text style={styles.panelSub}>
            {t('declares', { name: actorName, action: actionLabel })}
            {targetName ? ` — ${t('onPlayer', { name: targetName })}` : ''}
          </Text>
        ) : null}
        <Text style={styles.tallyText}>
          {t('respondedTally', {
            done: g.players.filter((p) => isAlive(p) && hasPassed(p.id)).length,
            total:
              g.players.filter((p) => isAlive(p) && hasPassed(p.id)).length + responders.length,
          })}
        </Text>
        <View style={[styles.btnRow, rtl && styles.rowReverse]}>
          {g.phase === 'block' ? (
            blockRoles.map((r, bi) => (
              <Animated.View
                key={r}
                entering={ZoomIn.duration(240).delay(bi * 70)}
                exiting={ZoomOut.duration(150)}
              >
              <Pressy
                scaleTo={0.94}
                disabled={sending}
                style={[
                  styles.blockBtn,
                  { borderColor: roleColors[r], backgroundColor: roleColors[r] + '22' },
                ]}
                onPress={() => dispatch({ type: 'block', role: r })}
              >
                <RolePortrait role={r} size={26} ring={1.5} />
                <Text style={[styles.blockBtnText, { color: roleColors[r] }]}>
                  {t('blockWith', { role: t(r as TKey) })}
                </Text>
              </Pressy>
              </Animated.View>
            ))
          ) : (
            <Animated.View entering={ZoomIn.duration(240)} exiting={ZoomOut.duration(150)}>
              <Pressy
                scaleTo={0.94}
                disabled={sending}
                style={styles.challengeBtn}
                onPress={() => dispatch({ type: 'challenge' })}
              >
                <Ionicons name="flash" size={17} color="#fff" />
                <Text style={styles.challengeBtnText}>{t('challenge')}</Text>
              </Pressy>
            </Animated.View>
          )}
          <Animated.View
            entering={ZoomIn.duration(240).delay(90)}
            exiting={ZoomOut.duration(150)}
          >
            <Pressy
              scaleTo={0.94}
              disabled={sending}
              style={styles.neutralBtn}
              onPress={() => dispatch({ type: 'pass' })}
            >
              <Text style={styles.neutralBtnText}>{t('allow')}</Text>
            </Pressy>
          </Animated.View>
        </View>
      </Animated.View>
    );
  } else if (iLose) {
    const choices = me.cards.map((c, i) => ({ c, i })).filter(({ c }) => !c.revealed);
    panel = (
      <Animated.View entering={FadeIn.duration(180)} style={styles.panel}>
        <Text style={[styles.panelTitle, { color: theme.colors.danger }]}>
          {t('loseCardTitle')}
        </Text>
        <View style={styles.exchangeRow}>
          {choices.map(({ c, i }) => (
            <Pressy
              key={i}
              scaleTo={0.93}
              onPress={() => {
                haptics.selection();
                setLoseIdx(i);
              }}
            >
              <InfluenceCard role={c.role} width={72} selected={loseIdx === i} />
            </Pressy>
          ))}
        </View>
        {loseIdx !== null ? (
          <Pressy
            scaleTo={0.94}
            disabled={sending}
            style={styles.dangerBtn}
            onPress={() => dispatch({ type: 'lose', cardIndex: loseIdx })}
          >
            <Text style={styles.challengeBtnText}>{t('confirm')}</Text>
          </Pressy>
        ) : null}
      </Animated.View>
    );
  } else if (iExchange && pending?.drawn) {
    const unrevealed = me.cards.map((c, i) => ({ c, i })).filter(({ c }) => !c.revealed);
    const pool: Role[] = [...unrevealed.map(({ c }) => c.role), ...pending.drawn];
    const need = unrevealed.length;
    const toggle = (i: number) => {
      haptics.selection();
      setKeepIdxs((prev) =>
        prev.includes(i) ? prev.filter((x) => x !== i) : prev.length < need ? [...prev, i] : prev,
      );
    };
    panel = (
      <Animated.View entering={FadeIn.duration(180)} style={styles.panel}>
        <Text style={styles.panelTitle}>{t('exchangeTitle', { n: need })}</Text>
        <View style={styles.exchangeRow}>
          {pool.map((r, i) => (
            <Pressy key={i} scaleTo={0.93} onPress={() => toggle(i)}>
              <InfluenceCard role={r} width={64} selected={keepIdxs.includes(i)} />
            </Pressy>
          ))}
        </View>
        <Pressy
          scaleTo={0.94}
          disabled={keepIdxs.length !== need || sending}
          style={[styles.goldBtn, keepIdxs.length !== need && styles.chipDisabled]}
          onPress={() => dispatch({ type: 'exchange_keep', keep: keepIdxs })}
        >
          <Text style={styles.goldBtnText}>{t('confirm')}</Text>
        </Pressy>
      </Animated.View>
    );
  } else {
    // Waiting on someone else — say what they are actually deciding
    const owed = responders
      .map((id) => g.players.find((p) => p.id === id)?.name)
      .filter(Boolean) as string[];
    const who = owed.length === 1 ? owed[0] : owed.length > 1 ? t('several', { n: owed.length }) : '';
    let label: string;
    if (g.phase === 'action' && current) {
      label = t('turnOf', { name: current.name });
    } else if (g.phase === 'action_challenge' && pending) {
      label = t('waitChallenge', {
        who,
        name: actorName,
        role: t((pending.claimedRole ?? 'duke') as TKey),
      });
    } else if (g.phase === 'block' && pending) {
      label = t('waitBlock', { who, action: t(ACTION_LABEL[pending.action]) });
    } else if (g.phase === 'block_challenge' && pending?.block) {
      const blocker = g.players.find((p) => p.id === pending.block!.blocker)?.name ?? '';
      label = t('waitBlockChallenge', {
        who,
        name: blocker,
        role: t(pending.block.role as TKey),
      });
    } else if (g.phase === 'lose_card' && g.lossQueue[0]) {
      const loser = g.players.find((p) => p.id === g.lossQueue[0].playerId)?.name ?? '';
      label = t('waitLose', { name: loser });
    } else if (g.phase === 'exchange' && pending) {
      label = t('waitExchange', { name: actorName });
    } else {
      label = t('waitingOthers');
    }
    panel = (
      <Animated.View
        key={`wait-${current?.id ?? ''}-${g.phase}`}
        entering={FadeIn.duration(320)}
        style={[styles.panel, styles.panelInline]}
      >
        <View style={[styles.waitRow, rtl && styles.rowReverse]}>
          <Ionicons name="hourglass-outline" size={15} color={theme.colors.inkSoft} />
          <Text style={styles.waitText}>{label}</Text>
        </View>
      </Animated.View>
    );
  }

  const targetable = (p: PlayerState) =>
    isMyTurn &&
    !!selAction &&
    needsTarget(selAction) &&
    !selTarget &&
    isAlive(p) &&
    (selAction !== 'steal' || p.coins > 0);

  const winner = g.winner ? g.players.find((p) => p.id === g.winner) : null;
  const latestLog = g.log.length > 0 ? g.log[g.log.length - 1] : null;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <LinearGradient
        colors={['#14171d', '#0e1014', '#12141a']}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <Breathing />
      {/* Header */}
      <View style={[styles.header, rtl && styles.rowReverse]}>
        <Pressy scaleTo={0.85} style={styles.iconBtn} onPress={onLeave} hitSlop={8}>
          <Ionicons name="exit-outline" size={19} color={theme.colors.danger} />
        </Pressy>
        <Text style={styles.roomCode}>{room!.code}</Text>
        {secsLeft !== null ? (
          <Animated.View
            entering={ZoomIn.duration(220)}
            exiting={ZoomOut.duration(180)}
            style={[
              styles.clockChip,
              secsLeft <= 5 && { borderColor: theme.colors.danger },
            ]}
          >
            <Ionicons
              name="time-outline"
              size={13}
              color={secsLeft <= 5 ? theme.colors.danger : theme.colors.inkSoft}
            />
            <Text
              style={[styles.clockText, secsLeft <= 5 && { color: theme.colors.danger }]}
            >
              {secsLeft}
            </Text>
          </Animated.View>
        ) : null}
        <Pressy
          scaleTo={0.92}
          style={[styles.deckChip, rtl && styles.rowReverse]}
          onPress={() => {
            haptics.selection();
            setDeckOpen(true);
          }}
        >
          <LinearGradient
            colors={['rgba(58,63,74,0.9)', 'rgba(10,12,16,0.95)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <Ionicons name="albums-outline" size={14} color={theme.colors.goldLight} />
          <Text style={styles.deckText}>{g.deck.length}</Text>
        </Pressy>
      </View>

      {/* Log strip — animates on every new event */}
      <Pressy scaleTo={0.98} style={styles.logStrip} onPress={() => setLogOpen(true)}>
        <Animated.View
          key={logLen}
          entering={FadeInDown.duration(280)}
          style={[styles.logStripInner, rtl && styles.rowReverse]}
        >
          {latestLog ? (
            <Ionicons
              name={logMeta(latestLog, theme).icon}
              size={15}
              color={logMeta(latestLog, theme).color}
            />
          ) : (
            <Ionicons name="chatbox-ellipses-outline" size={14} color={theme.colors.goldDark} />
          )}
          <Text style={[styles.logText, rtl && styles.rtlText]} numberOfLines={1}>
            {latestLog ? formatLog(latestLog) : '—'}
          </Text>
        </Animated.View>
        <Ionicons name="chevron-up" size={13} color={theme.colors.inkFaint} />
      </Pressy>

      {/* The table: green felt, silver rim, seats around the edge, the
          Court and the event banner at its center — a real card table. */}
      <Animated.View
        onLayout={(e) =>
          setTableBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })
        }
        layout={LinearTransition.duration(260)}
        style={[
          shakeStyle,
          styles.tableArea,
          needsMe && g.phase !== 'game_over'
            ? { marginBottom: Math.max(0, sheetH - myAreaH + 8) }
            : null,
        ]}
      >
        <View style={styles.tableRimOuter}>
          <LinearGradient
            colors={['#6b2a28', '#54201e', '#3d1615']}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={styles.felt}
          >
            {/* felt inner shade line */}
            <View style={styles.feltInnerLine} pointerEvents="none" />
            {/* table center: the Court + reveals + event banner */}
            <View style={styles.tableCenter} pointerEvents="box-none">
              <View style={styles.centerRow}>
                <View style={styles.courtStack}>
                  {[2, 1, 0].map((i) => (
                    <View key={i} style={[styles.courtCard, { top: -i * 3, left: i * 2 }]}>
                      <Image
                        source={require('../../assets/cards/back.png')}
                        style={{ width: 35, height: 49 }}
                        resizeMode="cover"
                      />
                    </View>
                  ))}
                  <Text style={styles.courtCount}>{g.deck.length}</Text>
                </View>
                <DiscardPiles
                  g={g}
                  onPress={() => {
                    haptics.selection();
                    sound.play('select');
                    setDeckOpen(true);
                  }}
                />
              </View>
            </View>
          </LinearGradient>
        </View>
        {/* seats straddle the rim */}
        {opponents.map((p, i) => (
          <Animated.View
            key={`in-${p.id}`}
            entering={ZoomIn.duration(360).delay(120 + i * 90)}
            style={StyleSheet.absoluteFill}
            pointerEvents="box-none"
          >
          <TableSeat
            key={p.id}
            p={p}
            avatar={avatarOf(p.id)}
            emote={emotes.get(p.id) ?? null}
            isTurn={current?.id === p.id && g.phase !== 'game_over'}
            responding={responders.includes(p.id)}
            targetable={targetable(p)}
            anchor={SEAT_ANCHORS[opponents.length][i]}
            compact={needsMe && g.phase !== 'game_over'}
            claim={claimOf(p.id)}
            passed={hasPassed(p.id)}
            dense={dense}
            onTarget={() => {
              if (!targetable(p)) return;
              haptics.selection();
              setSelTarget(p.id);
            }}
          />
          </Animated.View>
        ))}
        {deals.map((d) => (
          <FlyingCard
            key={d.key}
            from={{ x: tableBox.w * 0.5 - 17, y: tableBox.h * 0.36 }}
            to={d.to}
            delay={d.delay}
            duration={430}
          />
        ))}
        {/* event banner: last child + high zIndex, so it always floats
            ABOVE the seats and their card fans */}
        {banner && g.phase !== 'game_over' ? (
          <Animated.View
            key={banner.key}
            entering={FadeInDown.duration(300)}
            exiting={FadeOut.duration(350)}
            pointerEvents="none"
            style={styles.bannerWrap}
          >
            <View
              style={[
                styles.bannerCard,
                rtl && styles.rowReverse,
                { borderColor: logMeta(banner.entry, theme).color + '77' },
              ]}
            >
              <Ionicons
                name={logMeta(banner.entry, theme).icon}
                size={15}
                color={logMeta(banner.entry, theme).color}
              />
              <Text style={[styles.bannerText, rtl && styles.rtlText]} numberOfLines={2}>
                {formatLog(banner.entry)}
              </Text>
            </View>
          </Animated.View>
        ) : null}
        {attack ? (
          <AttackFx key={`fx-${attack.key}`} kind={attack.kind} from={attack.from} to={attack.to} />
        ) : null}
        {fly ? (
          <FlyingCard
            key={`fly-${fly.key}`}
            from={fly.from}
            to={{ x: tableBox.w * 0.5 - 17, y: tableBox.h * 0.40 }}
          />
        ) : null}
        {/* me, seated at the bottom of the table — my cards face-up so
            I always see what I hold, even with the sheet open */}
        <TableSeat
          p={me}
          avatar={avatarOf(me.id)}
          emote={emotes.get(me.id) ?? null}
          isTurn={current?.id === me.id && g.phase !== 'game_over'}
          responding={responders.includes(me.id)}
          targetable={false}
          onTarget={() => {}}
          anchor={{ x: 0.5, y: 0.70 }}
          anchorBottom={0.05}
          compact={needsMe && g.phase !== 'game_over'}
          claim={claimOf(me.id)}
          passed={hasPassed(me.id)}
          dense={dense}
          showFaces
        />
      </Animated.View>

      {/* My area */}
      <View style={styles.myArea} onLayout={(e) => setMyAreaH(e.nativeEvent.layout.height)}>
        <View style={[styles.myHead, rtl && styles.rowReverse]}>
          <View style={[styles.myIdent, rtl && styles.rowReverse]}>
            <Avatar id={avatarOf(me.id)} size={26} ring={1.5} />
            <Text style={styles.myName}>{me.name}</Text>
            {emotes.get(me.id) ? (
              <Animated.Text
                key={emotes.get(me.id)}
                entering={FadeInDown.duration(250)}
                exiting={FadeOut.duration(300)}
                style={styles.myEmote}
              >
                {emotes.get(me.id)}
              </Animated.Text>
            ) : null}
          </View>
          <AnimatedCoins amount={me.coins} size={20} chip />
        </View>
        <View style={styles.hand}>
          {me.cards.map((c, i) => (
            <Pressy
              key={i}
              scaleTo={0.95}
              disabled={c.revealed}
              noDimWhenDisabled
              onPress={() => {
                haptics.selection();
                if (iLose) {
                  setLoseIdx(i);
                } else {
                  sound.play('flip');
                  setPeek(c.role);
                }
              }}
            >
              <InfluenceCard
                role={c.role}
                dead={c.revealed}
                width={92}
                selected={iLose && loseIdx === i}
                tilt={i === 0 ? -3 : 3}
              />
            </Pressy>
          ))}
        </View>
        {!needsMe ? <View>{panel}</View> : null}
      </View>

      {/* Bottom sheet: whenever the game needs YOUR input, the panel
          rises from the bottom edge — it can never be pushed off-screen
          by a full table. Seats stay visible and tappable above it. */}
      {needsMe && g.phase !== 'game_over' ? (
        <Animated.View
          key={`sheet-${g.phase}`}
          entering={SlideInDown.duration(320).easing(Easing.out(Easing.cubic))}
          exiting={SlideOutDown.duration(240).easing(Easing.in(Easing.cubic))}
          style={styles.sheet}
          onLayout={(e) => setSheetH(e.nativeEvent.layout.height)}
        >
          <View style={styles.sheetHandle} />
          {panel}
        </Animated.View>
      ) : null}

      {/* Game over — final standings */}
      {g.phase === 'game_over' && winner ? (
        <Animated.View entering={FadeIn.duration(350)} style={styles.winOverlay}>
          <Animated.View
            entering={FadeInDown.duration(400).delay(120)}
            exiting={FadeOut.duration(220)}
            style={styles.winCard}
          >
            <Ionicons name="trophy" size={44} color={theme.colors.gold} />
            <Text style={styles.winTitle}>
              {winner.id === me.id ? t('youWin') : t('winnerIs', { name: winner.name })}
            </Text>
            <View style={styles.standings}>
              {standings(g).map((p, i) => {
                const medal =
                  i === 0 ? '#e8c766' : i === 1 ? '#b8c0cc' : i === 2 ? '#c98a4b' : null;
                return (
                  <Animated.View
                    key={p.id}
                    entering={FadeInDown.duration(300).delay(200 + i * 90)}
                    style={[
                      styles.standingRow,
                      rtl && styles.rowReverse,
                      i === 0 && styles.standingWinner,
                    ]}
                  >
                    <View
                      style={[
                        styles.rankBadge,
                        medal ? { borderColor: medal, backgroundColor: medal + '22' } : null,
                      ]}
                    >
                      {i === 0 ? (
                        <Ionicons name="trophy" size={13} color={medal!} />
                      ) : (
                        <Text style={[styles.rankText, medal ? { color: medal } : null]}>
                          {i + 1}
                        </Text>
                      )}
                    </View>
                    <Avatar id={avatarOf(p.id)} size={26} ring={1.5} />
                    <Text
                      style={[
                        styles.standingName,
                        rtl && styles.rtlText,
                        i === 0 && { color: theme.colors.goldLight },
                      ]}
                      numberOfLines={1}
                    >
                      {p.name}
                      {p.id === me.id ? `  (${t('you')})` : ''}
                    </Text>
                  </Animated.View>
                );
              })}
            </View>
            {room!.hostId === me.id ? (
              <Pressy scaleTo={0.95} style={styles.goldBtn} onPress={() => again()}>
                <Text style={styles.goldBtnText}>{t('playAgain')}</Text>
              </Pressy>
            ) : null}
            <Pressy scaleTo={0.95} style={styles.neutralBtn} onPress={() => leave()}>
              <Text style={styles.neutralBtnText}>{t('backHome')}</Text>
            </Pressy>
          </Animated.View>
        </Animated.View>
      ) : null}

      {/* Tapped one of my own cards: bigger, with its ability reminder */}
      <Modal visible={!!peek} transparent animationType="fade" onRequestClose={() => setPeek(null)}>
        <Pressy style={styles.peekBackdrop} onPress={() => setPeek(null)} scaleTo={1}>
          {peek ? (
            <Animated.View entering={ZoomIn.duration(240)} style={styles.peekCard}>
              <InfluenceCard role={peek} width={Math.min(240, width * 0.55)} />
              <Text style={[styles.peekName, { color: roleColors[peek] }]}>{t(peek as TKey)}</Text>
              <Text style={[styles.peekText, rtl && styles.rtlText]}>{t(ROLE_BLURB[peek])}</Text>
              <Text style={styles.peekHint}>{t('tapToClose')}</Text>
            </Animated.View>
          ) : null}
        </Pressy>
      </Modal>

      {/* Deck tracker — the 15 court cards at a glance */}
      <Modal
        visible={deckOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setDeckOpen(false)}
      >
        <DeckTracker g={g} onClose={() => setDeckOpen(false)} />
      </Modal>

      {/* Full history — visual timeline, latest first */}
      <Modal visible={logOpen} transparent animationType="fade" onRequestClose={() => setLogOpen(false)}>
        <View style={styles.logModalBackdrop}>
          <Animated.View entering={ZoomIn.duration(240)} style={styles.logModal}>
            <FlatList
              data={[...g.log].reverse()}
              keyExtractor={(_, i) => String(i)}
              renderItem={({ item, index }) => {
                const meta = logMeta(item, theme);
                return (
                  <View style={[styles.logRow, rtl && styles.rowReverse]}>
                    <View style={[styles.logIcon, { borderColor: meta.color + '66' }]}>
                      <Ionicons name={meta.icon} size={15} color={meta.color} />
                    </View>
                    <Text
                      style={[
                        styles.logLine,
                        rtl && styles.rtlText,
                        index === 0 && { color: theme.colors.ink },
                      ]}
                    >
                      {formatLog(item)}
                    </Text>
                  </View>
                );
              }}
            />
            <Pressy scaleTo={0.95} style={styles.neutralBtn} onPress={() => setLogOpen(false)}>
              <Text style={styles.neutralBtnText}>{t('ok')}</Text>
            </Pressy>
          </Animated.View>
        </View>
      </Modal>

      <MessageSheet message={notice} onClose={() => setNotice(null)} />
    </SafeAreaView>
  );
}

/* ------------------------------------------------------------------ */

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    rowReverse: { flexDirection: 'row-reverse' },
    rtlText: { textAlign: 'right', writingDirection: 'rtl' },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingTop: 4,
    },
    iconBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: theme.colors.surfaceHover,
      alignItems: 'center',
      justifyContent: 'center',
    },
    roomCode: {
      fontSize: 16,
      fontFamily: latinFont('bold'),
      letterSpacing: 6,
      color: theme.colors.goldLight,
    },
    clockChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      borderWidth: 1.5,
      borderColor: theme.colors.borderBright,
      borderRadius: theme.radius.pill,
      paddingHorizontal: 9,
      height: 28,
      backgroundColor: 'rgba(8,10,14,0.85)',
    },
    clockText: {
      fontSize: 13,
      fontFamily: latinFont('bold'),
      color: theme.colors.ink,
      minWidth: 16,
      textAlign: 'center',
    },
    deckChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderWidth: 1,
      borderColor: 'rgba(233,235,240,0.28)',
      borderRadius: theme.radius.pill,
      paddingHorizontal: 12,
      height: 32,
      overflow: 'hidden',
    },

    deckText: {
      fontSize: 14,
      fontFamily: latinFont('bold'),
      color: '#ffffff',
    },
    logStrip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginHorizontal: 16,
      marginTop: 8,
      paddingHorizontal: 12,
      height: 34,
      borderRadius: theme.radius.sm,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    logText: {
      flex: 1,
      fontSize: 12,
      fontFamily: font('semibold'),
      color: theme.colors.inkSoft,
    },
    tableArea: {
      flex: 1,
      marginHorizontal: 14,
      marginTop: 30,
      marginBottom: 6,
    },
    tableRimOuter: {
      flex: 1,
      borderRadius: 96,
      backgroundColor: '#3a3f4a',
      padding: 5,
    },
    felt: {
      flex: 1,
      borderRadius: 91,
      borderWidth: 2,
      borderColor: '#2a0f0e',
      backgroundColor: '#54201e',
      overflow: 'hidden',
      alignItems: 'center',
      justifyContent: 'center',
    },
    feltInnerLine: {
      position: 'absolute',
      top: 14,
      left: 14,
      right: 14,
      bottom: 14,
      borderRadius: 80,
      borderWidth: 1.5,
      borderColor: 'rgba(255,255,255,0.10)',
    },
    tableCenter: {
      position: 'absolute',
      top: '34%',
      left: 0,
      right: 0,
      alignItems: 'center',
      gap: 10,
    },
    deltaWrap: {
      position: 'absolute',
      top: -6,
      alignSelf: 'center',
      left: 0,
      right: 0,
      alignItems: 'center',
      zIndex: 25,
    },
    deltaText: {
      fontSize: 15,
      fontFamily: latinFont('bold'),
      textShadowColor: 'rgba(0,0,0,0.95)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 4,
    },
    deltaUp: { color: '#7ee08a' },
    deltaDown: { color: '#ff6b81' },
    fxWrap: {
      position: 'absolute',
      zIndex: 55,
      alignItems: 'center',
      justifyContent: 'center',
    },
    fxCoins: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
    },
    flyingCard: {
      position: 'absolute',
      zIndex: 30,
    },
    flyingCardFace: {
      overflow: 'hidden',
      width: 34,
      height: 48,
      borderRadius: 5,
      backgroundColor: '#232733',
      borderWidth: 1.5,
      borderColor: theme.colors.goldDark,
    },
    pileCount: {
      position: 'absolute',
      right: -6,
      bottom: -6,
      minWidth: 18,
      height: 18,
      borderRadius: 9,
      paddingHorizontal: 4,
      backgroundColor: '#05070a',
      borderWidth: 1.5,
      borderColor: theme.colors.goldLight,
      alignItems: 'center',
      justifyContent: 'center',
    },
    pileCountText: {
      fontSize: 10.5,
      fontFamily: latinFont('bold'),
      color: '#ffffff',
    },
    centerRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
    },
    pilesRow: {
      flexDirection: 'row',
      gap: 6,
      alignItems: 'flex-start',
    },
    courtStack: {
      width: 44,
      height: 58,
      alignItems: 'center',
      justifyContent: 'center',
    },
    courtCard: {
      position: 'absolute',
      overflow: 'hidden',
      width: 38,
      height: 52,
      borderRadius: 6,
      backgroundColor: '#232733',
      borderWidth: 1.5,
      borderColor: theme.colors.goldDark,
    },
    courtCountChip: {
      minWidth: 32,
      paddingHorizontal: 7,
      paddingVertical: 1,
      borderRadius: theme.radius.pill,
      borderWidth: 1,
      borderColor: 'rgba(233,235,240,0.55)',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    courtCount: {
      fontSize: 19,
      fontFamily: latinFont('bold'),
      color: '#ffffff',
      textShadowColor: 'rgba(0,0,0,0.95)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 4,
    },
    tableSeat: {
      position: 'absolute',
      width: SEAT_W,
      alignItems: 'center',
    },
    seatInner: {
      alignItems: 'center',
      gap: 3,
    },
    fan: {
      position: 'absolute',
      top: -12,
      flexDirection: 'row',
      gap: 14,
      zIndex: -1,
    },
    fanCard: {
      overflow: 'hidden',
      width: 24,
      height: 33,
      borderRadius: 4,
      backgroundColor: '#232733',
      borderWidth: 1.5,
      borderColor: theme.colors.goldDark,
      alignItems: 'center',
      justifyContent: 'center',
    },
    turnRing: {
      position: 'absolute',
      top: -4,
      left: -4,
      width: 66,
      height: 66,
      borderRadius: 30,
      borderWidth: 2.5,
      borderColor: theme.colors.gold,
      ...theme.shadow.goldGlow,
    },
    targetRing: {
      position: 'absolute',
      top: -4,
      left: -4,
      width: 66,
      height: 66,
      borderRadius: 30,
      borderWidth: 2.5,
      borderColor: theme.colors.danger,
      backgroundColor: 'rgba(224, 82, 82, 0.25)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    seatDeadAvatar: {
      opacity: 0.8,
    },
    deadBadge: {
      position: 'absolute',
      bottom: -2,
      right: -2,
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: theme.colors.surfaceElevated,
      borderWidth: 1,
      borderColor: theme.colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    respondBadge: {
      position: 'absolute',
      top: -3,
      right: -3,
      width: 18,
      height: 18,
      borderRadius: 9,
      backgroundColor: theme.colors.warning,
      alignItems: 'center',
      justifyContent: 'center',
    },
    passedBadge: {
      position: 'absolute',
      top: -3,
      right: -3,
      width: 18,
      height: 18,
      borderRadius: 9,
      backgroundColor: theme.colors.success,
      alignItems: 'center',
      justifyContent: 'center',
    },
    pipRow: {
      flexDirection: 'row',
      gap: 4,
      marginTop: 2,
    },
    pipAlive: {
      width: 11,
      height: 15,
      borderRadius: 3,
      backgroundColor: '#2b3243',
      borderWidth: 1,
      borderColor: theme.colors.goldDark,
    },
    pipDead: {
      width: 15,
      height: 15,
      borderRadius: 4,
      borderWidth: 1.5,
      alignItems: 'center',
      justifyContent: 'center',
    },
    fanHidden: {
      opacity: 0,
    },
    chipDivider: {
      width: 1,
      height: 11,
      backgroundColor: 'rgba(233,235,240,0.25)',
      marginHorizontal: 1,
    },
    chipCoins: {
      fontSize: 11,
      fontFamily: latinFont('bold'),
      color: '#ffffff',
    },
    seatNameChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: 'rgba(8, 10, 14, 0.95)',
      borderRadius: theme.radius.pill,
      paddingHorizontal: 9,
      paddingVertical: 2,
      maxWidth: SEAT_W,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.13)',
    },
    seatNameText: {
      fontSize: 11,
      fontFamily: font('bold'),
      color: theme.colors.ink,
    },
    seatNameChipTurn: {
      backgroundColor: theme.colors.gold,
      borderColor: theme.colors.goldLight,
    },
    seatNameTextTurn: {
      color: theme.colors.inkOnGold,
    },
    deadLabel: {
      fontSize: 9,
      fontFamily: font('bold'),
      color: theme.colors.danger,
    },
    logStripInner: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    bannerWrap: {
      position: 'absolute',
      left: 16,
      right: 16,
      top: '52%',
      alignItems: 'center',
      zIndex: 60,
      elevation: 12,
    },
    bannerCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: 'rgba(14, 18, 15, 0.92)',
      borderWidth: 1.5,
      borderRadius: theme.radius.md,
      paddingHorizontal: 12,
      paddingVertical: 8,
      maxWidth: '100%',
      ...theme.shadow.card,
    },
    bannerText: {
      fontSize: 12.5,
      fontFamily: font('bold'),
      color: theme.colors.ink,
      flexShrink: 1,
    },
    emoteBubble: {
      position: 'absolute',
      top: -26,
      backgroundColor: theme.colors.surfaceElevated,
      borderWidth: 1.5,
      borderColor: theme.colors.goldDark,
      borderRadius: theme.radius.pill,
      paddingHorizontal: 10,
      paddingVertical: 3,
      maxWidth: 200,
      zIndex: 5,
      ...theme.shadow.card,
    },
    emoteBubbleText: {
      fontSize: 16,
      fontFamily: font('bold'),
      color: theme.colors.ink,
    },
    myIdent: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      flexShrink: 1,
    },
    myEmote: {
      fontSize: 17,
    },
    trackerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 7,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.border,
    },
    trackerName: {
      flex: 1,
      fontSize: 14,
      fontFamily: font('bold'),
    },
    trackerPips: {
      flexDirection: 'row',
      gap: 6,
    },
    trackerPip: {
      width: 26,
      height: 34,
      borderRadius: 6,
      borderWidth: 1.5,
      backgroundColor: theme.colors.surfaceElevated,
      alignItems: 'center',
      justifyContent: 'center',
    },
    deckSummary: {
      fontSize: 12,
      fontFamily: font('semibold'),
      color: theme.colors.inkSoft,
      textAlign: 'center',
      marginTop: -4,
    },
    deckHint: {
      fontSize: 11,
      fontFamily: font('semibold'),
      color: theme.colors.inkFaint,
      textAlign: 'center',
    },
    standings: {
      alignSelf: 'stretch',
      gap: 6,
    },
    standingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: theme.colors.surfaceElevated,
      borderRadius: theme.radius.sm,
      borderWidth: 1,
      borderColor: theme.colors.border,
      paddingHorizontal: 12,
      height: 42,
    },
    standingWinner: {
      borderColor: theme.colors.gold,
    },
    rankBadge: {
      width: 26,
      height: 26,
      borderRadius: 13,
      borderWidth: 1.5,
      borderColor: theme.colors.borderBright,
      alignItems: 'center',
      justifyContent: 'center',
    },
    rankText: {
      fontSize: 12,
      fontFamily: latinFont('bold'),
      color: theme.colors.inkSoft,
    },
    standingName: {
      flex: 1,
      fontSize: 14,
      fontFamily: font('bold'),
      color: theme.colors.ink,
    },
    myArea: {
      marginTop: 'auto',
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
      paddingTop: 10,
      paddingBottom: 8,
      paddingHorizontal: 16,
      gap: 10,
    },
    myHead: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    myName: {
      fontSize: 15,
      fontFamily: font('black'),
      color: theme.colors.ink,
    },
    hand: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 12,
    },
    sheet: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: theme.colors.surfaceElevated,
      borderTopLeftRadius: 22,
      borderTopRightRadius: 22,
      borderWidth: 1,
      borderBottomWidth: 0,
      borderColor: theme.colors.borderBright,
      paddingHorizontal: 12,
      paddingBottom: 12,
      paddingTop: 6,
      ...theme.shadow.card,
      zIndex: 20,
    },
    sheetHandle: {
      alignSelf: 'center',
      width: 44,
      height: 4,
      borderRadius: 2,
      backgroundColor: theme.colors.borderBright,
      marginBottom: 6,
    },
    panel: {
      borderRadius: theme.radius.md,
      padding: 12,
      gap: 10,
      minHeight: 58,
      justifyContent: 'center',
    },
    panelInline: {
      backgroundColor: theme.colors.surfaceElevated,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    panelTitle: {
      fontSize: 14,
      fontFamily: font('bold'),
      color: theme.colors.ink,
      textAlign: 'center',
    },
    panelSub: {
      fontSize: 12,
      fontFamily: font('semibold'),
      color: theme.colors.inkSoft,
      textAlign: 'center',
      marginTop: -6,
    },
    actionGrid: {
      gap: 6,
    },
    actionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: theme.colors.surface,
      borderWidth: 1.5,
      borderRadius: theme.radius.sm,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    actionIcon: {
      width: 36,
      alignItems: 'center',
    },
    actionHead: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    actionName: {
      fontSize: 13.5,
      fontFamily: font('bold'),
    },
    actionDesc: {
      fontSize: 11,
      fontFamily: font('semibold'),
      color: theme.colors.inkSoft,
      marginTop: -1,
    },
    bluffBadge: {
      backgroundColor: 'rgba(232, 163, 61, 0.16)',
      borderWidth: 1,
      borderColor: theme.colors.warning,
      borderRadius: theme.radius.pill,
      paddingHorizontal: 7,
      paddingVertical: 0.5,
    },
    bluffText: {
      fontSize: 9.5,
      fontFamily: font('bold'),
      color: theme.colors.warning,
    },
    confirmArea: {
      gap: 6,
      alignItems: 'center',
    },
    claimRow: {
      alignItems: 'center',
      marginBottom: -2,
    },
    chipDisabled: {
      opacity: 0.35,
    },
    bluffHint: {
      fontSize: 11.5,
      fontFamily: font('semibold'),
      color: theme.colors.warning,
      textAlign: 'center',
    },
    targetHint: {
      fontSize: 13,
      fontFamily: font('bold'),
      color: theme.colors.danger,
      textAlign: 'center',
      paddingVertical: 8,
    },
    cancelLink: {
      paddingVertical: 4,
      paddingHorizontal: 16,
    },
    cancelLinkText: {
      fontSize: 12.5,
      fontFamily: font('bold'),
      color: theme.colors.inkFaint,
    },
    costTag: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
    },
    costText: {
      fontSize: 11,
      fontFamily: latinFont('bold'),
      color: theme.colors.goldLight,
    },
    btnRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      justifyContent: 'center',
    },
    challengeBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: theme.colors.danger,
      borderRadius: theme.radius.md,
      paddingHorizontal: 20,
      height: 46,
      justifyContent: 'center',
    },
    challengeBtnText: {
      fontSize: 14,
      fontFamily: font('bold'),
      color: '#fff',
    },
    dangerBtn: {
      backgroundColor: theme.colors.danger,
      borderRadius: theme.radius.md,
      height: 46,
      alignItems: 'center',
      justifyContent: 'center',
    },
    blockBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderWidth: 1.5,
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.md,
      paddingHorizontal: 14,
      height: 46,
      justifyContent: 'center',
    },
    blockBtnText: {
      fontSize: 13,
      fontFamily: font('bold'),
    },
    neutralBtn: {
      backgroundColor: theme.colors.surfaceHover,
      borderWidth: 1,
      borderColor: theme.colors.borderBright,
      borderRadius: theme.radius.md,
      paddingHorizontal: 20,
      height: 46,
      alignItems: 'center',
      justifyContent: 'center',
    },
    neutralBtnText: {
      fontSize: 14,
      fontFamily: font('bold'),
      color: theme.colors.ink,
    },
    goldBtn: {
      backgroundColor: theme.colors.gold,
      borderRadius: theme.radius.md,
      height: 48,
      alignItems: 'center',
      justifyContent: 'center',
      alignSelf: 'stretch',
      paddingHorizontal: 20,
    },
    goldBtnText: {
      fontSize: 15,
      fontFamily: font('bold'),
      color: theme.colors.inkOnGold,
    },
    exchangeRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      justifyContent: 'center',
    },
    tallyText: {
      fontSize: 11.5,
      fontFamily: font('semibold'),
      color: theme.colors.inkFaint,
      textAlign: 'center',
      marginTop: -4,
    },
    waitRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    waitText: {
      fontSize: 13,
      fontFamily: font('semibold'),
      color: theme.colors.inkSoft,
    },
    winOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(10, 8, 6, 0.88)',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 28,
    },
    winCard: {
      alignSelf: 'stretch',
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.xl,
      borderWidth: 1,
      borderColor: theme.colors.borderBright,
      alignItems: 'center',
      padding: 26,
      gap: 14,
      ...theme.shadow.card,
    },
    winTitle: {
      fontSize: 22,
      fontFamily: font('black'),
      color: theme.colors.goldLight,
      textAlign: 'center',
    },
    peekBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(4,6,10,0.9)',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 28,
    },
    peekCard: {
      alignItems: 'center',
      gap: 10,
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.xl,
      borderWidth: 1,
      borderColor: theme.colors.borderBright,
      paddingVertical: 22,
      paddingHorizontal: 24,
      maxWidth: 340,
    },
    peekName: {
      fontSize: 20,
      fontFamily: font('black'),
    },
    peekText: {
      fontSize: 13.5,
      lineHeight: 21,
      fontFamily: font('semibold'),
      color: theme.colors.inkSoft,
      textAlign: 'center',
    },
    peekHint: {
      fontSize: 11,
      fontFamily: font('semibold'),
      color: theme.colors.inkFaint,
    },
    logModalBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.6)',
      justifyContent: 'center',
      padding: 24,
    },
    logModal: {
      maxHeight: '70%',
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.lg,
      borderWidth: 1,
      borderColor: theme.colors.borderBright,
      padding: 16,
      gap: 10,
    },
    logRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 6,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.border,
    },
    logIcon: {
      width: 28,
      height: 28,
      borderRadius: 14,
      borderWidth: 1,
      backgroundColor: theme.colors.surfaceElevated,
      alignItems: 'center',
      justifyContent: 'center',
    },
    logLine: {
      flex: 1,
      fontSize: 13,
      lineHeight: 19,
      fontFamily: font('semibold'),
      color: theme.colors.inkSoft,
    },
  });

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
    case 'logLostCard':
      return 'fail';
    case 'logCoup':
    case 'logAssassinate':
      return 'kill';
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

/** Coin count that pulses whenever the amount changes. */
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
  useEffect(() => {
    if (prev.current !== amount) {
      prev.current = amount;
      scale.value = withSequence(
        withTiming(1.35, { duration: 170 }),
        withTiming(1, { duration: 260 }),
      );
    }
  }, [amount, scale]);
  const st = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Animated.View style={st}>
      <CoinCount amount={amount} size={size} chip={chip} />
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
  1: [{ x: 0.5, y: 0.02 }],
  2: [{ x: 0.13, y: 0.38 }, { x: 0.87, y: 0.38 }],
  3: [{ x: 0.13, y: 0.42 }, { x: 0.5, y: 0.02 }, { x: 0.87, y: 0.42 }],
  4: [
    { x: 0.12, y: 0.5 },
    { x: 0.26, y: 0.07 },
    { x: 0.74, y: 0.07 },
    { x: 0.88, y: 0.5 },
  ],
  5: [
    { x: 0.12, y: 0.52 },
    { x: 0.22, y: 0.1 },
    { x: 0.5, y: 0.02 },
    { x: 0.78, y: 0.1 },
    { x: 0.88, y: 0.52 },
  ],
};

const SEAT_W = 104;

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
  showFaces,
}: {
  p: PlayerState;
  avatar?: string;
  emote?: string | null;
  isTurn: boolean;
  responding: boolean;
  targetable: boolean;
  onTarget: () => void;
  anchor: { x: number; y: number };
  /** Render this seat's hidden cards face-up (the player's own seat). */
  showFaces?: boolean;
}) {
  const theme = useTheme();
  const styles = useStyles(makeStyles);
  const dead = !isAlive(p);

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
        {
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
            shows as a real face-up card at card proportions */}
        <View style={styles.fan} pointerEvents="none">
          {p.cards.map((c, i) =>
            c.revealed || showFaces ? (
              <Animated.View
                key={i}
                entering={FlipInEasyY.duration(500)}
                style={{
                  transform: [{ rotate: `${i === 0 ? -15 : 15}deg` }, { translateY: -14 }],
                }}
              >
                <InfluenceCard role={c.role} dead={c.revealed} width={44} />
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
            <Avatar id={avatar} size={58} ring={2.5} />
          </View>
          {/* pulsing turn ring */}
          <Animated.View pointerEvents="none" style={[styles.turnRing, ringStyle]} />
          {targetable ? (
            <View style={styles.targetRing}>
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
          ) : null}
        </Animated.View>
        <View
          style={[
            styles.seatNameChip,
            isTurn && styles.seatNameChipTurn,
            dead && { opacity: 0.6 },
          ]}
        >
          <Text style={[styles.seatNameText, isTurn && styles.seatNameTextTurn]} numberOfLines={1}>
            {p.name}
          </Text>
        </View>
        {dead ? (
          <Text style={styles.deadLabel}>{t('eliminated')}</Text>
        ) : (
          <AnimatedCoins amount={p.coins} size={15} chip />
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

/** A face-down card sails from the loser's seat to the discard piles. */
function FlyingCard({
  from,
  to,
}: {
  from: { x: number; y: number };
  to: { x: number; y: number };
}) {
  const styles = useStyles(makeStyles);
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withTiming(1, { duration: 520, easing: Easing.inOut(Easing.cubic) });
  }, [t]);
  const st = useAnimatedStyle(() => ({
    left: from.x + (to.x - from.x) * t.value,
    top: from.y + (to.y - from.y) * t.value - Math.sin(t.value * Math.PI) * 40,
    opacity: 1 - Math.max(0, t.value - 0.75) * 4,
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
function DiscardPiles({ g }: { g: GameState }) {
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
    <View style={styles.pilesRow}>
      {piles.map(({ role, n }) => (
        <View key={role} style={{ width: CARD_W, height: CARD_H + (n - 1) * STEP }}>
          {Array.from({ length: n }).map((_, i) => (
            <Animated.View
              key={i}
              entering={FlipInEasyY.duration(450)}
              style={{ position: 'absolute', top: i * STEP }}
            >
              <InfluenceCard role={role} dead width={CARD_W} />
            </Animated.View>
          ))}
        </View>
      ))}
    </View>
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
      <View style={styles.logModal}>
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
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Main screen                                                         */
/* ------------------------------------------------------------------ */

export function GameScreen() {
  const theme = useTheme();
  const styles = useStyles(makeStyles);
  const { height: winH } = useWindowDimensions();
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
  const [fly, setFly] = useState<{ key: number; from: { x: number; y: number } } | null>(null);
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
  const avatarOf = (id: string) => room?.roster.find((r) => r.id === id)?.avatar;

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
      sound.play('turn');
    }
    needed.current = needsMe;
  }, [needsMe]);

  // Reset transient selections when the phase moves on
  useEffect(() => {
    setSelAction(null);
    setSelTarget(null);
    setLoseIdx(null);
    setKeepIdxs([]);
  }, [g?.version]);

  // A fresh game opens with the shuffle of a new Court deck.
  const dealtFor = useRef<number>(-1);
  useEffect(() => {
    if (g && g.version === 0 && dealtFor.current !== 0 && g.phase !== 'game_over') {
      dealtFor.current = 0;
      sound.play('shuffle');
    }
    if (g && g.version > 0) dealtFor.current = g.version;
  }, [g]);

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
      setBanner({ entry, key: logLen });
      const timer = setTimeout(() => setBanner((b) => (b?.key === logLen ? null : b)), 2100);
      return () => clearTimeout(timer);
    }
  }, [logLen, g]);

  if (!g || !me) return null;
  const rtl = isRTL();
  const opponents = g.players.filter((p) => p.id !== me.id);

  const dispatch = async (m: Parameters<typeof move>[0]) => {
    if (sending) return;
    setSending(true);
    try {
      haptics.light();
      sound.play('tap');
      const err = await move(m);
      if (err) console.log('move rejected:', err);
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
              <Animated.View key={a} entering={FadeIn.duration(180)} layout={LinearTransition.duration(220)}>
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
          <Animated.View entering={FadeIn.duration(160)} style={styles.confirmArea}>
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
        <View style={[styles.btnRow, rtl && styles.rowReverse]}>
          {g.phase === 'block' ? (
            blockRoles.map((r) => (
              <Pressy
                key={r}
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
            ))
          ) : (
            <Pressy
              scaleTo={0.94}
              disabled={sending}
              style={styles.challengeBtn}
              onPress={() => dispatch({ type: 'challenge' })}
            >
              <Ionicons name="flash" size={17} color="#fff" />
              <Text style={styles.challengeBtnText}>{t('challenge')}</Text>
            </Pressy>
          )}
          <Pressy
            scaleTo={0.94}
            disabled={sending}
            style={styles.neutralBtn}
            onPress={() => dispatch({ type: 'pass' })}
          >
            <Text style={styles.neutralBtnText}>{t('allow')}</Text>
          </Pressy>
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
    // Waiting on someone else
    const label =
      g.phase === 'action' && current
        ? t('turnOf', { name: current.name })
        : t('waitingOthers');
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
        <Pressy
          scaleTo={0.92}
          style={[styles.deckChip, rtl && styles.rowReverse]}
          onPress={() => {
            haptics.selection();
            setDeckOpen(true);
          }}
        >
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
            <View style={styles.tableCenter} pointerEvents="none">
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
                <DiscardPiles g={g} />
              </View>
              {banner && g.phase !== 'game_over' ? (
                <Animated.View
                  key={banner.key}
                  entering={FadeInDown.duration(300)}
                  exiting={FadeOut.duration(350)}
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
                </Animated.View>
              ) : null}
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
            onTarget={() => {
              if (!targetable(p)) return;
              haptics.selection();
              setSelTarget(p.id);
            }}
          />
          </Animated.View>
        ))}
        {fly ? (
          <FlyingCard
            key={fly.key}
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
          anchor={{ x: 0.5, y: 0.64 }}
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
              disabled={!iLose || c.revealed}
              onPress={() => {
                haptics.selection();
                setLoseIdx(i);
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
          <Animated.View entering={FadeInDown.duration(400).delay(120)} style={styles.winCard}>
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
          <View style={styles.logModal}>
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
          </View>
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
    deckChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radius.pill,
      paddingHorizontal: 10,
      height: 30,
    },
    deckText: {
      fontSize: 14,
      fontFamily: latinFont('bold'),
      color: theme.colors.ink,
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
      alignItems: 'center',
      gap: 10,
      maxWidth: '72%',
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
      minWidth: 30,
      paddingHorizontal: 6,
      paddingVertical: 1,
      borderRadius: theme.radius.pill,
      backgroundColor: 'rgba(6, 8, 12, 0.94)',
      borderWidth: 1.5,
      borderColor: 'rgba(233, 235, 240, 0.45)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    courtCount: {
      fontSize: 16,
      fontFamily: latinFont('bold'),
      color: '#f2f4f8',
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
      opacity: 0.62,
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
    seatNameChip: {
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

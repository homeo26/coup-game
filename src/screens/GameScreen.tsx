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
import { FlatList, Modal, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
  LinearTransition,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
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
function logSound(key: string): sound.SoundKey | null {
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

/** Soft pulsing gold halo behind the active player's seat. Always
 *  mounted; presence fades in/out so the turn glides between seats. */
function TurnGlow({ active }: { active: boolean }) {
  const pulse = useSharedValue(0.35);
  const presence = useSharedValue(active ? 1 : 0);
  useEffect(() => {
    pulse.value = withRepeat(withTiming(1, { duration: 1100 }), -1, true);
  }, [pulse]);
  useEffect(() => {
    presence.value = withTiming(active ? 1 : 0, { duration: 550 });
  }, [active, presence]);
  const anim = useAnimatedStyle(() => ({ opacity: presence.value * pulse.value }));
  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, glowStyles.ring, anim]} />
  );
}

const glowStyles = StyleSheet.create({
  ring: {
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#d4a854',
  },
});

/** Tiny influence indicator: face-down back, or the lost character's
 *  portrait with a strike — so who lost what reads at a glance. */
function MiniCard({ role, revealed }: { role: Role; revealed: boolean }) {
  const theme = useTheme();
  const styles = useStyles(makeStyles);
  if (!revealed) {
    return (
      <View style={styles.miniCard}>
        <View style={styles.miniCardDot} />
      </View>
    );
  }
  return (
    <Animated.View entering={FadeIn.duration(400)} style={styles.miniDeadWrap}>
      <RolePortrait role={role} size={30} ring={1.5} />
      <View style={styles.miniDeadX}>
        <Ionicons name="close" size={10} color={theme.colors.danger} />
      </View>
    </Animated.View>
  );
}

/** Coin count that pulses whenever the amount changes. */
function AnimatedCoins({ amount, size }: { amount: number; size: number }) {
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
      <CoinCount amount={amount} size={size} />
    </Animated.View>
  );
}

/**
 * One opponent = one full-width scoreboard row: turn state on the left,
 * name, influence cards, coins on the right. All opponents fit in a
 * single glance-friendly column — no grid to scan.
 */
function SeatRow({
  p,
  isTurn,
  responding,
  targetable,
  onTarget,
}: {
  p: PlayerState;
  isTurn: boolean;
  responding: boolean;
  targetable: boolean;
  onTarget: () => void;
}) {
  const theme = useTheme();
  const styles = useStyles(makeStyles);
  const rtl = isRTL();
  const dead = !isAlive(p);

  // A gentle scale nudge when the turn arrives at this seat
  const nudge = useSharedValue(1);
  const wasTurn = useRef(isTurn);
  useEffect(() => {
    if (isTurn && !wasTurn.current) {
      nudge.value = withSequence(
        withTiming(1.03, { duration: 220 }),
        withTiming(1, { duration: 320 }),
      );
    }
    wasTurn.current = isTurn;
  }, [isTurn, nudge]);
  const nudgeStyle = useAnimatedStyle(() => ({ transform: [{ scale: nudge.value }] }));

  // Smooth turn hand-off: border tint eases in/out with the glow
  const turnSv = useSharedValue(isTurn ? 1 : 0);
  useEffect(() => {
    turnSv.value = withTiming(isTurn ? 1 : 0, { duration: 550 });
  }, [isTurn, turnSv]);
  const baseBorder = theme.colors.border;
  const goldBorder = theme.colors.gold;
  const borderStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(turnSv.value, [0, 1], [baseBorder, goldBorder]),
  }));

  return (
    <Animated.View style={nudgeStyle} layout={LinearTransition.duration(250)}>
      <Animated.View
        style={[
          styles.seatShell,
          !targetable && !dead && borderStyle,
          targetable && { borderColor: theme.colors.danger },
          dead && { borderColor: theme.colors.border },
        ]}
      >
        <Pressy
          scaleTo={0.97}
          disabled={!targetable}
          onPress={onTarget}
          style={[styles.seatRow, rtl && styles.rowReverse, dead && styles.seatRowDead]}
        >
          <TurnGlow active={isTurn} />
        <View style={styles.seatState}>
          {targetable ? (
            <Ionicons name="locate" size={17} color={theme.colors.danger} />
          ) : dead ? (
            <Ionicons name="skull-outline" size={15} color={theme.colors.inkFaint} />
          ) : responding ? (
            <Ionicons name="hourglass-outline" size={15} color={theme.colors.warning} />
          ) : isTurn ? (
            <Ionicons name="play" size={14} color={theme.colors.gold} />
          ) : (
            <View style={styles.seatIdleDot} />
          )}
        </View>
        <Text
          style={[styles.seatRowName, rtl && styles.rtlText, dead && styles.seatRowNameDead]}
          numberOfLines={1}
        >
          {p.name}
        </Text>
        <View style={[styles.seatRowCards, rtl && styles.rowReverse]}>
          {p.cards.map((c, i) => (
            <MiniCard key={i} role={c.role} revealed={c.revealed} />
          ))}
        </View>
        <View style={[styles.seatRowCoins, rtl && styles.rowReverse]}>
          {dead ? (
            <Text style={styles.deadLabel}>{t('eliminated')}</Text>
          ) : (
            <AnimatedCoins amount={p.coins} size={16} />
          )}
        </View>
        </Pressy>
      </Animated.View>
    </Animated.View>
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
  const [banner, setBanner] = useState<{ entry: LogEntry; key: number } | null>(null);
  const [notice, setNotice] = useState<SheetMessage | null>(null);
  void lang;

  const g = room?.game as GameState | undefined;

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
        const cue = logSound(entry.key);
        if (cue) sound.play(cue);
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
          style={{ maxHeight: Math.round(winH * 0.34) }}
          nestedScrollEnabled
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.actionGrid}>
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
              <Pressy
                key={a}
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
            );
          })}
          </View>
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
    panel = (
      <Animated.View entering={FadeIn.duration(180)} style={styles.panel}>
        <Text style={[styles.panelTitle, { color: theme.colors.danger }]}>
          {t('loseCardTitle')}
        </Text>
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
        style={styles.panel}
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

      {/* Opponents — one compact scoreboard row each, always all visible */}
      <View style={styles.seatColumn}>
        {opponents.map((p) => (
          <SeatRow
            key={p.id}
            p={p}
            isTurn={current?.id === p.id && g.phase !== 'game_over'}
            responding={responders.includes(p.id)}
            targetable={targetable(p)}
            onTarget={() => {
              if (!targetable(p)) return;
              haptics.selection();
              setSelTarget(p.id);
            }}
          />
        ))}
      </View>

      {/* The free table space between seats and my area hosts the
          floating event banner — it can never cover a player row. */}
      <View style={styles.tableSpace} pointerEvents="none">
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
              size={17}
              color={logMeta(banner.entry, theme).color}
            />
            <Text style={[styles.bannerText, rtl && styles.rtlText]} numberOfLines={2}>
              {formatLog(banner.entry)}
            </Text>
          </Animated.View>
        ) : null}
      </View>

      {/* My area */}
      <View style={styles.myArea}>
        <View style={[styles.myHead, rtl && styles.rowReverse]}>
          <Text style={styles.myName}>{me.name}</Text>
          <AnimatedCoins amount={me.coins} size={20} />
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
        <View>{panel}</View>
      </View>

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
      fontSize: 13,
      fontFamily: latinFont('bold'),
      color: theme.colors.inkSoft,
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
    seatColumn: {
      paddingHorizontal: 16,
      paddingTop: 10,
      gap: 6,
    },
    seatShell: {
      borderRadius: 14,
      borderWidth: 1.5,
      borderColor: theme.colors.border,
    },
    seatRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: theme.colors.surface,
      borderRadius: 12.5,
      paddingHorizontal: 12,
      height: 48,
    },
    seatRowDead: {
      opacity: 0.8,
    },
    seatState: {
      width: 20,
      alignItems: 'center',
    },
    seatIdleDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: theme.colors.borderBright,
    },
    seatRowName: {
      flex: 1,
      fontSize: 14.5,
      fontFamily: font('bold'),
      color: theme.colors.ink,
    },
    seatRowNameDead: {
      textDecorationLine: 'line-through',
      color: theme.colors.inkFaint,
    },
    seatRowCards: {
      flexDirection: 'row',
      gap: 4,
    },
    seatRowCoins: {
      minWidth: 52,
      alignItems: 'flex-end',
    },
    miniCard: {
      width: 20,
      height: 27,
      borderRadius: 4,
      borderWidth: 1.5,
      borderColor: theme.colors.borderBright,
      backgroundColor: theme.colors.surfaceElevated,
      alignItems: 'center',
      justifyContent: 'center',
    },
    miniCardDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: theme.colors.goldDark,
    },
    miniDeadWrap: {
      width: 30,
      height: 30,
      alignItems: 'center',
      justifyContent: 'center',
    },
    miniDeadX: {
      position: 'absolute',
      bottom: -3,
      right: -4,
      width: 15,
      height: 15,
      borderRadius: 8,
      backgroundColor: theme.colors.surfaceElevated,
      borderWidth: 1,
      borderColor: theme.colors.danger + '88',
      alignItems: 'center',
      justifyContent: 'center',
    },
    logStripInner: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    tableSpace: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 24,
    },
    bannerCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: 'rgba(18, 20, 26, 0.94)',
      borderWidth: 1.5,
      borderRadius: theme.radius.md,
      paddingHorizontal: 16,
      paddingVertical: 10,
      maxWidth: '100%',
      ...theme.shadow.card,
    },
    bannerText: {
      fontSize: 13.5,
      fontFamily: font('bold'),
      color: theme.colors.ink,
      flexShrink: 1,
    },
    deadLabel: {
      fontSize: 10,
      fontFamily: font('bold'),
      color: theme.colors.danger,
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
    panel: {
      backgroundColor: theme.colors.surfaceElevated,
      borderRadius: theme.radius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: 12,
      gap: 10,
      minHeight: 58,
      justifyContent: 'center',
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

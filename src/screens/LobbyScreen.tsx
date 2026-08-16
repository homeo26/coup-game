/**
 * LobbyScreen — waiting room: big shareable code, live roster, and the
 * start button for the host (2–6 players).
 */
import React, { useState } from 'react';
import { Share, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';
import { Theme, font, latinFont, useStyles, useTheme } from '../theme';
import { Pressy } from '../components/Pressy';
import { RolePortrait } from '../components/RolePortrait';
import { Breathing } from '../components/Breathing';
import { MessageSheet, SheetMessage } from '../components/MessageSheet';
import { useRoom } from '../net/RoomContext';
import { Role } from '../engine/types';
import { useSettings } from '../settings';
import { t, isRTL } from '../i18n';
import { MIN_PLAYERS } from '../engine/engine';
import * as haptics from '../haptics';

export function LobbyScreen() {
  const theme = useTheme();
  const styles = useStyles(makeStyles);
  const { lang } = useSettings();
  const { room, myId, start, leave } = useRoom();
  const [notice, setNotice] = useState<SheetMessage | null>(null);
  const [starting, setStarting] = useState(false);
  void lang;

  if (!room) return null;
  const isHost = room.hostId === myId;
  const canStart = room.roster.length >= MIN_PLAYERS;
  const rtl = isRTL();

  const onStart = async () => {
    setStarting(true);
    try {
      haptics.success();
      await start();
    } catch {
      setNotice({ icon: 'cloud-offline-outline', title: t('appName'), body: t('offline') });
    } finally {
      setStarting(false);
    }
  };

  const onLeave = () => {
    setNotice({
      icon: 'exit-outline',
      title: t('leaveGameTitle'),
      body: t('leaveLobbyBody'),
      actionLabel: t('leave'),
      destructive: true,
      onAction: () => leave(),
    });
  };

  const shareCode = () => {
    haptics.light();
    Share.share({ message: `Coup — ${t('roomCode')}: ${room.code}` }).catch(() => {});
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <Breathing />
      <View style={[styles.header, rtl && styles.rowReverse]}>
        <Pressy scaleTo={0.85} style={styles.iconBtn} onPress={onLeave} hitSlop={8}>
          <Ionicons name="exit-outline" size={20} color={theme.colors.danger} />
        </Pressy>
        <Text style={styles.title}>{t('lobby')}</Text>
        <View style={{ width: 38 }} />
      </View>

      <Animated.View entering={FadeInDown.duration(350)} style={styles.codeCard}>
        <Text style={styles.codeLabel}>{t('roomCode')}</Text>
        <Pressy scaleTo={0.97} onPress={shareCode}>
          <Text style={styles.code}>{room.code}</Text>
        </Pressy>
        <View style={[styles.shareRow, rtl && styles.rowReverse]}>
          <Ionicons name="share-social-outline" size={14} color={theme.colors.inkSoft} />
          <Text style={styles.shareHint}>{t('shareCode')}</Text>
        </View>
      </Animated.View>

      <Text style={[styles.section, rtl && styles.rtlText]}>
        {t('players')} ({room.roster.length}/6)
      </Text>
      <View style={styles.list}>
        {room.roster.map((p, i) => (
          <Animated.View
            key={p.id}
            entering={FadeInDown.duration(300).delay(Math.min(i * 50, 250))}
            layout={LinearTransition.duration(200)}
            style={[styles.playerRow, rtl && styles.rowReverse]}
          >
            {p.avatar ? (
              <RolePortrait role={p.avatar as Role} size={36} ring={2} />
            ) : (
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{p.name.slice(0, 1).toUpperCase()}</Text>
              </View>
            )}
            <Text style={[styles.playerName, rtl && styles.rtlText]} numberOfLines={1}>
              {p.name}
            </Text>
            {p.id === room.hostId ? (
              <View style={styles.badge}>
                <Ionicons name="star" size={10} color={theme.colors.inkOnGold} />
                <Text style={styles.badgeText}>{t('host')}</Text>
              </View>
            ) : null}
            {p.id === myId ? (
              <View style={[styles.badge, styles.youBadge]}>
                <Text style={styles.badgeText}>{t('you')}</Text>
              </View>
            ) : null}
          </Animated.View>
        ))}
      </View>

      <View style={styles.footer}>
        {isHost ? (
          <>
            {!canStart ? <Text style={styles.waitText}>{t('needTwo')}</Text> : null}
            <Pressy
              scaleTo={0.96}
              style={[styles.startBtn, (!canStart || starting) && styles.btnDisabled]}
              disabled={!canStart || starting}
              onPress={onStart}
            >
              <Ionicons name="play" size={20} color={theme.colors.inkOnGold} />
              <Text style={styles.startText}>{starting ? '…' : t('startGame')}</Text>
            </Pressy>
          </>
        ) : (
          <Text style={styles.waitText}>{t('waitingHost')}</Text>
        )}
      </View>
      <MessageSheet message={notice} onClose={() => setNotice(null)} />
    </SafeAreaView>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingTop: 6,
    },
    rowReverse: {
      flexDirection: 'row-reverse',
    },
    rtlText: {
      textAlign: 'right',
      writingDirection: 'rtl',
    },
    iconBtn: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: theme.colors.surfaceHover,
      alignItems: 'center',
      justifyContent: 'center',
    },
    title: {
      fontSize: 18,
      fontFamily: font('black'),
      color: theme.colors.ink,
    },
    codeCard: {
      margin: 20,
      marginBottom: 8,
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.lg,
      borderWidth: 1,
      borderColor: theme.colors.borderBright,
      alignItems: 'center',
      paddingVertical: 20,
      ...theme.shadow.card,
    },
    codeLabel: {
      fontSize: 12,
      fontFamily: font('semibold'),
      color: theme.colors.inkSoft,
    },
    code: {
      fontSize: 52,
      fontFamily: latinFont('black'),
      color: theme.colors.goldLight,
      letterSpacing: 14,
      marginVertical: 2,
    },
    shareRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    shareHint: {
      fontSize: 12,
      fontFamily: font('semibold'),
      color: theme.colors.inkSoft,
    },
    section: {
      fontSize: 15,
      fontFamily: font('bold'),
      color: theme.colors.ink,
      paddingHorizontal: 22,
      marginTop: 14,
      marginBottom: 8,
    },
    list: {
      paddingHorizontal: 20,
      gap: 8,
    },
    playerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      paddingHorizontal: 14,
      height: 54,
    },
    avatar: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: theme.colors.surfaceHover,
      borderWidth: 1,
      borderColor: theme.colors.borderBright,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarText: {
      fontSize: 14,
      fontFamily: font('bold'),
      color: theme.colors.goldLight,
    },
    playerName: {
      flex: 1,
      fontSize: 15,
      fontFamily: font('bold'),
      color: theme.colors.ink,
    },
    badge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: theme.colors.gold,
      borderRadius: theme.radius.pill,
      paddingHorizontal: 10,
      paddingVertical: 3,
    },
    youBadge: {
      backgroundColor: theme.colors.surfaceHover,
      borderWidth: 1,
      borderColor: theme.colors.gold,
    },
    badgeText: {
      fontSize: 11,
      fontFamily: font('bold'),
      color: theme.colors.ink,
    },
    footer: {
      marginTop: 'auto',
      padding: 20,
      gap: 10,
      alignItems: 'center',
    },
    waitText: {
      fontSize: 13,
      fontFamily: font('semibold'),
      color: theme.colors.inkSoft,
    },
    startBtn: {
      alignSelf: 'stretch',
      height: 56,
      borderRadius: theme.radius.md,
      backgroundColor: theme.colors.gold,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: 8,
      ...theme.shadow.goldGlow,
    },
    btnDisabled: {
      opacity: 0.5,
    },
    startText: {
      fontSize: 16,
      fontFamily: font('bold'),
      color: theme.colors.inkOnGold,
    },
  });

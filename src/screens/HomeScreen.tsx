/**
 * HomeScreen — the front door: the cast fanned out under the logo, then a
 * compact identity row (avatar + name), one primary action, and two
 * expanding tiles for joining a room or playing offline. Everything is
 * kept to one screen so it reads as a game menu, not a form.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeOut,
  LinearTransition,
  ZoomIn,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import * as Linking from 'expo-linking';
import { Theme, font, latinFont, roleColors, useStyles, useTheme } from '../theme';
import { Pressy } from '../components/Pressy';
import { Breathing } from '../components/Breathing';
import { ANIMALS, Avatar } from '../components/Avatar';
import { HeroFan } from '../components/HeroFan';
import { MessageSheet, SheetMessage } from '../components/MessageSheet';
import { useSettings } from '../settings';
import { useRoom } from '../net/RoomContext';
import { consumePendingJoin, onPendingJoin, parseJoinCode } from '../net/deeplink';
import { PERSONAS } from '../personas';
import { t, TKey, isRTL } from '../i18n';
import * as haptics from '../haptics';
import * as sound from '../sound';

/** Rotating one-liners under the hero: flavour plus a rules nudge. */
const TIPS: TKey[] = ['tip1', 'tip2', 'tip3', 'tip4', 'tip5'];

type Panel = 'join' | 'offline' | null;

/** Both tile panels share one fixed-height slot, so switching never
 *  re-lays out the screen (which looked like the widget being torn). */
const JOIN_PANEL_H = 132;
const ROSTER_ROW_H = 31;
/** Offline panel: title + one row per opponent + the counter and the button. */
const offlinePanelH = (bots: number) => 128 + bots * ROSTER_ROW_H;

export function HomeScreen() {
  const theme = useTheme();
  const styles = useStyles(makeStyles);
  const { lang, playerName, avatar, set, hydrated } = useSettings();
  const { create, join, playLocal, busy } = useRoom();
  const [name, setName] = useState<string | null>(null);
  const [codeInput, setCodeInput] = useState('');
  const [botCount, setBotCount] = useState(2);
  const scrollRef = useRef<ScrollView>(null);
  const [panel, setPanel] = useState<Panel>(null);
  const [avatarOpen, setAvatarOpen] = useState(false);
  const [notice, setNotice] = useState<SheetMessage | null>(null);
  const [working, setWorking] = useState<'create' | 'join' | null>(null);
  void lang; // re-render on language change

  const effectiveName = (name ?? playerName).trim();
  const rtl = isRTL();

  /* ----- rotating tip + a breathing primary action ----- */
  const [tipIndex, setTipIndex] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTipIndex((i) => (i + 1) % TIPS.length), 4200);
    return () => clearInterval(id);
  }, []);
  const pulse = useSharedValue(0);
  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(1, { duration: 2200, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
  }, [pulse]);
  // glow only — a constantly scaling button reads as wobble
  const ctaStyle = useAnimatedStyle(() => ({
    shadowOpacity: 0.25 + pulse.value * 0.45,
  }));

  const remember = () => {
    if (effectiveName && effectiveName !== playerName) set('playerName', effectiveName);
  };

  const fail = (e: unknown) => {
    const key = e instanceof Error ? e.message : '';
    const known: TKey[] = ['roomNotFound', 'roomFull', 'roomStarted'];
    setNotice({
      icon: 'alert-circle-outline',
      title: t('appName'),
      body: known.includes(key as TKey) ? t(key as TKey) : t('offline'),
    });
  };

  const needName = () => {
    setNotice({ icon: 'person-outline', title: t('yourName'), body: t('nameNeeded') });
  };

  const onCreate = async () => {
    Keyboard.dismiss();
    if (!effectiveName) return needName();
    remember();
    setWorking('create');
    try {
      haptics.medium();
      sound.play('tap');
      await create(effectiveName);
    } catch (e) {
      fail(e);
    } finally {
      setWorking(null);
    }
  };

  const onJoin = async (code = codeInput) => {
    Keyboard.dismiss();
    if (!effectiveName) return needName();
    const clean = code.trim().toUpperCase();
    if (clean.length !== 4) {
      setNotice({ icon: 'key-outline', title: t('joinGame'), body: t('codeNeeded') });
      return;
    }
    remember();
    setWorking('join');
    try {
      haptics.medium();
      sound.play('tap');
      await join(clean, effectiveName);
    } catch (e) {
      fail(e);
    } finally {
      setWorking(null);
    }
  };

  const onPlayBots = () => {
    Keyboard.dismiss();
    if (!effectiveName) return needName();
    remember();
    haptics.medium();
    sound.play('tap');
    playLocal(effectiveName, botCount);
  };

  /* ----- shared links: coupgame://join/ABCD or the hosted page ----- */
  const incoming = Linking.useURL();
  const handled = useRef<string | null>(null);
  const takeCode = (code: string | null) => {
    if (!code || handled.current === code) return;
    handled.current = code;
    setCodeInput(code);
    setPanel('join');
    const who = (name ?? playerName).trim();
    if (who && !busy) onJoin(code);
  };
  useEffect(() => {
    takeCode(consumePendingJoin());
    return onPendingJoin(takeCode);
  }, []);
  useEffect(() => {
    takeCode(parseJoinCode(incoming));
  }, [incoming]);

  /**
   * Switching between the two tiles slides the new controls in from the
   * side you moved toward, and an indicator glides under the active tile.
   */
  const ORDER: Panel[] = ['join', 'offline'];
  const [rowW, setRowW] = useState(0);
  const indicator = useSharedValue(0); // 0 = join, 1 = offline
  const indicatorShown = useSharedValue(0);
  /** 0 = join panel, 1 = offline panel; `shown` opens the slot. */
  const slide = useSharedValue(0);
  const shown = useSharedValue(0);
  const joinStyle = useAnimatedStyle(() => ({
    opacity: (1 - slide.value) * shown.value,
    transform: [{ translateX: -slide.value * 26 }],
  }));
  const offlineStyle = useAnimatedStyle(() => ({
    opacity: slide.value * shown.value,
    transform: [{ translateX: (1 - slide.value) * 26 }],
  }));
  const boxH = useSharedValue(JOIN_PANEL_H);
  const slotStyle = useAnimatedStyle(() => ({
    height: shown.value * boxH.value,
    marginTop: shown.value * 14,
    opacity: shown.value,
  }));
  const indicatorStyle = useAnimatedStyle(() => {
    const half = Math.max(0, (rowW - 12) / 2);
    return {
      width: half,
      opacity: indicatorShown.value,
      transform: [{ translateX: indicator.value * (half + 12) }],
    };
  });

  useEffect(() => {
    if (panel === 'offline') {
      const t = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 220);
      boxH.value = withTiming(offlinePanelH(botCount), {
        duration: 200,
        easing: Easing.out(Easing.cubic),
      });
      return () => clearTimeout(t);
    }
  }, [botCount, panel, boxH]);

  const openPanel = (p: Panel) => {
    haptics.selection();
    sound.play('select');
    setPanel((cur) => {
      const next = cur === p ? null : p;
      if (next) {
        const to = ORDER.indexOf(next);
        const ease = { duration: 240, easing: Easing.out(Easing.cubic) };
        indicator.value = withTiming(to, ease);
        indicatorShown.value = withTiming(1, { duration: 140 });
        slide.value = withTiming(to, ease);
        shown.value = withTiming(1, { duration: 200, easing: Easing.out(Easing.quad) });
        boxH.value = withTiming(
          next === 'offline' ? offlinePanelH(botCount) : JOIN_PANEL_H,
          ease,
        );
      } else {
        indicatorShown.value = withTiming(0, { duration: 140 });
        shown.value = withTiming(0, { duration: 180, easing: Easing.in(Easing.quad) });
      }
      return next;
    });
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <Image
        source={require('../../assets/bg-neon.png')}
        style={StyleSheet.absoluteFill}
        resizeMode="cover"
      />
      <Breathing />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ---------- hero ---------- */}
          <Animated.View entering={FadeInDown.duration(400)} style={styles.heroWrap}>
            <Image
              source={require('../../assets/logo.png')}
              style={styles.logo}
              resizeMode="contain"
            />
            <HeroFan />
            <Animated.Text
              key={tipIndex}
              entering={FadeIn.duration(500)}
              exiting={FadeOut.duration(400)}
              style={styles.tip}
            >
              {t(TIPS[tipIndex])}
            </Animated.Text>
          </Animated.View>

          {/* ---------- identity: avatar + name on one line ---------- */}
          <Animated.View
            entering={FadeInDown.duration(400).delay(80)}
            style={[styles.identity, rtl && styles.rowReverse]}
          >
            <Pressy scaleTo={0.9} onPress={() => setAvatarOpen(true)} style={styles.avatarBtn}>
              <Avatar id={avatar} size={44} ring={2} />
              <View style={styles.avatarEdit}>
                <Ionicons name="swap-horizontal" size={10} color={theme.colors.inkOnGold} />
              </View>
            </Pressy>
            <TextInput
              value={name ?? playerName}
              onChangeText={setName}
              editable={hydrated}
              placeholder={t('yourName')}
              placeholderTextColor={theme.colors.inkFaint}
              style={[styles.nameInput, rtl && styles.rtlText]}
              maxLength={16}
              returnKeyType="done"
            />
          </Animated.View>

          {/* ---------- primary action ---------- */}
          <Animated.View entering={FadeInDown.duration(400).delay(140)} style={ctaStyle}>
            <Pressy
              scaleTo={0.97}
              style={[styles.primaryBtn, (busy || working !== null) && styles.btnDisabled]}
              onPress={onCreate}
              disabled={busy || working !== null}
            >
              <Ionicons name="flame" size={22} color={theme.colors.inkOnGold} />
              <Text style={styles.primaryBtnText}>
                {working === 'create' ? '…' : t('createGame')}
              </Text>
            </Pressy>
          </Animated.View>

          {/* ---------- two tiles: join / offline ---------- */}
          <Animated.View
            entering={FadeInDown.duration(400).delay(200)}
            onLayout={(e) => setRowW(e.nativeEvent.layout.width)}
            style={[styles.tileRow, rtl && styles.rowReverse]}
          >
            <Animated.View style={[styles.tileIndicator, indicatorStyle]} pointerEvents="none" />
            <Pressy
              scaleTo={0.96}
              onPress={() => openPanel('join')}
              style={[
                styles.tile,
                { borderColor: roleColors.captain + (panel === 'join' ? 'ff' : '66') },
                panel === 'join' && styles.tileActive,
              ]}
            >
              <Ionicons name="enter-outline" size={22} color={roleColors.captain} />
              <Text style={styles.tileText}>{t('joinGame')}</Text>
            </Pressy>
            <Pressy
              scaleTo={0.96}
              onPress={() => openPanel('offline')}
              style={[
                styles.tile,
                { borderColor: roleColors.ambassador + (panel === 'offline' ? 'ff' : '66') },
                panel === 'offline' && styles.tileActive,
              ]}
            >
              <Ionicons name="hardware-chip-outline" size={22} color={roleColors.ambassador} />
              <Text style={styles.tileText}>{t('offlineMode')}</Text>
            </Pressy>
          </Animated.View>

          {/* ---------- the selected tile's controls ---------- */}
          <Animated.View style={[styles.panelSlot, slotStyle]} pointerEvents={panel ? 'auto' : 'none'}>
            <Animated.View
              style={[styles.panelBox, { borderColor: roleColors.captain + '55' }, joinStyle]}
              pointerEvents={panel === 'join' ? 'auto' : 'none'}
            >
              <View style={[styles.joinRow, rtl && styles.rowReverse]}>
                <TextInput
                  value={codeInput}
                  onChangeText={(v) =>
                    setCodeInput(v.replace(/[^a-zA-Z]/g, '').toUpperCase().slice(0, 4))
                  }
                  placeholder="ABCD"
                  autoCapitalize="characters"
                  autoCorrect={false}
                  placeholderTextColor={theme.colors.inkFaint}
                  style={styles.codeInput}
                  maxLength={4}
                  returnKeyType="go"
                  onSubmitEditing={() => onJoin()}
                />
                <Pressy
                  scaleTo={0.94}
                  style={[styles.goBtn, (busy || working !== null) && styles.btnDisabled]}
                  onPress={() => onJoin()}
                  disabled={busy || working !== null}
                >
                  <Text style={styles.goBtnText}>{working === 'join' ? '…' : t('join')}</Text>
                </Pressy>
              </View>
            </Animated.View>

            <Animated.View
              style={[styles.panelBox, { borderColor: roleColors.ambassador + '55' }, offlineStyle]}
              pointerEvents={panel === 'offline' ? 'auto' : 'none'}
            >
              <Text style={[styles.rosterTitle, rtl && styles.rtlText]}>{t('meetTheTable')}</Text>
              <View style={styles.roster}>
                {PERSONAS.slice(0, botCount).map((persona) => (
                  <Animated.View
                    key={persona.id}
                    entering={FadeIn.duration(220)}
                    style={[styles.rosterRow, rtl && styles.rowReverse]}
                  >
                    <Avatar id={persona.avatar} size={26} ring={1.5} />
                    <Text style={[styles.rosterName, rtl && styles.rtlText]}>
                      {t(persona.nameKey)}
                    </Text>
                    <Text
                      style={[styles.rosterLine, rtl && styles.rtlText]}
                      numberOfLines={1}
                    >
                      {t(persona.dossierKey)}
                    </Text>
                  </Animated.View>
                ))}
              </View>
              <View style={[styles.botRow, rtl && styles.rowReverse]}>
                <Text style={[styles.botLabel, rtl && styles.rtlText]}>{t('botCount')}</Text>
                <View style={[styles.botChips, rtl && styles.rowReverse]}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Pressy
                      key={n}
                      scaleTo={0.9}
                      style={[styles.botChip, botCount === n && styles.botChipSel]}
                      onPress={() => {
                        haptics.selection();
                        sound.play('select');
                        setBotCount(n);
                      }}
                    >
                      <Text style={[styles.botChipText, botCount === n && styles.botChipTextSel]}>
                        {n}
                      </Text>
                    </Pressy>
                  ))}
                </View>
              </View>
              <Pressy
                scaleTo={0.96}
                style={[styles.goWide, (busy || working !== null) && styles.btnDisabled]}
                onPress={onPlayBots}
                disabled={busy || working !== null}
              >
                <Text style={styles.goBtnText}>{t('playVsBots')}</Text>
              </Pressy>
            </Animated.View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ---------- avatar picker ---------- */}
      <Modal
        visible={avatarOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setAvatarOpen(false)}
      >
        <Pressy scaleTo={1} style={styles.pickBackdrop} onPress={() => setAvatarOpen(false)}>
          <Animated.View entering={ZoomIn.duration(220)} style={styles.pickCard}>
            <Text style={styles.pickTitle}>{t('avatarLabel')}</Text>
            <View style={styles.pickGrid}>
              {ANIMALS.map((a) => (
                <Pressy
                  key={a}
                  scaleTo={0.88}
                  onPress={() => {
                    haptics.selection();
                    sound.play('select');
                    set('avatar', a);
                    setAvatarOpen(false);
                  }}
                  style={[styles.pickItem, avatar === a && styles.pickItemSel]}
                >
                  <Avatar id={a} size={52} ring={avatar === a ? 3 : 1.5} />
                </Pressy>
              ))}
            </View>
          </Animated.View>
        </Pressy>
      </Modal>

      <MessageSheet message={notice} onClose={() => setNotice(null)} />
    </SafeAreaView>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: theme.colors.background },
    scroll: { padding: 20, paddingBottom: 104 },
    rowReverse: { flexDirection: 'row-reverse' },
    rtlText: { textAlign: 'right', writingDirection: 'rtl' },

    heroWrap: { alignItems: 'center', marginTop: 2 },
    logo: { width: 168, height: 168, marginBottom: -14 },
    tip: {
      fontSize: 12.5,
      fontFamily: font('semibold'),
      color: theme.colors.goldLight,
      textAlign: 'center',
      paddingHorizontal: 12,
      minHeight: 32,
      marginTop: 2,
    },

    identity: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.lg,
      borderWidth: 1.5,
      borderColor: theme.colors.border,
      padding: 10,
      marginBottom: 12,
      ...theme.shadow.card,
    },
    avatarBtn: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
    avatarEdit: {
      position: 'absolute',
      bottom: -1,
      right: -1,
      width: 17,
      height: 17,
      borderRadius: 9,
      backgroundColor: theme.colors.gold,
      alignItems: 'center',
      justifyContent: 'center',
    },
    nameInput: {
      flex: 1,
      height: 46,
      color: theme.colors.ink,
      fontFamily: font('bold'),
      fontSize: 16,
      paddingHorizontal: 4,
    },

    primaryBtn: {
      height: 58,
      borderRadius: theme.radius.md,
      backgroundColor: theme.colors.gold,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: 10,
      ...theme.shadow.goldGlow,
    },
    primaryBtnText: { fontSize: 17, fontFamily: font('black'), color: theme.colors.inkOnGold },
    btnDisabled: { opacity: 0.55 },

    tileRow: { flexDirection: 'row', gap: 12, marginTop: 12 },
    tileIndicator: {
      position: 'absolute',
      bottom: -6,
      left: 0,
      height: 3,
      borderRadius: 2,
      backgroundColor: theme.colors.goldLight,
    },
    tile: {
      flex: 1,
      height: 74,
      borderRadius: theme.radius.md,
      borderWidth: 1.5,
      backgroundColor: theme.colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
    },
    tileActive: { backgroundColor: theme.colors.surfaceHover },
    tileText: { fontSize: 12.5, fontFamily: font('bold'), color: theme.colors.ink },

    panelSlot: { overflow: 'hidden' },
    panelBox: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: 0,
      bottom: 0,
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.md,
      borderWidth: 1.5,
      padding: 12,
      gap: 8,
      justifyContent: 'center',
    },
    joinRow: { flexDirection: 'row', gap: 10 },
    codeInput: {
      flex: 1,
      height: 52,
      borderRadius: theme.radius.sm,
      borderWidth: 1.5,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surfaceElevated,
      color: theme.colors.goldLight,
      fontFamily: latinFont('bold'),
      fontSize: 22,
      letterSpacing: 10,
      textAlign: 'center',
    },
    goBtn: {
      height: 52,
      paddingHorizontal: 26,
      borderRadius: theme.radius.sm,
      backgroundColor: theme.colors.surfaceHover,
      borderWidth: 1.5,
      borderColor: theme.colors.gold,
      alignItems: 'center',
      justifyContent: 'center',
    },
    goWide: {
      height: 50,
      borderRadius: theme.radius.sm,
      backgroundColor: theme.colors.surfaceHover,
      borderWidth: 1.5,
      borderColor: theme.colors.gold,
      alignItems: 'center',
      justifyContent: 'center',
    },
    goBtnText: { fontSize: 15, fontFamily: font('bold'), color: theme.colors.goldLight },

    rosterTitle: {
      fontSize: 11.5,
      fontFamily: font('bold'),
      color: theme.colors.goldLight,
      letterSpacing: 0.4,
    },
    roster: { gap: 3 },
    rosterRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
    rosterName: {
      fontSize: 12,
      fontFamily: font('bold'),
      color: theme.colors.ink,
      minWidth: 44,
    },
    rosterLine: {
      flex: 1,
      fontSize: 10.5,
      fontFamily: font('semibold'),
      color: theme.colors.inkFaint,
    },
    botRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    botLabel: { fontSize: 13, fontFamily: font('semibold'), color: theme.colors.inkSoft },
    botChips: { flexDirection: 'row', gap: 6 },
    botChip: {
      width: 38,
      height: 38,
      borderRadius: 19,
      borderWidth: 1.5,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surfaceElevated,
      alignItems: 'center',
      justifyContent: 'center',
    },
    botChipSel: { borderColor: theme.colors.gold, backgroundColor: theme.colors.surfaceHover },
    botChipText: { fontSize: 15, fontFamily: latinFont('bold'), color: theme.colors.inkSoft },
    botChipTextSel: { color: theme.colors.goldLight },

    pickBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(4,6,10,0.88)',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
    },
    pickCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.xl,
      borderWidth: 1,
      borderColor: theme.colors.borderBright,
      padding: 20,
      gap: 14,
      alignItems: 'center',
      maxWidth: 380,
    },
    pickTitle: { fontSize: 16, fontFamily: font('bold'), color: theme.colors.ink },
    pickGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      justifyContent: 'center',
    },
    pickItem: { padding: 3, borderRadius: 32 },
    pickItemSel: { backgroundColor: 'rgba(212,168,84,0.16)' },
  });

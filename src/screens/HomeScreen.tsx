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
  SlideInLeft,
  SlideInRight,
  SlideOutLeft,
  SlideOutRight,
  ZoomIn,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSpring,
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
import { t, TKey, isRTL } from '../i18n';
import * as haptics from '../haptics';
import * as sound from '../sound';

/** Rotating one-liners under the hero: flavour plus a rules nudge. */
const TIPS: TKey[] = ['tip1', 'tip2', 'tip3', 'tip4', 'tip5'];

type Panel = 'join' | 'offline' | null;

export function HomeScreen() {
  const theme = useTheme();
  const styles = useStyles(makeStyles);
  const { lang, playerName, avatar, set, hydrated } = useSettings();
  const { create, join, playLocal, busy } = useRoom();
  const [name, setName] = useState<string | null>(null);
  const [codeInput, setCodeInput] = useState('');
  const [botCount, setBotCount] = useState(2);
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
      withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
  }, [pulse]);
  const ctaStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + pulse.value * 0.016 }],
    shadowOpacity: 0.3 + pulse.value * 0.4,
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
  const dir = useRef(1);
  const [rowW, setRowW] = useState(0);
  const indicator = useSharedValue(0); // 0 = join, 1 = offline
  const indicatorShown = useSharedValue(0);
  const indicatorStyle = useAnimatedStyle(() => {
    const half = Math.max(0, (rowW - 12) / 2);
    return {
      width: half,
      opacity: indicatorShown.value,
      transform: [{ translateX: indicator.value * (half + 12) }],
    };
  });

  const openPanel = (p: Panel) => {
    haptics.selection();
    sound.play('select');
    setPanel((cur) => {
      const next = cur === p ? null : p;
      if (next) {
        const from = cur ? ORDER.indexOf(cur) : ORDER.indexOf(next);
        const to = ORDER.indexOf(next);
        dir.current = to >= from ? 1 : -1;
        indicator.value = withSpring(to, { damping: 18, stiffness: 170 });
        indicatorShown.value = withTiming(1, { duration: 160 });
      } else {
        indicatorShown.value = withTiming(0, { duration: 160 });
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
          <Animated.View
            layout={LinearTransition.springify().damping(20).stiffness(160)}
            style={styles.panelWrap}
          >
            {panel === 'join' ? (
              <Animated.View
                key="join"
                entering={(dir.current > 0 ? SlideInRight : SlideInLeft).duration(260)}
                exiting={(dir.current > 0 ? SlideOutLeft : SlideOutRight).duration(200)}
                style={[styles.panelBox, { borderColor: roleColors.captain + '55' }]}
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
            ) : panel === 'offline' ? (
              <Animated.View
                key="offline"
                entering={(dir.current > 0 ? SlideInRight : SlideInLeft).duration(260)}
                exiting={(dir.current > 0 ? SlideOutLeft : SlideOutRight).duration(200)}
                style={[styles.panelBox, { borderColor: roleColors.ambassador + '55' }]}
              >
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
                        <Text
                          style={[styles.botChipText, botCount === n && styles.botChipTextSel]}
                        >
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
            ) : null}
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
    scroll: { padding: 20, paddingBottom: 28 },
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

    panelWrap: { marginTop: 14, overflow: 'hidden' },
    panelBox: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.md,
      borderWidth: 1.5,
      padding: 12,
      gap: 10,
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

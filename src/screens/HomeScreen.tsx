/**
 * HomeScreen — landing: logo, player name, create a room or join one
 * with a 4-letter code. Shown when no room is active.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  Image,
  Keyboard,
  KeyboardAvoidingView,
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
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { Theme, font, latinFont, roleColors, useStyles, useTheme } from '../theme';
import { Pressy } from '../components/Pressy';
import { Breathing } from '../components/Breathing';
import { ANIMALS, Avatar } from '../components/Avatar';
import { HeroFan } from '../components/HeroFan';
import { MessageSheet, SheetMessage } from '../components/MessageSheet';
import { useSettings } from '../settings';
import * as Linking from 'expo-linking';
import { useRoom } from '../net/RoomContext';
import { consumePendingJoin, onPendingJoin, parseJoinCode } from '../net/deeplink';
import { t, TKey, isRTL } from '../i18n';
import * as haptics from '../haptics';

/** Rotating one-liners under the hero: flavour plus a rules nudge. */
const TIPS: TKey[] = ['tip1', 'tip2', 'tip3', 'tip4', 'tip5'];

export function HomeScreen() {
  const theme = useTheme();
  const styles = useStyles(makeStyles);
  const { lang, playerName, avatar, set, hydrated } = useSettings();
  const { create, join, playLocal, busy } = useRoom();
  const [name, setName] = useState<string | null>(null);
  const [codeInput, setCodeInput] = useState('');
  const [botCount, setBotCount] = useState(2);
  const [notice, setNotice] = useState<SheetMessage | null>(null);
  const [working, setWorking] = useState<'create' | 'join' | null>(null);
  void lang; // re-render on language change

  const effectiveName = (name ?? playerName).trim();

  /**
   * A shared link (coupgame://join/ABCD or the hosted https page) drops
   * the code straight into the join field — and joins immediately when we
   * already know the player's name.
   */
  const incoming = Linking.useURL();
  const handled = useRef<string | null>(null);
  const takeCode = (code: string | null) => {
    if (!code || handled.current === code) return;
    handled.current = code;
    setCodeInput(code);
    const who = (name ?? playerName).trim();
    if (who && !busy) {
      haptics.medium();
      join(code, who).catch((e) => fail(e));
    }
  };
  // the /join/[code] route stashes the code before redirecting here
  useEffect(() => {
    takeCode(consumePendingJoin());
    return onPendingJoin(takeCode);
  }, []);
  // and a raw URL (bare scheme, or a link opened while we're running)
  useEffect(() => {
    takeCode(parseJoinCode(incoming));
  }, [incoming]);

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

  const onCreate = async () => {
    Keyboard.dismiss();
    if (!effectiveName) {
      setNotice({ icon: 'person-outline', title: t('yourName'), body: t('nameNeeded') });
      return;
    }
    remember();
    setWorking('create');
    try {
      haptics.medium();
      await create(effectiveName);
    } catch (e) {
      fail(e);
    } finally {
      setWorking(null);
    }
  };

  const onJoin = async () => {
    Keyboard.dismiss();
    if (!effectiveName) {
      setNotice({ icon: 'person-outline', title: t('yourName'), body: t('nameNeeded') });
      return;
    }
    const code = codeInput.trim().toUpperCase();
    if (code.length !== 4) {
      setNotice({ icon: 'key-outline', title: t('joinGame'), body: t('codeNeeded') });
      return;
    }
    remember();
    setWorking('join');
    try {
      haptics.medium();
      await join(code, effectiveName);
    } catch (e) {
      fail(e);
    } finally {
      setWorking(null);
    }
  };

  const onPlayBots = () => {
    Keyboard.dismiss();
    if (!effectiveName) {
      setNotice({ icon: 'person-outline', title: t('yourName'), body: t('nameNeeded') });
      return;
    }
    remember();
    haptics.medium();
    playLocal(effectiveName, botCount);
  };

  const rtl = isRTL();

  // a slowly rotating tip keeps the screen alive and teaches the rules
  const [tipIndex, setTipIndex] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTipIndex((i) => (i + 1) % TIPS.length), 4200);
    return () => clearInterval(id);
  }, []);

  // the primary action breathes so the screen never looks static
  const pulse = useSharedValue(0);
  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
  }, [pulse]);
  const ctaStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + pulse.value * 0.018 }],
    shadowOpacity: 0.35 + pulse.value * 0.4,
  }));

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      {/* neon-cyborg backdrop (scripts/gen-bg.py) + slow character wash */}
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
          <Animated.View entering={FadeInDown.duration(400)} style={styles.heroWrap}>
            <Image
              source={require('../../assets/logo.png')}
              style={styles.logo}
              resizeMode="contain"
            />
            <Text style={styles.tag}>{t('homeTag')}</Text>
            {/* the cast, fanned out — tap a card to hear the character */}
            <HeroFan />
            <Animated.Text
              key={tipIndex}
              entering={FadeIn.duration(500)}
              exiting={FadeOut.duration(400)}
              style={styles.tip}
            >
              {t(TIPS[tipIndex])}
            </Animated.Text>
            {/* pick your animal avatar */}
            <Text style={styles.avatarLabel}>{t('avatarLabel')}</Text>
            <View style={styles.cast}>
              {ANIMALS.map((r, i) => {
                const selected = avatar === r;
                return (
                  <Animated.View key={r} entering={FadeInDown.duration(320).delay(80 + i * 35)}>
                    <Pressy
                      scaleTo={0.88}
                      onPress={() => {
                        haptics.selection();
                        set('avatar', r);
                      }}
                      style={[styles.avatarWrap, selected && styles.avatarSel]}
                    >
                      <Avatar id={r} size={selected ? 54 : 46} ring={selected ? 3 : 1.5} />
                      {selected ? (
                        <View style={styles.avatarCheck}>
                          <Ionicons name="checkmark" size={11} color={theme.colors.inkOnGold} />
                        </View>
                      ) : null}
                    </Pressy>
                  </Animated.View>
                );
              })}
            </View>
          </Animated.View>

          <Animated.View
            entering={FadeInDown.duration(400).delay(80)}
            style={[styles.card, { borderColor: roleColors.duke + '99' }]}
          >
            <View style={[styles.cardEdge, { backgroundColor: roleColors.duke }]} />
            <Text style={[styles.label, rtl && styles.rtlText]}>{t('yourName')}</Text>
            <TextInput
              value={name ?? playerName}
              onChangeText={setName}
              editable={hydrated}
              placeholder={t('yourName')}
              placeholderTextColor={theme.colors.inkFaint}
              style={[styles.input, rtl && styles.rtlText]}
              maxLength={16}
              returnKeyType="done"
            />

            <Animated.View style={ctaStyle}>
              <Pressy
                scaleTo={0.96}
                style={[styles.primaryBtn, (busy || working !== null) && styles.btnDisabled]}
                onPress={onCreate}
                disabled={busy || working !== null}
              >
                <Ionicons name="add-circle" size={22} color={theme.colors.inkOnGold} />
                <Text style={styles.primaryBtnText}>
                  {working === 'create' ? '…' : t('createGame')}
                </Text>
              </Pressy>
            </Animated.View>
          </Animated.View>

          <Animated.View
            entering={FadeInDown.duration(400).delay(160)}
            style={[styles.card, { borderColor: roleColors.captain + '99' }]}
          >
            <View style={[styles.cardEdge, { backgroundColor: roleColors.captain }]} />
            <Text style={[styles.label, rtl && styles.rtlText]}>{t('joinGame')}</Text>
            <View style={[styles.joinRow, rtl && styles.rowReverse]}>
              <TextInput
                value={codeInput}
                onChangeText={(v) => setCodeInput(v.replace(/[^a-zA-Z]/g, '').toUpperCase().slice(0, 4))}
                placeholder="ABCD"
                autoCapitalize="characters"
                autoCorrect={false}
                placeholderTextColor={theme.colors.inkFaint}
                style={styles.codeInput}
                maxLength={4}
                returnKeyType="go"
                onSubmitEditing={onJoin}
              />
              <Pressy
                scaleTo={0.94}
                style={[styles.joinBtn, (busy || working !== null) && styles.btnDisabled]}
                onPress={onJoin}
                disabled={busy || working !== null}
              >
                <Text style={styles.joinBtnText}>{working === 'join' ? '…' : t('join')}</Text>
              </Pressy>
            </View>
          </Animated.View>

          <Animated.View
            entering={FadeInDown.duration(400).delay(240)}
            style={[styles.card, { borderColor: roleColors.ambassador + '99' }]}
          >
            <View style={[styles.cardEdge, { backgroundColor: roleColors.ambassador }]} />
            <Text style={[styles.label, rtl && styles.rtlText]}>{t('offlineMode')}</Text>
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
              style={[styles.botsBtn, (busy || working !== null) && styles.btnDisabled]}
              onPress={onPlayBots}
              disabled={busy || working !== null}
            >
              <Ionicons name="hardware-chip-outline" size={20} color={theme.colors.ink} />
              <Text style={styles.botsBtnText}>{t('playVsBots')}</Text>
            </Pressy>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
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
    scroll: {
      padding: 20,
      paddingBottom: 32,
    },
    heroWrap: {
      alignItems: 'center',
      marginTop: 8,
      marginBottom: 20,
    },
    logo: {
      width: 190,
      height: 190,
    },
    tag: {
      fontSize: 14,
      fontFamily: font('semibold'),
      color: theme.colors.inkSoft,
      marginTop: -6,
    },
    tip: {
      fontSize: 12.5,
      fontFamily: font('semibold'),
      color: theme.colors.goldLight,
      textAlign: 'center',
      marginTop: 2,
      marginBottom: 2,
      paddingHorizontal: 12,
      minHeight: 34,
    },
    cast: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
      marginTop: 6,
      alignItems: 'center',
      justifyContent: 'center',
      maxWidth: 400,
    },
    avatarLabel: {
      fontSize: 12,
      fontFamily: font('bold'),
      color: theme.colors.inkSoft,
      marginTop: 12,
    },
    avatarWrap: {
      width: 58,
      height: 58,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 32,
    },
    avatarSel: {
      backgroundColor: 'rgba(212, 168, 84, 0.14)',
    },
    avatarCheck: {
      position: 'absolute',
      bottom: 2,
      right: 2,
      width: 17,
      height: 17,
      borderRadius: 9,
      backgroundColor: theme.colors.gold,
      alignItems: 'center',
      justifyContent: 'center',
    },
    card: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.lg,
      borderWidth: 1.5,
      borderColor: theme.colors.border,
      padding: 18,
      marginBottom: 16,
      overflow: 'hidden',
      ...theme.shadow.card,
    },
    cardEdge: {
      position: 'absolute',
      left: 0,
      top: 0,
      bottom: 0,
      width: 4,
    },
    label: {
      fontSize: 13,
      fontFamily: font('bold'),
      color: theme.colors.inkSoft,
      marginBottom: 8,
    },
    rtlText: {
      textAlign: 'right',
      writingDirection: 'rtl',
    },
    rowReverse: {
      flexDirection: 'row-reverse',
    },
    input: {
      height: 48,
      borderRadius: theme.radius.sm,
      borderWidth: 1.5,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surfaceElevated,
      color: theme.colors.ink,
      paddingHorizontal: 14,
      fontFamily: font('semibold'),
      fontSize: 15,
    },
    primaryBtn: {
      marginTop: 14,
      height: 54,
      borderRadius: theme.radius.md,
      backgroundColor: theme.colors.gold,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: 8,
      ...theme.shadow.goldGlow,
    },
    btnDisabled: {
      opacity: 0.55,
    },
    primaryBtnText: {
      fontSize: 16,
      fontFamily: font('bold'),
      color: theme.colors.inkOnGold,
    },
    joinRow: {
      flexDirection: 'row',
      gap: 10,
    },
    codeInput: {
      flex: 1,
      height: 54,
      borderRadius: theme.radius.sm,
      borderWidth: 1.5,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surfaceElevated,
      color: theme.colors.goldLight,
      paddingHorizontal: 14,
      fontFamily: latinFont('bold'),
      fontSize: 22,
      letterSpacing: 10,
      textAlign: 'center',
    },
    joinBtn: {
      height: 54,
      paddingHorizontal: 24,
      borderRadius: theme.radius.md,
      backgroundColor: theme.colors.surfaceHover,
      borderWidth: 1.5,
      borderColor: theme.colors.gold,
      alignItems: 'center',
      justifyContent: 'center',
    },
    joinBtnText: {
      fontSize: 15,
      fontFamily: font('bold'),
      color: theme.colors.goldLight,
    },
    botRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 12,
    },
    botLabel: {
      fontSize: 13,
      fontFamily: font('semibold'),
      color: theme.colors.inkSoft,
    },
    botChips: {
      flexDirection: 'row',
      gap: 6,
    },
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
    botChipSel: {
      borderColor: theme.colors.gold,
      backgroundColor: theme.colors.surfaceHover,
    },
    botChipText: {
      fontSize: 15,
      fontFamily: latinFont('bold'),
      color: theme.colors.inkSoft,
    },
    botChipTextSel: {
      color: theme.colors.goldLight,
    },
    botsBtn: {
      height: 50,
      borderRadius: theme.radius.md,
      backgroundColor: theme.colors.surfaceHover,
      borderWidth: 1.5,
      borderColor: theme.colors.borderBright,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: 8,
    },
    botsBtnText: {
      fontSize: 15,
      fontFamily: font('bold'),
      color: theme.colors.ink,
    },
  });

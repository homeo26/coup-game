/**
 * HomeScreen — landing: logo, player name, create a room or join one
 * with a 4-letter code. Shown when no room is active.
 */
import React, { useState } from 'react';
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
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Theme, font, latinFont, useStyles, useTheme } from '../theme';
import { Pressy } from '../components/Pressy';
import { Breathing } from '../components/Breathing';
import { RolePortrait } from '../components/RolePortrait';
import { MessageSheet, SheetMessage } from '../components/MessageSheet';
import { useSettings } from '../settings';
import { useRoom } from '../net/RoomContext';
import { ROLES } from '../engine/types';
import { t, TKey, isRTL } from '../i18n';
import * as haptics from '../haptics';

export function HomeScreen() {
  const theme = useTheme();
  const styles = useStyles(makeStyles);
  const { lang, playerName, set, hydrated } = useSettings();
  const { create, join, busy } = useRoom();
  const [name, setName] = useState<string | null>(null);
  const [codeInput, setCodeInput] = useState('');
  const [notice, setNotice] = useState<SheetMessage | null>(null);
  const [working, setWorking] = useState<'create' | 'join' | null>(null);
  void lang; // re-render on language change

  const effectiveName = (name ?? playerName).trim();

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

  const rtl = isRTL();

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
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
            {/* the cast — staggered entrance, alternating lift */}
            <View style={styles.cast}>
              {ROLES.map((r, i) => (
                <Animated.View
                  key={r}
                  entering={FadeInDown.duration(380).delay(140 + i * 70)}
                  style={{ transform: [{ translateY: i % 2 === 0 ? 0 : 10 }] }}
                >
                  <RolePortrait role={r} size={58} ring={2.5} />
                </Animated.View>
              ))}
            </View>
          </Animated.View>

          <Animated.View entering={FadeInDown.duration(400).delay(80)} style={styles.card}>
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

          <Animated.View entering={FadeInDown.duration(400).delay(160)} style={styles.card}>
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
    cast: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 16,
      alignItems: 'center',
    },
    card: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.lg,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: 18,
      marginBottom: 16,
      ...theme.shadow.card,
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
  });

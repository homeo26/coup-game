/**
 * SettingsScreen — language (English / العربية), haptics, and about.
 */
import React from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Theme, font, useStyles, useTheme } from '../theme';
import { Pressy } from '../components/Pressy';
import { useSettings } from '../settings';
import { t, isRTL, Lang } from '../i18n';
import * as haptics from '../haptics';

export function SettingsScreen() {
  const theme = useTheme();
  const styles = useStyles(makeStyles);
  const settings = useSettings();
  const rtl = isRTL();
  const rtlText = rtl ? styles.rtlText : null;

  const pickLang = (l: Lang) => {
    if (l !== settings.lang) {
      haptics.selection();
      settings.set('lang', l);
    }
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.brand}>
          <Image source={require('../../assets/logo.png')} style={styles.logo} resizeMode="contain" />
        </View>

        <Text style={[styles.title, rtlText]}>{t('settings')}</Text>

        {/* Language */}
        <View style={styles.card}>
          <View style={[styles.row, rtl && styles.rowReverse]}>
            <Ionicons name="language" size={20} color={theme.colors.gold} />
            <Text style={[styles.rowTitle, rtlText]}>{t('language')}</Text>
          </View>
          <View style={[styles.segment, rtl && styles.rowReverse]}>
            {(['en', 'ar'] as Lang[]).map((l) => {
              const active = settings.lang === l;
              return (
                <Pressy
                  key={l}
                  scaleTo={0.95}
                  style={[styles.segmentBtn, active && styles.segmentActive]}
                  onPress={() => pickLang(l)}
                >
                  <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                    {l === 'en' ? 'English' : 'العربية'}
                  </Text>
                </Pressy>
              );
            })}
          </View>
        </View>

        {/* Haptics */}
        <View style={styles.card}>
          <View style={[styles.row, rtl && styles.rowReverse]}>
            <Ionicons name="radio-button-on" size={20} color={theme.colors.gold} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowTitle, rtlText]}>{t('hapticsSetting')}</Text>
              <Text style={[styles.rowDesc, rtlText]}>{t('hapticsDesc')}</Text>
            </View>
            <Pressy
              scaleTo={0.9}
              onPress={() => settings.set('haptics', !settings.haptics)}
              style={[styles.toggle, settings.haptics && styles.toggleOn]}
            >
              <View style={[styles.thumb, settings.haptics && styles.thumbOn]} />
            </Pressy>
          </View>
        </View>

        {/* About */}
        <View style={styles.card}>
          <View style={[styles.row, rtl && styles.rowReverse]}>
            <Ionicons name="information-circle" size={20} color={theme.colors.gold} />
            <Text style={[styles.rowTitle, rtlText]}>{t('about')}</Text>
          </View>
          <Text style={[styles.aboutText, rtlText]}>{t('aboutText')}</Text>
        </View>

        <Text style={styles.version}>v1.0.0</Text>
      </ScrollView>
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
    },
    brand: {
      alignItems: 'center',
      marginBottom: 4,
    },
    logo: {
      width: 130,
      height: 130,
    },
    title: {
      fontSize: 24,
      fontFamily: font('black'),
      color: theme.colors.ink,
      marginBottom: 12,
    },
    rtlText: {
      textAlign: 'right',
      writingDirection: 'rtl',
    },
    rowReverse: {
      flexDirection: 'row-reverse',
    },
    card: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.lg,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: 16,
      marginBottom: 12,
      gap: 12,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    rowTitle: {
      fontSize: 15,
      fontFamily: font('bold'),
      color: theme.colors.ink,
    },
    rowDesc: {
      fontSize: 12,
      fontFamily: font('semibold'),
      color: theme.colors.inkFaint,
      marginTop: 1,
    },
    segment: {
      flexDirection: 'row',
      backgroundColor: theme.colors.surfaceElevated,
      borderRadius: theme.radius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: 4,
      gap: 4,
    },
    segmentBtn: {
      flex: 1,
      height: 42,
      borderRadius: theme.radius.sm,
      alignItems: 'center',
      justifyContent: 'center',
    },
    segmentActive: {
      backgroundColor: theme.colors.gold,
    },
    segmentText: {
      fontSize: 14,
      fontFamily: font('bold'),
      color: theme.colors.inkSoft,
    },
    segmentTextActive: {
      color: theme.colors.inkOnGold,
    },
    toggle: {
      width: 52,
      height: 30,
      borderRadius: 15,
      backgroundColor: theme.colors.surfaceHover,
      borderWidth: 1,
      borderColor: theme.colors.borderBright,
      justifyContent: 'center',
      paddingHorizontal: 3,
    },
    toggleOn: {
      backgroundColor: theme.colors.gold,
      borderColor: theme.colors.gold,
    },
    thumb: {
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: theme.colors.inkSoft,
    },
    thumbOn: {
      backgroundColor: '#fff',
      alignSelf: 'flex-end',
    },
    aboutText: {
      fontSize: 13,
      lineHeight: 21,
      fontFamily: font('semibold'),
      color: theme.colors.inkSoft,
    },
    version: {
      textAlign: 'center',
      fontSize: 11,
      color: theme.colors.inkFaint,
      fontFamily: font('semibold'),
      marginTop: 8,
    },
  });

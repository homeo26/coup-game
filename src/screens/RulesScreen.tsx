/**
 * RulesScreen — reference for the table: goal, general actions, the five
 * characters with their art and abilities, and the challenge/block rules.
 */
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Theme, font, roleColors, useStyles } from '../theme';
import { RoleArt } from '../components/RoleArt';
import { RolePortrait } from '../components/RolePortrait';
import { useSettings } from '../settings';
import { Role, ROLES } from '../engine/types';
import { t, TKey, isRTL } from '../i18n';

const BLURB: Record<Role, TKey> = {
  duke: 'dukeBlurb',
  assassin: 'assassinBlurb',
  captain: 'captainBlurb',
  ambassador: 'ambassadorBlurb',
  contessa: 'contessaBlurb',
};

export function RulesScreen() {
  const styles = useStyles(makeStyles);
  const { lang } = useSettings();
  void lang;
  const rtl = isRTL();
  const rtlText = rtl ? styles.rtlText : null;

  const Section = ({ title, body }: { title: string; body: string }) => (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, rtlText]}>{title}</Text>
      <Text style={[styles.paragraph, rtlText]}>{body}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={[styles.title, rtlText]}>{t('rulesTitle')}</Text>

        <Section title={t('rulesGoal')} body={t('rulesGoalText')} />
        <Section title={t('generalActions')} body={t('generalActionsText')} />

        <Text style={[styles.sectionTitle, rtlText, { marginTop: 8 }]}>{t('rolesTitle')}</Text>
        {ROLES.map((r) => (
          <View key={r} style={[styles.roleRow, rtl && styles.rowReverse]}>
            <View style={styles.roleArtWrap}>
              <RolePortrait role={r} size={52} ring={2} />
              <View style={styles.roleEmblem}>
                <RoleArt role={r} size={15} />
              </View>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.roleName, rtlText, { color: roleColors[r] }]}>
                {t(r as TKey)}
              </Text>
              <Text style={[styles.roleBlurb, rtlText]}>{t(BLURB[r])}</Text>
            </View>
          </View>
        ))}

        <Section title={t('rulesBluff')} body={t('rulesBluffText')} />
        <Section title={t('rulesBlocks')} body={t('rulesBlocksText')} />
        <Section title={t('rulesTen')} body={t('rulesTenText')} />
        <View style={{ height: 24 }} />
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
    rtlText: {
      textAlign: 'right',
      writingDirection: 'rtl',
    },
    rowReverse: {
      flexDirection: 'row-reverse',
    },
    title: {
      fontSize: 26,
      fontFamily: font('black'),
      color: theme.colors.ink,
      marginBottom: 10,
    },
    section: {
      marginBottom: 14,
    },
    sectionTitle: {
      fontSize: 16,
      fontFamily: font('bold'),
      color: theme.colors.goldLight,
      marginBottom: 4,
    },
    paragraph: {
      fontSize: 13.5,
      lineHeight: 22,
      fontFamily: font('semibold'),
      color: theme.colors.inkSoft,
    },
    roleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: 12,
      marginBottom: 8,
    },
    roleArtWrap: {
      width: 58,
      height: 58,
      alignItems: 'center',
      justifyContent: 'center',
    },
    roleEmblem: {
      position: 'absolute',
      bottom: -2,
      right: -4,
      backgroundColor: theme.colors.surfaceElevated,
      borderRadius: 10,
      padding: 2,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    roleName: {
      fontSize: 15,
      fontFamily: font('bold'),
    },
    roleBlurb: {
      fontSize: 12.5,
      lineHeight: 19,
      fontFamily: font('semibold'),
      color: theme.colors.inkSoft,
      marginTop: 1,
    },
  });

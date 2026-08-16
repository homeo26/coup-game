/**
 * RulesScreen — full table reference: goal, setup (the 15-card court),
 * turn structure, every action with cost / block / challenge facts, the
 * five characters with their art, and the challenge & elimination rules.
 */
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Theme, font, latinFont, roleColors, useStyles, useTheme } from '../theme';
import { RoleArt } from '../components/RoleArt';
import { RolePortrait } from '../components/RolePortrait';
import { CoinIcon } from '../components/Coin';
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

interface ActionSpec {
  label: TKey;
  desc: TKey;
  cost?: number;
  role?: Role;
  blocks?: Role[];
  challengeable: boolean;
}

const ACTIONS: ActionSpec[] = [
  { label: 'income', desc: 'incomeDesc', challengeable: false },
  { label: 'foreign_aid', desc: 'foreignAidDesc', blocks: ['duke'], challengeable: false },
  { label: 'coupAction', desc: 'coupDesc', cost: 7, challengeable: false },
  { label: 'tax', desc: 'taxDesc', role: 'duke', challengeable: true },
  {
    label: 'assassinate',
    desc: 'assassinateDesc',
    cost: 3,
    role: 'assassin',
    blocks: ['contessa'],
    challengeable: true,
  },
  {
    label: 'steal',
    desc: 'stealDesc',
    role: 'captain',
    blocks: ['captain', 'ambassador'],
    challengeable: true,
  },
  { label: 'exchange', desc: 'exchangeDesc', role: 'ambassador', challengeable: true },
];

export function RulesScreen() {
  const theme = useTheme();
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
        <Section title={t('rulesSetup')} body={t('rulesSetupText')} />
        <Section title={t('rulesTurn')} body={t('rulesTurnText')} />

        {/* Every action, with its full fact sheet */}
        <Text style={[styles.sectionTitle, rtlText]}>{t('rulesActions')}</Text>
        {ACTIONS.map((a) => {
          const color = a.role
            ? roleColors[a.role]
            : a.label === 'coupAction'
              ? theme.colors.danger
              : theme.colors.goldLight;
          return (
            <View key={a.label} style={styles.actionCard}>
              <View style={[styles.actionHead, rtl && styles.rowReverse]}>
                {a.role ? (
                  <RolePortrait role={a.role} size={30} ring={1.5} />
                ) : (
                  <Ionicons
                    name={
                      a.label === 'coupAction'
                        ? 'skull'
                        : a.label === 'income'
                          ? 'add-circle'
                          : 'cash-outline'
                    }
                    size={22}
                    color={color}
                  />
                )}
                <Text style={[styles.actionName, { color }]}>{t(a.label)}</Text>
                {a.cost !== undefined ? (
                  <View style={[styles.costTag, rtl && styles.rowReverse]}>
                    <CoinIcon size={13} />
                    <Text style={styles.costText}>{a.cost}</Text>
                  </View>
                ) : null}
              </View>
              <Text style={[styles.actionDesc, rtlText]}>{t(a.desc)}</Text>
              {a.role ? (
                <Text style={[styles.actionMetaClaim, rtlText]}>
                  {t('claimsRole', { role: t(a.role as TKey) })}
                </Text>
              ) : null}
              <View style={[styles.metaRow, rtl && styles.rowReverse]}>
                <View style={[styles.metaChip, rtl && styles.rowReverse]}>
                  <Ionicons
                    name={a.blocks ? 'shield-half-outline' : 'shield-outline'}
                    size={12}
                    color={a.blocks ? theme.colors.warning : theme.colors.inkFaint}
                  />
                  <Text style={[styles.metaText, a.blocks && { color: theme.colors.warning }]}>
                    {a.blocks
                      ? t('blockedBy', {
                          roles: a.blocks.map((r) => t(r as TKey)).join(' / '),
                        })
                      : t('noBlock')}
                  </Text>
                </View>
                <View style={[styles.metaChip, rtl && styles.rowReverse]}>
                  <Ionicons
                    name={a.challengeable ? 'flash-outline' : 'flash-off-outline'}
                    size={12}
                    color={a.challengeable ? theme.colors.danger : theme.colors.inkFaint}
                  />
                  <Text
                    style={[styles.metaText, a.challengeable && { color: theme.colors.danger }]}
                  >
                    {a.challengeable ? t('challengeableYes') : t('challengeableNo')}
                  </Text>
                </View>
              </View>
            </View>
          );
        })}

        <Text style={[styles.sectionTitle, rtlText, { marginTop: 8 }]}>{t('rolesTitle')}</Text>
        <Text style={[styles.paragraph, rtlText, { marginBottom: 8 }]}>{t('rolesCopies')}</Text>
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
        <Section title={t('rulesInfluence')} body={t('rulesInfluenceText')} />
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
    actionCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: 12,
      marginBottom: 8,
      gap: 5,
    },
    actionHead: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 9,
    },
    actionName: {
      fontSize: 15,
      fontFamily: font('bold'),
      flexShrink: 1,
    },
    costTag: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      backgroundColor: theme.colors.surfaceElevated,
      borderRadius: theme.radius.pill,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    costText: {
      fontSize: 12,
      fontFamily: latinFont('bold'),
      color: theme.colors.goldLight,
    },
    actionDesc: {
      fontSize: 13,
      lineHeight: 19,
      fontFamily: font('semibold'),
      color: theme.colors.ink,
    },
    actionMetaClaim: {
      fontSize: 11.5,
      fontFamily: font('semibold'),
      color: theme.colors.inkSoft,
      marginTop: -3,
    },
    metaRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
      marginTop: 2,
    },
    metaChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    metaText: {
      fontSize: 11,
      fontFamily: font('semibold'),
      color: theme.colors.inkFaint,
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

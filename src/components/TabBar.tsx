/**
 * Bottom tab bar — three tabs (Play / Rules / More), gold active state,
 * fixed heights so labels align in both languages.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as haptics from '../haptics';
import { Theme, font, useStyles, useTheme } from '../theme';
import { Pressy } from './Pressy';
import { t } from '../i18n';

export type TabName = 'play' | 'chat' | 'rules' | 'settings';
/** Page order inside the pager — fixed; the chat BUTTON hides when idle. */
export const TAB_ORDER: TabName[] = ['play', 'chat', 'rules', 'settings'];

const ICONS: Record<TabName, keyof typeof Ionicons.glyphMap> = {
  play: 'game-controller',
  chat: 'chatbubbles',
  rules: 'book',
  settings: 'ellipsis-horizontal-circle',
};

interface Props {
  activeIndex: number;
  onPress: (index: number) => void;
  /** Chat tab is only offered while in a room. */
  showChat: boolean;
  /** Unread chat messages since the tab was last open. */
  chatBadge: number;
}

export function TabBar({ activeIndex, onPress, showChat, chatBadge }: Props) {
  const theme = useTheme();
  const styles = useStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const labels: Record<TabName, string> = {
    play: t('tabPlay'),
    chat: t('tabChat'),
    rules: t('tabRules'),
    settings: t('tabSettings'),
  };

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      {TAB_ORDER.map((tab, index) => {
        if (tab === 'chat' && !showChat) return null;
        const focused = activeIndex === index;
        return (
          <Pressy
            key={tab}
            style={styles.item}
            scaleTo={0.88}
            onPress={() => {
              if (!focused) {
                haptics.selection();
                onPress(index);
              }
            }}
          >
            <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
              <Ionicons
                name={ICONS[tab]}
                size={22}
                color={focused ? theme.colors.gold : theme.colors.tabInactive}
              />
              {tab === 'chat' && chatBadge > 0 ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{chatBadge > 9 ? '9+' : chatBadge}</Text>
                </View>
              ) : null}
            </View>
            <Text
              numberOfLines={1}
              style={[
                styles.label,
                {
                  color: focused ? theme.colors.goldLight : theme.colors.tabInactive,
                  fontFamily: focused ? font('bold') : font('semibold'),
                },
              ]}
            >
              {labels[tab]}
            </Text>
          </Pressy>
        );
      })}
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    bar: {
      flexDirection: 'row',
      backgroundColor: theme.colors.tabBar,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
      paddingTop: 8,
    },
    item: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      height: 52,
    },
    iconWrap: {
      width: 40,
      height: 30,
      borderRadius: theme.radius.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    iconWrapActive: {
      backgroundColor: 'rgba(212, 168, 84, 0.14)',
    },
    label: {
      fontSize: 11,
      marginTop: 3,
      lineHeight: 15,
    },
    badge: {
      position: 'absolute',
      top: -4,
      right: -6,
      minWidth: 17,
      height: 17,
      borderRadius: 9,
      backgroundColor: theme.colors.danger,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 3,
      borderWidth: 1.5,
      borderColor: theme.colors.tabBar,
    },
    badgeText: {
      fontSize: 9.5,
      fontFamily: font('bold'),
      color: '#fff',
    },
  });

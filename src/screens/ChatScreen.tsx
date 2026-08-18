/**
 * ChatScreen — in-room chat. Appears as its own tab once you're in a
 * room (lobby or game): message history, a quick emote/taunt row, and a
 * text input. Emotes/taunts sent here also float over the sender's seat
 * on the game table.
 */
import React, { useMemo, useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown, FadeInUp, LinearTransition } from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Theme, font, roleColors, useStyles, useTheme } from '../theme';
import { Pressy } from '../components/Pressy';
import { Avatar } from '../components/Avatar';
import { useRoom } from '../net/RoomContext';
import { useSettings } from '../settings';
import { t, TKey, isRTL } from '../i18n';
import * as haptics from '../haptics';
import * as sound from '../sound';

export const EMOTES = ['😂', '😏', '🤔', '😱', '🔥', '👑', '💀', '🫣'];
export const TAUNT_KEYS: TKey[] = ['tauntBluff', 'tauntComeAtMe', 'tauntNice', 'tauntScared'];

export function ChatScreen() {
  const theme = useTheme();
  const styles = useStyles(makeStyles);
  const { lang } = useSettings();
  const { room, myId, sendChat } = useRoom();
  const [text, setText] = useState('');
  const listRef = useRef<FlatList>(null);
  void lang;
  const rtl = isRTL();

  const me = room?.roster.find((p) => p.id === myId);
  const messages = useMemo(() => [...(room?.chat ?? [])].reverse(), [room?.chat]);

  if (!room) {
    return (
      <SafeAreaView style={styles.root} edges={['top']}>
        <View style={styles.empty}>
          <Ionicons name="chatbubbles-outline" size={40} color={theme.colors.inkFaint} />
          <Text style={styles.emptyText}>{t('chatJoinFirst')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const send = (k: 'text' | 'emote' | 'taunt', v: string) => {
    if (!v.trim()) return;
    haptics.selection();
    sound.play('tap');
    sendChat({ n: me?.name ?? '?', a: me?.avatar, k, v: v.trim() });
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Text style={[styles.title, rtl && styles.rtlText]}>{t('chatTitle')}</Text>
        <Animated.FlatList
          ref={listRef}
          inverted
          data={messages}
          keyExtractor={(m) => `${m.u}-${m.ts}`}
          contentContainerStyle={styles.list}
          itemLayoutAnimation={LinearTransition.springify().damping(18).stiffness(160)}
          renderItem={({ item, index }) => {
            const mine = item.u === myId;
            const isEmote = item.k === 'emote';
            // Inverted list: index 0 is the newest — give it a slide-in;
            // older rows shift down via the layout transition.
            return (
              <Animated.View
                entering={
                  index === 0
                    ? FadeInUp.springify().damping(16).stiffness(150).mass(0.7)
                    : FadeInDown.duration(200)
                }
                style={[
                  styles.msgRow,
                  (rtl ? !mine : mine) && styles.msgRowMine,
                ]}
              >
                {!mine ? <Avatar id={item.a} size={28} ring={1.5} /> : null}
                <View
                  style={[
                    styles.bubble,
                    mine && styles.bubbleMine,
                    isEmote && styles.bubbleEmote,
                  ]}
                >
                  {!mine ? (
                    <Text style={[styles.msgName, rtl && styles.rtlText]}>{item.n}</Text>
                  ) : null}
                  <Text style={[isEmote ? styles.emoteText : styles.msgText, rtl && !isEmote && styles.rtlText]}>
                    {item.k === 'taunt' ? t(item.v as TKey) : item.v}
                  </Text>
                </View>
              </Animated.View>
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyChat}>
              <Text style={styles.emptyText}>{t('chatEmpty')}</Text>
            </View>
          }
        />
        {/* Quick emotes + taunts */}
        <View style={[styles.quickRow, rtl && styles.rowReverse]}>
          {EMOTES.map((e) => (
            <Pressy key={e} scaleTo={0.8} style={styles.quickEmote} onPress={() => send('emote', e)}>
              <Text style={styles.quickEmoteText}>{e}</Text>
            </Pressy>
          ))}
        </View>
        <View style={[styles.quickRow, rtl && styles.rowReverse]}>
          {TAUNT_KEYS.map((k) => (
            <Pressy key={k} scaleTo={0.92} style={styles.tauntChip} onPress={() => send('taunt', k)}>
              <Text style={styles.tauntText} numberOfLines={1}>
                {t(k)}
              </Text>
            </Pressy>
          ))}
        </View>
        {/* Input */}
        <View style={[styles.inputRow, rtl && styles.rowReverse]}>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder={t('chatPlaceholder')}
            placeholderTextColor={theme.colors.inkFaint}
            style={[styles.input, rtl && styles.rtlText]}
            maxLength={140}
            returnKeyType="send"
            onSubmitEditing={() => {
              send('text', text);
              setText('');
            }}
          />
          <Pressy
            scaleTo={0.88}
            style={styles.sendBtn}
            onPress={() => {
              send('text', text);
              setText('');
            }}
          >
            <Ionicons
              name={rtl ? 'send' : 'send'}
              size={18}
              color={theme.colors.inkOnGold}
              style={rtl ? { transform: [{ scaleX: -1 }] } : undefined}
            />
          </Pressy>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    rtlText: { textAlign: 'right', writingDirection: 'rtl' },
    rowReverse: { flexDirection: 'row-reverse' },
    title: {
      fontSize: 20,
      fontFamily: font('black'),
      color: theme.colors.ink,
      paddingHorizontal: 20,
      paddingTop: 10,
      paddingBottom: 4,
    },
    empty: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
      padding: 40,
    },
    emptyChat: {
      padding: 30,
      alignItems: 'center',
      transform: [{ scaleY: -1 }], // inverted list flips children
    },
    emptyText: {
      fontSize: 13.5,
      fontFamily: font('semibold'),
      color: theme.colors.inkFaint,
      textAlign: 'center',
    },
    list: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      gap: 8,
    },
    msgRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: 8,
      maxWidth: '85%',
      alignSelf: 'flex-start',
    },
    msgRowMine: {
      alignSelf: 'flex-end',
      flexDirection: 'row-reverse',
    },
    bubble: {
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: 14,
      paddingHorizontal: 12,
      paddingVertical: 7,
    },
    bubbleMine: {
      backgroundColor: 'rgba(212, 168, 84, 0.13)',
      borderColor: theme.colors.goldDark,
    },
    bubbleEmote: {
      backgroundColor: 'transparent',
      borderColor: 'transparent',
      paddingVertical: 0,
    },
    msgName: {
      fontSize: 10.5,
      fontFamily: font('bold'),
      color: theme.colors.goldLight,
      marginBottom: 1,
    },
    msgText: {
      fontSize: 14,
      lineHeight: 20,
      fontFamily: font('semibold'),
      color: theme.colors.ink,
    },
    emoteText: {
      fontSize: 30,
      lineHeight: 36,
    },
    quickRow: {
      flexDirection: 'row',
      gap: 6,
      paddingHorizontal: 16,
      paddingVertical: 4,
    },
    quickEmote: {
      flex: 1,
      height: 38,
      borderRadius: theme.radius.sm,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    quickEmoteText: {
      fontSize: 19,
    },
    tauntChip: {
      flex: 1,
      height: 34,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.colors.surfaceElevated,
      borderWidth: 1,
      borderColor: theme.colors.borderBright,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 6,
    },
    tauntText: {
      fontSize: 10.5,
      fontFamily: font('bold'),
      color: theme.colors.inkSoft,
    },
    inputRow: {
      flexDirection: 'row',
      gap: 8,
      paddingHorizontal: 16,
      paddingTop: 6,
      paddingBottom: 10,
    },
    input: {
      flex: 1,
      height: 44,
      borderRadius: theme.radius.md,
      borderWidth: 1.5,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surfaceElevated,
      color: theme.colors.ink,
      paddingHorizontal: 14,
      fontFamily: font('semibold'),
      fontSize: 14,
    },
    sendBtn: {
      width: 44,
      height: 44,
      borderRadius: theme.radius.md,
      backgroundColor: theme.colors.gold,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });

/**
 * MessageSheet — bottom sheet for notices and confirmations (spring up,
 * fade backdrop, swipe or tap to dismiss). Same interaction language as
 * the game's other sheets; replaces native dialogs.
 */
import React, { useEffect, useState } from 'react';
import { Dimensions, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressy } from './Pressy';
import { Theme, font, useStyles, useTheme } from '../theme';
import { t } from '../i18n';

const { height: SCREEN_H } = Dimensions.get('window');
const DISMISS_THRESHOLD = 100;

export interface SheetMessage {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
  actionLabel?: string;
  onAction?: () => void;
  /** Danger styling for the primary action (e.g. leave game). */
  destructive?: boolean;
}

interface Props {
  message: SheetMessage | null;
  onClose: () => void;
}

export function MessageSheet({ message, onClose }: Props) {
  const theme = useTheme();
  const styles = useStyles(makeStyles);
  const [showing, setShowing] = useState(false);
  const [content, setContent] = useState<SheetMessage | null>(null);
  const translateY = useSharedValue(SCREEN_H);
  const backdropOpacity = useSharedValue(0);

  useEffect(() => {
    if (message) {
      setContent(message);
      setShowing(true);
      translateY.value = SCREEN_H;
      backdropOpacity.value = 0;
      requestAnimationFrame(() => {
        translateY.value = withSpring(0, { damping: 22, stiffness: 200, mass: 0.7 });
        backdropOpacity.value = withTiming(1, { duration: 220 });
      });
    }
  }, [message, translateY, backdropOpacity]);

  const afterExit = () => {
    setShowing(false);
    setContent(null);
    onClose();
  };

  const dismiss = () => {
    translateY.value = withTiming(SCREEN_H, { duration: 240 });
    backdropOpacity.value = withTiming(0, { duration: 200 }, (finished) => {
      if (finished) runOnJS(afterExit)();
    });
  };

  const pan = Gesture.Pan()
    .activeOffsetY(14)
    .failOffsetX([-16, 16])
    .onUpdate((e) => {
      if (e.translationY > 0) {
        translateY.value = e.translationY;
        backdropOpacity.value = 1 - Math.min(e.translationY / 400, 0.7);
      }
    })
    .onEnd((e) => {
      if (e.translationY > DISMISS_THRESHOLD || e.velocityY > 800) {
        translateY.value = withTiming(SCREEN_H, { duration: 220 });
        backdropOpacity.value = withTiming(0, { duration: 200 }, (finished) => {
          if (finished) runOnJS(afterExit)();
        });
      } else {
        translateY.value = withSpring(0, { damping: 22, stiffness: 220 });
        backdropOpacity.value = withSpring(1);
      }
    });

  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));
  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdropOpacity.value }));

  return (
    <Modal transparent visible={showing} onRequestClose={dismiss} animationType="none" statusBarTranslucent>
      {content ? (
        <GestureHandlerRootView style={styles.root}>
          <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, backdropStyle]}>
            <Pressable style={StyleSheet.absoluteFill} onPress={dismiss} />
          </Animated.View>

          <Animated.View style={[styles.sheet, sheetStyle]}>
            <SafeAreaView edges={['bottom']}>
              <GestureDetector gesture={pan}>
                <View>
                  <View style={styles.handleRow}>
                    <View style={styles.handle} />
                  </View>
                  <View style={styles.body}>
                    <View style={styles.iconCircle}>
                      <Ionicons
                        name={content.icon ?? 'information-circle'}
                        size={34}
                        color={content.destructive ? theme.colors.danger : theme.colors.gold}
                      />
                    </View>
                    <Text style={styles.title}>{content.title}</Text>
                    <Text style={styles.text}>{content.body}</Text>

                    {content.actionLabel ? (
                      <Pressy
                        scaleTo={0.96}
                        style={[styles.primaryBtn, content.destructive && styles.dangerBtn]}
                        onPress={() => {
                          content.onAction?.();
                          dismiss();
                        }}
                      >
                        <Text style={styles.primaryBtnText}>{content.actionLabel}</Text>
                      </Pressy>
                    ) : null}
                    <Pressy scaleTo={0.96} style={styles.secondaryBtn} onPress={dismiss}>
                      <Text style={styles.secondaryBtnText}>
                        {content.actionLabel ? t('cancel') : t('ok')}
                      </Text>
                    </Pressy>
                  </View>
                </View>
              </GestureDetector>
            </SafeAreaView>
          </Animated.View>
        </GestureHandlerRootView>
      ) : null}
    </Modal>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    root: {
      flex: 1,
      justifyContent: 'flex-end',
    },
    backdrop: {
      backgroundColor: 'rgba(0,0,0,0.55)',
    },
    sheet: {
      backgroundColor: theme.colors.surface,
      borderTopLeftRadius: theme.radius.xl,
      borderTopRightRadius: theme.radius.xl,
      borderTopWidth: 1,
      borderColor: theme.colors.border,
    },
    handleRow: {
      alignItems: 'center',
      paddingTop: 10,
      paddingBottom: 6,
    },
    handle: {
      width: 44,
      height: 5,
      borderRadius: 3,
      backgroundColor: theme.colors.borderBright,
    },
    body: {
      paddingHorizontal: 24,
      paddingTop: 8,
      paddingBottom: 20,
      alignItems: 'center',
      gap: 6,
    },
    iconCircle: {
      width: 68,
      height: 68,
      borderRadius: 34,
      backgroundColor: theme.colors.surfaceHover,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 6,
    },
    title: {
      fontSize: 18,
      fontFamily: font('black'),
      color: theme.colors.ink,
      textAlign: 'center',
    },
    text: {
      fontSize: 14,
      lineHeight: 23,
      fontFamily: font('semibold'),
      color: theme.colors.inkSoft,
      textAlign: 'center',
    },
    primaryBtn: {
      alignSelf: 'stretch',
      height: 50,
      borderRadius: theme.radius.md,
      backgroundColor: theme.colors.gold,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 12,
    },
    dangerBtn: {
      backgroundColor: theme.colors.danger,
    },
    primaryBtnText: {
      fontSize: 15,
      fontFamily: font('bold'),
      color: theme.colors.inkOnGold,
    },
    secondaryBtn: {
      alignSelf: 'stretch',
      height: 46,
      borderRadius: theme.radius.md,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 4,
    },
    secondaryBtnText: {
      fontSize: 14,
      fontFamily: font('bold'),
      color: theme.colors.inkSoft,
    },
  });

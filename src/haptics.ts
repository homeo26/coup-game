/**
 * Haptics helpers — every call checks the user's haptics setting first,
 * so a single toggle silences all tactile feedback app-wide.
 */
import * as Haptics from 'expo-haptics';
import { getSettings } from './settings';

const on = () => getSettings().haptics;

export const light = () => {
  if (on()) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
};
export const medium = () => {
  if (on()) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
};
export const selection = () => {
  if (on()) Haptics.selectionAsync().catch(() => {});
};
export const success = () => {
  if (on()) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
};

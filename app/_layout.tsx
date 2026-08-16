import React, { useEffect } from 'react';
import { I18nManager, LogBox, View } from 'react-native';

// The Firestore web SDK logs WebChannel transport noise on RN; the LogBox
// pill it spawns overlays (and steals taps from) the bottom action area.
// Reanimated's layout-animation advisory is likewise dev-only noise.
LogBox.ignoreLogs([/WebChannelConnection/, /@firebase\/firestore/, /\[Reanimated\]/]);
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import {
  useFonts,
  Cairo_400Regular,
  Cairo_600SemiBold,
  Cairo_700Bold,
  Cairo_900Black,
} from '@expo-google-fonts/cairo';
import {
  Poppins_400Regular,
  Poppins_600SemiBold,
  Poppins_700Bold,
  Poppins_900Black,
} from '@expo-google-fonts/poppins';
import { theme } from '../src/theme';
import { SettingsProvider } from '../src/settings';
import { RoomProvider } from '../src/net/RoomContext';

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Cairo_400Regular,
    Cairo_600SemiBold,
    Cairo_700Bold,
    Cairo_900Black,
    Poppins_400Regular,
    Poppins_600SemiBold,
    Poppins_700Bold,
    Poppins_900Black,
  });

  useEffect(() => {
    // Keep native direction pinned to LTR — RTL is handled manually per
    // component (row-reverse / textAlign) driven by the app language.
    if (I18nManager.isRTL) {
      I18nManager.allowRTL(false);
      I18nManager.forceRTL(false);
    }
  }, []);

  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: theme.colors.background }} />;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <KeyboardProvider>
        <SettingsProvider>
          <RoomProvider>
            <StatusBar style="light" />
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: theme.colors.background },
              }}
            >
              <Stack.Screen name="index" />
            </Stack>
          </RoomProvider>
        </SettingsProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}

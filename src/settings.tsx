/**
 * App settings — language, haptics, and the player's display name,
 * persisted to AsyncStorage and exposed app-wide through a context.
 * Language changes re-render the whole tree via the context value.
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Lang, getLang, setLang } from './i18n';

export interface Settings {
  lang: Lang;
  haptics: boolean;
  sounds: boolean;
  music: boolean;
  /** Show a subtle sign when an offline bot is bluffing. */
  tells: boolean;
  /** Seconds each decision gets in an offline game (0 = no clock). */
  turnTimer: number;
  /** Which table the game is played on (src/skins.ts). */
  skin: string;
  /** Character portrait used as the player's avatar. */
  avatar: string;
  playerName: string;
}

const ANIMALS = ['bear','panda','owl','penguin','monkey','elephant','frog','pig','rabbit','duck','gorilla','giraffe'];

const DEFAULTS: Settings = {
  lang: getLang(),
  haptics: true,
  sounds: true,
  music: true,
  tells: false,
  turnTimer: 30,
  skin: 'felt',
  avatar: ANIMALS[Math.floor(Math.random() * ANIMALS.length)],
  playerName: '',
};

const STORAGE_KEY = 'coup.settings.v1';

interface SettingsState extends Settings {
  hydrated: boolean;
  set: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
}

const SettingsContext = createContext<SettingsState>({
  ...DEFAULTS,
  hydrated: false,
  set: () => {},
});

// Module-level mirror so non-React code (haptics helper) can read settings.
let current: Settings = { ...DEFAULTS };
export function getSettings(): Settings {
  return current;
}

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw) {
          const loaded = { ...DEFAULTS, ...JSON.parse(raw) } as Settings;
          setSettings(loaded);
          current = loaded;
          setLang(loaded.lang);
        }
      })
      .catch(() => {})
      .finally(() => setHydrated(true));
  }, []);

  const set = useCallback(<K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettings((prev) => {
      const next = { ...prev, [key]: value };
      current = next;
      if (key === 'lang') setLang(next.lang);
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const value = useMemo(() => ({ ...settings, hydrated, set }), [settings, hydrated, set]);
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export const useSettings = () => useContext(SettingsContext);

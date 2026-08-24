/**
 * Background music — two scenes that cross-fade:
 *   menu  "The Old Tower Inn" by Alexandr Zhelanov (opengameart, CC0)
 *   table "Backup Plan" by Zane Little Music (opengameart, CC0) — the
 *         driving heist track that plays while a game is in progress
 *
 * Players live on a global so a module re-evaluation (Fast Refresh, or a
 * double import) can't leave a second loop playing underneath.
 */
import { AudioPlayer, createAudioPlayer } from 'expo-audio';
import { ensureAudioMode } from './sound';

export type Scene = 'menu' | 'table';

const SOURCES: Record<Scene, number> = {
  menu: require('../assets/sounds/music-loop.m4a'),
  table: require('../assets/sounds/music-game.m4a'),
};
const PEAK: Record<Scene, number> = { menu: 0.5, table: 0.42 };
const FADE_MS = 700;

interface Store {
  players?: Partial<Record<Scene, AudioPlayer>>;
  scene?: Scene;
  timers?: ReturnType<typeof setInterval>[];
}
const g = globalThis as unknown as { __coupMusic?: Store };
const store: Store = (g.__coupMusic = g.__coupMusic ?? {});
store.players = store.players ?? {};
store.timers = store.timers ?? [];

let enabled = false;

function player(scene: Scene): AudioPlayer | null {
  try {
    let p = store.players![scene];
    if (!p) {
      p = createAudioPlayer(SOURCES[scene]);
      p.loop = true;
      p.volume = 0;
      store.players![scene] = p;
    }
    return p;
  } catch {
    return null;
  }
}

/** Ramp a player's volume, starting or pausing it around the fade. */
function fade(scene: Scene, to: number) {
  const p = player(scene);
  if (!p) return;
  try {
    if (to > 0 && !p.playing) p.play();
  } catch {}
  const steps = 14;
  const from = p.volume ?? 0;
  let i = 0;
  const id = setInterval(() => {
    i += 1;
    const v = from + ((to - from) * i) / steps;
    try {
      p.volume = Math.max(0, Math.min(1, v));
      if (i >= steps) {
        clearInterval(id);
        if (to === 0) p.pause();
      }
    } catch {
      clearInterval(id);
    }
  }, FADE_MS / steps);
  store.timers!.push(id);
}

/** Switch scenes (no-op when already there). Silent unless start() ran. */
export function setScene(scene: Scene) {
  if (store.scene === scene) return;
  const previous = store.scene;
  store.scene = scene;
  if (!enabled) return;
  if (previous) fade(previous, 0);
  fade(scene, PEAK[scene]);
}

export function start(scene: Scene = store.scene ?? 'menu') {
  try {
    ensureAudioMode();
    enabled = true;
    store.scene = scene;
    (Object.keys(SOURCES) as Scene[]).forEach((s) => {
      if (s !== scene) fade(s, 0);
    });
    fade(scene, PEAK[scene]);
  } catch {
    // music must never break the app
  }
}

/**
 * Keep the current scene alive: audio focus changes, codec pressure or a
 * device quirk can silently stop it, so callers can poll this cheaply.
 */
export function ensurePlaying() {
  if (!enabled || !store.scene) return;
  const p = store.players![store.scene];
  try {
    if (p && !p.playing) {
      p.volume = PEAK[store.scene];
      p.play();
    }
  } catch {}
}

export function stop() {
  enabled = false;
  try {
    (Object.keys(SOURCES) as Scene[]).forEach((s) => {
      const p = store.players![s];
      if (p?.playing) p.pause();
    });
  } catch {}
}

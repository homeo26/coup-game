/**
 * Sound effects — every call checks the user's sound setting first, so a
 * single toggle silences the whole table. Audio: Kenney "Casino Audio" +
 * "Interface Sounds" packs (CC0), converted to m4a for iOS + Android.
 *
 * Uses expo-audio's imperative API: one AudioPlayer per effect, created
 * lazily on first play and reused (seekTo(0) restarts overlapping cues).
 */
import { AudioPlayer, createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { getSettings } from './settings';

const SOURCES = {
  turn: require('../assets/sounds/turn.m4a'), // it's your move
  coins: require('../assets/sounds/coins.m4a'), // income / tax / steal gain
  pay: require('../assets/sounds/pay.m4a'), // fee spent (coup, assassin)
  card: require('../assets/sounds/card.m4a'), // card dealt / kept
  flip: require('../assets/sounds/flip.m4a'), // exchange / reveal
  shuffle: require('../assets/sounds/shuffle.m4a'), // new game / court reshuffle
  claim: require('../assets/sounds/claim.m4a'), // action declared
  challenge: require('../assets/sounds/challenge.m4a'), // challenge thrown
  block: require('../assets/sounds/block.m4a'), // block declared
  fail: require('../assets/sounds/fail.m4a'), // bluff caught / lost card
  kill: require('../assets/sounds/kill.m4a'), // coup / assassination lands
  win: require('../assets/sounds/win.m4a'), // victory
  lose: require('../assets/sounds/lose.m4a'), // eliminated
  tap: require('../assets/sounds/tap.m4a'), // confirm press
  chat: require('../assets/sounds/chat.m4a'), // incoming chat message
  // Character voice stingers (Piper TTS, processed): played when the
  // character is claimed for an action (or the Contessa blocks).
  voiceDuke: require('../assets/sounds/roles/duke.m4a'),
  voiceAssassin: require('../assets/sounds/roles/assassin.m4a'),
  voiceCaptain: require('../assets/sounds/roles/captain.m4a'),
  voiceAmbassador: require('../assets/sounds/roles/ambassador.m4a'),
  voiceContessa: require('../assets/sounds/roles/contessa.m4a'),
} as const;

/** Voice stinger for a claimed character, if we have one. */
export const ROLE_VOICE: Record<string, SoundKey> = {
  duke: 'voiceDuke',
  assassin: 'voiceAssassin',
  captain: 'voiceCaptain',
  ambassador: 'voiceAmbassador',
  contessa: 'voiceContessa',
};

export type SoundKey = keyof typeof SOURCES;

/**
 * Players are created lazily and capped: Android only allows a limited
 * number of concurrent media codecs, and holding one per cue (times a
 * pool) starves everything else — including the music loop. We keep a
 * small LRU of pools and release the oldest when the cap is reached.
 *
 * Short, frequently repeated cues get two players so they can overlap;
 * long ones (voices, music-adjacent stingers) get one.
 */
const pools = new Map<SoundKey, { players: AudioPlayer[]; next: number }>();
const lru: SoundKey[] = [];
const MAX_POOLS = 6;
const DOUBLE: SoundKey[] = ['tap', 'coins', 'card', 'chat'];
let audioModeSet = false;

function makePlayer(key: SoundKey): AudioPlayer {
  const p = createAudioPlayer(SOURCES[key]);
  p.volume = 0.85;
  return p;
}

function releasePool(key: SoundKey) {
  const entry = pools.get(key);
  pools.delete(key);
  const i = lru.indexOf(key);
  if (i >= 0) lru.splice(i, 1);
  entry?.players.forEach((p) => {
    try {
      p.pause();
      (p as unknown as { remove?: () => void }).remove?.();
    } catch {}
  });
}

function pool(key: SoundKey) {
  let entry = pools.get(key);
  if (!entry) {
    while (lru.length >= MAX_POOLS) releasePool(lru[0]);
    const size = DOUBLE.includes(key) ? 2 : 1;
    entry = { players: Array.from({ length: size }, () => makePlayer(key)), next: 0 };
    pools.set(key, entry);
  }
  const i = lru.indexOf(key);
  if (i >= 0) lru.splice(i, 1);
  lru.push(key);
  return entry;
}

/** Start a player from the beginning, retrying if the device swallows it. */
function fire(key: SoundKey, p: AudioPlayer, attempt = 0) {
  try {
    try {
      p.seekTo(0);
    } catch {}
    p.volume = 0.85;
    p.play();
    setTimeout(() => {
      try {
        if (p.playing) return;
        if (attempt === 0) {
          // second chance once the source has had time to load
          fire(key, p, 1);
        } else {
          // give up on this instance and rebuild the pool for next time
          releasePool(key);
        }
      } catch {
        releasePool(key);
      }
    }, 110);
  } catch {
    releasePool(key);
  }
}

export function ensureAudioMode() {
  if (audioModeSet) return;
  audioModeSet = true;
  // Games play their SFX even with the iOS mute switch on (the in-app
  // toggles are the mute control); mix with other apps' audio so we
  // never fight for focus on picky Android devices.
  setAudioModeAsync({
    playsInSilentMode: true,
    interruptionMode: 'mixWithOthers',
    interruptionModeAndroid: 'duckOthers',
    shouldPlayInBackground: false,
  }).catch(() => {
    audioModeSet = false; // retry on the next play
  });
}

/**
 * Prime the audio engine: set the audio mode and create every player up
 * front, so the first cue of a session can't be swallowed while a source
 * is still loading (a common failure on slower/older devices).
 */
export function warmup() {
  try {
    ensureAudioMode();
    // only the cues that fire first in a session — everything else is
    // built on demand, so codecs stay available for the music loop.
    (['tap', 'coins'] as SoundKey[]).forEach((key) => {
      try {
        pool(key);
      } catch {}
    });
  } catch {}
}

export function play(key: SoundKey) {
  if (!getSettings().sounds) return;
  try {
    ensureAudioMode();
    const entry = pool(key);
    const p = entry.players[entry.next % entry.players.length];
    entry.next += 1;
    fire(key, p);
  } catch {
    releasePool(key);
  }
}

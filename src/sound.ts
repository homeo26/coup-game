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

const players = new Map<SoundKey, AudioPlayer>();
let audioModeSet = false;

function ensureAudioMode() {
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

export function play(key: SoundKey) {
  if (!getSettings().sounds) return;
  try {
    ensureAudioMode();
    let p = players.get(key);
    if (!p) {
      p = createAudioPlayer(SOURCES[key]);
      p.volume = 0.8;
      players.set(key, p);
      p.play();
      return; // fresh player starts from 0 — no seek needed
    }
    // Replaying: rewind defensively (some devices reject seek pre-load)
    try {
      p.seekTo(0);
    } catch {}
    p.play();
  } catch {
    // A broken player must never break the game — drop and rebuild next time.
    players.delete(key);
  }
}

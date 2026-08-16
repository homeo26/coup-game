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
} as const;

export type SoundKey = keyof typeof SOURCES;

const players = new Map<SoundKey, AudioPlayer>();
let audioModeSet = false;

export function play(key: SoundKey) {
  if (!getSettings().sounds) return;
  try {
    if (!audioModeSet) {
      audioModeSet = true;
      // Mix with background music, respect the mute switch on iOS.
      setAudioModeAsync({ playsInSilentMode: false, interruptionModeAndroid: 'duckOthers' }).catch(
        () => {},
      );
    }
    let p = players.get(key);
    if (!p) {
      p = createAudioPlayer(SOURCES[key]);
      p.volume = 0.8;
      players.set(key, p);
    }
    p.seekTo(0);
    p.play();
  } catch {
    // Sound must never break the game.
  }
}

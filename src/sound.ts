/**
 * Sound effects — every call checks the user's sound setting first, so a
 * single toggle silences the whole table. Audio: Kenney "Casino Audio" +
 * "Interface Sounds" packs (CC0), converted to m4a for iOS + Android.
 *
 * Uses expo-audio's imperative API: one AudioPlayer per effect, created
 * lazily on first play and reused (seekTo(0) restarts overlapping cues).
 */
import { AudioPlayer, createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { getLang } from './i18n';
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
  select: require('../assets/sounds/select.m4a'), // action row picked
  cancel: require('../assets/sounds/cancel.m4a'), // selection dropped
  sheet: require('../assets/sounds/sheet.m4a'), // response sheet rises
  coinLoss: require('../assets/sounds/coinLoss.m4a'), // coins taken from me
  coupHit: require('../assets/sounds/coupHit.m4a'), // a coup lands
  reveal: require('../assets/sounds/reveal.m4a'), // a card turned face up
  join: require('../assets/sounds/join.m4a'), // player joined the lobby
  error: require('../assets/sounds/error.m4a'), // rules rejected the move
  emote: require('../assets/sounds/emote.m4a'), // emote / taunt
  // Character voice stingers (Piper TTS, processed): played when the
  // character is claimed for an action (or the Contessa blocks).
  voiceDuke: require('../assets/sounds/roles/duke.m4a'),
  voiceAssassin: require('../assets/sounds/roles/assassin.m4a'),
  voiceCaptain: require('../assets/sounds/roles/captain.m4a'),
  voiceAmbassador: require('../assets/sounds/roles/ambassador.m4a'),
  voiceContessa: require('../assets/sounds/roles/contessa.m4a'),
  // reaction barks: how a character takes a resolved challenge or a block
  voiceDukeGloat: require('../assets/sounds/roles/duke-gloat.m4a'),
  voiceDukeCaught: require('../assets/sounds/roles/duke-caught.m4a'),
  voiceDukeBlocked: require('../assets/sounds/roles/duke-blocked.m4a'),
  voiceAssassinGloat: require('../assets/sounds/roles/assassin-gloat.m4a'),
  voiceAssassinCaught: require('../assets/sounds/roles/assassin-caught.m4a'),
  voiceAssassinBlocked: require('../assets/sounds/roles/assassin-blocked.m4a'),
  voiceCaptainGloat: require('../assets/sounds/roles/captain-gloat.m4a'),
  voiceCaptainCaught: require('../assets/sounds/roles/captain-caught.m4a'),
  voiceCaptainBlocked: require('../assets/sounds/roles/captain-blocked.m4a'),
  voiceAmbassadorGloat: require('../assets/sounds/roles/ambassador-gloat.m4a'),
  voiceAmbassadorCaught: require('../assets/sounds/roles/ambassador-caught.m4a'),
  voiceAmbassadorBlocked: require('../assets/sounds/roles/ambassador-blocked.m4a'),
  voiceContessaGloat: require('../assets/sounds/roles/contessa-gloat.m4a'),
  voiceContessaCaught: require('../assets/sounds/roles/contessa-caught.m4a'),
  voiceContessaBlocked: require('../assets/sounds/roles/contessa-blocked.m4a'),
  // the same cast in Arabic (scripts/gen-voices.sh, Arabic pass)
  voiceDukeAr: require('../assets/sounds/roles/duke-ar.m4a'),
  voiceAssassinAr: require('../assets/sounds/roles/assassin-ar.m4a'),
  voiceCaptainAr: require('../assets/sounds/roles/captain-ar.m4a'),
  voiceAmbassadorAr: require('../assets/sounds/roles/ambassador-ar.m4a'),
  voiceContessaAr: require('../assets/sounds/roles/contessa-ar.m4a'),
  voiceDukeGloatAr: require('../assets/sounds/roles/duke-gloat-ar.m4a'),
  voiceDukeCaughtAr: require('../assets/sounds/roles/duke-caught-ar.m4a'),
  voiceDukeBlockedAr: require('../assets/sounds/roles/duke-blocked-ar.m4a'),
  voiceAssassinGloatAr: require('../assets/sounds/roles/assassin-gloat-ar.m4a'),
  voiceAssassinCaughtAr: require('../assets/sounds/roles/assassin-caught-ar.m4a'),
  voiceAssassinBlockedAr: require('../assets/sounds/roles/assassin-blocked-ar.m4a'),
  voiceCaptainGloatAr: require('../assets/sounds/roles/captain-gloat-ar.m4a'),
  voiceCaptainCaughtAr: require('../assets/sounds/roles/captain-caught-ar.m4a'),
  voiceCaptainBlockedAr: require('../assets/sounds/roles/captain-blocked-ar.m4a'),
  voiceAmbassadorGloatAr: require('../assets/sounds/roles/ambassador-gloat-ar.m4a'),
  voiceAmbassadorCaughtAr: require('../assets/sounds/roles/ambassador-caught-ar.m4a'),
  voiceAmbassadorBlockedAr: require('../assets/sounds/roles/ambassador-blocked-ar.m4a'),
  voiceContessaGloatAr: require('../assets/sounds/roles/contessa-gloat-ar.m4a'),
  voiceContessaCaughtAr: require('../assets/sounds/roles/contessa-caught-ar.m4a'),
  voiceContessaBlockedAr: require('../assets/sounds/roles/contessa-blocked-ar.m4a'),
} as const;

/** Voice stinger for a claimed character, if we have one. */
const ROLE_VOICE_EN: Record<string, SoundKey> = {
  duke: 'voiceDuke',
  assassin: 'voiceAssassin',
  captain: 'voiceCaptain',
  ambassador: 'voiceAmbassador',
  contessa: 'voiceContessa',
};

/** Reaction barks per character: proven claim, caught bluff, blocked action. */
const ROLE_REACTION_EN: Record<string, Record<ReactionKind, SoundKey>> = {
  duke: { gloat: 'voiceDukeGloat', caught: 'voiceDukeCaught', blocked: 'voiceDukeBlocked' },
  assassin: {
    gloat: 'voiceAssassinGloat',
    caught: 'voiceAssassinCaught',
    blocked: 'voiceAssassinBlocked',
  },
  captain: {
    gloat: 'voiceCaptainGloat',
    caught: 'voiceCaptainCaught',
    blocked: 'voiceCaptainBlocked',
  },
  ambassador: {
    gloat: 'voiceAmbassadorGloat',
    caught: 'voiceAmbassadorCaught',
    blocked: 'voiceAmbassadorBlocked',
  },
  contessa: {
    gloat: 'voiceContessaGloat',
    caught: 'voiceContessaCaught',
    blocked: 'voiceContessaBlocked',
  },
};

const ROLE_VOICE_AR: Record<string, SoundKey> = {
  duke: 'voiceDukeAr',
  assassin: 'voiceAssassinAr',
  captain: 'voiceCaptainAr',
  ambassador: 'voiceAmbassadorAr',
  contessa: 'voiceContessaAr',
};

const ROLE_REACTION_AR: Record<string, Record<ReactionKind, SoundKey>> = {
  duke: { gloat: 'voiceDukeGloatAr', caught: 'voiceDukeCaughtAr', blocked: 'voiceDukeBlockedAr' },
  assassin: { gloat: 'voiceAssassinGloatAr', caught: 'voiceAssassinCaughtAr', blocked: 'voiceAssassinBlockedAr' },
  captain: { gloat: 'voiceCaptainGloatAr', caught: 'voiceCaptainCaughtAr', blocked: 'voiceCaptainBlockedAr' },
  ambassador: { gloat: 'voiceAmbassadorGloatAr', caught: 'voiceAmbassadorCaughtAr', blocked: 'voiceAmbassadorBlockedAr' },
  contessa: { gloat: 'voiceContessaGloatAr', caught: 'voiceContessaCaughtAr', blocked: 'voiceContessaBlockedAr' },
};

export type ReactionKind = 'gloat' | 'caught' | 'blocked';

/**
 * The characters speak the player's language. Arabic has its own recordings;
 * anything else falls back to the English cast.
 */
export function roleVoice(role: string): SoundKey | null {
  const table = getLang() === 'ar' ? ROLE_VOICE_AR : ROLE_VOICE_EN;
  return table[role] ?? null;
}

export function roleReaction(role: string, kind: ReactionKind): SoundKey | null {
  const table = getLang() === 'ar' ? ROLE_REACTION_AR : ROLE_REACTION_EN;
  return table[role]?.[kind] ?? null;
}

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
const DOUBLE: SoundKey[] = ['tap', 'coins', 'card', 'select'];
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

/**
 * Background table music — a quiet medieval inn loop that plays while
 * you're in a room. Track: "The Old Tower Inn" by Alexandr Zhelanov
 * (opengameart.org, CC0). Controlled by the Music toggle in settings.
 */
import { AudioPlayer, createAudioPlayer } from 'expo-audio';
import { ensureAudioMode } from './sound';

let player: AudioPlayer | null = null;

export function start() {
  try {
    ensureAudioMode();
    if (!player) {
      player = createAudioPlayer(require('../assets/sounds/music-loop.m4a'));
      player.loop = true;
      player.volume = 0.55;
    }
    if (!player.playing) {
      player.play();
      const p = player;
      setTimeout(() => {
        try {
          if (!p.playing) p.play();
        } catch {}
      }, 150);
    }
  } catch {
    // music must never break the app
  }
}

export function stop() {
  try {
    if (player?.playing) player.pause();
  } catch {}
}

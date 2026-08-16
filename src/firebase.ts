/**
 * Firebase — Firestore only (web SDK). Rooms live in the `coup_rooms`
 * collection of the dedicated `coup-game-rooms` project (its own data
 * store, fully separate from the Lawazem apps).
 */
import { initializeApp } from 'firebase/app';
import { connectFirestoreEmulator, getFirestore, initializeFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyDqPtVwQjzmchGrPe5rqM8AMSURWdoHzb4',
  authDomain: 'coup-game-rooms.firebaseapp.com',
  projectId: 'coup-game-rooms',
  storageBucket: 'coup-game-rooms.firebasestorage.app',
  messagingSenderId: '902436972116',
  appId: '1:902436972116:web:1e2c2588fe8230c553efc1',
};

export const app = initializeApp(firebaseConfig);
// React Native's fetch streams don't fully support WebChannel — let the
// SDK fall back to long polling instead of spamming transport errors.
// (getFirestore fallback keeps Fast Refresh from re-initializing.)
export const db = (() => {
  try {
    return initializeFirestore(app, { experimentalAutoDetectLongPolling: true });
  } catch {
    return getFirestore(app);
  }
})();

// Local development: point at the Firestore emulator when the bundle is
// built with EXPO_PUBLIC_FIRESTORE_EMULATOR=host:port (never set in
// release builds).
const emu = process.env.EXPO_PUBLIC_FIRESTORE_EMULATOR;
if (emu) {
  const [host, port] = emu.split(':');
  connectFirestoreEmulator(db, host, parseInt(port, 10));
}

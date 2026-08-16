/**
 * Multiplayer rooms — one Firestore doc per room in `coup_rooms/{code}`.
 *
 * The whole GameState is stored as a JSON string (`gameJson`): it dodges
 * Firestore's nested-array constraints entirely and keeps reads/writes
 * atomic. Every move runs in a transaction: read latest doc → apply the
 * pure reducer → write the new state. Concurrent movers simply retry and
 * the second one's move validates against the fresh state (usually
 * becoming a harmless no-op error like "no response owed").
 *
 * Identity: a stable per-install id in AsyncStorage — no accounts.
 * Reconnect: the active room code is persisted; on relaunch we resume
 * the live listener and the player picks up where they left off.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '../firebase';
import { apply, newGame, MAX_PLAYERS } from '../engine/engine';
import { GameState, Move } from '../engine/types';

export interface RoomPlayer {
  id: string;
  name: string;
  /** Character portrait used as this player's avatar. */
  avatar?: string;
}

export interface ChatMsg {
  /** Sender id + name + avatar (denormalized so history survives leaves). */
  u: string;
  n: string;
  a?: string;
  /** 'text' = typed message, 'emote' = floating emoji, 'taunt' = canned line. */
  k: 'text' | 'emote' | 'taunt';
  v: string;
  ts: number;
}

/** Chat history kept on the doc — capped so the doc stays small. */
export const CHAT_CAP = 40;

export interface Room {
  code: string;
  hostId: string;
  status: 'lobby' | 'playing';
  roster: RoomPlayer[];
  chat: ChatMsg[];
  game: GameState | null;
}

const IDENTITY_KEY = 'coup.installId.v1';
const NAME_ROOM_KEY = 'coup.activeRoom.v1';
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // no I/O (lookalikes)

let cachedId: string | null = null;

/** Stable per-install player id. */
export async function getInstallId(): Promise<string> {
  if (cachedId) return cachedId;
  let id = await AsyncStorage.getItem(IDENTITY_KEY);
  if (!id) {
    id = Array.from({ length: 20 }, () =>
      'abcdefghijklmnopqrstuvwxyz0123456789'.charAt(Math.floor(Math.random() * 36)),
    ).join('');
    await AsyncStorage.setItem(IDENTITY_KEY, id);
  }
  cachedId = id;
  return id;
}

export async function saveActiveRoom(code: string | null): Promise<void> {
  if (code) await AsyncStorage.setItem(NAME_ROOM_KEY, code);
  else await AsyncStorage.removeItem(NAME_ROOM_KEY);
}

export async function getActiveRoom(): Promise<string | null> {
  return AsyncStorage.getItem(NAME_ROOM_KEY);
}

function roomRef(code: string) {
  return doc(db, 'coup_rooms', code);
}

function parseRoom(code: string, data: Record<string, unknown>): Room {
  return {
    code,
    hostId: data.hostId as string,
    status: data.status as Room['status'],
    roster: (data.roster as RoomPlayer[]) ?? [],
    chat: (data.chat as ChatMsg[]) ?? [],
    game: data.gameJson ? (JSON.parse(data.gameJson as string) as GameState) : null,
  };
}

function randomCode(): string {
  return Array.from({ length: 4 }, () =>
    CODE_ALPHABET.charAt(Math.floor(Math.random() * CODE_ALPHABET.length)),
  ).join('');
}

/** Create a room and become its host. Returns the room code. */
export async function createRoom(name: string, avatar?: string): Promise<string> {
  const id = await getInstallId();
  sweepStaleRooms(); // opportunistic GC, fire and forget
  for (let attempt = 0; attempt < 8; attempt++) {
    const code = randomCode();
    const ref = roomRef(code);
    const existing = await getDoc(ref);
    // A stale lobby (or finished game) can be replaced after 24h.
    const stale =
      existing.exists() &&
      Date.now() - ((existing.data()?.createdAtMs as number) ?? 0) > 24 * 3600 * 1000;
    if (existing.exists() && !stale) continue;
    await setDoc(ref, {
      hostId: id,
      status: 'lobby',
      roster: [{ id, name, ...(avatar ? { avatar } : {}) }],
      chat: [],
      gameJson: null,
      createdAt: serverTimestamp(),
      createdAtMs: Date.now(),
      updatedAt: serverTimestamp(),
    });
    await saveActiveRoom(code);
    return code;
  }
  throw new Error('could not allocate a room code');
}

/** Join an existing lobby by code. Throws i18n-key errors. */
export async function joinRoom(code: string, name: string, avatar?: string): Promise<void> {
  const id = await getInstallId();
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(roomRef(code));
    if (!snap.exists()) throw new Error('roomNotFound');
    const room = parseRoom(code, snap.data()!);
    const already = room.roster.some((p) => p.id === id);
    if (room.status !== 'lobby') {
      // Rejoining a game you're part of is fine (reconnect)
      if (already) {
        const left = ((snap.data()?.left as string[]) ?? []).filter((x) => x !== id);
        tx.update(roomRef(code), { left, updatedAt: serverTimestamp() });
        return;
      }
      throw new Error('roomStarted');
    }
    if (already) {
      // update name/avatar if changed
      const roster = room.roster.map((p) =>
        p.id === id ? { ...p, name, ...(avatar ? { avatar } : {}) } : p,
      );
      tx.update(roomRef(code), { roster, updatedAt: serverTimestamp() });
      return;
    }
    if (room.roster.length >= MAX_PLAYERS) throw new Error('roomFull');
    tx.update(roomRef(code), {
      roster: [...room.roster, { id, name, ...(avatar ? { avatar } : {}) }],
      updatedAt: serverTimestamp(),
    });
  });
  await saveActiveRoom(code);
}

/** Host starts the game from the lobby. */
export async function startGame(code: string): Promise<void> {
  const id = await getInstallId();
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(roomRef(code));
    if (!snap.exists()) throw new Error('roomNotFound');
    const room = parseRoom(code, snap.data()!);
    if (room.hostId !== id) throw new Error('not host');
    if (room.status !== 'lobby') return;
    const game = newGame(room.roster);
    tx.update(roomRef(code), {
      status: 'playing',
      gameJson: JSON.stringify(game),
      updatedAt: serverTimestamp(),
    });
  });
}

/** Apply an engine move transactionally. Resolves the engine error, if any. */
export async function commitMove(code: string, move: Move): Promise<string | null> {
  const id = await getInstallId();
  let engineError: string | null = null;
  await runTransaction(db, async (tx) => {
    engineError = null;
    const snap = await tx.get(roomRef(code));
    if (!snap.exists()) throw new Error('roomNotFound');
    const room = parseRoom(code, snap.data()!);
    if (!room.game) throw new Error('not playing');
    const result = apply(room.game, id, move);
    if (result.error) {
      engineError = result.error;
      return; // leave the doc untouched
    }
    tx.update(roomRef(code), {
      gameJson: JSON.stringify(result.state),
      updatedAt: serverTimestamp(),
    });
  });
  return engineError;
}

/** Leave: in lobby, drop from roster (host leaving deletes the room);
 *  in game, forfeit. The last participant to walk away deletes the doc
 *  — that is the garbage collector for finished/abandoned games. */
export async function leaveRoom(code: string): Promise<void> {
  const id = await getInstallId();
  try {
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(roomRef(code));
      if (!snap.exists()) return;
      const room = parseRoom(code, snap.data()!);
      if (room.status === 'lobby') {
        if (room.hostId === id) {
          tx.delete(roomRef(code));
        } else {
          tx.update(roomRef(code), {
            roster: room.roster.filter((p) => p.id !== id),
            updatedAt: serverTimestamp(),
          });
        }
        return;
      }
      const left: string[] = [...((snap.data()?.left as string[]) ?? [])];
      if (!left.includes(id)) left.push(id);
      if (room.roster.every((p) => left.includes(p.id))) {
        // Everyone is gone — reclaim the storage.
        tx.delete(roomRef(code));
        return;
      }
      let gameJson: string | null = null;
      if (room.game && room.game.phase !== 'game_over') {
        const result = apply(room.game, id, { type: 'forfeit' });
        if (!result.error) gameJson = JSON.stringify(result.state);
      }
      tx.update(roomRef(code), {
        left,
        ...(gameJson ? { gameJson } : {}),
        updatedAt: serverTimestamp(),
      });
    });
  } finally {
    await saveActiveRoom(null);
  }
}

/**
 * Best-effort sweep of rooms nobody bothered to leave: anything older
 * than 24h is fair game. Runs on room creation; failures are ignored
 * (another client may be sweeping the same doc).
 */
export async function sweepStaleRooms(): Promise<void> {
  try {
    const cutoff = Date.now() - 24 * 3600 * 1000;
    const stale = await getDocs(
      query(collection(db, 'coup_rooms'), where('createdAtMs', '<', cutoff), limit(10)),
    );
    await Promise.all(stale.docs.map((d) => deleteDoc(d.ref).catch(() => {})));
  } catch {
    // listing may be racing another sweep — never block room creation
  }
}

/** Host can reset a finished game back to a fresh one with the same roster. */
export async function playAgain(code: string): Promise<void> {
  const id = await getInstallId();
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(roomRef(code));
    if (!snap.exists()) throw new Error('roomNotFound');
    const room = parseRoom(code, snap.data()!);
    if (room.hostId !== id) throw new Error('not host');
    if (!room.game || room.game.phase !== 'game_over') return;
    // Keep only players who were in the previous game
    const game = newGame(room.roster);
    tx.update(roomRef(code), {
      gameJson: JSON.stringify(game),
      left: [],
      updatedAt: serverTimestamp(),
    });
  });
}

/** Append a chat message / emote / taunt; history capped at CHAT_CAP. */
export async function sendChat(
  code: string,
  msg: Omit<ChatMsg, 'u' | 'ts'>,
): Promise<void> {
  const id = await getInstallId();
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(roomRef(code));
    if (!snap.exists()) return;
    const chat: ChatMsg[] = [...((snap.data()?.chat as ChatMsg[]) ?? [])];
    chat.push({ ...msg, u: id, ts: Date.now() });
    tx.update(roomRef(code), {
      chat: chat.slice(-CHAT_CAP),
      updatedAt: serverTimestamp(),
    });
  });
}

/** Live-subscribe to a room. Returns unsubscribe. */
export function watchRoom(
  code: string,
  onRoom: (room: Room | null) => void,
  onError?: (e: Error) => void,
): () => void {
  return onSnapshot(
    roomRef(code),
    (snap) => {
      onRoom(snap.exists() ? parseRoom(code, snap.data()!) : null);
    },
    (e) => onError?.(e as Error),
  );
}

/** Best-effort delete for finished rooms (host only, fire and forget). */
export async function cleanupRoom(code: string): Promise<void> {
  try {
    await deleteDoc(roomRef(code));
  } catch {}
}

/** Touch updatedAt so others can see we're alive (light presence). */
export async function touchRoom(code: string): Promise<void> {
  try {
    await updateDoc(roomRef(code), { updatedAt: serverTimestamp() });
  } catch {}
}

/**
 * bot.ts — a headless Coup player for testing multiplayer end-to-end.
 * Runs on Node with the same firebase web SDK + engine as the app.
 *
 * Usage:
 *   FIRESTORE_EMULATOR=localhost:8080 npx tsx scripts/bot.ts join <CODE> <NAME>
 *   FIRESTORE_EMULATOR=localhost:8080 npx tsx scripts/bot.ts auto <CODE> <NAME>
 *
 * `join` joins the lobby and exits. `auto` joins (if needed) and then
 * plays forever with a simple policy: on its turn income/coup, passes
 * every window, loses its first card, keeps its first N on exchange.
 */
import { initializeApp } from 'firebase/app';
import {
  connectFirestoreEmulator,
  doc,
  getFirestore,
  onSnapshot,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore';
import { apply, isAlive, pendingResponders } from '../src/engine/engine';
import { GameState, Move } from '../src/engine/types';
import { decideBot } from '../src/ai';

const [, , cmd, code, name = 'Bot', moveJson] = process.argv;
if (!cmd || !code) {
  console.error('usage: bot.ts <join|auto|move> <CODE> [NAME] [moveJSON]');
  process.exit(1);
}

const app = initializeApp({ projectId: 'coup-game-rooms', apiKey: 'x', appId: 'x' });
const db = getFirestore(app);
const emu = process.env.FIRESTORE_EMULATOR ?? 'localhost:8080';
const [host, port] = emu.split(':');
connectFirestoreEmulator(db, host, parseInt(port, 10));

const myId = `bot-${name.toLowerCase()}`;
const ref = doc(db, 'coup_rooms', code.toUpperCase());

async function join() {
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('room not found');
    const data = snap.data()!;
    const roster = (data.roster as { id: string; name: string }[]) ?? [];
    if (roster.some((p) => p.id === myId)) return;
    if (data.status !== 'lobby') throw new Error('already started');
    if (roster.length >= 6) throw new Error('full');
    const avatars = ['monkey', 'penguin', 'frog', 'elephant', 'owl'];
    const avatar = avatars[roster.length % avatars.length];
    tx.update(ref, { roster: [...roster, { id: myId, name, avatar }], updatedAt: serverTimestamp() });
  });
  console.log(`[${name}] joined ${code}`);
}

const decide = (g: GameState) => decideBot(g, myId);


async function moveOnce(m: Move): Promise<string | null> {
  let err: string | null = null;
  await runTransaction(db, async (tx) => {
    err = null;
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('room gone');
    const data = snap.data()!;
    if (!data.gameJson) throw new Error('not started');
    const g = JSON.parse(data.gameJson) as GameState;
    const res = apply(g, myId, m);
    if (res.error) {
      err = res.error;
      return;
    }
    tx.update(ref, { gameJson: JSON.stringify(res.state), updatedAt: serverTimestamp() });
  });
  return err;
}

async function main() {
  if (cmd === 'chat') {
    // One-shot chat message: bot.ts chat CODE NAME "text"  (moveJson = text)
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists()) throw new Error('room gone');
      const chat = [...((snap.data()?.chat as unknown[]) ?? [])];
      chat.push({ u: myId, n: name, a: 'penguin', k: 'text', v: moveJson ?? 'hi', ts: Date.now() });
      tx.update(ref, { chat: chat.slice(-40), updatedAt: serverTimestamp() });
    });
    console.log(`[${name}] chat sent`);
    process.exit(0);
  }
  if (cmd === 'emote') {
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists()) throw new Error('room gone');
      const chat = [...((snap.data()?.chat as unknown[]) ?? [])];
      chat.push({ u: myId, n: name, a: 'monkey', k: 'emote', v: moveJson ?? '🔥', ts: Date.now() });
      tx.update(ref, { chat: chat.slice(-40), updatedAt: serverTimestamp() });
    });
    console.log(`[${name}] emote sent`);
    process.exit(0);
  }
  if (cmd === 'move') {
    // One-shot scripted move (testing): bot.ts move CODE NAME '{"type":...}'
    const err = await moveOnce(JSON.parse(moveJson!) as Move);
    console.log(`[${name}] scripted move${err ? ` → rejected: ${err}` : ' ok'}`);
    process.exit(err ? 1 : 0);
  }
  await join().catch((e) => {
    if (cmd === 'join') throw e;
    console.log(`[${name}] join skipped: ${e.message}`);
  });
  if (cmd === 'join') process.exit(0);

  let busy = false;
  let latest: GameState | null = null;
  const act = async () => {
    if (!latest || busy) return;
    const g = latest;
    if (g.phase === 'game_over') return;
    const m = decide(g);
    if (!m) return;
    busy = true;
    // small human-ish delay so the app UI visibly updates step by step
    await new Promise((r) => setTimeout(r, 700));
    try {
      const err = await moveOnce(m);
      console.log(`[${name}] ${JSON.stringify(m)}${err ? ` → rejected: ${err}` : ''}`);
    } catch (e) {
      console.log(`[${name}] move failed:`, (e as Error).message);
    } finally {
      busy = false;
    }
  };
  onSnapshot(ref, (snap) => {
    if (!snap.exists()) {
      console.log(`[${name}] room deleted — bye`);
      process.exit(0);
    }
    const data = snap.data()!;
    if (!data.gameJson) return;
    const g = JSON.parse(data.gameJson) as GameState;
    latest = g;
    if (g.phase === 'game_over') {
      const w = g.players.find((p) => p.id === g.winner);
      console.log(`[${name}] game over — winner: ${w?.name}`);
      return;
    }
    act();
  });
  // A rejected move produces no new snapshot — re-evaluate on a slow
  // tick so a bot can never deadlock against a stale read.
  setInterval(act, 2500);
}

main().catch((e) => {
  console.error(`[${name}]`, e.message);
  process.exit(1);
});

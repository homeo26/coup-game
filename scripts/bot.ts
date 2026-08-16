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
import { BLOCK_ROLES, GameState, Move } from '../src/engine/types';

const [, , cmd, code, name = 'Bot', moveJson] = process.argv;
if (!cmd || !code) {
  console.error('usage: bot.ts <join|auto|move> <CODE> [NAME] [moveJSON]');
  process.exit(1);
}

const app = initializeApp({ projectId: 'lawazempack4', apiKey: 'x', appId: 'x' });
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
    tx.update(ref, { roster: [...roster, { id: myId, name }], updatedAt: serverTimestamp() });
  });
  console.log(`[${name}] joined ${code}`);
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function decide(g: GameState): Move | null {
  const me = g.players.find((p) => p.id === myId);
  if (!me || !isAlive(me) || g.phase === 'game_over') return null;
  const myRoles = me.cards.filter((c) => !c.revealed).map((c) => c.role);
  const foes = g.players.filter((p) => p.id !== myId && isAlive(p));
  const richFoes = foes.filter((p) => p.coins > 0);

  if (g.phase === 'action' && g.players[g.turn].id === myId) {
    if (foes.length === 0) return null;
    // Mandatory coup at 10+, opportunistic coup at 7+
    if (me.coins >= 10 || (me.coins >= 7 && Math.random() < 0.6)) {
      return { type: 'declare', action: 'coup', target: pick(foes).id };
    }
    // Assassinate when armed (or as a rare bluff)
    if (me.coins >= 3 && (myRoles.includes('assassin') || Math.random() < 0.08)) {
      if (Math.random() < 0.7) {
        return { type: 'declare', action: 'assassinate', target: pick(foes).id };
      }
    }
    // Steal when a captain (or a rare bluff) and someone has coins
    if (richFoes.length > 0 && (myRoles.includes('captain') || Math.random() < 0.08)) {
      if (Math.random() < 0.55) {
        return { type: 'declare', action: 'steal', target: pick(richFoes).id };
      }
    }
    // Exchange with the Court now and then
    if (myRoles.includes('ambassador') && Math.random() < 0.35) {
      return { type: 'declare', action: 'exchange' };
    }
    // Tax with a duke (or as an occasional bluff)
    if (myRoles.includes('duke') || Math.random() < 0.12) {
      return { type: 'declare', action: 'tax' };
    }
    return Math.random() < 0.5
      ? { type: 'declare', action: 'foreign_aid' }
      : { type: 'declare', action: 'income' };
  }

  if (g.phase === 'lose_card' && g.lossQueue[0]?.playerId === myId) {
    const idx = me.cards.findIndex((c) => !c.revealed);
    return { type: 'lose', cardIndex: idx };
  }
  if (g.phase === 'exchange' && g.pending?.actor === myId) {
    const n = me.cards.filter((c) => !c.revealed).length;
    const poolSize = n + (g.pending.drawn?.length ?? 0);
    const all = Array.from({ length: poolSize }, (_, i) => i);
    const keep: number[] = [];
    while (keep.length < n) {
      const k = pick(all.filter((i) => !keep.includes(i)));
      keep.push(k);
    }
    return { type: 'exchange_keep', keep };
  }
  if (pendingResponders(g).includes(myId)) {
    const p = g.pending!;
    // Block window: use a real blocker when held, bluff-block sometimes
    if (g.phase === 'block') {
      const options = (BLOCK_ROLES[p.action] ?? []).filter(
        (r) => p.action === 'foreign_aid' || p.target === myId,
      );
      const real = options.filter((r) => myRoles.includes(r));
      if (real.length > 0 && Math.random() < 0.85) return { type: 'block', role: pick(real) };
      if (options.length > 0 && Math.random() < 0.2) return { type: 'block', role: pick(options) };
      return { type: 'pass' };
    }
    // Challenge windows: suspicious roughly a third of the time
    if ((g.phase === 'action_challenge' || g.phase === 'block_challenge') && Math.random() < 0.3) {
      return { type: 'challenge' };
    }
    return { type: 'pass' };
  }
  return null;
}

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

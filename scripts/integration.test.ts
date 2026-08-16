/**
 * Headless integration test against the Firestore emulator:
 * host creates a room, two bots join, game starts, both sides play a
 * full game through transactional moves under the production rules.
 * FIRESTORE_EMULATOR=localhost:8080 npx tsx scripts/integration.test.ts
 */
import { initializeApp } from 'firebase/app';
import {
  connectFirestoreEmulator,
  doc,
  getDoc,
  getFirestore,
  runTransaction,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import { apply, isAlive, newGame, pendingResponders } from '../src/engine/engine';
import { GameState, Move } from '../src/engine/types';

const app = initializeApp({ projectId: 'coup-game-rooms', apiKey: 'x', appId: 'x' });
const db = getFirestore(app);
const emu = process.env.FIRESTORE_EMULATOR ?? 'localhost:8080';
connectFirestoreEmulator(db, emu.split(':')[0], parseInt(emu.split(':')[1], 10));

const CODE = 'ITST';
const ref = doc(db, 'coup_rooms', CODE);

async function move(id: string, m: Move): Promise<string | null> {
  let err: string | null = null;
  await runTransaction(db, async (tx) => {
    err = null;
    const snap = await tx.get(ref);
    const g = JSON.parse(snap.data()!.gameJson) as GameState;
    const res = apply(g, id, m);
    if (res.error) {
      err = res.error;
      return;
    }
    tx.update(ref, { gameJson: JSON.stringify(res.state), updatedAt: serverTimestamp() });
  });
  return err;
}

async function main() {
  // 1. create room (validates rules: create with hostId/status/roster)
  await setDoc(ref, {
    hostId: 'host1',
    status: 'lobby',
    roster: [{ id: 'host1', name: 'Host' }],
    gameJson: null,
    createdAt: serverTimestamp(),
    createdAtMs: Date.now(),
    updatedAt: serverTimestamp(),
  });
  console.log('✓ room created under rules');

  // 2. two joins
  for (const [id, name] of [
    ['p2', 'Beta'],
    ['p3', 'Gamma'],
  ] as const) {
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      const roster = snap.data()!.roster as { id: string; name: string }[];
      tx.update(ref, { roster: [...roster, { id, name }], updatedAt: serverTimestamp() });
    });
  }
  console.log('✓ joins committed');

  // 3. start
  const rosterSnap = await getDoc(ref);
  const roster = rosterSnap.data()!.roster as { id: string; name: string }[];
  await runTransaction(db, async (tx) => {
    tx.update(ref, {
      status: 'playing',
      gameJson: JSON.stringify(newGame(roster)),
      updatedAt: serverTimestamp(),
    });
  });
  console.log('✓ game started');

  // 4. play a full game: everyone income/coup + pass, transactionally
  let guard = 0;
  for (;;) {
    if (guard++ > 500) throw new Error('game did not terminate');
    const snap = await getDoc(ref);
    const g = JSON.parse(snap.data()!.gameJson) as GameState;
    if (g.phase === 'game_over') {
      const w = g.players.find((p) => p.id === g.winner)!;
      console.log(`✓ game finished after ${g.version} moves — winner ${w.name}`);
      break;
    }
    let actorId: string;
    let m: Move;
    if (g.phase === 'action') {
      const me = g.players[g.turn];
      actorId = me.id;
      if (me.coins >= 7) {
        const tgt = g.players.find((p) => p.id !== me.id && isAlive(p))!;
        m = { type: 'declare', action: 'coup', target: tgt.id };
      } else {
        m = { type: 'declare', action: 'income' };
      }
    } else if (g.phase === 'lose_card') {
      actorId = g.lossQueue[0].playerId;
      const me = g.players.find((p) => p.id === actorId)!;
      m = { type: 'lose', cardIndex: me.cards.findIndex((c) => !c.revealed) };
    } else {
      actorId = pendingResponders(g)[0];
      m = { type: 'pass' };
    }
    const err = await move(actorId, m);
    if (err) throw new Error(`move rejected: ${err}`);
  }

  // 5. rules negative check: oversized roster update must be rejected
  let denied = false;
  try {
    await runTransaction(db, async (tx) => {
      tx.update(ref, {
        roster: Array.from({ length: 9 }, (_, i) => ({ id: `x${i}`, name: 'x' })),
      });
    });
  } catch {
    denied = true;
  }
  console.log(denied ? '✓ rules rejected 9-player roster' : '✗ rules allowed oversized roster!');
  if (!denied) process.exit(1);
  console.log('\nINTEGRATION OK');
  process.exit(0);
}

main().catch((e) => {
  console.error('✗', e.message ?? e);
  process.exit(1);
});

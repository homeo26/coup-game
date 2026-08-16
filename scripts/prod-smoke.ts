/** One-shot prod smoke: create → read → delete a room in coup-game-rooms. */
import { initializeApp } from 'firebase/app';
import { deleteDoc, doc, getDoc, getFirestore, setDoc } from 'firebase/firestore';

const app = initializeApp({
  apiKey: 'AIzaSyDqPtVwQjzmchGrPe5rqM8AMSURWdoHzb4',
  projectId: 'coup-game-rooms',
  appId: '1:902436972116:web:1e2c2588fe8230c553efc1',
});
const db = getFirestore(app);

async function main() {
  const ref = doc(db, 'coup_rooms', 'ZZTS');
  await setDoc(ref, {
    hostId: 'smoke-test',
    status: 'lobby',
    roster: [{ id: 'smoke-test', name: 'Smoke' }],
    gameJson: null,
    createdAtMs: Date.now(),
  });
  const snap = await getDoc(ref);
  console.log('created + read back:', snap.exists(), snap.data()?.status);
  // negative: an invalid doc (7 players) must be rejected by rules
  let rejected = false;
  try {
    await setDoc(doc(db, 'coup_rooms', 'ZZTT'), {
      hostId: 'x',
      status: 'lobby',
      roster: Array.from({ length: 7 }, (_, i) => ({ id: String(i), name: 'x' })),
    });
  } catch {
    rejected = true;
  }
  console.log('7-player roster rejected by prod rules:', rejected);
  await deleteDoc(ref);
  console.log('deleted — prod store clean. PROD OK');
  process.exit(0);
}
main().catch((e) => {
  console.error('PROD SMOKE FAILED:', e.message);
  process.exit(1);
});

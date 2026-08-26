/**
 * Engine tests — run with `npm test` (tsx).
 * Covers every action, block, challenge branch, coin semantics, the
 * 10-coin rule, steal-from-1-coin, double-loss assassination, exchange,
 * elimination ordering, forfeits, and win detection.
 */
import {
  apply,
  influence,
  isAlive,
  newGame,
  pendingResponders,
  standings,
} from './engine';
import { GameState, Move, Role } from './types';

let passed = 0;
let failed = 0;

function assert(cond: boolean, msg: string) {
  if (cond) {
    passed++;
  } else {
    failed++;
    console.error('  ✗', msg);
  }
}

function eq<T>(actual: T, expected: T, msg: string) {
  assert(
    JSON.stringify(actual) === JSON.stringify(expected),
    `${msg} (expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)})`,
  );
}

function test(name: string, fn: () => void) {
  const before = failed;
  try {
    fn();
  } catch (e) {
    failed++;
    console.error('  ✗ threw:', e);
  }
  console.log(`${failed === before ? '✓' : '✗'} ${name}`);
}

/** Build a game with fixed hands and deck for deterministic tests. */
function rig(
  hands: Record<string, [Role, Role]>,
  deck: Role[],
  coins?: Record<string, number>,
): GameState {
  const ids = Object.keys(hands);
  const s = newGame(
    ids.map((id) => ({ id, name: id.toUpperCase() })),
    () => 0.5,
  );
  s.players.forEach((p) => {
    p.cards = hands[p.id].map((role) => ({ role, revealed: false }));
    // rigs start everyone on 2 coins regardless of the official 2-player
    // opening (that rule has its own test) unless the case overrides it
    p.coins = coins && coins[p.id] !== undefined ? coins[p.id] : 2;
  });
  s.deck = [...deck];
  return s;
}

function mv(s: GameState, id: string, move: Move): GameState {
  const r = apply(s, id, move);
  if (r.error) throw new Error(`unexpected error: ${r.error} for ${id} ${JSON.stringify(move)}`);
  return r.state;
}

function expectError(s: GameState, id: string, move: Move, msg: string) {
  const r = apply(s, id, move);
  assert(!!r.error, `${msg} — should have errored`);
  return r;
}

const P = (s: GameState, id: string) => s.players.find((p) => p.id === id)!;

/* ------------------------------------------------------------------ */

test('setup deals 2 cards & 2 coins each, 15 cards total', () => {
  const s = newGame([
    { id: 'a', name: 'A' },
    { id: 'b', name: 'B' },
    { id: 'c', name: 'C' },
  ]);
  eq(s.players.length, 3, 'three players');
  s.players.forEach((p) => {
    eq(p.cards.length, 2, 'two cards');
    eq(p.coins, 2, 'two coins');
  });
  eq(s.deck.length, 15 - 6, 'court deck 9');
  eq(s.phase, 'action', 'starts awaiting action');
});

test('income: +1, no window, next turn', () => {
  let s = rig({ a: ['duke', 'contessa'], b: ['captain', 'captain'] }, ['assassin']);
  s = mv(s, 'a', { type: 'declare', action: 'income' });
  eq(P(s, 'a').coins, 3, 'a has 3');
  eq(s.players[s.turn].id, 'b', "b's turn");
  eq(s.phase, 'action', 'action phase');
});

test('foreign aid: unblocked gives +2 after all pass', () => {
  let s = rig(
    { a: ['duke', 'contessa'], b: ['captain', 'captain'], c: ['assassin', 'ambassador'] },
    ['duke'],
  );
  s = mv(s, 'a', { type: 'declare', action: 'foreign_aid' });
  eq(s.phase, 'block', 'block window');
  eq(pendingResponders(s).sort(), ['b', 'c'], 'b and c may block');
  s = mv(s, 'b', { type: 'pass' });
  s = mv(s, 'c', { type: 'pass' });
  eq(P(s, 'a').coins, 4, 'a has 4');
  eq(s.players[s.turn].id, 'b', "b's turn");
});

test('foreign aid blocked by unchallenged duke claim: no coins', () => {
  let s = rig({ a: ['contessa', 'contessa'], b: ['captain', 'captain'] }, ['duke']);
  s = mv(s, 'a', { type: 'declare', action: 'foreign_aid' });
  s = mv(s, 'b', { type: 'block', role: 'duke' }); // bluff, but unchallenged
  eq(s.phase, 'block_challenge', 'block challenge window');
  eq(pendingResponders(s), ['a'], 'a may challenge the block');
  s = mv(s, 'a', { type: 'pass' });
  eq(P(s, 'a').coins, 2, 'a still 2');
  eq(s.players[s.turn].id, 'b', 'turn advanced');
});

test('foreign aid block challenged, blocker HAD duke: challenger loses card, blocker redraws', () => {
  let s = rig({ a: ['contessa', 'contessa'], b: ['duke', 'captain'] }, ['ambassador', 'assassin']);
  s = mv(s, 'a', { type: 'declare', action: 'foreign_aid' });
  s = mv(s, 'b', { type: 'block', role: 'duke' });
  s = mv(s, 'a', { type: 'challenge' });
  // a must now lose a card (has 2 → chooses)
  eq(s.phase, 'lose_card', 'a chooses a loss');
  s = mv(s, 'a', { type: 'lose', cardIndex: 0 });
  eq(influence(P(s, 'a')), 1, 'a down to 1');
  // b's duke was returned & replaced — hand size still 2 unrevealed
  eq(influence(P(s, 'b')), 2, 'b keeps 2');
  eq(P(s, 'a').coins, 2, 'aid denied');
  eq(s.deck.length, 2, 'deck same size (1 in, 1 out)');
});

test('foreign aid block challenged, blocker bluffed: blocker loses card, aid resolves', () => {
  let s = rig({ a: ['contessa', 'contessa'], b: ['captain', 'captain'] }, ['duke']);
  s = mv(s, 'a', { type: 'declare', action: 'foreign_aid' });
  s = mv(s, 'b', { type: 'block', role: 'duke' });
  s = mv(s, 'a', { type: 'challenge' });
  eq(s.phase, 'lose_card', 'b chooses a loss');
  s = mv(s, 'b', { type: 'lose', cardIndex: 1 });
  eq(influence(P(s, 'b')), 1, 'b down to 1');
  eq(P(s, 'a').coins, 4, 'aid went through');
});

test('tax unchallenged: +3', () => {
  let s = rig({ a: ['duke', 'contessa'], b: ['captain', 'captain'] }, ['duke']);
  s = mv(s, 'a', { type: 'declare', action: 'tax' });
  eq(s.phase, 'action_challenge', 'challenge window');
  s = mv(s, 'b', { type: 'pass' });
  eq(P(s, 'a').coins, 5, 'a has 5');
});

test('tax challenged with real duke: challenger loses, tax resolves, duke reshuffled', () => {
  let s = rig({ a: ['duke', 'contessa'], b: ['captain', 'captain'] }, ['ambassador', 'assassin']);
  s = mv(s, 'a', { type: 'declare', action: 'tax' });
  s = mv(s, 'b', { type: 'challenge' });
  s = mv(s, 'b', { type: 'lose', cardIndex: 0 });
  eq(P(s, 'a').coins, 5, 'tax collected');
  eq(influence(P(s, 'b')), 1, 'challenger lost a card');
  eq(s.deck.length, 2, 'deck size unchanged (1 returned, 1 drawn)');
  eq(influence(P(s, 'a')), 2, 'a keeps 2 influence after the swap');
});

test('tax challenged on a bluff: actor loses card, no coins', () => {
  let s = rig({ a: ['contessa', 'assassin'], b: ['captain', 'captain'] }, ['duke']);
  s = mv(s, 'a', { type: 'declare', action: 'tax' });
  s = mv(s, 'b', { type: 'challenge' });
  eq(s.phase, 'lose_card', 'a must lose');
  s = mv(s, 'a', { type: 'lose', cardIndex: 0 });
  eq(P(s, 'a').coins, 2, 'no tax');
  eq(influence(P(s, 'a')), 1, 'a lost a card');
  eq(s.players[s.turn].id, 'b', 'turn advanced');
});

test('steal: takes 2, blockable by captain or ambassador', () => {
  let s = rig({ a: ['captain', 'contessa'], b: ['captain', 'duke'] }, ['duke'], { a: 2, b: 5 });
  s = mv(s, 'a', { type: 'declare', action: 'steal', target: 'b' });
  s = mv(s, 'b', { type: 'pass' }); // no challenge
  eq(s.phase, 'block', 'block window for target');
  eq(pendingResponders(s), ['b'], 'only target may block');
  s = mv(s, 'b', { type: 'pass' });
  eq(P(s, 'a').coins, 4, 'a took 2');
  eq(P(s, 'b').coins, 3, 'b lost 2');
});

test('steal from a player with 1 coin takes only 1', () => {
  let s = rig({ a: ['captain', 'contessa'], b: ['duke', 'duke'] }, ['duke'], { a: 2, b: 1 });
  s = mv(s, 'a', { type: 'declare', action: 'steal', target: 'b' });
  s = mv(s, 'b', { type: 'pass' });
  s = mv(s, 'b', { type: 'pass' });
  eq(P(s, 'a').coins, 3, 'a took 1');
  eq(P(s, 'b').coins, 0, 'b at 0');
});

test('stealing from a broke player is allowed (the rules only cap the amount)', () => {
  const s = rig({ a: ['captain', 'contessa'], b: ['duke', 'duke'] }, ['duke'], { a: 2, b: 0 });
  const r = apply(s, 'a', { type: 'declare', action: 'steal', target: 'b' });
  eq(r.error, undefined, 'declaration accepted');
  eq(r.state.phase, 'action_challenge', 'the Captain claim can be challenged');
});

test('steal blocked by ambassador claim (unchallenged): no transfer', () => {
  let s = rig({ a: ['captain', 'contessa'], b: ['duke', 'duke'] }, ['duke'], { a: 2, b: 5 });
  s = mv(s, 'a', { type: 'declare', action: 'steal', target: 'b' });
  s = mv(s, 'b', { type: 'pass' });
  s = mv(s, 'b', { type: 'block', role: 'ambassador' });
  s = mv(s, 'a', { type: 'pass' });
  eq(P(s, 'a').coins, 2, 'no steal');
  eq(P(s, 'b').coins, 5, 'b untouched');
});

test('assassinate: fee paid up-front, target loses a card', () => {
  let s = rig({ a: ['assassin', 'contessa'], b: ['duke', 'duke'] }, ['captain'], { a: 3, b: 2 });
  s = mv(s, 'a', { type: 'declare', action: 'assassinate', target: 'b' });
  eq(P(s, 'a').coins, 0, 'fee spent at declaration');
  s = mv(s, 'b', { type: 'pass' }); // no challenge
  s = mv(s, 'b', { type: 'pass' }); // no block
  eq(s.phase, 'lose_card', 'b must lose');
  s = mv(s, 'b', { type: 'lose', cardIndex: 0 });
  eq(influence(P(s, 'b')), 1, 'b lost a card');
  eq(P(s, 'a').coins, 0, 'fee stays spent');
});

test('assassinate blocked by contessa (unchallenged): fee lost, no kill', () => {
  let s = rig({ a: ['assassin', 'duke'], b: ['contessa', 'duke'] }, ['captain'], { a: 3, b: 2 });
  s = mv(s, 'a', { type: 'declare', action: 'assassinate', target: 'b' });
  s = mv(s, 'b', { type: 'pass' });
  s = mv(s, 'b', { type: 'block', role: 'contessa' });
  s = mv(s, 'a', { type: 'pass' });
  eq(P(s, 'a').coins, 0, 'fee NOT refunded on block');
  eq(influence(P(s, 'b')), 2, 'b unhurt');
  eq(s.players[s.turn].id, 'b', 'turn advanced');
});

test('assassinate successfully challenged: actor loses card AND gets fee back', () => {
  let s = rig({ a: ['captain', 'duke'], b: ['contessa', 'duke'] }, ['captain'], { a: 3, b: 2 });
  s = mv(s, 'a', { type: 'declare', action: 'assassinate', target: 'b' }); // bluff!
  s = mv(s, 'b', { type: 'challenge' });
  eq(s.phase, 'lose_card', 'a must lose');
  s = mv(s, 'a', { type: 'lose', cardIndex: 0 });
  eq(P(s, 'a').coins, 3, 'fee refunded on successful challenge');
  eq(influence(P(s, 'a')), 1, 'a lost a card');
  eq(influence(P(s, 'b')), 2, 'b unhurt');
});

test('the double-kill: target challenges a REAL assassin, loses challenge card, then the hit lands', () => {
  let s = rig(
    { a: ['assassin', 'duke'], b: ['captain', 'captain'], c: ['duke', 'duke'] },
    ['contessa', 'ambassador'],
    { a: 3, b: 2, c: 2 },
  );
  s = mv(s, 'a', { type: 'declare', action: 'assassinate', target: 'b' });
  s = mv(s, 'b', { type: 'challenge' }); // b challenges — a HAS the assassin
  eq(s.phase, 'lose_card', 'b loses for the failed challenge');
  s = mv(s, 'b', { type: 'lose', cardIndex: 0 });
  eq(influence(P(s, 'b')), 1, 'b down to 1');
  // Block window now opens for b (c already implicitly uninvolved)
  eq(s.phase, 'block', 'b may still try to block');
  s = mv(s, 'b', { type: 'pass' });
  // Single remaining card → auto-revealed
  eq(influence(P(s, 'b')), 0, 'b eliminated');
  assert(!isAlive(P(s, 'b')), 'b is out');
  eq(s.phase, 'action', 'game continues (c alive)');
});

test('coup: pay 7, unblockable, mandatory at 10+', () => {
  let s = rig({ a: ['duke', 'duke'], b: ['contessa', 'contessa'] }, ['captain'], { a: 10, b: 2 });
  const r = apply(s, 'a', { type: 'declare', action: 'income' });
  assert(!!r.error, 'income rejected at 10 coins');
  s = mv(s, 'a', { type: 'declare', action: 'coup', target: 'b' });
  eq(P(s, 'a').coins, 3, 'paid 7');
  eq(s.phase, 'lose_card', 'b must lose');
  s = mv(s, 'b', { type: 'lose', cardIndex: 1 });
  eq(influence(P(s, 'b')), 1, 'b lost one');
  eq(s.players[s.turn].id, 'b', "b's turn");
});

test('coup needs 7 coins', () => {
  const s = rig({ a: ['duke', 'duke'], b: ['contessa', 'contessa'] }, ['captain'], { a: 6, b: 2 });
  expectError(s, 'a', { type: 'declare', action: 'coup', target: 'b' }, 'coup with 6 coins');
});

test('exchange: draw 2, keep same count, rest reshuffled back', () => {
  let s = rig({ a: ['ambassador', 'contessa'], b: ['duke', 'duke'] }, ['captain', 'assassin', 'duke']);
  s = mv(s, 'a', { type: 'declare', action: 'exchange' });
  s = mv(s, 'b', { type: 'pass' });
  eq(s.phase, 'exchange', 'picker open');
  eq(s.pending?.drawn?.length, 2, 'drew 2');
  eq(s.deck.length, 1, 'deck now 1');
  // pool = [ambassador, contessa, captain, assassin] → keep the two drawn
  s = mv(s, 'a', { type: 'exchange_keep', keep: [2, 3] });
  const roles = P(s, 'a').cards.filter((c) => !c.revealed).map((c) => c.role).sort();
  eq(roles, ['assassin', 'captain'], 'kept the drawn cards');
  eq(s.deck.length, 3, 'returned 2 to deck');
  eq(s.players[s.turn].id, 'b', 'turn advanced');
});

test('exchange with one influence keeps exactly one', () => {
  let s = rig({ a: ['ambassador', 'contessa'], b: ['duke', 'duke'] }, ['captain', 'assassin']);
  P(s, 'a').cards[1].revealed = true; // a has 1 influence
  s = mv(s, 'a', { type: 'declare', action: 'exchange' });
  s = mv(s, 'b', { type: 'pass' });
  // pool = [ambassador, captain, assassin]
  const bad = apply(s, 'a', { type: 'exchange_keep', keep: [0, 1] });
  assert(!!bad.error, 'keeping 2 with 1 influence rejected');
  s = mv(s, 'a', { type: 'exchange_keep', keep: [1] });
  eq(
    P(s, 'a').cards.filter((c) => !c.revealed).map((c) => c.role),
    ['captain'],
    'kept 1',
  );
  eq(s.deck.length, 2, 'two back in deck');
});

test('exchange challenged on a bluff: no draw happens', () => {
  let s = rig({ a: ['duke', 'contessa'], b: ['duke', 'duke'] }, ['captain', 'assassin']);
  s = mv(s, 'a', { type: 'declare', action: 'exchange' }); // bluff
  s = mv(s, 'b', { type: 'challenge' });
  s = mv(s, 'a', { type: 'lose', cardIndex: 0 });
  eq(s.deck.length, 2, 'deck untouched');
  eq(s.players[s.turn].id, 'b', 'turn advanced');
});

test('challenge windows: any uninvolved player may challenge', () => {
  let s = rig(
    { a: ['duke', 'duke'], b: ['contessa', 'contessa'], c: ['captain', 'captain'] },
    ['ambassador', 'assassin'],
  );
  s = mv(s, 'a', { type: 'declare', action: 'tax' });
  eq(pendingResponders(s).sort(), ['b', 'c'], 'both may respond');
  s = mv(s, 'c', { type: 'challenge' }); // uninvolved c challenges — a has duke
  s = mv(s, 'c', { type: 'lose', cardIndex: 0 });
  eq(P(s, 'a').coins, 5, 'tax resolved after failed challenge');
});

test('turn skips eliminated players', () => {
  let s = rig(
    { a: ['duke', 'duke'], b: ['contessa', 'contessa'], c: ['captain', 'captain'] },
    ['ambassador'],
    { a: 7, b: 2, c: 2 },
  );
  P(s, 'b').cards.forEach((c) => (c.revealed = true)); // b already out
  s = mv(s, 'a', { type: 'declare', action: 'income' });
  eq(s.players[s.turn].id, 'c', 'skipped b');
});

test('win: last player standing, game_over locks moves', () => {
  let s = rig({ a: ['duke', 'duke'], b: ['contessa', 'contessa'] }, ['ambassador'], { a: 7, b: 2 });
  P(s, 'b').cards[0].revealed = true;
  s = mv(s, 'a', { type: 'declare', action: 'coup', target: 'b' });
  // b's single card auto-reveals
  eq(s.phase, 'game_over', 'game over');
  eq(s.winner, 'a', 'a wins');
  const r = apply(s, 'b', { type: 'declare', action: 'income' });
  assert(!!r.error, 'moves rejected after game over');
});

test('forfeit mid-window completes the window', () => {
  let s = rig(
    { a: ['duke', 'duke'], b: ['contessa', 'contessa'], c: ['captain', 'captain'] },
    ['ambassador'],
  );
  s = mv(s, 'a', { type: 'declare', action: 'tax' });
  s = mv(s, 'b', { type: 'pass' });
  s = mv(s, 'c', { type: 'forfeit' }); // last responder leaves
  eq(P(s, 'a').coins, 5, 'tax resolved');
  assert(!isAlive(P(s, 'c')), 'c out');
});

test('forfeit of the turn holder advances the turn', () => {
  let s = rig(
    { a: ['duke', 'duke'], b: ['contessa', 'contessa'], c: ['captain', 'captain'] },
    ['ambassador'],
  );
  s = mv(s, 'a', { type: 'forfeit' });
  eq(s.players[s.turn].id, 'b', "b's turn");
  eq(s.phase, 'action', 'action phase');
});

test('forfeit down to one player ends the game', () => {
  let s = rig({ a: ['duke', 'duke'], b: ['contessa', 'contessa'] }, ['ambassador']);
  s = mv(s, 'a', { type: 'forfeit' });
  eq(s.phase, 'game_over', 'over');
  eq(s.winner, 'b', 'b wins');
});

test('validation: acting out of turn / phase rejected', () => {
  const s = rig({ a: ['duke', 'duke'], b: ['contessa', 'contessa'] }, ['ambassador']);
  expectError(s, 'b', { type: 'declare', action: 'income' }, 'out of turn');
  expectError(s, 'b', { type: 'challenge' }, 'challenge with no claim');
  expectError(s, 'a', { type: 'lose', cardIndex: 0 }, 'lose without owing');
});

test('cannot target self / dead players', () => {
  let s = rig(
    { a: ['duke', 'duke'], b: ['contessa', 'contessa'], c: ['captain', 'captain'] },
    ['ambassador'],
    { a: 7, b: 2, c: 2 },
  );
  P(s, 'b').cards.forEach((c) => (c.revealed = true));
  expectError(s, 'a', { type: 'declare', action: 'coup', target: 'a' }, 'self target');
  expectError(s, 'a', { type: 'declare', action: 'coup', target: 'b' }, 'dead target');
});

test('double pass rejected; duplicate challenge windows close exactly once', () => {
  let s = rig(
    { a: ['duke', 'duke'], b: ['contessa', 'contessa'], c: ['captain', 'captain'] },
    ['ambassador'],
  );
  s = mv(s, 'a', { type: 'declare', action: 'tax' });
  s = mv(s, 'b', { type: 'pass' });
  expectError(s, 'b', { type: 'pass' }, 'double pass');
  s = mv(s, 'c', { type: 'pass' });
  eq(s.phase, 'action', 'window closed once');
});

test('full 4-player smoke game runs to completion with random-ish play', () => {
  let s = newGame(
    ['a', 'b', 'c', 'd'].map((id) => ({ id, name: id })),
    () => 0.42,
  );
  let guard = 0;
  while (s.phase !== 'game_over' && guard++ < 2000) {
    if (s.phase === 'action') {
      const me = s.players[s.turn];
      // prefer coup when forced/possible, else income
      if (me.coins >= 7) {
        const tgt = s.players.find((p) => p.id !== me.id && isAlive(p))!;
        s = mv(s, me.id, { type: 'declare', action: 'coup', target: tgt.id });
      } else {
        s = mv(s, me.id, { type: 'declare', action: 'income' });
      }
    } else if (s.phase === 'lose_card') {
      const loser = s.lossQueue[0].playerId;
      const idx = P(s, loser).cards.findIndex((c) => !c.revealed);
      s = mv(s, loser, { type: 'lose', cardIndex: idx });
    } else {
      const owed = pendingResponders(s);
      if (owed.length === 0) throw new Error('stuck window');
      s = mv(s, owed[0], { type: 'pass' });
    }
  }
  assert(s.phase === 'game_over' && guard < 2000, 'smoke game finished');
  assert(!!s.winner, 'has a winner');
});

/* ------------------------------------------------------------------ */

test('elimination order → standings ranks winner, then last-out first', () => {
  let s = rig(
    {
      a: ['duke', 'duke'],
      b: ['captain', 'captain'],
      c: ['contessa', 'contessa'],
    },
    ['ambassador'],
    { a: 30, b: 20, c: 0 },
  );
  // a coups c twice (c out first), then b coups a once, a coups b twice (b out second)
  s = mv(s, 'a', { type: 'declare', action: 'coup', target: 'c' });
  s = mv(s, 'c', { type: 'lose', cardIndex: 0 });
  s = mv(s, 'b', { type: 'declare', action: 'coup', target: 'c' }); // auto-reveals last card
  eq(s.eliminated, ['c'], 'c eliminated first');
  s = mv(s, 'a', { type: 'declare', action: 'coup', target: 'b' });
  s = mv(s, 'b', { type: 'lose', cardIndex: 0 });
  s = mv(s, 'b', { type: 'declare', action: 'coup', target: 'a' });
  s = mv(s, 'a', { type: 'lose', cardIndex: 0 });
  s = mv(s, 'a', { type: 'declare', action: 'coup', target: 'b' }); // b's last card
  eq(s.phase, 'game_over', 'game over');
  eq(s.eliminated, ['c', 'b'], 'elimination order c then b');
  eq(
    standings(s).map((p) => p.id),
    ['a', 'b', 'c'],
    'standings: winner a, runner-up b, third c',
  );
});

test('forfeit joins the elimination order', () => {
  let s = rig(
    {
      a: ['duke', 'duke'],
      b: ['captain', 'captain'],
      c: ['contessa', 'contessa'],
    },
    ['ambassador'],
  );
  s = mv(s, 'b', { type: 'forfeit' });
  eq(s.eliminated, ['b'], 'quitter recorded');
  eq(s.phase, 'action', 'game continues with 2 players');
});

test('pre-standings saves migrate (eliminated defaults to [])', () => {
  let s = rig({ a: ['duke', 'duke'], b: ['captain', 'captain'] }, ['ambassador']);
  delete (s as Partial<GameState>).eliminated; // simulate an old saved game
  s = mv(s, 'a', { type: 'declare', action: 'income' });
  eq(s.eliminated, [], 'field restored');
});

test('forfeit mid-exchange returns drawn cards to the Court', () => {
  let s = rig(
    { a: ['ambassador', 'duke'], b: ['captain', 'captain'], c: ['contessa', 'contessa'] },
    ['assassin', 'assassin', 'duke'],
  );
  const before = 3 + 6; // deck + all hidden hands
  s = mv(s, 'a', { type: 'declare', action: 'exchange' });
  s = mv(s, 'b', { type: 'pass' });
  s = mv(s, 'c', { type: 'pass' });
  eq(s.phase, 'exchange', 'exchange window open');
  eq(s.deck.length, 1, 'two cards drawn out');
  s = mv(s, 'a', { type: 'forfeit' });
  const after =
    s.deck.length + s.players.reduce((n, p) => n + p.cards.filter((c) => !c.revealed).length, 0);
  eq(s.deck.length, 3, 'drawn cards returned to the deck');
  eq(after, before - 2, 'total hidden cards only dropped by the forfeited hand');
});

test("actor forfeit still collects the failed challenger's loss", () => {
  let s = rig(
    { a: ['duke', 'duke'], b: ['captain', 'captain'], c: ['contessa', 'contessa'] },
    ['ambassador'],
  );
  s = mv(s, 'a', { type: 'declare', action: 'tax' });
  s = mv(s, 'b', { type: 'challenge' }); // a proves the Duke → b owes a card
  eq(s.phase, 'lose_card', 'b picking a card to lose');
  s = mv(s, 'a', { type: 'forfeit' }); // actor walks away mid-collection
  eq(s.phase, 'lose_card', 'b still owes their pick');
  s = mv(s, 'b', { type: 'lose', cardIndex: 0 });
  eq(influence(P(s, 'b')), 1, 'b still paid the failed challenge');
  eq(s.phase, 'action', 'game moved on');
  assert(isAlive(P(s, 'b')) && isAlive(P(s, 'c')), 'b and c continue');
});

/* ------------------------------------------------------------------ */

test('log is capped so gameJson cannot grow unbounded', () => {
  let s = rig({ a: ['duke', 'duke'], b: ['captain', 'captain'] }, ['ambassador']);
  for (let i = 0; i < 120; i++) {
    const me = s.players[s.turn];
    s = mv(s, me.id, { type: 'declare', action: 'income' });
    s.players.forEach((p) => (p.coins = 0)); // stay under the 10-coin rule
  }
  assert(s.log.length <= 80, `log capped (got ${s.log.length})`);
  eq(s.log[s.log.length - 1].key, 'logIncome', 'newest entry kept');
});

test('turn timer: timeout is rejected early, then forces the decision', () => {
  const roster = [
    { id: 'a', name: 'A' },
    { id: 'b', name: 'B' },
    { id: 'c', name: 'C' },
  ];
  let s = newGame(roster, () => 0.5, 30);
  assert(s.timerSec === 30, 'timer stored on the game');
  const started = 1_000_000;
  s = apply(s, 'a', { type: 'declare', action: 'income' }, started).state;
  assert(s.deadlineMs === started + 30_000, 'deadline set from the clock');

  // b is on the clock; too early to force
  const early = apply(s, 'c', { type: 'timeout' }, started + 5_000);
  assert(!!early.error, 'timeout rejected before the deadline');

  // once expired, ANY player can force it — b takes Income
  const coinsBefore = P(s, 'b').coins;
  const forced = apply(s, 'c', { type: 'timeout' }, started + 31_000);
  eq(forced.error, undefined, 'timeout accepted after the deadline');
  eq(P(forced.state, 'b').coins, coinsBefore + 1, 'turn holder auto-took Income');
  eq(forced.state.players[forced.state.turn].id, 'c', 'turn moved on');
});

test('turn timer: a response window times out as passes', () => {
  let s = rig({ a: ['duke', 'duke'], b: ['captain', 'captain'], c: ['contessa', 'contessa'] }, [
    'ambassador',
  ]);
  s.timerSec = 30;
  const t0 = 5_000_000;
  s = apply(s, 'a', { type: 'declare', action: 'tax' }, t0).state;
  eq(s.phase, 'action_challenge', 'challenge window open');
  const r = apply(s, 'a', { type: 'timeout' }, t0 + 30_001);
  eq(r.error, undefined, 'window forced');
  eq(r.state.phase, 'action', 'tax resolved and the turn ended');
  eq(P(r.state, 'a').coins, P(s, 'a').coins + 3, 'tax paid out');
});

test('turn timer: forced coup when the actor is over the 10-coin limit', () => {
  let s = rig({ a: ['duke', 'duke'], b: ['captain', 'captain'] }, ['ambassador'], { a: 10 });
  s.timerSec = 30;
  s.deadlineMs = 1;
  const r = apply(s, 'b', { type: 'timeout' }, 10_000);
  eq(r.error, undefined, 'timeout accepted');
  assert(influence(P(r.state, 'b')) === 1 || r.state.phase === 'lose_card', 'coup was launched');
});

test('no timer means timeouts are rejected outright', () => {
  const s = rig({ a: ['duke', 'duke'], b: ['captain', 'captain'] }, ['ambassador']);
  const r = apply(s, 'b', { type: 'timeout' }, Date.now() + 10_000_000);
  assert(!!r.error, 'rejected when the host set no timer');
});

/* ------------------------------------------------------------------ */

test('two-player game: the starting player begins with 1 coin', () => {
  const two = newGame(
    [
      { id: 'a', name: 'A' },
      { id: 'b', name: 'B' },
    ],
    () => 0.5,
  );
  eq(two.players[0].coins, 1, 'starter has 1');
  eq(two.players[1].coins, 2, 'opponent has 2');
  const three = newGame(
    [
      { id: 'a', name: 'A' },
      { id: 'b', name: 'B' },
      { id: 'c', name: 'C' },
    ],
    () => 0.5,
  );
  eq(
    three.players.map((p) => p.coins),
    [2, 2, 2],
    'three players all start with 2',
  );
});

test('stealing from a broke player is legal and takes nothing', () => {
  let s = rig({ a: ['captain', 'duke'], b: ['contessa', 'contessa'] }, ['ambassador'], {
    a: 3,
    b: 0,
  });
  s = mv(s, 'a', { type: 'declare', action: 'steal', target: 'b' });
  eq(s.phase, 'action_challenge', 'the claim stands to be challenged');
  s = mv(s, 'b', { type: 'pass' }); // no challenge
  s = mv(s, 'b', { type: 'pass' }); // no block
  eq(P(s, 'a').coins, 3, 'thief gained nothing');
  eq(P(s, 'b').coins, 0, 'victim still has nothing');
  eq(s.phase, 'action', 'turn ended cleanly');
});

/* ------------------------------------------------------------------ */

console.log(`\n${passed} assertions passed, ${failed} failed`);
if (failed > 0) process.exit(1);

/**
 * Coup engine — a pure reducer over GameState.
 *
 * Implements the complete 2013 rulebook:
 * - Income / Foreign Aid / Coup (mandatory at 10+ coins, unblockable)
 * - Tax (Duke), Assassinate (Assassin), Steal (Captain), Exchange (Ambassador)
 * - Blocks: Duke blocks Foreign Aid, Contessa blocks Assassination,
 *   Captain/Ambassador block Steal
 * - Challenges on any character claim (actions AND blocks), with the
 *   reshuffle-and-replace rule when a claim is proven
 * - Coin semantics: a successfully CHALLENGED action refunds its cost;
 *   a successfully BLOCKED action does not (the assassin's fee is lost)
 * - Steal takes min(2, target's coins)
 * - Losing both cards eliminates a player; last player standing wins
 */
import {
  ACTION_ROLE,
  ActionType,
  BLOCK_ROLES,
  GameState,
  LOG_CAP,
  LogEntry,
  Move,
  MoveResult,
  PendingAction,
  PlayerState,
  PlayerStats,
  Resume,
  Role,
  ROLES,
} from './types';

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function shuffle<T>(arr: T[], rand: () => number = Math.random): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function influence(p: PlayerState): number {
  return p.cards.filter((c) => !c.revealed).length;
}

export function isAlive(p: PlayerState): boolean {
  return influence(p) > 0;
}

function player(s: GameState, id: string): PlayerState {
  const p = s.players.find((x) => x.id === id);
  if (!p) throw new Error(`no player ${id}`);
  return p;
}

function alivePlayers(s: GameState): PlayerState[] {
  return s.players.filter(isAlive);
}

/** Bump one of a player's recap totals, creating the row on first use. */
type StatCounter = Exclude<keyof PlayerStats, 'biggestSteal'>;

function stat(s: GameState, id: string, key: keyof PlayerStats, by = 1) {
  s.stats = s.stats ?? {};
  const row = (s.stats[id] = s.stats[id] ?? {
    coinsGained: 0,
    stolen: 0,
    biggestSteal: 0,
    bluffsCalled: 0,
    challengesLost: 0,
    caughtBluffing: 0,
    blocks: 0,
    kills: 0,
  });
  if (key === 'biggestSteal') row.biggestSteal = Math.max(row.biggestSteal, by);
  else row[key as StatCounter] += by;
}

function log(s: GameState, key: string, params?: LogEntry['params']) {
  s.log.push({ key, ...(params ? { params } : {}) });
  // Keep the state bounded: the doc carries a rolling window, while the
  // UI accumulates the full session history locally.
  if (s.log.length > LOG_CAP) s.log.splice(0, s.log.length - LOG_CAP);
}

function nameOf(s: GameState, id: string): string {
  return player(s, id).name;
}

/** Players who still owe a response in the current window. */
export function pendingResponders(s: GameState): string[] {
  const p = s.pending;
  if (!p) return [];
  if (s.phase === 'action_challenge') {
    return alivePlayers(s)
      .filter((x) => x.id !== p.actor && !p.passed.includes(x.id))
      .map((x) => x.id);
  }
  if (s.phase === 'block') {
    if (p.action === 'foreign_aid') {
      return alivePlayers(s)
        .filter((x) => x.id !== p.actor && !p.passed.includes(x.id))
        .map((x) => x.id);
    }
    // steal / assassinate: only the target may respond
    const t = p.target ? s.players.find((x) => x.id === p.target) : undefined;
    return t && isAlive(t) && !p.passed.includes(t.id) ? [t.id] : [];
  }
  if (s.phase === 'block_challenge') {
    const blocker = p.block!.blocker;
    return alivePlayers(s)
      .filter((x) => x.id !== blocker && !p.passed.includes(x.id))
      .map((x) => x.id);
  }
  return [];
}

/* ------------------------------------------------------------------ */
/* Setup                                                               */
/* ------------------------------------------------------------------ */

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 6;

export function newGame(
  roster: { id: string; name: string }[],
  rand: () => number = Math.random,
  timerSec = 0,
  nowMs: number = Date.now(),
): GameState {
  if (roster.length < MIN_PLAYERS || roster.length > MAX_PLAYERS) {
    throw new Error('players must be 2-6');
  }
  const deck: Role[] = shuffle(
    ROLES.flatMap((r) => [r, r, r]),
    rand,
  );
  const players: PlayerState[] = roster.map((p) => ({
    id: p.id,
    name: p.name,
    coins: 2,
    cards: [
      { role: deck.pop()!, revealed: false },
      { role: deck.pop()!, revealed: false },
    ],
  }));
  // Official two-player rule: the starting player receives only 1 coin.
  if (players.length === 2) players[0].coins = 1;
  return {
    players,
    deck,
    turn: 0,
    phase: 'action',
    pending: null,
    lossQueue: [],
    winner: null,
    eliminated: [],
    timerSec,
    deadlineMs: timerSec > 0 ? nowMs + timerSec * 1000 : 0,
    stats: Object.fromEntries(
      players.map((p) => [
        p.id,
        {
          coinsGained: 0,
          stolen: 0,
          biggestSteal: 0,
          bluffsCalled: 0,
          challengesLost: 0,
          caughtBluffing: 0,
          blocks: 0,
          kills: 0,
        },
      ]),
    ),
    log: [],
    version: 0,
  };
}

/* ------------------------------------------------------------------ */
/* Reducer                                                             */
/* ------------------------------------------------------------------ */

export function apply(
  prev: GameState,
  playerId: string,
  move: Move,
  nowMs: number = Date.now(),
): MoveResult {
  // Deep clone: the reducer mutates its working copy freely.
  const s: GameState = JSON.parse(JSON.stringify(prev));
  s.eliminated = s.eliminated ?? []; // migrate pre-standings saves
  s.timerSec = s.timerSec ?? 0; // migrate pre-timer saves
  s.deadlineMs = s.deadlineMs ?? 0;
  s.stats = s.stats ?? {}; // migrate pre-stats saves
  try {
    applyMove(s, playerId, move, nowMs);
  } catch (e) {
    return { state: prev, error: e instanceof Error ? e.message : String(e) };
  }
  // Every decision gets a fresh clock.
  s.deadlineMs = s.timerSec > 0 && s.phase !== 'game_over' ? nowMs + s.timerSec * 1000 : 0;
  s.version = prev.version + 1;
  return { state: s };
}

function applyMove(s: GameState, playerId: string, move: Move, nowMs: number) {
  if (s.phase === 'game_over') throw new Error('game over');
  const me = player(s, playerId);

  if (move.type === 'forfeit') {
    forfeit(s, playerId);
    return;
  }
  if (move.type === 'timeout') {
    // Any living player may force the clock once it has expired, so an
    // absent player can never freeze the table.
    if (!s.timerSec || !s.deadlineMs) throw new Error('no timer');
    if (nowMs < s.deadlineMs) throw new Error('too early');
    if (!isAlive(me)) throw new Error('eliminated');
    forceTimeout(s);
    return;
  }
  if (!isAlive(me)) throw new Error('eliminated');

  switch (move.type) {
    case 'declare':
      requirePhase(s, 'action');
      if (s.players[s.turn].id !== playerId) throw new Error('not your turn');
      declare(s, me, move.action, move.target);
      return;
    case 'pass':
      if (!pendingResponders(s).includes(playerId)) throw new Error('no response owed');
      s.pending!.passed.push(playerId);
      if (pendingResponders(s).length === 0) closeWindow(s);
      return;
    case 'challenge':
      if (s.phase === 'action_challenge') {
        if (!pendingResponders(s).includes(playerId)) throw new Error('cannot challenge');
        resolveActionChallenge(s, playerId);
      } else if (s.phase === 'block_challenge') {
        if (!pendingResponders(s).includes(playerId)) throw new Error('cannot challenge');
        resolveBlockChallenge(s, playerId);
      } else {
        throw new Error('nothing to challenge');
      }
      return;
    case 'block': {
      requirePhase(s, 'block');
      const p = s.pending!;
      if (!pendingResponders(s).includes(playerId)) throw new Error('cannot block');
      const allowed = BLOCK_ROLES[p.action] ?? [];
      if (!allowed.includes(move.role)) throw new Error('invalid block role');
      p.block = { blocker: playerId, role: move.role };
      p.passed = [];
      s.phase = 'block_challenge';
      log(s, 'logBlockDeclared', { a: me.name, r: move.role });
      return;
    }
    case 'lose': {
      requirePhase(s, 'lose_card');
      const head = s.lossQueue[0];
      if (!head || head.playerId !== playerId) throw new Error('not your loss');
      const card = me.cards[move.cardIndex];
      if (!card || card.revealed) throw new Error('invalid card');
      revealCard(s, me, move.cardIndex);
      s.lossQueue.shift();
      afterLossProgress(s);
      return;
    }
    case 'exchange_keep': {
      requirePhase(s, 'exchange');
      const p = s.pending!;
      if (p.actor !== playerId) throw new Error('not your exchange');
      finishExchange(s, me, move.keep);
      return;
    }
  }
}

function requirePhase(s: GameState, phase: GameState['phase']) {
  if (s.phase !== phase) throw new Error(`wrong phase (${s.phase})`);
}

/* ------------------------------------------------------------------ */
/* Declaring actions                                                   */
/* ------------------------------------------------------------------ */

function declare(s: GameState, me: PlayerState, action: ActionType, target?: string) {
  if (me.coins >= 10 && action !== 'coup') throw new Error('must coup with 10+ coins');

  const needsTarget = action === 'coup' || action === 'assassinate' || action === 'steal';
  let tgt: PlayerState | undefined;
  if (needsTarget) {
    if (!target || target === me.id) throw new Error('target required');
    tgt = player(s, target);
    if (!isAlive(tgt)) throw new Error('target eliminated');
    // (a 0-coin target is legal: the rules only cap the amount taken, and
    // claiming Captain to bait a challenge is a real play)
  }

  switch (action) {
    case 'income':
      me.coins += 1;
      stat(s, me.id, 'coinsGained', 1);
      log(s, 'logIncome', { a: me.name });
      endTurn(s);
      return;

    case 'foreign_aid':
      s.pending = mkPending(action, me.id);
      s.phase = 'block';
      log(s, 'logForeignAidDeclared', { a: me.name });
      return;

    case 'coup':
      if (me.coins < 7) throw new Error('need 7 coins');
      me.coins -= 7;
      stat(s, me.id, 'kills');
      log(s, 'logCoup', { a: me.name, b: tgt!.name });
      s.pending = mkPending(action, me.id, target);
      queueLoss(s, tgt!.id, 'end_turn');
      return;

    case 'tax':
    case 'exchange':
    case 'assassinate':
    case 'steal': {
      if (action === 'assassinate') {
        if (me.coins < 3) throw new Error('need 3 coins');
        me.coins -= 3; // fee is spent now; refunded only on a lost challenge
      }
      const claimed = ACTION_ROLE[action]!;
      s.pending = mkPending(action, me.id, target, claimed);
      s.phase = 'action_challenge';
      log(s, 'logDeclared', { a: me.name, r: claimed, act: action });
      return;
    }
  }
}

function mkPending(
  action: ActionType,
  actor: string,
  target?: string,
  claimedRole?: Role,
): PendingAction {
  return {
    action,
    actor,
    ...(target ? { target } : {}),
    ...(claimedRole ? { claimedRole } : {}),
    passed: [],
  };
}

/* ------------------------------------------------------------------ */
/* Window closing / continuations                                      */
/* ------------------------------------------------------------------ */

function closeWindow(s: GameState) {
  const p = s.pending!;
  if (s.phase === 'action_challenge') {
    proceedAction(s);
  } else if (s.phase === 'block') {
    // Nobody blocked — the action resolves.
    resolveAction(s);
  } else if (s.phase === 'block_challenge') {
    blockStands(s);
  } else {
    throw new Error(`closeWindow in ${s.phase} (${p.action})`);
  }
}

/** The action's claim stood (unchallenged or challenge failed). */
function proceedAction(s: GameState) {
  const p = s.pending!;
  const actor = player(s, p.actor);
  if (!isAlive(actor)) {
    // Actor died mid-flow (shouldn't happen for own action, but be safe)
    endTurn(s);
    return;
  }
  switch (p.action) {
    case 'tax':
      actor.coins += 3;
      stat(s, actor.id, 'coinsGained', 3);
      log(s, 'logTax', { a: actor.name });
      endTurn(s);
      return;
    case 'exchange': {
      const n = Math.min(2, s.deck.length);
      p.drawn = s.deck.splice(0, n);
      s.phase = 'exchange';
      return;
    }
    case 'steal':
    case 'assassinate': {
      const tgt = player(s, p.target!);
      if (!isAlive(tgt)) {
        // Target was eliminated by a failed challenge — nothing to hit.
        endTurn(s);
        return;
      }
      s.phase = 'block';
      p.passed = [];
      return;
    }
    default:
      throw new Error(`proceedAction for ${p.action}`);
  }
}

/** No block (or the block failed) — apply the action's effect. */
function resolveAction(s: GameState) {
  const p = s.pending!;
  const actor = player(s, p.actor);
  switch (p.action) {
    case 'foreign_aid':
      actor.coins += 2;
      stat(s, actor.id, 'coinsGained', 2);
      log(s, 'logForeignAid', { a: actor.name });
      endTurn(s);
      return;
    case 'steal': {
      const tgt = player(s, p.target!);
      if (!isAlive(tgt)) {
        endTurn(s);
        return;
      }
      const n = Math.min(2, tgt.coins);
      tgt.coins -= n;
      actor.coins += n;
      stat(s, actor.id, 'coinsGained', n);
      stat(s, actor.id, 'stolen', n);
      stat(s, actor.id, 'biggestSteal', n);
      log(s, 'logSteal', { a: actor.name, b: tgt.name, n });
      endTurn(s);
      return;
    }
    case 'assassinate': {
      const tgt = player(s, p.target!);
      if (!isAlive(tgt)) {
        endTurn(s);
        return;
      }
      stat(s, actor.id, 'kills');
      log(s, 'logAssassinate', { a: actor.name, b: tgt.name });
      queueLoss(s, tgt.id, 'end_turn');
      return;
    }
    default:
      throw new Error(`resolveAction for ${p.action}`);
  }
}

/** The block stood — the action fails; coins paid remain spent. */
function blockStands(s: GameState) {
  const p = s.pending!;
  if (p.block) stat(s, p.block.blocker, 'blocks');
  if (p.action === 'foreign_aid') log(s, 'logForeignAidBlocked');
  else if (p.action === 'steal') log(s, 'logStealBlocked');
  else if (p.action === 'assassinate') log(s, 'logAssassinateBlocked');
  endTurn(s);
}

/* ------------------------------------------------------------------ */
/* Challenges                                                          */
/* ------------------------------------------------------------------ */

function hasUnrevealed(p: PlayerState, role: Role): number {
  return p.cards.findIndex((c) => !c.revealed && c.role === role);
}

/** Prove-a-claim: reveal, return to deck, shuffle, draw a replacement. */
function swapProvenCard(s: GameState, p: PlayerState, cardIndex: number) {
  const role = p.cards[cardIndex].role;
  s.deck.push(role);
  s.deck = shuffle(s.deck);
  p.cards[cardIndex] = { role: s.deck.pop()!, revealed: false };
}

function resolveActionChallenge(s: GameState, challengerId: string) {
  const p = s.pending!;
  const actor = player(s, p.actor);
  const challenger = player(s, challengerId);
  log(s, 'logChallenge', { a: challenger.name, b: actor.name });

  const idx = hasUnrevealed(actor, p.claimedRole!);
  if (idx >= 0) {
    // Claim proven: challenger loses a card, actor swaps the shown card.
    swapProvenCard(s, actor, idx);
    stat(s, challengerId, 'challengesLost');
    log(s, 'logChallengeFailed', { a: challenger.name, b: actor.name, r: p.claimedRole! });
    queueLoss(s, challengerId, 'proceed_action');
  } else {
    // Bluff caught: actor loses a card; the action fails and its cost
    // is refunded.
    stat(s, challengerId, 'bluffsCalled');
    stat(s, p.actor, 'caughtBluffing');
    log(s, 'logChallengeWon', { b: actor.name });
    if (p.action === 'assassinate') actor.coins += 3;
    queueLoss(s, p.actor, 'action_failed');
  }
}

function resolveBlockChallenge(s: GameState, challengerId: string) {
  const p = s.pending!;
  const blocker = player(s, p.block!.blocker);
  const challenger = player(s, challengerId);
  log(s, 'logChallenge', { a: challenger.name, b: blocker.name });

  const idx = hasUnrevealed(blocker, p.block!.role);
  if (idx >= 0) {
    swapProvenCard(s, blocker, idx);
    stat(s, challengerId, 'challengesLost');
    log(s, 'logChallengeFailed', { a: challenger.name, b: blocker.name, r: p.block!.role });
    queueLoss(s, challengerId, 'block_stands');
  } else {
    stat(s, challengerId, 'bluffsCalled');
    stat(s, p.block!.blocker, 'caughtBluffing');
    log(s, 'logChallengeWon', { b: blocker.name });
    queueLoss(s, p.block!.blocker, 'resolve_action');
  }
}

/* ------------------------------------------------------------------ */
/* Losses, elimination, win                                            */
/* ------------------------------------------------------------------ */

function queueLoss(s: GameState, playerId: string, resume: Resume) {
  if (s.pending) s.pending.resume = resume;
  else s.pending = { action: 'income', actor: playerId, passed: [], resume }; // never hit; safety
  s.lossQueue.push({ playerId });
  afterLossProgress(s);
}

/**
 * Drain the loss queue: skip dead entries, auto-reveal forced losses
 * (a single remaining card offers no choice), stop when a real choice
 * is owed, and apply the continuation when the queue is empty.
 */
function afterLossProgress(s: GameState) {
  while (s.lossQueue.length > 0) {
    const head = s.lossQueue[0];
    const p = player(s, head.playerId);
    const unrevealed = p.cards
      .map((c, i) => ({ c, i }))
      .filter(({ c }) => !c.revealed);
    if (unrevealed.length === 0) {
      s.lossQueue.shift(); // already eliminated — nothing to lose
      continue;
    }
    if (unrevealed.length === 1) {
      revealCard(s, p, unrevealed[0].i);
      s.lossQueue.shift();
      continue;
    }
    s.phase = 'lose_card';
    return;
  }
  if (s.phase === 'game_over') return;
  applyResume(s);
}

function revealCard(s: GameState, p: PlayerState, cardIndex: number) {
  p.cards[cardIndex].revealed = true;
  log(s, 'logLostCard', { a: p.name, r: p.cards[cardIndex].role });
  if (!isAlive(p)) {
    markEliminated(s, p);
    log(s, 'logEliminated', { a: p.name });
  }
  checkWin(s);
}

function markEliminated(s: GameState, p: PlayerState) {
  if (!s.eliminated.includes(p.id)) s.eliminated.push(p.id);
}

/**
 * Final ranking: everyone still alive first (the winner once the game is
 * over), then the eliminated in reverse elimination order — the last
 * player knocked out takes 2nd place.
 */
export function standings(s: GameState): PlayerState[] {
  const elim = s.eliminated ?? [];
  return [
    ...s.players.filter(isAlive),
    ...[...elim].reverse().map((id) => player(s, id)),
  ];
}

function checkWin(s: GameState) {
  const alive = alivePlayers(s);
  if (alive.length === 1) {
    s.winner = alive[0].id;
    s.phase = 'game_over';
    s.pending = null;
    s.lossQueue = [];
    log(s, 'logWinner', { a: alive[0].name });
  }
}

function applyResume(s: GameState) {
  const resume = s.pending?.resume;
  if (!s.pending || !resume) {
    // No pending continuation (e.g. loss handled at end of flow)
    if (s.phase !== 'game_over') endTurn(s);
    return;
  }
  s.pending.resume = undefined;
  switch (resume) {
    case 'proceed_action':
      proceedAction(s);
      return;
    case 'resolve_action':
      resolveAction(s);
      return;
    case 'action_failed':
    case 'end_turn':
      endTurn(s);
      return;
    case 'block_stands':
      blockStands(s);
      return;
  }
}

/* ------------------------------------------------------------------ */
/* Exchange                                                            */
/* ------------------------------------------------------------------ */

function finishExchange(s: GameState, me: PlayerState, keep: number[]) {
  const p = s.pending!;
  const handIdx = me.cards.map((c, i) => ({ c, i })).filter(({ c }) => !c.revealed);
  const pool: Role[] = [...handIdx.map(({ c }) => c.role), ...(p.drawn ?? [])];
  const need = handIdx.length;
  const uniq = [...new Set(keep)];
  if (uniq.length !== need || uniq.some((k) => k < 0 || k >= pool.length)) {
    throw new Error('invalid keep selection');
  }
  const kept = uniq.map((k) => pool[k]);
  const returned = pool.filter((_, i) => !uniq.includes(i));
  // Write kept roles back into the unrevealed slots
  handIdx.forEach(({ i }, n) => {
    me.cards[i] = { role: kept[n], revealed: false };
  });
  s.deck.push(...returned);
  s.deck = shuffle(s.deck);
  log(s, 'logExchange', { a: me.name });
  endTurn(s);
}

/* ------------------------------------------------------------------ */
/* Turn flow                                                           */
/* ------------------------------------------------------------------ */

function endTurn(s: GameState) {
  s.pending = null;
  if (s.phase === 'game_over') return;
  const n = s.players.length;
  for (let step = 1; step <= n; step++) {
    const idx = (s.turn + step) % n;
    if (isAlive(s.players[idx])) {
      s.turn = idx;
      s.phase = 'action';
      return;
    }
  }
  // No alive player found — should be unreachable (checkWin fires first)
  s.phase = 'game_over';
}

/* ------------------------------------------------------------------ */
/* Timeouts                                                            */
/* ------------------------------------------------------------------ */

/**
 * Resolve whatever the table is waiting for in the least damaging way:
 * the turn holder takes Income (or the forced Coup), pending responders
 * all pass, a card loss reveals the first card, and an exchange keeps
 * the hand as it is.
 */
function forceTimeout(s: GameState) {
  log(s, 'logTimeout');
  if (s.phase === 'action') {
    const actor = s.players[s.turn];
    if (actor.coins >= 10) {
      const target = alivePlayers(s).find((p) => p.id !== actor.id);
      if (target) {
        declare(s, actor, 'coup', target.id);
        return;
      }
    }
    declare(s, actor, 'income');
    return;
  }
  if (s.phase === 'lose_card') {
    const head = s.lossQueue[0];
    if (head) {
      const p = player(s, head.playerId);
      const idx = p.cards.findIndex((c) => !c.revealed);
      if (idx >= 0) {
        revealCard(s, p, idx);
        s.lossQueue.shift();
        afterLossProgress(s);
        return;
      }
    }
    return;
  }
  if (s.phase === 'exchange' && s.pending) {
    const me = player(s, s.pending.actor);
    const keep = me.cards
      .map((c, i) => ({ c, i }))
      .filter(({ c }) => !c.revealed)
      .map((_, n) => n); // keep the current hand, return what was drawn
    finishExchange(s, me, keep);
    return;
  }
  // a response window: everyone still owing simply passes
  const owed = pendingResponders(s);
  if (owed.length > 0 && s.pending) {
    s.pending.passed.push(...owed);
    closeWindow(s);
  }
}

/* ------------------------------------------------------------------ */
/* Forfeit                                                             */
/* ------------------------------------------------------------------ */

function forfeit(s: GameState, playerId: string) {
  const me = player(s, playerId);
  if (!isAlive(me)) throw new Error('already out');
  me.cards.forEach((c) => (c.revealed = true));
  markEliminated(s, me);
  log(s, 'logForfeit', { a: me.name });
  s.lossQueue = s.lossQueue.filter((l) => l.playerId !== playerId);
  // An exchange in flight holds cards drawn from the Court — return
  // them, or the deck shrinks for the rest of the game.
  if (s.pending?.drawn && s.pending.actor === playerId) {
    s.deck.push(...s.pending.drawn);
    s.deck = shuffle(s.deck);
    s.pending.drawn = undefined;
  }
  checkWin(s);
  if (s.phase === 'game_over') return;

  const p = s.pending;
  if (!p) {
    // phase 'action' — if it was their turn, move on
    if (s.players[s.turn].id === playerId) endTurn(s);
    return;
  }

  if (p.actor === playerId) {
    // Their own action dies with them — but losses already owed by
    // OTHER players (e.g. a failed challenger) must still be paid.
    if (s.lossQueue.length > 0) {
      p.resume = 'end_turn';
      afterLossProgress(s);
    } else {
      endTurn(s);
    }
    return;
  }
  if (p.block && p.block.blocker === playerId && s.phase === 'block_challenge') {
    // The blocker walked away — the block evaporates
    resolveAction(s);
    return;
  }
  if (s.phase === 'lose_card') {
    // If the head of the queue left, progress past them
    afterLossProgress(s);
    return;
  }
  if (s.phase === 'action_challenge' || s.phase === 'block' || s.phase === 'block_challenge') {
    // Their response is no longer owed — the window may now be complete
    if (s.phase === 'block' && p.target === playerId) {
      // Target of steal/assassinate left: nothing to resolve against
      endTurn(s);
      return;
    }
    if (pendingResponders(s).length === 0) closeWindow(s);
    return;
  }
}

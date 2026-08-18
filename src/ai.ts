/**
 * Bot AI — personality-driven Coup players for offline games.
 *
 * Every bot gets a stable persona derived from its id: how aggressive
 * it is, how suspicious, how often it bluffs, and how easily it backs
 * down. Bots hold grudges (they retaliate against whoever hit them
 * last, read from the game log), gang up on the leader, bluff actions
 * they don't hold, challenge and sometimes fail, and sometimes get
 * deceived by a confident block. Pure function over GameState — no
 * hidden state, deterministic persona, random dice.
 */
import { isAlive, pendingResponders } from './engine/engine';
import { BLOCK_ROLES, GameState, Move, PlayerState, Role } from './engine/types';

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** Cheap stable hash → [0,1) slices for persona traits. */
function trait(id: string, salt: number): number {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < id.length; i++) {
    h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  }
  return ((h >>> 0) % 1000) / 1000;
}

interface Persona {
  /** Appetite for coups / assassinations / steals. */
  aggression: number; // 0.35..0.85
  /** Multiplier on challenge instinct. */
  suspicion: number; // 0.55..1.45
  /** How often it claims cards it does not hold. */
  bluffiness: number; // 0.05..0.30
  /** Chance to retaliate against its last attacker. */
  grudge: number; // 0.45..0.85
}

export function personaOf(id: string): Persona {
  return {
    aggression: 0.35 + 0.5 * trait(id, 1),
    suspicion: 0.55 + 0.9 * trait(id, 2),
    bluffiness: 0.05 + 0.25 * trait(id, 3),
    grudge: 0.45 + 0.4 * trait(id, 4),
  };
}

/** Who hit me last? (coup / assassinate / steal against me, from the log) */
function lastAttacker(g: GameState, myId: string): string | undefined {
  const myName = g.players.find((p) => p.id === myId)?.name;
  if (!myName) return undefined;
  for (let i = g.log.length - 1; i >= 0; i--) {
    const e = g.log[i];
    if (
      (e.key === 'logCoup' || e.key === 'logAssassinate' || e.key === 'logSteal') &&
      e.params?.b === myName
    ) {
      const attacker = g.players.find((p) => p.name === e.params!.a);
      if (attacker && isAlive(attacker) && attacker.id !== myId) return attacker.id;
    }
  }
  return undefined;
}

/** Pick a victim: grudge first, then the table leader, then anyone. */
function chooseTarget(g: GameState, myId: string, pool: PlayerState[], me: Persona): string {
  const grudgeId = lastAttacker(g, myId);
  const grudgeTarget = pool.find((p) => p.id === grudgeId);
  if (grudgeTarget && Math.random() < me.grudge) return grudgeTarget.id;
  // The leader: most coins, influence breaks ties — everyone hates a winner.
  if (Math.random() < 0.6) {
    const leader = [...pool].sort(
      (a, b) =>
        b.coins + 2 * b.cards.filter((c) => !c.revealed).length -
        (a.coins + 2 * a.cards.filter((c) => !c.revealed).length),
    )[0];
    return leader.id;
  }
  return pick(pool).id;
}

export function decideBot(g: GameState, myId: string): Move | null {
  const me = g.players.find((p) => p.id === myId);
  if (!me || !isAlive(me) || g.phase === 'game_over') return null;
  const P = personaOf(myId);
  const myRoles = me.cards.filter((c) => !c.revealed).map((c) => c.role);
  const foes = g.players.filter((p) => p.id !== myId && isAlive(p));
  const richFoes = foes.filter((p) => p.coins > 0);

  if (g.phase === 'action' && g.players[g.turn].id === myId) {
    if (foes.length === 0) return null;
    // Mandatory coup at 10+; aggressive bots coup as soon as they can
    if (me.coins >= 10 || (me.coins >= 7 && Math.random() < P.aggression)) {
      return { type: 'declare', action: 'coup', target: chooseTarget(g, myId, foes, P) };
    }
    // Assassinate: with the card, or as a nervy bluff
    if (me.coins >= 3 && (myRoles.includes('assassin') || Math.random() < P.bluffiness * 0.5)) {
      if (Math.random() < P.aggression) {
        return { type: 'declare', action: 'assassinate', target: chooseTarget(g, myId, foes, P) };
      }
    }
    // Steal: with the captain, or as a bluff
    if (
      richFoes.length > 0 &&
      (myRoles.includes('captain') || Math.random() < P.bluffiness * 0.7)
    ) {
      if (Math.random() < P.aggression * 0.75) {
        return { type: 'declare', action: 'steal', target: chooseTarget(g, myId, richFoes, P) };
      }
    }
    // Exchange with the Court now and then
    if (myRoles.includes('ambassador') && Math.random() < 0.35) {
      return { type: 'declare', action: 'exchange' };
    }
    // Tax with a duke, or bluff it
    if (myRoles.includes('duke') || Math.random() < P.bluffiness) {
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
    // Block window: block for real when armed; bold bots bluff-block
    if (g.phase === 'block') {
      const options = (BLOCK_ROLES[p.action] ?? []).filter(
        (r) => p.action === 'foreign_aid' || p.target === myId,
      );
      const real = options.filter((r) => myRoles.includes(r));
      if (real.length > 0 && Math.random() < 0.85) return { type: 'block', role: pick(real) };
      if (options.length > 0 && Math.random() < P.bluffiness * 1.5) {
        return { type: 'block', role: pick(options) };
      }
      return { type: 'pass' };
    }
    // Challenge windows: shared table suspicion scaled by persona and
    // sharpened by card counting. Gullible bots (low suspicion) get
    // deceived by confident claims; paranoid ones overreach and fail.
    if (g.phase === 'action_challenge' || g.phase === 'block_challenge') {
      const claimed: Role | undefined =
        g.phase === 'action_challenge' ? p.claimedRole : p.block?.role;
      if (claimed) {
        const visible =
          myRoles.filter((r) => r === claimed).length +
          g.players.reduce(
            (k, pl) => k + pl.cards.filter((c) => c.revealed && c.role === claimed).length,
            0,
          );
        if (visible >= 3) return { type: 'challenge' }; // impossible claim
        const others = Math.max(1, g.players.filter(isAlive).length - 1);
        const chance = (0.28 / others) * (1 + visible * 0.9) * P.suspicion;
        if (Math.random() < chance) return { type: 'challenge' };
      }
      return { type: 'pass' };
    }
    return { type: 'pass' };
  }
  return null;
}

/**
 * Bot AI — a full (if simple) Coup player used for offline games.
 *
 * Pure decision function over GameState: real claims when the card is
 * held, occasional bluffs, honest blocks (and rare bluffed ones), a
 * moderate challenge instinct, and random targeting. The same policy
 * drives the headless test bots (scripts/bot.ts).
 */
import { isAlive, pendingResponders } from './engine/engine';
import { BLOCK_ROLES, GameState, Move } from './engine/types';

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function decideBot(g: GameState, myId: string): Move | null {
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
    // Challenge windows: suspicious roughly a quarter of the time
    if ((g.phase === 'action_challenge' || g.phase === 'block_challenge') && Math.random() < 0.25) {
      return { type: 'challenge' };
    }
    return { type: 'pass' };
  }
  return null;
}

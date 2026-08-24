/**
 * Coup engine — types.
 *
 * The whole game is a single serializable GameState plus a pure reducer
 * (see engine.ts). Every client renders from the same state; the player
 * whose input is awaited applies the reducer locally and commits the
 * resulting state to Firestore in a transaction.
 */

export type Role = 'duke' | 'assassin' | 'captain' | 'ambassador' | 'contessa';

export const ROLES: Role[] = ['duke', 'assassin', 'captain', 'ambassador', 'contessa'];

export type ActionType =
  | 'income'
  | 'foreign_aid'
  | 'coup'
  | 'tax'
  | 'assassinate'
  | 'steal'
  | 'exchange';

/** Which role a character action claims. */
export const ACTION_ROLE: Partial<Record<ActionType, Role>> = {
  tax: 'duke',
  assassinate: 'assassin',
  steal: 'captain',
  exchange: 'ambassador',
};

/** Roles that can block a given action. */
export const BLOCK_ROLES: Partial<Record<ActionType, Role[]>> = {
  foreign_aid: ['duke'],
  assassinate: ['contessa'],
  steal: ['captain', 'ambassador'],
};

export interface CardState {
  role: Role;
  revealed: boolean;
}

export interface PlayerState {
  id: string;
  name: string;
  coins: number;
  cards: CardState[];
}

export type Phase =
  | 'action' // current player must declare an action
  | 'action_challenge' // others may challenge the declared character action
  | 'block' // eligible player(s) may block or allow
  | 'block_challenge' // others may challenge the declared block
  | 'lose_card' // head of lossQueue must pick a card to turn face-up
  | 'exchange' // actor picks which cards to keep
  | 'game_over';

/** What to do once the pending loss queue drains. */
export type Resume =
  | 'proceed_action' // action survived its challenge → go to block window / resolve
  | 'resolve_action' // block window passed / block failed → apply the effect
  | 'action_failed' // action was successfully challenged → turn ends
  | 'block_stands' // block survived → action fails, coins stay spent
  | 'end_turn';

export interface PendingLoss {
  playerId: string;
}

export interface PendingAction {
  action: ActionType;
  actor: string;
  target?: string;
  /** Role claimed to perform the action (character actions only). */
  claimedRole?: Role;
  /** Declared block, if any. */
  block?: { blocker: string; role: Role };
  /** Players who passed in the current response window. */
  passed: string[];
  /** Cards drawn for an exchange (actor's eyes only). */
  drawn?: Role[];
  /** Continuation after the loss queue drains. */
  resume?: Resume;
}

export interface LogEntry {
  key: string; // i18n key
  params?: Record<string, string | number>;
}

export interface GameState {
  players: PlayerState[];
  deck: Role[];
  /** Index into players of the current turn holder. */
  turn: number;
  phase: Phase;
  pending: PendingAction | null;
  lossQueue: PendingLoss[];
  winner: string | null;
  /** Player ids in the order they were eliminated (first out first). */
  eliminated: string[];
  /** Seconds allowed per decision, chosen by the host. 0 = no timer. */
  timerSec: number;
  /** Absolute ms deadline for the decision now awaited. 0 = none. */
  deadlineMs: number;
  log: LogEntry[];
  /** Monotonic move counter (optimistic concurrency). */
  version: number;
}

export type Move =
  | { type: 'declare'; action: ActionType; target?: string }
  | { type: 'pass' }
  | { type: 'challenge' }
  | { type: 'block'; role: Role }
  | { type: 'lose'; cardIndex: number }
  | { type: 'exchange_keep'; keep: number[] } // indexes into [hand..., drawn...]
  | { type: 'forfeit' }
  /** The clock ran out: any player may force the awaited decision. */
  | { type: 'timeout' };

/** Log entries kept in state; the UI accumulates the full session locally. */
export const LOG_CAP = 80;

export interface MoveResult {
  state: GameState;
  error?: string;
}

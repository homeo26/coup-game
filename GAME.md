# Coup — Complete Game Specification

This document contains everything needed to reconstruct this game from
scratch: rules, characters, state machine, edge-case semantics, and the
multiplayer protocol. The rules text below is written in original words
(game design credit: Rikki Tahta / Indie Boards & Cards).

## 1. Overview

Coup is a bluffing card game for **2–6 players**. Each player secretly
holds **2 influence cards** drawn from a 15-card deck (3 copies each of
5 characters). Cards are "lives": when you lose an influence you turn
one of your cards permanently face-up. Lose both and you are eliminated.
**Last player with influence wins.**

The core mechanic: on your turn you may perform the action of ANY
character — whether or not you actually hold it. Any other player may
challenge the claim. Bluffs that survive unchallenged simply work.

## 2. Components

- 15 character cards: 3 × Duke, 3 × Assassin, 3 × Captain,
  3 × Ambassador, 3 × Contessa
- Coins (treasury is unlimited in the digital version)
- The undealt cards form the face-down **Court deck**

## 3. Setup

1. Shuffle all 15 cards; deal 2 to each player (kept secret, owner may
   look anytime). Remainder becomes the Court deck.
2. Each player starts with **2 coins**. Coin counts are public.
3. First player: winner of the previous game (digital version: seat 0).
   Turns proceed in seating order, skipping eliminated players.

## 4. Turn structure

On your turn you take **exactly one action**, then play passes left.

### General actions (no character claim, cannot be challenged)

| Action | Effect | Blockable? |
|---|---|---|
| **Income** | Take 1 coin | No |
| **Foreign Aid** | Take 2 coins | Yes — by a Duke claim (any player) |
| **Coup** | Pay 7 coins; chosen player loses 1 influence | No — always succeeds |

**Mandatory Coup:** a player who starts their turn with **10 or more
coins must Coup** — no other action is legal.

### Character actions (a claim — may be challenged)

| Character | Action | Effect | Blocked by |
|---|---|---|---|
| **Duke** | Tax | Take 3 coins | — |
| **Assassin** | Assassinate | Pay 3 coins; target loses 1 influence | Contessa |
| **Captain** | Steal | Take 2 coins from a target (only 1 if they have 1; a 0-coin player cannot be targeted) | Captain or Ambassador |
| **Ambassador** | Exchange | Draw 2 from the Court, keep any combination totalling your current influence count, return 2, reshuffle | — |
| **Contessa** | *(no action — block only)* | — | — |

### Counteractions (blocks)

- Blocks are **also claims** and may be bluffed and challenged.
- Foreign Aid may be blocked by **any** player claiming Duke.
- Steal / Assassinate may be blocked only by the **target**.
- An unchallenged block automatically succeeds: the action fails, **but
  any coins paid as its cost remain spent** (a blocked Assassin still
  loses the 3-coin fee).

## 5. Challenges

- **Any action or counteraction that claims a character can be
  challenged by any other living player**, involved or not, before play
  continues (never retroactively).
- The challenged player must prove the claim by revealing the claimed
  character among their face-down cards:
  - **Claim proven:** the challenger immediately loses 1 influence. The
    prover returns the shown card to the Court, reshuffles, and draws a
    random replacement (so their influence count is unchanged and the
    new card is unknown). The action/block then proceeds.
  - **Claim was a bluff:** the claimer loses 1 influence. A challenged
    *action* fails entirely and **its cost is refunded** (Assassin gets
    the 3 coins back). A failed *block* means the original action
    resolves.

### Notable interaction — the double loss

If the target of a real Assassin challenges and loses, they lose one
card for the failed challenge and can still be hit by the assassination
(losing the second) — elimination in a single turn.

## 6. Losing influence & winning

- Losing influence = the owner **chooses** which face-down card to turn
  face-up (revealed cards stay visible to everyone).
  Digital: with only one card left the reveal is forced/automatic.
- A player with both cards revealed is eliminated and skipped.
- When one player remains, they win immediately.
- The engine records the **elimination order** (`eliminated: string[]`,
  first-out first). Final standings = winner, then the eliminated in
  reverse order (the last player knocked out is 2nd). Exposed via
  `standings(state)` and shown as a ranked list on the game-over screen.
- Digital extra: **forfeit** (leaving mid-game) reveals all of the
  leaver's cards and joins the elimination order; any pending window
  they owed a response to is re-evaluated so the game never stalls.

## 7. The characters (visual identity)

Per-role signature colors used across the UI, with both a vector emblem
and a portrait avatar:

| Role | Color | Emblem | Personality on card art |
|---|---|---|---|
| Duke | crimson `#c8355b` | five-point star in a ring | robed, imperious |
| Assassin | steel `#8b93a3` | skull with crossed eyes | dark hood, masked |
| Captain | blue `#4d8fdb` | double chevrons | scarred enforcer |
| Ambassador | olive `#a8b23e` | two diamonds exchanging | tan/warm diplomat |
| Contessa | scarlet `#e05a33` | crest shield with bars | red dress, dark hair |

App theme: dystopian court — warm near-black background `#12100d`,
antique gold `#d4a854` (light `#f5d68c`, dark `#8c6828`), ink
`#f0e8d8`. Coin motif: gold coin stamped with a 5-point star (one point
per character).

## 8. Engine state machine (implementation contract)

State is a single serializable object (see `src/engine/types.ts`):

```
players[]: { id, name, coins, cards: [{role, revealed}] }
deck: Role[]            // Court
turn: number            // index of current player
phase: 'action' | 'action_challenge' | 'block' | 'block_challenge'
     | 'lose_card' | 'exchange' | 'game_over'
pending: { action, actor, target?, claimedRole?, block?{blocker, role},
           passed[], drawn?, resume? } | null
lossQueue: [{playerId}] // ordered pending influence losses
winner, log[], version
```

Moves: `declare(action, target?)`, `pass`, `challenge`, `block(role)`,
`lose(cardIndex)`, `exchange_keep(indexes)`, `forfeit`.

### Phase flow per action

- `income` → apply, end turn (no windows).
- `coup` → pay 7 → target queued in `lose_card` → end turn.
- `foreign_aid` → `block` window (responders: all living non-actors).
  All pass → +2, end turn. Block declared → `block_challenge` window
  (responders: all living except blocker) → all pass = block stands.
- `tax`/`exchange`/`steal`/`assassinate` → `action_challenge` window
  (responders: all living non-actors). All pass →
  - `tax`: +3, end turn.
  - `exchange`: draw 2 → `exchange` phase → keep selection → return 2,
    shuffle, end turn.
  - `steal`/`assassinate`: `block` window (responder: target only) →
    all pass → resolve (transfer coins / queue target loss).
- Challenge resolution enqueues a loss and records a `resume`
  continuation (`proceed_action`, `resolve_action`, `action_failed`,
  `block_stands`, `end_turn`) applied after the loss queue drains.
- Every reveal checks for elimination and win; `game_over` locks moves.
- Assassinate pays its 3-coin fee **at declaration**; refunded only when
  the actor's claim is successfully challenged.
- Window bookkeeping: `passed[]` holds responders who passed; a window
  closes when the eligible-responder set (recomputed from live players)
  is exhausted — so deaths/forfeits mid-window can close it.

## 9. Multiplayer protocol

- One Firestore doc per room: `coup_rooms/{4-letter code}` with
  `{ hostId, status: lobby|playing, roster[], gameJson, timestamps }`.
  `gameJson` is the full engine state as a JSON string.
- Identity: a random per-install id persisted on device. No accounts.
- Every move: Firestore **transaction** — read doc → run the pure
  reducer locally → write the new state. Stale concurrent moves fail
  validation against the fresh state and are dropped.
- All clients subscribe with `onSnapshot` and render from the same
  state; each device only *displays* its own hidden cards (hidden
  information is UI-level, acceptable for friendly play).
- Reconnect: the active room code is persisted locally and re-attached
  on launch. Leaving a lobby removes you from the roster (host leaving
  deletes the room); leaving a live game forfeits.
- Room codes: 4 letters from `ABCDEFGHJKLMNPQRSTUVWXYZ` (no I/O).
- **Garbage collection** (no server, so clients clean up):
  - Leaving a playing room records the leaver in a `left[]` field; the
    last participant to leave **deletes the doc**.
  - Moves that end the game stamp `finishedAtMs`; every room creation
    sweeps finished games older than 2h — chat, history, everything —
    plus any room older than 24h (`createdAtMs`).
  - `playAgain` resets `left`, clears `chat` and `finishedAtMs`.

### Offline mode (vs bots)

- `playLocal(name, botCount 1–5)` runs the same engine entirely
  in-memory — no Firestore, works with no connection.
- Bot policy (`src/ai.ts`, shared with the headless test bots): coup at
  10+ (mandatory) and often at 7+, assassinate/steal/tax/exchange with
  real claims, occasional bluffs, honest blocks (rare bluffed ones),
  ~25% challenge instinct, random targets.
- A driver effect lets one bot act per state change (short human-ish
  delay); the local game is presented through the same `Room` shape so
  the entire game UI is reused unchanged (room code shows `BOTS`).

## 10. UX contract

- Three always-mounted tabs (Play / Rules / More) in a pager; the Play
  tab morphs Home → Lobby → Game table with the room status.
- The table IS a table: a green-felt, silver-rimmed rounded surface
  with opponents **seated around the rim** (1–5 seats mapped to arc
  anchors), the Court deck and event banner at its center, and your
  hand at the bottom edge — a real card-table read.
- Each seat: animal avatar with a fading turn-glow ring, a mini card
  fan behind the head (face-down backs; lost cards show the character's
  emblem in its color), name chip, coin count, response/dead badges.
- The header deck chip opens the **deck tracker**: all 15 court cards
  as 5 roles × 3 pips — revealed (dead, ✗) vs still hidden — plus
  Court-deck and hidden-in-hands counts (public information only).
- The bottom context panel morphs by phase: action chips on your turn
  (with target-selection mode for coup/steal/assassinate), Challenge /
  Allow prompts, Block-with-X buttons, card-loss picker, exchange
  keeper, waiting states, and a game-over overlay with **ranked
  standings** (1st = winner, then reverse elimination order; host gets
  Play-again).
- Motion: every interactive element uses press feedback (scale+fade);
  every new game event floats an animated **banner in the free table
  space** (never covering player rows) and re-animates the log strip;
  coin counts pulse on change; the turn glow **fades between seats**
  (border tint + halo ease in/out, small scale nudge on the new turn
  holder); panels cross-fade per turn/phase.
- Whenever the game needs the player's input, the phase panel rises as
  a **bottom sheet** anchored to the screen edge — it can never be
  pushed off-screen by a full table; seats stay visible and tappable
  above it (the card-loss picker offers the cards inside the sheet).
- **In-room chat** (`chat[]` on the room doc, capped at 40 entries):
  its own tab appears while in a room, with an unread badge, quick
  emote row, and canned taunts. Emotes/taunts float over the sender's
  seat for ~3.5s. Offline bots emote occasionally after moves.
- **Avatars**: each player picks one of 12 animal faces (Kenney Animal
  Pack, CC0) on the Home screen (persisted); shown in the lobby, table
  seats, chat and final standings. Offline bots get distinct animals.
  Legacy character-portrait avatars from old clients still render.
- **Table music**: a quiet CC0 inn loop plays app-wide (settings
  toggle), pausing when the app is backgrounded.
- **Character voices**: each character announces its own action in a
  distinct voice — Duke "takes three coins", Captain "steals two coins",
  Ambassador "exchanges with the Court", Assassin "strikes, lose one
  influence", Contessa "blocks the assassination" (played on the claim,
  bluffs included). Five different speakers, each with its own register
  and room (scripts/gen-voices.sh).
- **Audio robustness**: SFX play in iOS silent mode (the in-app toggles
  are the mute control), mix rather than fight for focus, every player
  is preloaded at startup, a swallowed first play is retried, and a
  broken player is dropped and rebuilt — audio can never break play.
- Full Arabic + English; layout direction is applied manually per
  component (native direction stays LTR).
- 10+ coins: UI disables everything except Coup and says why.

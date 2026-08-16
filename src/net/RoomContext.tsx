/**
 * RoomContext — owns the active room lifecycle: create/join/leave,
 * the live Firestore subscription, reconnect on app relaunch, and
 * dispatching engine moves. UI reads `room` + `myId` and renders.
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { GameState, Move } from '../engine/types';
import { apply, newGame } from '../engine/engine';
import { decideBot } from '../ai';
import { t } from '../i18n';
import {
  Room,
  commitMove,
  createRoom,
  getActiveRoom,
  getInstallId,
  joinRoom,
  leaveRoom,
  playAgain,
  saveActiveRoom,
  startGame,
  watchRoom,
} from './rooms';

export const LOCAL_CODE = 'BOTS';

interface RoomState {
  myId: string | null;
  code: string | null;
  room: Room | null;
  /** True when playing offline against bots (no network involved). */
  isLocal: boolean;
  /** True while restoring a previous session or joining. */
  busy: boolean;
  create: (name: string) => Promise<void>;
  join: (code: string, name: string) => Promise<void>;
  /** Start an offline game against `bots` AI opponents. */
  playLocal: (name: string, bots: number) => void;
  start: () => Promise<void>;
  move: (m: Move) => Promise<string | null>;
  leave: () => Promise<void>;
  again: () => Promise<void>;
}

const RoomContext = createContext<RoomState>({
  myId: null,
  code: null,
  room: null,
  isLocal: false,
  busy: false,
  create: async () => {},
  join: async () => {},
  playLocal: () => {},
  start: async () => {},
  move: async () => null,
  leave: async () => {},
  again: async () => {},
});

export function RoomProvider({ children }: { children: React.ReactNode }) {
  const [myId, setMyId] = useState<string | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [busy, setBusy] = useState(true);
  const [localGame, setLocalGame] = useState<GameState | null>(null);
  const unsubRef = useRef<(() => void) | null>(null);
  const botTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const attach = useCallback((roomCode: string) => {
    unsubRef.current?.();
    setCode(roomCode);
    unsubRef.current = watchRoom(roomCode, (r) => {
      setRoom(r);
      if (r === null) {
        // Room deleted (host left the lobby / cleanup)
        setCode(null);
        saveActiveRoom(null).catch(() => {});
      }
    });
  }, []);

  const detach = useCallback(() => {
    unsubRef.current?.();
    unsubRef.current = null;
    setCode(null);
    setRoom(null);
  }, []);

  // Restore identity + previous session on launch
  useEffect(() => {
    (async () => {
      try {
        const id = await getInstallId();
        setMyId(id);
        const saved = await getActiveRoom();
        if (saved) attach(saved);
      } finally {
        setBusy(false);
      }
    })();
    return () => unsubRef.current?.();
  }, [attach]);

  /* ----- offline vs bots ----- */

  const isLocal = localGame !== null;

  // Bot driver: after every state change, let the next bot who owes a
  // move act, with a small delay so the table reads naturally.
  useEffect(() => {
    if (!localGame || !myId || localGame.phase === 'game_over') return;
    const botId = localGame.players
      .map((p) => p.id)
      .find((id) => id !== myId && decideBot(localGame, id) !== null);
    if (!botId) return;
    botTimer.current = setTimeout(() => {
      setLocalGame((g) => {
        if (!g || g.phase === 'game_over') return g;
        const m = decideBot(g, botId);
        if (!m) return { ...g }; // retrigger — another bot may owe a move
        const r = apply(g, botId, m);
        return r.error ? { ...g } : r.state;
      });
    }, 650 + Math.random() * 650);
    return () => {
      if (botTimer.current) clearTimeout(botTimer.current);
    };
  }, [localGame, myId]);

  const playLocal = useCallback(
    (name: string, bots: number) => {
      if (!myId) return;
      const n = Math.max(1, Math.min(5, bots));
      const roster = [
        { id: myId, name },
        ...Array.from({ length: n }, (_, i) => ({
          id: `bot-${i + 1}`,
          name: t('botName', { n: i + 1 }),
        })),
      ];
      detach();
      setLocalGame(newGame(roster));
    },
    [myId, detach],
  );

  /* ----- shared API (routes to local or Firestore) ----- */

  const create = useCallback(
    async (name: string) => {
      setBusy(true);
      try {
        const newCode = await createRoom(name);
        attach(newCode);
      } finally {
        setBusy(false);
      }
    },
    [attach],
  );

  const join = useCallback(
    async (joinCode: string, name: string) => {
      setBusy(true);
      try {
        await joinRoom(joinCode, name);
        attach(joinCode);
      } finally {
        setBusy(false);
      }
    },
    [attach],
  );

  const start = useCallback(async () => {
    if (code) await startGame(code);
  }, [code]);

  const move = useCallback(
    async (m: Move) => {
      if (localGame && myId) {
        const r = apply(localGame, myId, m);
        if (!r.error) setLocalGame(r.state);
        return r.error ?? null;
      }
      if (!code) return 'no room';
      return commitMove(code, m);
    },
    [code, localGame, myId],
  );

  const leave = useCallback(async () => {
    if (localGame) {
      if (botTimer.current) clearTimeout(botTimer.current);
      setLocalGame(null);
      return;
    }
    const c = code;
    detach();
    if (c) await leaveRoom(c).catch(() => {});
  }, [code, detach, localGame]);

  const again = useCallback(async () => {
    if (localGame && myId) {
      const roster = localGame.players.map((p) => ({ id: p.id, name: p.name }));
      setLocalGame(newGame(roster));
      return;
    }
    if (code) await playAgain(code);
  }, [code, localGame, myId]);

  // A local game is presented through the same Room shape the UI knows.
  const effectiveRoom: Room | null = useMemo(() => {
    if (localGame && myId) {
      return {
        code: LOCAL_CODE,
        hostId: myId,
        status: 'playing',
        roster: localGame.players.map((p) => ({ id: p.id, name: p.name })),
        game: localGame,
      };
    }
    return room;
  }, [localGame, myId, room]);

  const value = useMemo(
    () => ({
      myId,
      code: isLocal ? LOCAL_CODE : code,
      room: effectiveRoom,
      isLocal,
      busy,
      create,
      join,
      playLocal,
      start,
      move,
      leave,
      again,
    }),
    [myId, code, effectiveRoom, isLocal, busy, create, join, playLocal, start, move, leave, again],
  );

  return <RoomContext.Provider value={value}>{children}</RoomContext.Provider>;
}

export const useRoom = () => useContext(RoomContext);

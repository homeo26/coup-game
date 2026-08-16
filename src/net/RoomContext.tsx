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
import { Move } from '../engine/types';
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

interface RoomState {
  myId: string | null;
  code: string | null;
  room: Room | null;
  /** True while restoring a previous session or joining. */
  busy: boolean;
  create: (name: string) => Promise<void>;
  join: (code: string, name: string) => Promise<void>;
  start: () => Promise<void>;
  move: (m: Move) => Promise<string | null>;
  leave: () => Promise<void>;
  again: () => Promise<void>;
}

const RoomContext = createContext<RoomState>({
  myId: null,
  code: null,
  room: null,
  busy: false,
  create: async () => {},
  join: async () => {},
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
  const unsubRef = useRef<(() => void) | null>(null);

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
      if (!code) return 'no room';
      return commitMove(code, m);
    },
    [code],
  );

  const leave = useCallback(async () => {
    const c = code;
    detach();
    if (c) await leaveRoom(c).catch(() => {});
  }, [code, detach]);

  const again = useCallback(async () => {
    if (code) await playAgain(code);
  }, [code]);

  const value = useMemo(
    () => ({ myId, code, room, busy, create, join, start, move, leave, again }),
    [myId, code, room, busy, create, join, start, move, leave, again],
  );

  return <RoomContext.Provider value={value}>{children}</RoomContext.Provider>;
}

export const useRoom = () => useContext(RoomContext);

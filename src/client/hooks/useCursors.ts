import { useEffect, useRef, useCallback, useState } from "react";
import type { ClientMessage, ServerMessage } from "../../types";

interface CursorPosition {
  x: number;
  y: number;
  name: string;
  color: string;
  lastSeen: number;
}

// Agent-friendly hook: automated visitors that navigate by manipulating the DOM
// (rather than moving a real mouse) can call window.freeretro.moveCursor(clientX,
// clientY) to broadcast their pointer to everyone else in the room, just like a
// human moving the mouse does.
declare global {
  interface Window {
    freeretro?: {
      moveCursor: (clientX: number, clientY: number) => boolean;
    };
  }
}

export function useCursors(
  send: (msg: ClientMessage) => void,
  subscribe: (handler: (msg: ServerMessage) => void) => () => void,
  userId: string,
  users: { id: string; name: string; color: string }[],
) {
  const [cursors, setCursors] = useState<Map<string, CursorPosition>>(new Map());
  const userColorsRef = useRef<Map<string, string>>(new Map());
  const lastSendRef = useRef(0);
  const boardRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    userColorsRef.current = new Map(users.map((user) => [user.id, user.color]));
  }, [users]);

  // Track remote cursors
  useEffect(() => {
    return subscribe((msg) => {
      if (msg.type === "state") {
        userColorsRef.current = new Map(msg.users.map((user) => [user.id, user.color]));
      }

      if (msg.type === "user:joined") {
        userColorsRef.current.set(msg.user.id, msg.user.color);
      }

      if (msg.type === "cursor" && msg.userId !== userId) {
        setCursors((prev) => {
          const next = new Map(prev);
          next.set(msg.userId, {
            x: msg.x,
            y: msg.y,
            name: msg.name,
            color: msg.color ?? userColorsRef.current.get(msg.userId) ?? "#FF4801",
            lastSeen: Date.now(),
          });
          return next;
        });
      }

      if (msg.type === "user:left") {
        setCursors((prev) => {
          const next = new Map(prev);
          next.delete(msg.userId);
          return next;
        });
      }
    });
  }, [subscribe, userId]);

  // Clean up stale cursors every 3 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setCursors((prev) => {
        const now = Date.now();
        const next = new Map(prev);
        for (const [id, cursor] of next) {
          if (now - cursor.lastSeen > 5000) {
            next.delete(id);
          }
        }
        return next.size !== prev.size ? next : prev;
      });
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  // Convert viewport coordinates to board-relative ratios and broadcast.
  const broadcastCursor = useCallback(
    (clientX: number, clientY: number) => {
      const board = boardRef.current;
      if (!board) return false;

      const rect = board.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return false;

      const x = (clientX - rect.left) / rect.width;
      const y = (clientY - rect.top) / rect.height;

      send({ type: "cursor", x, y });
      return true;
    },
    [send],
  );

  // Broadcast local cursor position from real pointer movement, throttled.
  const handlePointerMove = useCallback(
    (e: PointerEvent | MouseEvent) => {
      const now = Date.now();
      if (now - lastSendRef.current < 50) return;
      lastSendRef.current = now;
      broadcastCursor(e.clientX, e.clientY);
    },
    [broadcastCursor],
  );

  useEffect(() => {
    const board = boardRef.current;
    if (!board) return;
    // pointermove covers mouse, pen, and touch, and is dispatched by automated
    // browser tooling; mousemove is kept as a fallback. The shared throttle in
    // handlePointerMove dedupes when both fire.
    board.addEventListener("pointermove", handlePointerMove);
    board.addEventListener("mousemove", handlePointerMove);
    return () => {
      board.removeEventListener("pointermove", handlePointerMove);
      board.removeEventListener("mousemove", handlePointerMove);
    };
  }, [handlePointerMove]);

  // Expose a programmatic cursor API for agents that don't move a real mouse.
  useEffect(() => {
    window.freeretro = {
      moveCursor: (clientX: number, clientY: number) => broadcastCursor(clientX, clientY),
    };
    return () => {
      delete window.freeretro;
    };
  }, [broadcastCursor]);

  return { cursors, boardRef };
}

import { useEffect, useRef, useCallback, useState } from "react";
import type { ClientMessage, ServerMessage } from "../../types";
import { durationForDistance, easeInOutCubic } from "../agent/embodiment";

interface CursorPosition {
  x: number;
  y: number;
  name: string;
  color: string;
  lastSeen: number;
}

interface MoveOptions {
  animate?: boolean;
}

// How often an embodied (agent) cursor re-announces its position so observers
// don't cull it. Must stay below the 5s stale-cursor cutoff below.
const HEARTBEAT_MS = 3000;

export function useCursors(
  send: (msg: ClientMessage) => void,
  subscribe: (handler: (msg: ServerMessage) => void) => () => void,
  userId: string,
  users: { id: string; name: string; color: string }[],
  connected: boolean,
) {
  const [cursors, setCursors] = useState<Map<string, CursorPosition>>(new Map());
  const userColorsRef = useRef<Map<string, string>>(new Map());
  const lastSendRef = useRef(0);
  const boardRef = useRef<HTMLDivElement | null>(null);

  // Embodiment state. Automated browsers (navigator.webdriver) get a visible,
  // persistent cursor by default; humans keep the original behavior.
  const embodiedRef = useRef(typeof navigator !== "undefined" && navigator.webdriver === true);
  const currentPosRef = useRef<{ x: number; y: number } | null>(null);
  const connectedRef = useRef(connected);
  const animRef = useRef<{ interval: ReturnType<typeof setInterval>; resolve: () => void } | null>(
    null,
  );

  useEffect(() => {
    connectedRef.current = connected;
  }, [connected]);

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

      currentPosRef.current = { x: clientX, y: clientY };
      send({
        type: "cursor",
        x: (clientX - rect.left) / rect.width,
        y: (clientY - rect.top) / rect.height,
      });
      return true;
    },
    [send],
  );

  const cancelAnimation = useCallback(() => {
    if (animRef.current) {
      clearInterval(animRef.current.interval);
      animRef.current.resolve();
      animRef.current = null;
    }
  }, []);

  // Move the cursor to a viewport coordinate. When embodied and animated, glide
  // there along an eased path so observers can follow; otherwise jump directly.
  const moveCursorTo = useCallback(
    (clientX: number, clientY: number, options?: MoveOptions): Promise<void> => {
      const animate = options?.animate ?? true;
      if (!animate || !embodiedRef.current) {
        broadcastCursor(clientX, clientY);
        return Promise.resolve();
      }

      cancelAnimation();
      const from = currentPosRef.current ?? { x: clientX, y: clientY };
      const dx = clientX - from.x;
      const dy = clientY - from.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 1) {
        broadcastCursor(clientX, clientY);
        return Promise.resolve();
      }

      const duration = durationForDistance(dist);
      const start = performance.now();
      return new Promise<void>((resolve) => {
        const interval = setInterval(() => {
          const t = Math.min(1, (performance.now() - start) / duration);
          const e = easeInOutCubic(t);
          broadcastCursor(from.x + dx * e, from.y + dy * e);
          if (t >= 1) {
            clearInterval(interval);
            animRef.current = null;
            resolve();
          }
        }, 28);
        animRef.current = { interval, resolve };
      });
    },
    [broadcastCursor, cancelAnimation],
  );

  // Place the cursor at the center of the board (used on join).
  const broadcastCenter = useCallback(() => {
    const board = boardRef.current;
    if (!board) return;
    const rect = board.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    broadcastCursor(rect.left + rect.width / 2, rect.top + rect.height / 2);
  }, [broadcastCursor]);

  const setEmbodied = useCallback(
    (value: boolean) => {
      embodiedRef.current = value;
      if (value && connectedRef.current && !currentPosRef.current) {
        broadcastCenter();
      }
    },
    [broadcastCenter],
  );

  const isEmbodied = useCallback(() => embodiedRef.current, []);

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

  // Show the agent's cursor immediately on join.
  useEffect(() => {
    if (!connected || !embodiedRef.current) return;
    const timeout = setTimeout(broadcastCenter, 250);
    return () => clearTimeout(timeout);
  }, [connected, broadcastCenter]);

  // Keep an idle agent cursor alive so observers don't cull it.
  useEffect(() => {
    const interval = setInterval(() => {
      const pos = currentPosRef.current;
      if (connectedRef.current && embodiedRef.current && pos) {
        broadcastCursor(pos.x, pos.y);
      }
    }, HEARTBEAT_MS);
    return () => clearInterval(interval);
  }, [broadcastCursor]);

  useEffect(() => cancelAnimation, [cancelAnimation]);

  return { cursors, boardRef, broadcastCursor, moveCursorTo, setEmbodied, isEmbodied };
}

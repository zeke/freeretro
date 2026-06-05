import { useEffect, useRef, useCallback, useState } from "react";
import type { ClientMessage, CursorAnchor, ServerMessage } from "../../types";
import { computeAnchor } from "../agent/anchor";

export interface CursorPosition {
  x: number;
  y: number;
  anchor?: CursorAnchor;
  name: string;
  color: string;
  lastSeen: number;
}

export interface ClickRipple {
  x: number;
  y: number;
  anchor?: CursorAnchor;
  color: string;
  born: number;
}

interface MoveOptions {
  animate?: boolean;
}

// How often an embodied (agent) cursor re-announces its position so observers
// don't cull it. Must stay below the 5s stale-cursor cutoff below.
const HEARTBEAT_MS = 3000;

// The sender only broadcasts where it wants the cursor to be; observers animate
// the glide. These estimate how long a move takes purely so the agent can time
// its dwell/click after a move. They do not affect what observers see.
const MOVE_SPEED_PX_PER_MS = 1.6;
const MIN_MOVE_MS = 220;
const MAX_MOVE_MS = 800;

function estimateMoveMs(distance: number): number {
  return Math.min(MAX_MOVE_MS, Math.max(MIN_MOVE_MS, distance / MOVE_SPEED_PX_PER_MS));
}

export function useCursors(
  send: (msg: ClientMessage) => void,
  subscribe: (handler: (msg: ServerMessage) => void) => () => void,
  userId: string,
  users: { id: string; name: string; color: string }[],
  connected: boolean,
) {
  const [cursors, setCursors] = useState<Map<string, CursorPosition>>(new Map());
  const [clicks, setClicks] = useState<Map<string, ClickRipple>>(new Map());
  // userId -> cardId for cards other people are currently dragging.
  const [drags, setDrags] = useState<Map<string, string>>(new Map());
  const dragTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const userColorsRef = useRef<Map<string, string>>(new Map());
  const lastSendRef = useRef(0);
  const boardRef = useRef<HTMLDivElement | null>(null);

  // Embodiment state. Automated browsers (navigator.webdriver) get a visible,
  // persistent cursor by default; humans keep the original behavior.
  const embodiedRef = useRef(typeof navigator !== "undefined" && navigator.webdriver === true);
  const connectedRef = useRef(connected);

  // The sender tracks only its last logical position (for distance estimates and
  // anchoring). Visible easing happens on each observer.
  const posRef = useRef<{ x: number; y: number } | null>(null);

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
            anchor: msg.anchor,
            name: msg.name,
            color: msg.color ?? userColorsRef.current.get(msg.userId) ?? "#FF4801",
            lastSeen: Date.now(),
          });
          return next;
        });
      }

      if (msg.type === "click" && msg.userId !== userId) {
        const id = crypto.randomUUID();
        const color = msg.color ?? userColorsRef.current.get(msg.userId) ?? "#FF4801";
        setClicks((prev) => {
          const next = new Map(prev);
          next.set(id, { x: msg.x, y: msg.y, anchor: msg.anchor, color, born: performance.now() });
          return next;
        });
        setTimeout(() => {
          setClicks((prev) => {
            if (!prev.has(id)) return prev;
            const next = new Map(prev);
            next.delete(id);
            return next;
          });
        }, 600);
      }

      if (msg.type === "drag:start" && msg.userId !== userId) {
        const dragUserId = msg.userId;
        setDrags((prev) => {
          const next = new Map(prev);
          next.set(dragUserId, msg.cardId);
          return next;
        });
        const timers = dragTimersRef.current;
        clearTimeout(timers.get(dragUserId));
        timers.set(
          dragUserId,
          setTimeout(() => {
            setDrags((prev) => {
              if (!prev.has(dragUserId)) return prev;
              const next = new Map(prev);
              next.delete(dragUserId);
              return next;
            });
          }, 12000),
        );
      }

      if (msg.type === "drag:end" && msg.userId !== userId) {
        clearTimeout(dragTimersRef.current.get(msg.userId));
        dragTimersRef.current.delete(msg.userId);
        setDrags((prev) => {
          if (!prev.has(msg.userId)) return prev;
          const next = new Map(prev);
          next.delete(msg.userId);
          return next;
        });
      }

      if (msg.type === "user:left") {
        setCursors((prev) => {
          const next = new Map(prev);
          next.delete(msg.userId);
          return next;
        });
        clearTimeout(dragTimersRef.current.get(msg.userId));
        dragTimersRef.current.delete(msg.userId);
        setDrags((prev) => {
          if (!prev.has(msg.userId)) return prev;
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

  // Send a viewport coordinate to everyone else, anchored to the element under
  // it so it resolves to the same spot on any viewport.
  const transmit = useCallback(
    (clientX: number, clientY: number) => {
      const board = boardRef.current;
      if (!board) return false;
      const { anchor, x, y } = computeAnchor(board, clientX, clientY);
      send({ type: "cursor", x, y, anchor });
      return true;
    },
    [send],
  );

  // Broadcast a click effect at a viewport coordinate.
  const broadcastClick = useCallback(
    (clientX: number, clientY: number) => {
      const board = boardRef.current;
      if (!board) return;
      const { anchor, x, y } = computeAnchor(board, clientX, clientY);
      send({ type: "click", x, y, anchor });
    },
    [send],
  );

  // Set the cursor to a point immediately (no glide), broadcasting the target.
  const jumpTo = useCallback(
    (clientX: number, clientY: number) => {
      posRef.current = { x: clientX, y: clientY };
      transmit(clientX, clientY);
    },
    [transmit],
  );

  // Move the cursor to a viewport coordinate. The sender just broadcasts the
  // destination; each observer eases toward it at 60fps, so motion stays smooth
  // even when this (possibly backgrounded) tab's timers are throttled. The
  // returned promise resolves after an estimated travel time so the caller can
  // sequence a dwell/click after the move.
  const moveCursorTo = useCallback(
    (clientX: number, clientY: number, options?: MoveOptions): Promise<void> => {
      const animate = options?.animate ?? true;
      const from = posRef.current;
      posRef.current = { x: clientX, y: clientY };
      transmit(clientX, clientY);

      if (!animate || !embodiedRef.current || !from) {
        return Promise.resolve();
      }

      const distance = Math.hypot(clientX - from.x, clientY - from.y);
      return new Promise<void>((resolve) => setTimeout(resolve, estimateMoveMs(distance)));
    },
    [transmit],
  );

  // Place the cursor at the center of the board (used on join).
  const broadcastCenter = useCallback(() => {
    const board = boardRef.current;
    if (!board) return;
    const rect = board.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    jumpTo(rect.left + rect.width / 2, rect.top + rect.height / 2);
  }, [jumpTo]);

  const setEmbodied = useCallback(
    (value: boolean) => {
      embodiedRef.current = value;
      if (value && connectedRef.current && !posRef.current) {
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
      posRef.current = { x: e.clientX, y: e.clientY };
      transmit(e.clientX, e.clientY);
    },
    [transmit],
  );

  const handlePointerDown = useCallback(
    (e: PointerEvent | MouseEvent) => {
      broadcastClick(e.clientX, e.clientY);
    },
    [broadcastClick],
  );

  useEffect(() => {
    const board = boardRef.current;
    if (!board) return;
    // pointermove covers mouse, pen, and touch, and is dispatched by automated
    // browser tooling; mousemove is kept as a fallback. The shared throttle in
    // handlePointerMove dedupes when both fire. pointerdown broadcasts a click
    // ripple so real clicks (human or agent) are visible to everyone.
    board.addEventListener("pointermove", handlePointerMove);
    board.addEventListener("mousemove", handlePointerMove);
    board.addEventListener("pointerdown", handlePointerDown);
    return () => {
      board.removeEventListener("pointermove", handlePointerMove);
      board.removeEventListener("mousemove", handlePointerMove);
      board.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [handlePointerMove, handlePointerDown]);

  // Show the agent's cursor immediately on join.
  useEffect(() => {
    if (!connected || !embodiedRef.current) return;
    const timeout = setTimeout(broadcastCenter, 250);
    return () => clearTimeout(timeout);
  }, [connected, broadcastCenter]);

  // Keep an idle agent cursor alive so observers don't cull it.
  useEffect(() => {
    const interval = setInterval(() => {
      const pos = posRef.current;
      if (connectedRef.current && embodiedRef.current && pos) {
        transmit(pos.x, pos.y);
      }
    }, HEARTBEAT_MS);
    return () => clearInterval(interval);
  }, [transmit]);

  return {
    cursors,
    clicks,
    drags,
    boardRef,
    moveCursorTo,
    broadcastClick,
    setEmbodied,
    isEmbodied,
  };
}

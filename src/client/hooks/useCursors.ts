import { useEffect, useRef, useCallback, useState } from "react";
import type { ClientMessage, CursorAnchor, ServerMessage } from "../../types";
import { smoothDamp } from "../agent/embodiment";
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

// Cursor motion feel. SMOOTH_TIME is roughly how long the cursor takes to reach
// a target; MAX_SPEED keeps long sweeps from teleporting. SEND_INTERVAL_MS
// throttles how often positions go over the wire during an animation.
const SMOOTH_TIME = 0.22;
const MAX_SPEED = 3200;
const SEND_INTERVAL_MS = 33;
const ARRIVAL_PX = 1.2;

export function useCursors(
  send: (msg: ClientMessage) => void,
  subscribe: (handler: (msg: ServerMessage) => void) => () => void,
  userId: string,
  users: { id: string; name: string; color: string }[],
  connected: boolean,
) {
  const [cursors, setCursors] = useState<Map<string, CursorPosition>>(new Map());
  const [clicks, setClicks] = useState<Map<string, ClickRipple>>(new Map());
  const userColorsRef = useRef<Map<string, string>>(new Map());
  const lastSendRef = useRef(0);
  const boardRef = useRef<HTMLDivElement | null>(null);

  // Embodiment state. Automated browsers (navigator.webdriver) get a visible,
  // persistent cursor by default; humans keep the original behavior.
  const embodiedRef = useRef(typeof navigator !== "undefined" && navigator.webdriver === true);
  const connectedRef = useRef(connected);

  // Cursor motion. The position chases a target each frame via SmoothDamp so the
  // movement reads as a hand, and retargeting mid-flight stays continuous.
  const posRef = useRef<{ x: number; y: number } | null>(null);
  const targetRef = useRef<{ x: number; y: number } | null>(null);
  const velRef = useRef({ x: 0, y: 0 });
  const rafRef = useRef<number | null>(null);
  const lastFrameRef = useRef(0);
  const lastBroadcastRef = useRef(0);
  const arrivalResolversRef = useRef<(() => void)[]>([]);

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

  const resolveArrivals = useCallback(() => {
    const resolvers = arrivalResolversRef.current;
    arrivalResolversRef.current = [];
    for (const resolve of resolvers) resolve();
  }, []);

  // The follow loop: ease the current position toward the target each frame.
  const tick = useCallback(
    (now: number) => {
      const target = targetRef.current;
      const pos = posRef.current;
      if (!target || !pos) {
        rafRef.current = null;
        return;
      }

      const dt = Math.min(0.05, (now - lastFrameRef.current) / 1000 || 0);
      lastFrameRef.current = now;

      const dampX = smoothDamp(pos.x, target.x, velRef.current.x, SMOOTH_TIME, dt, MAX_SPEED);
      const dampY = smoothDamp(pos.y, target.y, velRef.current.y, SMOOTH_TIME, dt, MAX_SPEED);
      pos.x = dampX.value;
      pos.y = dampY.value;
      velRef.current = { x: dampX.velocity, y: dampY.velocity };

      if (now - lastBroadcastRef.current >= SEND_INTERVAL_MS) {
        lastBroadcastRef.current = now;
        transmit(pos.x, pos.y);
      }

      const arrived =
        Math.hypot(target.x - pos.x, target.y - pos.y) < ARRIVAL_PX &&
        Math.hypot(velRef.current.x, velRef.current.y) < 4;

      if (arrived) {
        pos.x = target.x;
        pos.y = target.y;
        velRef.current = { x: 0, y: 0 };
        transmit(pos.x, pos.y);
        rafRef.current = null;
        resolveArrivals();
        return;
      }

      rafRef.current = requestAnimationFrame(tick);
    },
    [transmit, resolveArrivals],
  );

  const ensureLoop = useCallback(() => {
    if (rafRef.current === null) {
      lastFrameRef.current = performance.now();
      rafRef.current = requestAnimationFrame(tick);
    }
  }, [tick]);

  // Jump the cursor to a point with no animation.
  const jumpTo = useCallback(
    (clientX: number, clientY: number) => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      posRef.current = { x: clientX, y: clientY };
      targetRef.current = { x: clientX, y: clientY };
      velRef.current = { x: 0, y: 0 };
      transmit(clientX, clientY);
      resolveArrivals();
    },
    [transmit, resolveArrivals],
  );

  // Move the cursor to a viewport coordinate. When embodied and animated, glide
  // there via the follow loop; otherwise jump directly.
  const moveCursorTo = useCallback(
    (clientX: number, clientY: number, options?: MoveOptions): Promise<void> => {
      const animate = options?.animate ?? true;
      if (!animate || !embodiedRef.current) {
        jumpTo(clientX, clientY);
        return Promise.resolve();
      }

      if (!posRef.current) {
        // No known position yet: appear at the target rather than flying in.
        jumpTo(clientX, clientY);
        return Promise.resolve();
      }

      targetRef.current = { x: clientX, y: clientY };
      ensureLoop();
      return new Promise<void>((resolve) => {
        arrivalResolversRef.current.push(resolve);
      });
    },
    [jumpTo, ensureLoop],
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
      targetRef.current = { x: e.clientX, y: e.clientY };
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
      if (connectedRef.current && embodiedRef.current && pos && rafRef.current === null) {
        transmit(pos.x, pos.y);
      }
    }, HEARTBEAT_MS);
    return () => clearInterval(interval);
  }, [transmit]);

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return { cursors, clicks, boardRef, moveCursorTo, broadcastClick, setEmbodied, isEmbodied };
}

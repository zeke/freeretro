import { useEffect, useRef, type RefObject } from "react";
import { resolvePoint } from "../agent/anchor";
import { smoothDamp } from "../agent/embodiment";
import type { ClickRipple, CursorPosition } from "../hooks/useCursors";
import type { Card } from "../../types";

interface CursorOverlayProps {
  cursors: Map<string, CursorPosition>;
  clicks: Map<string, ClickRipple>;
  drags: Map<string, string>;
  cards: Card[];
  boardRef: RefObject<HTMLDivElement | null>;
}

const RIPPLE_MS = 500;
// Observer-side easing. Senders only broadcast their target position; each
// observer eases its rendered cursor toward that target every frame with
// SmoothDamp (ease in/out, no overshoot). This runs in the viewer's foreground
// tab at 60fps, so motion stays smooth and continuous no matter how sparsely or
// irregularly a sender (which may be a throttled background tab) broadcasts.
const SMOOTH_TIME = 0.16;
const MAX_SPEED = 2800;

export function CursorOverlay({ cursors, clicks, drags, cards, boardRef }: CursorOverlayProps) {
  const cursorNodes = useRef(new Map<string, HTMLDivElement>());
  const clickNodes = useRef(new Map<string, HTMLDivElement>());
  const ghostNodes = useRef(new Map<string, HTMLDivElement>());
  const rendered = useRef(new Map<string, { x: number; y: number }>());
  const velocities = useRef(new Map<string, { x: number; y: number }>());
  const lastFrameRef = useRef(0);
  const cursorsRef = useRef(cursors);
  cursorsRef.current = cursors;
  const clicksRef = useRef(clicks);
  clicksRef.current = clicks;
  const dragsRef = useRef(drags);
  dragsRef.current = drags;

  useEffect(() => {
    let raf = 0;
    const frame = (now: number) => {
      const board = boardRef.current;
      const dt = Math.min(0.05, (now - lastFrameRef.current) / 1000 || 0);
      lastFrameRef.current = now;

      for (const [id, cursor] of cursorsRef.current) {
        const node = cursorNodes.current.get(id);
        if (!node) continue;
        const target = resolvePoint(board, cursor.anchor, cursor.x, cursor.y);
        if (!target) {
          node.style.opacity = "0";
          continue;
        }
        let r = rendered.current.get(id);
        if (!r) {
          r = { x: target.x, y: target.y };
          rendered.current.set(id, r);
          velocities.current.set(id, { x: 0, y: 0 });
        }
        const v = velocities.current.get(id) ?? { x: 0, y: 0 };
        const dampX = smoothDamp(r.x, target.x, v.x, SMOOTH_TIME, dt, MAX_SPEED);
        const dampY = smoothDamp(r.y, target.y, v.y, SMOOTH_TIME, dt, MAX_SPEED);
        r.x = dampX.value;
        r.y = dampY.value;
        velocities.current.set(id, { x: dampX.velocity, y: dampY.velocity });
        node.style.opacity = "1";
        node.style.transform = `translate3d(${r.x}px, ${r.y}px, 0)`;
      }

      for (const id of rendered.current.keys()) {
        if (!cursorsRef.current.has(id)) {
          rendered.current.delete(id);
          velocities.current.delete(id);
        }
      }

      // Dragged-card ghosts follow their owner's eased cursor position.
      for (const [dragUserId] of dragsRef.current) {
        const node = ghostNodes.current.get(dragUserId);
        if (!node) continue;
        const pos = rendered.current.get(dragUserId);
        if (!pos) {
          node.style.opacity = "0";
          continue;
        }
        node.style.opacity = "0.9";
        node.style.transform = `translate3d(${pos.x + 8}px, ${pos.y + 14}px, 0) rotate(-3deg)`;
      }

      for (const [id, ripple] of clicksRef.current) {
        const node = clickNodes.current.get(id);
        if (!node) continue;
        const point = resolvePoint(board, ripple.anchor, ripple.x, ripple.y);
        if (!point) {
          node.style.opacity = "0";
          continue;
        }
        const t = Math.min(1, (now - ripple.born) / RIPPLE_MS);
        node.style.transform = `translate3d(${point.x}px, ${point.y}px, 0)`;
        const dot = node.firstElementChild as HTMLElement | null;
        if (dot) {
          dot.style.transform = `scale(${0.4 + t * 1.4})`;
          dot.style.opacity = String((1 - t) * 0.9);
        }
      }

      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [boardRef]);

  const cardsById = new Map(cards.map((card) => [card.id, card]));

  return (
    <div className="pointer-events-none fixed inset-0" style={{ zIndex: 9999 }}>
      {Array.from(drags.entries()).map(([dragUserId, cardId]) => {
        const card = cardsById.get(cardId);
        if (!card) return null;
        const color = cursors.get(dragUserId)?.color ?? "#FF4801";
        return (
          <div
            key={dragUserId}
            ref={(node) => {
              if (node) ghostNodes.current.set(dragUserId, node);
              else ghostNodes.current.delete(dragUserId);
            }}
            className="absolute top-0 left-0 will-change-transform"
            style={{ opacity: 0 }}
          >
            <div
              className="bg-cf-bg-card w-60 rounded border p-3 text-sm shadow-lg"
              style={{ borderColor: color }}
            >
              <p className="text-cf-text line-clamp-4 whitespace-pre-wrap">{card.content}</p>
              <p className="text-cf-text-muted mt-2 text-xs">{card.author}</p>
            </div>
          </div>
        );
      })}

      {Array.from(clicks.entries()).map(([id, ripple]) => (
        <div
          key={id}
          ref={(node) => {
            if (node) clickNodes.current.set(id, node);
            else clickNodes.current.delete(id);
          }}
          className="absolute top-0 left-0"
        >
          <span
            className="block rounded-full"
            style={{
              width: 28,
              height: 28,
              marginLeft: -14,
              marginTop: -14,
              border: `2px solid ${ripple.color}`,
            }}
          />
        </div>
      ))}

      {Array.from(cursors.entries()).map(([id, cursor]) => (
        <div
          key={id}
          ref={(node) => {
            if (node) cursorNodes.current.set(id, node);
            else cursorNodes.current.delete(id);
          }}
          className="absolute top-0 left-0 will-change-transform"
          style={{ opacity: 0 }}
        >
          <svg
            width="16"
            height="20"
            viewBox="0 0 16 20"
            fill="none"
            className="-translate-x-[2px]"
          >
            <path
              d="M0.928711 0.616699L14.2422 10.5767L7.17871 11.5767L4.17871 19.0767L0.928711 0.616699Z"
              fill={cursor.color}
              stroke="white"
              strokeWidth="1"
            />
          </svg>
          <span
            className="-mt-1 ml-3 inline-block rounded-full px-2 py-0.5 text-xs whitespace-nowrap text-white shadow-sm"
            style={{ backgroundColor: cursor.color }}
          >
            {cursor.name}
          </span>
        </div>
      ))}
    </div>
  );
}

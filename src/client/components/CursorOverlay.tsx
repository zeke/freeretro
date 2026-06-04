import { useEffect, useRef, type RefObject } from "react";
import { resolvePoint } from "../agent/anchor";
import type { ClickRipple, CursorPosition } from "../hooks/useCursors";

interface CursorOverlayProps {
  cursors: Map<string, CursorPosition>;
  clicks: Map<string, ClickRipple>;
  boardRef: RefObject<HTMLDivElement | null>;
}

const RIPPLE_MS = 500;
// Observer-side easing: each frame the rendered cursor moves this fraction of
// the way to its resolved target, upsampling network updates to 60fps and
// smoothing scrolls without adding noticeable lag.
const FOLLOW = 0.35;

export function CursorOverlay({ cursors, clicks, boardRef }: CursorOverlayProps) {
  const cursorNodes = useRef(new Map<string, HTMLDivElement>());
  const clickNodes = useRef(new Map<string, HTMLDivElement>());
  const rendered = useRef(new Map<string, { x: number; y: number }>());
  const cursorsRef = useRef(cursors);
  cursorsRef.current = cursors;
  const clicksRef = useRef(clicks);
  clicksRef.current = clicks;

  useEffect(() => {
    let raf = 0;
    const frame = () => {
      const board = boardRef.current;

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
        }
        r.x += (target.x - r.x) * FOLLOW;
        r.y += (target.y - r.y) * FOLLOW;
        node.style.opacity = "1";
        node.style.transform = `translate3d(${r.x}px, ${r.y}px, 0)`;
      }

      for (const id of rendered.current.keys()) {
        if (!cursorsRef.current.has(id)) rendered.current.delete(id);
      }

      const now = performance.now();
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

  return (
    <div className="pointer-events-none fixed inset-0" style={{ zIndex: 9999 }}>
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

import type { CursorAnchor } from "../../types";

export interface RectLike {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface ResolvedPoint {
  x: number;
  y: number;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

// Pure math: where a viewport point sits inside a rect, as a 0..1 offset
// (clamped to a small margin so near-misses don't fly far away).
export function offsetWithinRect(rect: RectLike, x: number, y: number): { ox: number; oy: number } {
  if (rect.width === 0 || rect.height === 0) return { ox: 0.5, oy: 0.5 };
  return {
    ox: clamp((x - rect.left) / rect.width, -0.5, 1.5),
    oy: clamp((y - rect.top) / rect.height, -0.5, 1.5),
  };
}

// Pure math: the viewport point for a given offset within a rect.
export function pointFromRect(rect: RectLike, ox: number, oy: number): ResolvedPoint {
  return { x: rect.left + ox * rect.width, y: rect.top + oy * rect.height };
}

// Build the cursor/click anchor for a viewport point. Prefers the most specific
// element under the point: a control, then its card or column scope, then the
// card or column itself, then the board. Also returns board-relative ratios as
// a fallback for observers that can't resolve the anchor.
export function computeAnchor(
  board: HTMLElement | null,
  clientX: number,
  clientY: number,
): { anchor: CursorAnchor; x: number; y: number } {
  let fx = 0.5;
  let fy = 0.5;
  if (board) {
    const br = board.getBoundingClientRect();
    if (br.width && br.height) {
      fx = (clientX - br.left) / br.width;
      fy = (clientY - br.top) / br.height;
    }
  }

  const el = document.elementFromPoint(clientX, clientY) as HTMLElement | null;
  const controlEl = el?.closest<HTMLElement>("[data-agent-control]") ?? null;
  const base = controlEl ?? el ?? null;
  const cardEl = base?.closest<HTMLElement>('[data-agent="card"]') ?? null;
  const columnEl = base?.closest<HTMLElement>('[data-agent="column"]') ?? null;

  let scope: CursorAnchor["scope"] = "board";
  let id: string | undefined;
  let anchorEl: HTMLElement | null = null;

  if (controlEl) {
    anchorEl = controlEl;
    if (cardEl) {
      scope = "card";
      id = cardEl.dataset.cardId;
    } else if (columnEl) {
      scope = "column";
      id = columnEl.dataset.columnId;
    } else {
      scope = "global";
    }
  } else if (cardEl) {
    scope = "card";
    id = cardEl.dataset.cardId;
    anchorEl = cardEl;
  } else if (columnEl) {
    scope = "column";
    id = columnEl.dataset.columnId;
    anchorEl = columnEl;
  }

  let ox = fx;
  let oy = fy;
  if (anchorEl) {
    const offset = offsetWithinRect(anchorEl.getBoundingClientRect(), clientX, clientY);
    ox = offset.ox;
    oy = offset.oy;
  }

  const control = controlEl?.dataset.agentControl;
  return { anchor: { scope, id, control, ox, oy }, x: fx, y: fy };
}

function selectorFor(anchor: CursorAnchor): string | null {
  if (anchor.scope === "card" && anchor.id) {
    return `[data-agent="card"][data-card-id="${CSS.escape(anchor.id)}"]`;
  }
  if (anchor.scope === "column" && anchor.id) {
    return `[data-agent="column"][data-column-id="${CSS.escape(anchor.id)}"]`;
  }
  if (anchor.scope === "global") return "";
  return null;
}

// Resolve an anchor to a viewport point against this client's own DOM.
export function resolveAnchor(
  board: HTMLElement | null,
  anchor: CursorAnchor,
): ResolvedPoint | null {
  if (anchor.scope === "board") {
    if (!board) return null;
    const rect = board.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    return pointFromRect(rect, anchor.ox, anchor.oy);
  }

  const base = selectorFor(anchor);
  if (base === null) return null;

  let selector = base;
  if (anchor.control) {
    selector = `${base}${base ? " " : ""}[data-agent-control="${CSS.escape(anchor.control)}"]`;
  }
  if (!selector) return null;

  const el = document.querySelector<HTMLElement>(selector);
  if (!el) return null;
  const rect = el.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;
  return pointFromRect(rect, anchor.ox, anchor.oy);
}

// Resolve to the anchored element, falling back to the board-relative ratio.
export function resolvePoint(
  board: HTMLElement | null,
  anchor: CursorAnchor | undefined,
  fallbackX: number,
  fallbackY: number,
): ResolvedPoint | null {
  if (anchor) {
    const resolved = resolveAnchor(board, anchor);
    if (resolved) return resolved;
  }
  if (!board) return null;
  const rect = board.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;
  return pointFromRect(rect, fallbackX, fallbackY);
}

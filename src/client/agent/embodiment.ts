import type { ColumnId } from "../../types";

export type InteractionMode = "human" | "direct";

// Where on the board the agent's cursor should glide before acting.
export type Locator =
  | { type: "card"; cardId: string }
  | { type: "column"; columnId: ColumnId }
  | { type: "add-card"; columnId: ColumnId }
  | { type: "point"; x: number; y: number };

// The choreography the tool layer uses to make actions visually traceable.
export interface Embodiment {
  click: (locator: Locator) => Promise<void>;
  drag: (from: Locator, to: Locator) => Promise<void>;
  point: (x: number, y: number) => Promise<void>;
  getMode: () => InteractionMode;
  setMode: (mode: InteractionMode) => void;
}

export interface Point {
  x: number;
  y: number;
}

export interface DampResult {
  value: number;
  velocity: number;
}

// Critically-damped smoothing (Game Programming Gems "SmoothDamp"). Eases in and
// out like a real hand, never overshoots, and retargets smoothly if the target
// moves mid-flight. smoothTime is roughly how long it takes to reach the target.
export function smoothDamp(
  current: number,
  target: number,
  velocity: number,
  smoothTime: number,
  dt: number,
  maxSpeed = Infinity,
): DampResult {
  const time = Math.max(0.0001, smoothTime);
  const omega = 2 / time;
  const x = omega * dt;
  const exp = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);

  let change = current - target;
  const maxChange = maxSpeed * time;
  change = Math.min(Math.max(change, -maxChange), maxChange);
  const movedTarget = current - change;

  const temp = (velocity + omega * change) * dt;
  let newVelocity = (velocity - omega * temp) * exp;
  let output = movedTarget + (change + temp) * exp;

  // Clamp to avoid overshooting past the target.
  if (target - current > 0 === output > target) {
    output = target;
    newVelocity = 0;
  }

  return { value: output, velocity: newVelocity };
}

// Cubic ease-in-out: slow start, quick middle, gentle stop, like a real hand.
export function easeInOutCubic(t: number): number {
  const clamped = Math.min(1, Math.max(0, t));
  return clamped < 0.5 ? 4 * clamped * clamped * clamped : 1 - Math.pow(-2 * clamped + 2, 3) / 2;
}

export function distance(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

// Time a pointer move should take to read as human: ~1400px/s, clamped so very
// short hops are not instant and long sweeps do not drag on.
const SPEED_PX_PER_MS = 1.4;
const MIN_DURATION_MS = 240;
const MAX_DURATION_MS = 900;

export function durationForDistance(px: number): number {
  return Math.min(MAX_DURATION_MS, Math.max(MIN_DURATION_MS, px / SPEED_PX_PER_MS));
}

// Dwell times that punctuate an action so observers can follow it.
export const DWELL = {
  click: 170,
  grab: 220,
  drop: 200,
} as const;

const SELECTORS: Record<Exclude<Locator["type"], "point">, (id: string) => string> = {
  card: (id) => `[data-agent="card"][data-card-id="${CSS.escape(id)}"]`,
  column: (id) => `[data-agent="column"][data-column-id="${CSS.escape(id)}"]`,
  "add-card": (id) =>
    `[data-agent="column"][data-column-id="${CSS.escape(id)}"] [data-agent="add-card"]`,
};

export function locateElement(locator: Locator): HTMLElement | null {
  if (locator.type === "point") return null;
  const id = locator.type === "card" ? locator.cardId : locator.columnId;
  return document.querySelector<HTMLElement>(SELECTORS[locator.type](id));
}

// Center of an element in viewport coordinates, scrolling it into view first if
// it is outside the visible area.
export function elementCenter(el: HTMLElement): Point {
  let rect = el.getBoundingClientRect();
  const offscreen =
    rect.bottom < 0 ||
    rect.top > window.innerHeight ||
    rect.right < 0 ||
    rect.left > window.innerWidth;
  if (offscreen) {
    el.scrollIntoView({ block: "nearest", inline: "nearest" });
    rect = el.getBoundingClientRect();
  }
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

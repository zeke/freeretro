import type { ClientMessage, ColumnId, ServerMessage } from "../../types";
import { COLUMNS } from "../../types";

// A demo persona: a name, the three cards it adds, and the emoji it reacts with.
interface Persona {
  name: string;
  cards: [ColumnId, string][];
  emojis: string[];
}

const PERSONAS: Persona[] = [
  {
    name: "Maya (PM)",
    cards: [
      ["highlights", "We hit the launch date with every must-have feature shipped."],
      ["challenges", "Scope crept late and we had to cut two stretch goals."],
      ["questions", "Do we have capacity for a fast-follow release next month?"],
    ],
    emojis: ["👍", "🎉", "💯", "⭐"],
  },
  {
    name: "Devon (Engineer)",
    cards: [
      ["highlights", "The new caching layer cut p95 API latency by about 40%."],
      ["challenges", "Flaky integration tests kept blocking the release candidate."],
      ["questions", "Should we retire the legacy queue next sprint?"],
    ],
    emojis: ["🔥", "🚀", "💯", "👍"],
  },
  {
    name: "Sasha (Designer)",
    cards: [
      ["highlights", "The redesigned onboarding flow tested really well with users."],
      ["challenges", "Design handoff was rushed; several specs landed late."],
      ["questions", "Can we run a post-launch usability study on the dashboard?"],
    ],
    emojis: ["🤔", "👀", "⭐", "❤️"],
  },
];

interface Ratio {
  x: number;
  y: number;
}

const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

// A quadratic Bézier from `from` to `to` whose control point is offset
// perpendicular to the straight line, giving the path a gentle, hand-like arc.
function curvedPath(from: Ratio, to: Ratio): (t: number) => Ratio {
  const mx = (from.x + to.x) / 2;
  const my = (from.y + to.y) / 2;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  const px = -dy / len;
  const py = dx / len;
  const bend = (Math.random() * 2 - 1) * Math.min(0.16, len * 0.45);
  const cx = mx + px * bend;
  const cy = my + py * bend;
  return (t: number) => {
    const u = 1 - t;
    return {
      x: u * u * from.x + 2 * u * t * cx + t * t * to.x,
      y: u * u * from.y + 2 * u * t * cy + t * t * to.y,
    };
  };
}

function waitOpen(ws: WebSocket): Promise<void> {
  if (ws.readyState === WebSocket.OPEN) return Promise.resolve();
  return new Promise((resolve, reject) => {
    ws.addEventListener("open", () => resolve(), { once: true });
    ws.addEventListener("error", () => reject(new Error("ws error")), { once: true });
  });
}

// One simulated participant: a real WebSocket client that adds its cards, then
// continuously roams the board with curved, eased cursor motion and lightly
// interacts. It works in board-relative ratio space (it has no DOM); the
// viewer's page resolves and renders everything.
function makeBot(retroId: string, persona: Persona): () => void {
  const userId = crypto.randomUUID();
  const protocol = location.protocol === "https:" ? "wss:" : "ws:";
  const url = `${protocol}//${location.host}/api/ws/${retroId}?userId=${userId}&name=${encodeURIComponent(persona.name)}`;
  const ws = new WebSocket(url);

  const cards = new Map<string, { columnId: ColumnId; position: number }>();
  const upvoted = new Set<string>();
  const reacted = new Set<string>();
  let alive = true;
  let pos: Ratio = { x: rnd(0.2, 0.8), y: rnd(0.2, 0.6) };

  const send = (msg: ClientMessage) => {
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
  };
  const cardIds = () => [...cards.keys()];

  // Glide along a curved, eased path to a target ratio, streaming cursor points
  // (~30/sec) the whole way so the motion reads as a continuous hand movement.
  function glideTo(to: Ratio): Promise<void> {
    const from = { ...pos };
    const path = curvedPath(from, to);
    const distance = Math.hypot(to.x - from.x, to.y - from.y);
    const duration = clamp(320 + distance * 950, 360, 1250);
    const start = performance.now();
    return new Promise<void>((resolve) => {
      const step = () => {
        if (!alive) {
          resolve();
          return;
        }
        const tRaw = Math.min(1, (performance.now() - start) / duration);
        const p = path(easeInOut(tRaw));
        pos = p;
        const x = clamp(p.x + (Math.random() * 2 - 1) * 0.0025, 0, 1);
        const y = clamp(p.y + (Math.random() * 2 - 1) * 0.0025, 0, 1);
        send({ type: "cursor", x, y, anchor: { scope: "board", ox: x, oy: y } });
        if (tRaw < 1) setTimeout(step, 33);
        else resolve();
      };
      step();
    });
  }

  // Rough on-board location of a card (column gives x; rank within column gives
  // y). Good enough to glide near it; a precise anchored message lands the final
  // bit on the real element.
  const cardRegion = (id: string): Ratio => {
    const card = cards.get(id);
    if (!card) return { x: 0.5, y: 0.4 };
    const colIndex = Math.max(0, COLUMNS.indexOf(card.columnId));
    const sameColumn = [...cards.values()]
      .filter((c) => c.columnId === card.columnId)
      .sort((a, b) => a.position - b.position);
    const rank = Math.max(
      0,
      sameColumn.findIndex((c) => c.position === card.position),
    );
    return {
      x: clamp((colIndex + 0.5) / COLUMNS.length + rnd(-0.05, 0.05), 0.06, 0.94),
      y: clamp(0.16 + rank * 0.13 + rnd(-0.03, 0.03), 0.1, 0.82),
    };
  };

  const columnRegion = (columnId: ColumnId): Ratio => {
    const index = Math.max(0, COLUMNS.indexOf(columnId));
    return {
      x: clamp((index + 0.5) / COLUMNS.length + rnd(-0.04, 0.04), 0.06, 0.94),
      y: rnd(0.2, 0.5),
    };
  };

  const localDrift = (): Ratio => ({
    x: clamp(pos.x + rnd(-0.16, 0.16), 0.05, 0.95),
    y: clamp(pos.y + rnd(-0.13, 0.13), 0.08, 0.85),
  });

  // Land precisely on a card via an anchored message (the small final homing-in).
  const pointAtCard = (id: string) => {
    const region = cardRegion(id);
    pos = region;
    send({
      type: "cursor",
      x: region.x,
      y: region.y,
      anchor: { scope: "card", id, ox: rnd(0.3, 0.7), oy: rnd(0.35, 0.65) },
    });
  };

  const endPosition = (columnId: ColumnId) => {
    let max = 0;
    for (const card of cards.values()) {
      if (card.columnId === columnId && card.position > max) max = card.position;
    }
    return max + 1;
  };

  ws.addEventListener("message", (event) => {
    let msg: ServerMessage;
    try {
      msg = JSON.parse(event.data as string) as ServerMessage;
    } catch {
      return;
    }
    if (msg.type === "state") {
      cards.clear();
      for (const card of msg.cards) {
        cards.set(card.id, { columnId: card.columnId, position: card.position });
      }
    } else if (msg.type === "card:created" || msg.type === "card:moved") {
      cards.set(msg.card.id, { columnId: msg.card.columnId, position: msg.card.position });
    } else if (msg.type === "card:deleted") {
      cards.delete(msg.cardId);
    }
  });

  (async () => {
    try {
      await waitOpen(ws);
    } catch {
      return;
    }
    await sleep(rnd(300, 1400)); // stagger so the three don't move in lockstep
    if (!alive) return;

    for (const [columnId, content] of persona.cards) {
      if (!alive) return;
      await glideTo(columnRegion(columnId));
      send({ type: "card:create", columnId, content });
      await sleep(rnd(700, 1500));
    }

    while (alive) {
      const roll = Math.random();
      try {
        if (roll < 0.5) {
          await glideTo(localDrift());
          await sleep(rnd(120, 450));
        } else if (roll < 0.7 && cardIds().length) {
          const id = pick(cardIds());
          await glideTo(cardRegion(id));
          pointAtCard(id);
          await sleep(rnd(200, 420));
          if (!upvoted.has(id)) {
            upvoted.add(id);
            send({ type: "upvote:toggle", cardId: id });
          }
          await sleep(rnd(150, 450));
        } else if (roll < 0.88 && cardIds().length) {
          const id = pick(cardIds());
          const emoji = pick(persona.emojis);
          await glideTo(cardRegion(id));
          pointAtCard(id);
          await sleep(rnd(200, 420));
          const key = `${id}:${emoji}`;
          if (!reacted.has(key)) {
            reacted.add(key);
            send({ type: "reaction:toggle", cardId: id, emoji });
          }
          await sleep(rnd(150, 450));
        } else if (cardIds().length) {
          const id = pick(cardIds());
          const from = cards.get(id);
          const target = pick(COLUMNS.filter((c) => c !== from?.columnId));
          await glideTo(cardRegion(id));
          pointAtCard(id);
          await sleep(rnd(220, 420));
          send({ type: "drag:start", cardId: id });
          await glideTo(columnRegion(target));
          send({
            type: "cursor",
            x: pos.x,
            y: pos.y,
            anchor: { scope: "column", id: target, ox: rnd(0.3, 0.7), oy: rnd(0.2, 0.45) },
          });
          await sleep(rnd(120, 300));
          send({ type: "card:move", cardId: id, columnId: target, position: endPosition(target) });
          send({ type: "drag:end" });
          await sleep(rnd(200, 500));
        }
      } catch {
        // keep roaming
      }
    }
  })();

  return () => {
    alive = false;
    try {
      ws.close();
    } catch {
      // already closed
    }
  };
}

// Start a swarm of demo participants. Returns a stop function that disconnects
// all of them.
export function startDemoSwarm(retroId: string): () => void {
  const stops = PERSONAS.map((persona) => makeBot(retroId, persona));
  return () => {
    for (const stop of stops) stop();
  };
}

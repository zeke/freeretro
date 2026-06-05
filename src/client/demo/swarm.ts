import type { ClientMessage, ColumnId, ServerMessage } from "../../types";
import { COLUMNS } from "../../types";

// A demo persona: a name, a color hint (the server assigns the real one), the
// three cards it adds, and the emoji it likes to react with.
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

const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function waitOpen(ws: WebSocket): Promise<void> {
  if (ws.readyState === WebSocket.OPEN) return Promise.resolve();
  return new Promise((resolve, reject) => {
    ws.addEventListener("open", () => resolve(), { once: true });
    ws.addEventListener("error", () => reject(new Error("ws error")), { once: true });
  });
}

// One simulated participant: a real WebSocket client that adds its cards, then
// drifts its cursor and lightly interacts. It tracks just enough card state to
// anchor its cursor and perform moves. It has no DOM; the viewer's page renders
// and smooths everything.
function makeBot(retroId: string, persona: Persona): () => void {
  const userId = crypto.randomUUID();
  const protocol = location.protocol === "https:" ? "wss:" : "ws:";
  const url = `${protocol}//${location.host}/api/ws/${retroId}?userId=${userId}&name=${encodeURIComponent(persona.name)}`;
  const ws = new WebSocket(url);

  const cards = new Map<string, { columnId: ColumnId; position: number }>();
  const upvoted = new Set<string>();
  const reacted = new Set<string>();
  let alive = true;

  const send = (msg: ClientMessage) => {
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
  };
  const cardIds = () => [...cards.keys()];

  const cursorToCard = (id: string) =>
    send({
      type: "cursor",
      x: rnd(0, 1),
      y: rnd(0, 1),
      anchor: { scope: "card", id, ox: rnd(0.2, 0.8), oy: rnd(0.3, 0.7) },
    });
  const cursorToColumn = (columnId: ColumnId) =>
    send({
      type: "cursor",
      x: rnd(0, 1),
      y: rnd(0, 1),
      anchor: { scope: "column", id: columnId, ox: rnd(0.3, 0.7), oy: rnd(0.15, 0.5) },
    });
  const cursorToBoard = () => {
    const x = rnd(0.08, 0.92);
    const y = rnd(0.1, 0.85);
    send({ type: "cursor", x, y, anchor: { scope: "board", ox: x, oy: y } });
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
      for (const card of msg.cards)
        cards.set(card.id, { columnId: card.columnId, position: card.position });
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
    await sleep(rnd(300, 1400)); // stagger so the three don't act in lockstep
    if (!alive) return;

    for (const [columnId, content] of persona.cards) {
      if (!alive) return;
      send({ type: "card:create", columnId, content });
      await sleep(rnd(1200, 2600));
    }

    while (alive) {
      const roll = Math.random();
      try {
        if (roll < 0.55) {
          if (Math.random() < 0.5 && cardIds().length) cursorToCard(pick(cardIds()));
          else cursorToBoard();
        } else if (roll < 0.74 && cardIds().length) {
          const id = pick(cardIds());
          cursorToCard(id);
          if (!upvoted.has(id)) {
            upvoted.add(id);
            await sleep(rnd(250, 550));
            send({ type: "upvote:toggle", cardId: id });
          }
        } else if (roll < 0.9 && cardIds().length) {
          const id = pick(cardIds());
          const emoji = pick(persona.emojis);
          cursorToCard(id);
          const key = `${id}:${emoji}`;
          if (!reacted.has(key)) {
            reacted.add(key);
            await sleep(rnd(250, 550));
            send({ type: "reaction:toggle", cardId: id, emoji });
          }
        } else if (cardIds().length) {
          const id = pick(cardIds());
          const from = cards.get(id);
          const targets = COLUMNS.filter((c) => c !== from?.columnId);
          const target = pick(targets);
          cursorToCard(id);
          await sleep(rnd(350, 650));
          send({ type: "drag:start", cardId: id });
          await sleep(rnd(300, 600));
          cursorToColumn(target);
          await sleep(rnd(600, 1000));
          send({ type: "card:move", cardId: id, columnId: target, position: endPosition(target) });
          send({ type: "drag:end" });
        }
      } catch {
        // ignore and keep going
      }
      await sleep(rnd(1200, 2800));
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

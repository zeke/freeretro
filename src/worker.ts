import { Hono } from "hono";
import type { Env } from "./env.d";
import type { RetroSnapshot } from "./types";

export { RetroRegistry } from "./retro-registry";
export { RetroRoom } from "./retro-room";

const app = new Hono<{ Bindings: Env }>();

app.use("*", async (c, next) => {
  await next();
  c.header(
    "X-Agent-Instructions",
    "This app requires a browser. See /llms.txt for agent API docs.",
  );
});

// API: Create a new retro
app.post("/api/retros", async (c) => {
  const body = await c.req.json<{ title: string; createdBy?: string }>();
  if (!body.title?.trim()) {
    return c.json({ error: "Title is required" }, 400);
  }

  const retroId = crypto.randomUUID();
  const id = c.env.RETRO_REGISTRY.idFromName("global");
  const registry = c.env.RETRO_REGISTRY.get(id);
  const retro = await registry.createRetro(retroId, body.title.trim(), body.createdBy ?? null);
  return c.json(retro, 201);
});

// API: Get a single unlisted retro
app.get("/api/retros/:retroId", async (c) => {
  const retroId = c.req.param("retroId");
  const id = c.env.RETRO_REGISTRY.idFromName("global");
  const registry = c.env.RETRO_REGISTRY.get(id);
  const retro = await registry.getRetro(retroId);
  if (!retro) {
    return c.json({ error: "Retro not found" }, 404);
  }
  return c.json(retro);
});

// API: Copy a retro. Columns are always carried over; cards are optional
// (default: not carried over).
app.post("/api/retros/:retroId/copy", async (c) => {
  const retroId = c.req.param("retroId");
  const body = await c.req.json<{ title?: string; includeCards?: boolean }>().catch(() => ({}));
  const registryId = c.env.RETRO_REGISTRY.idFromName("global");
  const registry = c.env.RETRO_REGISTRY.get(registryId);

  const source = await registry.getRetro(retroId);
  if (!source) {
    return c.json({ error: "Retro not found" }, 404);
  }

  const title = body.title?.trim() || `${source.title} (copy)`;

  const sourceRoomId = c.env.RETRO_ROOM.idFromName(source.id);
  const sourceRoom = c.env.RETRO_ROOM.get(sourceRoomId);
  const state = await sourceRoom.getRawState();

  const newRetroId = crypto.randomUUID();
  const newRetro = await registry.createRetro(newRetroId, title, source.createdBy);

  const newRoomId = c.env.RETRO_ROOM.idFromName(newRetroId);
  const newRoom = c.env.RETRO_ROOM.get(newRoomId);
  await newRoom.importState({
    columns: state.columns,
    cards: body.includeCards ? state.cards : [],
    upvotes: body.includeCards ? state.upvotes : [],
    comments: body.includeCards ? state.comments : [],
  });

  return c.json(newRetro, 201);
});

// API: Rename a retro
app.put("/api/retros/:retroId", async (c) => {
  const body = await c.req.json<{ title: string }>();
  if (!body.title?.trim()) {
    return c.json({ error: "Title is required" }, 400);
  }

  const retroId = c.req.param("retroId");
  const id = c.env.RETRO_REGISTRY.idFromName("global");
  const registry = c.env.RETRO_REGISTRY.get(id);
  const existing = await registry.getRetro(retroId);
  if (!existing) {
    return c.json({ error: "Retro not found" }, 404);
  }
  const retro = await registry.updateRetroTitle(existing.id, body.title.trim());
  if (!retro) {
    return c.json({ error: "Retro not found" }, 404);
  }
  return c.json(retro);
});

// API: Delete a retro
app.delete("/api/retros/:retroId", async (c) => {
  const retroId = c.req.param("retroId");
  const id = c.env.RETRO_REGISTRY.idFromName("global");
  const registry = c.env.RETRO_REGISTRY.get(id);
  const existing = await registry.getRetro(retroId);
  if (!existing) {
    return c.json({ ok: true });
  }
  await registry.deleteRetro(existing.id);
  const roomId = c.env.RETRO_ROOM.idFromName(existing.id);
  const room = c.env.RETRO_ROOM.get(roomId);
  await room.deleteAll();
  return c.json({ ok: true });
});

// Structured JSON export of a retro board: /retro/:retroId.json
app.get("/retro/:file{[0-9a-fA-F-]+\\.json}", async (c) => {
  const retroId = c.req.param("file").slice(0, -".json".length);
  const registryId = c.env.RETRO_REGISTRY.idFromName("global");
  const registry = c.env.RETRO_REGISTRY.get(registryId);
  const retro = await registry.getRetro(retroId);
  if (!retro) {
    return c.json({ error: "Retro not found" }, 404);
  }

  const roomId = c.env.RETRO_ROOM.idFromName(retroId);
  const room = c.env.RETRO_ROOM.get(roomId);
  const columns = await room.getSnapshot();

  const snapshot: RetroSnapshot = {
    id: retro.id,
    title: retro.title,
    createdAt: retro.createdAt,
    createdBy: retro.createdBy,
    columns,
  };
  return c.json(snapshot);
});

// WebSocket: Connect to a retro room
app.get("/api/ws/:retroId", async (c) => {
  const upgradeHeader = c.req.header("Upgrade");
  if (!upgradeHeader || upgradeHeader !== "websocket") {
    return c.text("Expected Upgrade: websocket", 426);
  }

  const retroId = c.req.param("retroId");
  const registryId = c.env.RETRO_REGISTRY.idFromName("global");
  const registry = c.env.RETRO_REGISTRY.get(registryId);
  const retro = await registry.getRetro(retroId);
  if (!retro) {
    return c.json({ error: "Retro not found" }, 404);
  }

  const id = c.env.RETRO_ROOM.idFromName(retro.id);
  const room = c.env.RETRO_ROOM.get(id);
  return room.fetch(c.req.raw);
});

export default app;

import { Hono } from "hono";
import type { Env } from "./env.d";

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

// API: Rename a retro
app.put("/api/retros/:retroId", async (c) => {
  const body = await c.req.json<{ title: string }>();
  if (!body.title?.trim()) {
    return c.json({ error: "Title is required" }, 400);
  }

  const retroId = c.req.param("retroId");
  const id = c.env.RETRO_REGISTRY.idFromName("global");
  const registry = c.env.RETRO_REGISTRY.get(id);
  const retro = await registry.updateRetroTitle(retroId, body.title.trim());
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
  await registry.deleteRetro(retroId);
  const roomId = c.env.RETRO_ROOM.idFromName(retroId);
  const room = c.env.RETRO_ROOM.get(roomId);
  await room.deleteAll();
  return c.json({ ok: true });
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

  const id = c.env.RETRO_ROOM.idFromName(retroId);
  const room = c.env.RETRO_ROOM.get(id);
  return room.fetch(c.req.raw);
});

export default app;

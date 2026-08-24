import { SELF, env } from "cloudflare:test";
import { describe, it, expect } from "vitest";
import { DEFAULT_COLUMNS } from "../src/types";

describe("API endpoints", () => {
  it("does not expose a retro listing", async () => {
    const res = await SELF.fetch("http://localhost/api/retros");
    expect(res.status).toBe(404);
  });

  it("POST /api/retros creates an unlisted retro with a UUID", async () => {
    const res = await SELF.fetch("http://localhost/api/retros", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Test Retro" }),
    });
    expect(res.status).toBe(201);
    const retro = (await res.json()) as { id: string; title: string };
    expect(retro.title).toBe("Test Retro");
    expect(retro.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it("GET /api/retros/:id returns a single retro", async () => {
    const createRes = await SELF.fetch("http://localhost/api/retros", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Find Me" }),
    });
    const created = (await createRes.json()) as { id: string };

    const res = await SELF.fetch(`http://localhost/api/retros/${created.id}`);
    expect(res.status).toBe(200);
    const retro = (await res.json()) as { id: string; title: string };
    expect(retro.id).toBe(created.id);
    expect(retro.title).toBe("Find Me");
  });

  it("PUT /api/retros/:id renames a retro", async () => {
    const createRes = await SELF.fetch("http://localhost/api/retros", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Old Name" }),
    });
    const created = (await createRes.json()) as { id: string };

    const res = await SELF.fetch(`http://localhost/api/retros/${created.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "New Name" }),
    });
    expect(res.status).toBe(200);
    const retro = (await res.json()) as { id: string; title: string };
    expect(retro.id).toBe(created.id);
    expect(retro.title).toBe("New Name");
  });

  it("PUT /api/retros/:id rejects empty titles", async () => {
    const res = await SELF.fetch("http://localhost/api/retros/missing", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "" }),
    });
    expect(res.status).toBe(400);
  });

  it("POST /api/retros rejects empty title", async () => {
    const res = await SELF.fetch("http://localhost/api/retros", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "" }),
    });
    expect(res.status).toBe(400);
  });

  it("POST /api/retros rejects missing title", async () => {
    const res = await SELF.fetch("http://localhost/api/retros", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });

  it("DELETE /api/retros/:id deletes a retro", async () => {
    // Create first
    const createRes = await SELF.fetch("http://localhost/api/retros", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "To Delete" }),
    });
    const retro = (await createRes.json()) as { id: string };

    // Delete
    const deleteRes = await SELF.fetch(`http://localhost/api/retros/${retro.id}`, {
      method: "DELETE",
    });
    expect(deleteRes.status).toBe(200);

    const getRes = await SELF.fetch(`http://localhost/api/retros/${retro.id}`);
    expect(getRes.status).toBe(404);
  });

  it("POST /api/retros/:retroId/copy duplicates columns and appends '(copy)' to the title", async () => {
    const createRes = await SELF.fetch("http://localhost/api/retros", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Sprint 42 Retro", createdBy: "Alice" }),
    });
    const source = (await createRes.json()) as { id: string };

    const copyRes = await SELF.fetch(`http://localhost/api/retros/${source.id}/copy`, {
      method: "POST",
    });
    expect(copyRes.status).toBe(201);
    const copy = (await copyRes.json()) as {
      id: string;
      title: string;
      createdBy: string | null;
    };
    expect(copy.title).toBe("Sprint 42 Retro (copy)");
    expect(copy.createdBy).toBe("Alice");
    expect(copy.id).not.toBe(source.id);
    expect(copy.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );

    const snapshotRes = await SELF.fetch(`http://localhost/retro/${copy.id}.json`);
    const snapshot = (await snapshotRes.json()) as {
      columns: { id: string; label: string; cards: unknown[] }[];
    };
    expect(snapshot.columns.map((column) => column.id)).toEqual([
      "highlights",
      "challenges",
      "questions",
      "notes",
    ]);
    expect(snapshot.columns.every((column) => column.cards.length === 0)).toBe(true);
  });

  it("POST /api/retros/:retroId/copy accepts a custom title", async () => {
    const createRes = await SELF.fetch("http://localhost/api/retros", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Sprint 42 Retro" }),
    });
    const source = (await createRes.json()) as { id: string };

    const copyRes = await SELF.fetch(`http://localhost/api/retros/${source.id}/copy`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Custom Copy Title" }),
    });
    expect(copyRes.status).toBe(201);
    const copy = (await copyRes.json()) as { title: string };
    expect(copy.title).toBe("Custom Copy Title");
  });

  it("POST /api/retros/:retroId/copy only carries over cards when includeCards is true", async () => {
    const createRes = await SELF.fetch("http://localhost/api/retros", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Retro With Cards" }),
    });
    const source = (await createRes.json()) as { id: string };

    const sourceRoomId = env.RETRO_ROOM.idFromName(source.id);
    const sourceRoom = env.RETRO_ROOM.get(sourceRoomId);
    await sourceRoom.importState({
      columns: DEFAULT_COLUMNS.map((column) => ({ ...column })),
      cards: [
        {
          id: "card-1",
          columnId: "highlights",
          content: "We shipped on time",
          author: "Alice",
          authorId: "user-1",
          groupId: null,
          position: 0,
          createdAt: Date.now(),
        },
      ],
      upvotes: [{ cardId: "card-1", userId: "user-2" }],
      comments: [
        {
          id: "comment-1",
          cardId: "card-1",
          content: "Nice work",
          author: "Bob",
          authorId: "user-3",
          createdAt: Date.now(),
        },
      ],
    });

    // Without includeCards, cards are not carried over.
    const withoutCardsRes = await SELF.fetch(`http://localhost/api/retros/${source.id}/copy`, {
      method: "POST",
    });
    const withoutCards = (await withoutCardsRes.json()) as { id: string };
    const withoutCardsSnapshot = (await (
      await SELF.fetch(`http://localhost/retro/${withoutCards.id}.json`)
    ).json()) as { columns: { cards: unknown[] }[] };
    expect(withoutCardsSnapshot.columns.every((column) => column.cards.length === 0)).toBe(true);

    // With includeCards, cards, upvotes, and comments are carried over.
    const withCardsRes = await SELF.fetch(`http://localhost/api/retros/${source.id}/copy`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ includeCards: true }),
    });
    const withCards = (await withCardsRes.json()) as { id: string };
    const withCardsSnapshot = (await (
      await SELF.fetch(`http://localhost/retro/${withCards.id}.json`)
    ).json()) as {
      columns: {
        id: string;
        cards: { content: string; upvotes: number; comments: { content: string }[] }[];
      }[];
    };
    const highlights = withCardsSnapshot.columns.find((column) => column.id === "highlights");
    expect(highlights?.cards).toHaveLength(1);
    expect(highlights?.cards[0]?.content).toBe("We shipped on time");
    expect(highlights?.cards[0]?.upvotes).toBe(1);
    expect(highlights?.cards[0]?.comments).toEqual([
      expect.objectContaining({ content: "Nice work", author: "Bob" }),
    ]);
  });

  it("POST /api/retros/:retroId/copy returns 404 for a missing retro", async () => {
    const res = await SELF.fetch(
      "http://localhost/api/retros/00000000-0000-4000-8000-000000000000/copy",
      { method: "POST" },
    );
    expect(res.status).toBe(404);
  });

  it("GET /api/ws/:retroId without upgrade header returns 426", async () => {
    const res = await SELF.fetch("http://localhost/api/ws/test-room");
    expect(res.status).toBe(426);
  });

  it("GET /retro/:id.json returns a structured snapshot", async () => {
    const createRes = await SELF.fetch("http://localhost/api/retros", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Snapshot Retro" }),
    });
    const created = (await createRes.json()) as { id: string };

    const res = await SELF.fetch(`http://localhost/retro/${created.id}.json`);
    expect(res.status).toBe(200);
    const snapshot = (await res.json()) as {
      id: string;
      title: string;
      columns: { id: string; label: string; cards: unknown[] }[];
    };
    expect(snapshot.id).toBe(created.id);
    expect(snapshot.title).toBe("Snapshot Retro");
    expect(snapshot.columns.map((column) => column.id)).toEqual([
      "highlights",
      "challenges",
      "questions",
      "notes",
    ]);
    expect(snapshot.columns.every((column) => Array.isArray(column.cards))).toBe(true);
  });

  it("GET /retro/:id.json returns 404 for a missing retro", async () => {
    const res = await SELF.fetch(
      "http://localhost/retro/00000000-0000-4000-8000-000000000000.json",
    );
    expect(res.status).toBe(404);
  });
});

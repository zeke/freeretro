import { describe, expect, it, vi } from "vitest";
import { createTools } from "../src/client/agent/tools";
import type { BoardSnapshot } from "../src/client/agent/tools";
import type { Embodiment } from "../src/client/agent/embodiment";
import type { ClientMessage } from "../src/types";

function fakeEmbodiment(): Embodiment {
  return {
    click: vi.fn(async () => {}),
    drag: vi.fn(async (_from, _to, onDrop?: () => void) => {
      onDrop?.();
    }),
    point: vi.fn(async () => {}),
    getMode: vi.fn(() => "human" as const),
    setMode: vi.fn(),
  };
}

function snapshot(overrides: Partial<BoardSnapshot> = {}): BoardSnapshot {
  return {
    cards: [],
    columns: [],
    users: [],
    reactions: [],
    upvotes: [],
    blurred: false,
    sortByUpvotes: false,
    ...overrides,
  };
}

function setup(state: BoardSnapshot) {
  const sent: ClientMessage[] = [];
  const embodiment = fakeEmbodiment();
  const setName = vi.fn();
  const tools = createTools({
    send: (msg) => sent.push(msg),
    getState: () => state,
    embodiment,
    setName,
  });
  const byName = (name: string) => tools.find((t) => t.name === name)!;
  return { sent, embodiment, setName, tools, byName };
}

describe("agent tools", () => {
  it("create_card sends a trimmed card:create after gliding to the add button", async () => {
    const { sent, embodiment, byName } = setup(snapshot());
    const result = await byName("create_card").execute({ columnId: "notes", content: "  hi  " });

    expect(result.isError).toBeFalsy();
    expect(embodiment.click).toHaveBeenCalledWith({ type: "add-card", columnId: "notes" });
    expect(sent).toEqual([{ type: "card:create", columnId: "notes", content: "hi" }]);
  });

  it("create_card rejects an invalid column", async () => {
    const { sent, byName } = setup(snapshot());
    const result = await byName("create_card").execute({ columnId: "nope", content: "hi" });

    expect(result.isError).toBe(true);
    expect(sent).toEqual([]);
  });

  it("move_card defaults position to the end of the target column", async () => {
    const state = snapshot({
      cards: [
        {
          id: "a",
          columnId: "challenges",
          content: "x",
          author: "z",
          authorId: "z",
          groupId: null,
          position: 7,
          createdAt: 1,
        },
        {
          id: "b",
          columnId: "highlights",
          content: "y",
          author: "z",
          authorId: "z",
          groupId: null,
          position: 1,
          createdAt: 2,
        },
      ],
    });
    const { sent, embodiment, byName } = setup(state);
    await byName("move_card").execute({ cardId: "b", columnId: "challenges" });

    expect(embodiment.drag).toHaveBeenCalledWith(
      { type: "card", cardId: "b" },
      { type: "column", columnId: "challenges" },
      expect.any(Function),
    );
    expect(sent).toEqual([{ type: "card:move", cardId: "b", columnId: "challenges", position: 8 }]);
  });

  it("move_card honors an explicit position", async () => {
    const { sent, byName } = setup(snapshot());
    await byName("move_card").execute({ cardId: "b", columnId: "notes", position: 3 });

    expect(sent).toEqual([{ type: "card:move", cardId: "b", columnId: "notes", position: 3 }]);
  });

  it("upvote_card toggles an upvote", async () => {
    const { sent, byName } = setup(snapshot());
    await byName("upvote_card").execute({ cardId: "a" });

    expect(sent).toEqual([{ type: "upvote:toggle", cardId: "a" }]);
  });

  it("list_cards reports upvote counts and reactions", async () => {
    const state = snapshot({
      cards: [
        {
          id: "a",
          columnId: "notes",
          content: "hello",
          author: "z",
          authorId: "z",
          groupId: null,
          position: 1,
          createdAt: 1,
        },
      ],
      upvotes: [{ cardId: "a", userId: "u1" }],
      reactions: [
        { cardId: "a", emoji: "🚀", userName: "z" },
        { cardId: "a", emoji: "🚀", userName: "q" },
      ],
    });
    const { byName } = setup(state);
    const result = await byName("list_cards").execute({});
    const parsed = JSON.parse(result.content[0].text);

    expect(parsed).toEqual([
      {
        id: "a",
        columnId: "notes",
        content: "hello",
        author: "z",
        groupId: null,
        upvotes: 1,
        reactions: { "🚀": 2 },
      },
    ]);
  });

  it("set_interaction_mode updates embodiment mode", async () => {
    const { embodiment, byName } = setup(snapshot());
    await byName("set_interaction_mode").execute({ mode: "direct" });

    expect(embodiment.setMode).toHaveBeenCalledWith("direct");
  });

  it("set_name sets a trimmed name", async () => {
    const { setName, byName } = setup(snapshot());
    const result = await byName("set_name").execute({ name: "  Ada  " });

    expect(result.isError).toBeFalsy();
    expect(setName).toHaveBeenCalledWith("Ada");
  });

  it("set_name rejects an empty name", async () => {
    const { setName, byName } = setup(snapshot());
    const result = await byName("set_name").execute({ name: "   " });

    expect(result.isError).toBe(true);
    expect(setName).not.toHaveBeenCalled();
  });
});

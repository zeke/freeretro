import type {
  Card,
  ClientMessage,
  ColumnId,
  Reaction,
  RetroColumn,
  RetroUser,
  Upvote,
} from "../../types";
import { COLUMNS } from "../../types";
import type { AgentTool, ToolResult } from "./webmcp";
import type { Embodiment, InteractionMode } from "./embodiment";

// Snapshot of live client state the read tools report on.
export interface BoardSnapshot {
  cards: Card[];
  columns: RetroColumn[];
  users: RetroUser[];
  reactions: Reaction[];
  upvotes: Upvote[];
  blurred: boolean;
  sortByUpvotes: boolean;
}

export interface ToolContext {
  send: (msg: ClientMessage) => void;
  getState: () => BoardSnapshot;
  embodiment: Embodiment;
  setName: (name: string) => void;
}

function ok(text: string): ToolResult {
  return { content: [{ type: "text", text }] };
}

function err(text: string): ToolResult {
  return { content: [{ type: "text", text }], isError: true };
}

function json(value: unknown): ToolResult {
  return ok(JSON.stringify(value, null, 2));
}

function isColumnId(value: unknown): value is ColumnId {
  return typeof value === "string" && (COLUMNS as string[]).includes(value);
}

// Position at the end of the target column, matching the drag-and-drop and
// move-menu behavior elsewhere in the app.
function endOfColumnPosition(cards: Card[], columnId: ColumnId): number {
  const inColumn = cards
    .filter((c) => c.columnId === columnId && c.groupId === null)
    .sort((a, b) => a.position - b.position);
  const last = inColumn[inColumn.length - 1];
  return last ? last.position + 1 : 1;
}

const columnSchema = {
  type: "string",
  enum: [...COLUMNS],
  description: "Column id: highlights, challenges, questions, or notes.",
};

export function createTools(ctx: ToolContext): AgentTool[] {
  const { send, getState, embodiment, setName } = ctx;

  return [
    {
      name: "list_cards",
      description:
        "List all cards on the board with their column, author, content, upvote count, and reactions.",
      execute: () => {
        const { cards, upvotes, reactions } = getState();
        return json(
          cards.map((card) => ({
            id: card.id,
            columnId: card.columnId,
            content: card.content,
            author: card.author,
            groupId: card.groupId,
            upvotes: upvotes.filter((u) => u.cardId === card.id).length,
            reactions: reactions
              .filter((r) => r.cardId === card.id)
              .reduce<Record<string, number>>((acc, r) => {
                acc[r.emoji] = (acc[r.emoji] ?? 0) + 1;
                return acc;
              }, {}),
          })),
        );
      },
    },
    {
      name: "list_columns",
      description: "List the board's columns with their labels and card counts.",
      execute: () => {
        const { columns, cards } = getState();
        return json(
          columns.map((column) => ({
            id: column.id,
            label: column.label,
            position: column.position,
            cardCount: cards.filter((c) => c.columnId === column.id && c.groupId === null).length,
          })),
        );
      },
    },
    {
      name: "list_users",
      description: "List the people and agents currently connected to this retro.",
      execute: () => {
        const { users } = getState();
        return json(users.map((u) => ({ id: u.id, name: u.name, color: u.color })));
      },
    },
    {
      name: "get_board_state",
      description: "Get board-wide state: whether cards are blurred, the sort mode, and counts.",
      execute: () => {
        const { blurred, sortByUpvotes, users, cards } = getState();
        return json({ blurred, sortByUpvotes, online: users.length, cardCount: cards.length });
      },
    },
    {
      name: "create_card",
      description: "Add a new card to a column.",
      inputSchema: {
        type: "object",
        properties: {
          columnId: columnSchema,
          content: { type: "string", description: "The card text." },
        },
        required: ["columnId", "content"],
      },
      execute: async ({ columnId, content }) => {
        if (!isColumnId(columnId)) return err(`Invalid columnId: ${String(columnId)}`);
        if (typeof content !== "string" || !content.trim()) return err("content is required.");
        await embodiment.click({ type: "add-card", columnId });
        send({ type: "card:create", columnId, content: content.trim() });
        return ok(`Added a card to ${columnId}.`);
      },
    },
    {
      name: "edit_card",
      description: "Replace the text of an existing card.",
      inputSchema: {
        type: "object",
        properties: {
          cardId: { type: "string" },
          content: { type: "string", description: "The new card text." },
        },
        required: ["cardId", "content"],
      },
      execute: async ({ cardId, content }) => {
        if (typeof cardId !== "string") return err("cardId is required.");
        if (typeof content !== "string" || !content.trim()) return err("content is required.");
        await embodiment.click({ type: "card-control", cardId, control: "content" });
        send({ type: "card:update", cardId, content: content.trim() });
        return ok(`Updated card ${cardId}.`);
      },
    },
    {
      name: "delete_card",
      description: "Delete a card.",
      inputSchema: {
        type: "object",
        properties: { cardId: { type: "string" } },
        required: ["cardId"],
      },
      execute: async ({ cardId }) => {
        if (typeof cardId !== "string") return err("cardId is required.");
        await embodiment.click({ type: "card-control", cardId, control: "delete" });
        send({ type: "card:delete", cardId });
        return ok(`Deleted card ${cardId}.`);
      },
    },
    {
      name: "move_card",
      description:
        "Move a card to another column. In human mode the cursor drags it across; position defaults to the end of the target column.",
      inputSchema: {
        type: "object",
        properties: {
          cardId: { type: "string" },
          columnId: columnSchema,
          position: { type: "number", description: "Optional explicit position." },
        },
        required: ["cardId", "columnId"],
      },
      execute: async ({ cardId, columnId, position }) => {
        if (typeof cardId !== "string") return err("cardId is required.");
        if (!isColumnId(columnId)) return err(`Invalid columnId: ${String(columnId)}`);
        const resolved =
          typeof position === "number" ? position : endOfColumnPosition(getState().cards, columnId);
        await embodiment.drag({ type: "card", cardId }, { type: "column", columnId }, () => {
          send({ type: "card:move", cardId, columnId, position: resolved });
        });
        return ok(`Moved card ${cardId} to ${columnId}.`);
      },
    },
    {
      name: "upvote_card",
      description: "Toggle your upvote on a card.",
      inputSchema: {
        type: "object",
        properties: { cardId: { type: "string" } },
        required: ["cardId"],
      },
      execute: async ({ cardId }) => {
        if (typeof cardId !== "string") return err("cardId is required.");
        await embodiment.click({ type: "card-control", cardId, control: "upvote" });
        send({ type: "upvote:toggle", cardId });
        return ok(`Toggled upvote on card ${cardId}.`);
      },
    },
    {
      name: "react_to_card",
      description: "Toggle an emoji reaction on a card.",
      inputSchema: {
        type: "object",
        properties: {
          cardId: { type: "string" },
          emoji: { type: "string", description: "An emoji, e.g. 🚀." },
        },
        required: ["cardId", "emoji"],
      },
      execute: async ({ cardId, emoji }) => {
        if (typeof cardId !== "string") return err("cardId is required.");
        if (typeof emoji !== "string" || !emoji) return err("emoji is required.");
        // Aim at the existing reaction chip if present, else the "+" picker button.
        const hasChip = getState().reactions.some((r) => r.cardId === cardId && r.emoji === emoji);
        const control = hasChip ? `reaction-${emoji}` : "react";
        await embodiment.click({ type: "card-control", cardId, control });
        send({ type: "reaction:toggle", cardId, emoji });
        return ok(`Toggled ${emoji} on card ${cardId}.`);
      },
    },
    {
      name: "rename_column",
      description: "Rename a column.",
      inputSchema: {
        type: "object",
        properties: {
          columnId: columnSchema,
          label: { type: "string", description: "The new column label." },
        },
        required: ["columnId", "label"],
      },
      execute: async ({ columnId, label }) => {
        if (!isColumnId(columnId)) return err(`Invalid columnId: ${String(columnId)}`);
        if (typeof label !== "string" || !label.trim()) return err("label is required.");
        await embodiment.click({ type: "column-control", columnId, control: "rename" });
        send({ type: "column:update", columnId, label: label.trim() });
        return ok(`Renamed ${columnId} to "${label.trim()}".`);
      },
    },
    {
      name: "set_blur",
      description: "Blur or reveal all cards for everyone in the retro.",
      inputSchema: {
        type: "object",
        properties: { blurred: { type: "boolean" } },
        required: ["blurred"],
      },
      execute: ({ blurred }) => {
        send({ type: "blur:set", blurred: Boolean(blurred) });
        return ok(`Set blur to ${Boolean(blurred)}.`);
      },
    },
    {
      name: "set_sort",
      description: "Sort cards by upvotes, or restore manual order.",
      inputSchema: {
        type: "object",
        properties: { sortByUpvotes: { type: "boolean" } },
        required: ["sortByUpvotes"],
      },
      execute: ({ sortByUpvotes }) => {
        send({ type: "sort:set", sortByUpvotes: Boolean(sortByUpvotes) });
        return ok(`Set sortByUpvotes to ${Boolean(sortByUpvotes)}.`);
      },
    },
    {
      name: "set_name",
      description: "Set the display name others see for you in the retro.",
      inputSchema: {
        type: "object",
        properties: {
          name: { type: "string", description: "Your display name." },
        },
        required: ["name"],
      },
      execute: ({ name }) => {
        if (typeof name !== "string" || !name.trim()) return err("name is required.");
        setName(name.trim());
        return ok(`Set name to "${name.trim()}".`);
      },
    },
    {
      name: "set_cursor",
      description:
        "Move your visible cursor to viewport coordinates so others can see where you are pointing.",
      inputSchema: {
        type: "object",
        properties: {
          x: { type: "number", description: "Viewport x in pixels." },
          y: { type: "number", description: "Viewport y in pixels." },
        },
        required: ["x", "y"],
      },
      execute: async ({ x, y }) => {
        if (typeof x !== "number" || typeof y !== "number") return err("x and y are required.");
        await embodiment.point(x, y);
        return ok(`Moved cursor to (${x}, ${y}).`);
      },
    },
    {
      name: "set_interaction_mode",
      description:
        'Set how actions are performed: "human" animates your cursor to each target so people can follow along; "direct" applies changes instantly.',
      inputSchema: {
        type: "object",
        properties: { mode: { type: "string", enum: ["human", "direct"] } },
        required: ["mode"],
      },
      execute: ({ mode }) => {
        if (mode !== "human" && mode !== "direct") return err('mode must be "human" or "direct".');
        embodiment.setMode(mode as InteractionMode);
        return ok(`Interaction mode set to ${mode}.`);
      },
    },
  ];
}

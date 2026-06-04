import { DurableObject } from "cloudflare:workers";
import type { Env } from "./env.d";
import type {
  Card,
  ClientMessage,
  Reaction,
  RetroUser,
  ServerMessage,
  ColumnId,
  RetroColumn,
  Upvote,
} from "./types";
import { USER_COLORS, COLUMNS, DEFAULT_COLUMNS } from "./types";

interface SessionData {
  id: string;
  name: string;
  color: string;
}

export class RetroRoom extends DurableObject<Env> {
  private sessions: Map<WebSocket, SessionData> = new Map();
  private colorIndex = 0;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);

    this.ctx.blockConcurrencyWhile(async () => {
      this.ctx.storage.sql.exec(`
        CREATE TABLE IF NOT EXISTS cards (
          id TEXT PRIMARY KEY,
          column_id TEXT NOT NULL,
          content TEXT NOT NULL,
          author TEXT NOT NULL,
          author_id TEXT,
          group_id TEXT,
          position REAL NOT NULL,
          created_at INTEGER NOT NULL
        )
      `);

      this.ctx.storage.sql.exec(`
        CREATE TABLE IF NOT EXISTS reactions (
          card_id TEXT NOT NULL,
          emoji TEXT NOT NULL,
          user_name TEXT NOT NULL,
          PRIMARY KEY (card_id, emoji, user_name)
        )
      `);

      this.ctx.storage.sql.exec(`
        CREATE TABLE IF NOT EXISTS upvotes (
          card_id TEXT NOT NULL,
          user_id TEXT NOT NULL,
          PRIMARY KEY (card_id, user_id)
        )
      `);

      this.ctx.storage.sql.exec(`
        CREATE TABLE IF NOT EXISTS retro_columns (
          id TEXT PRIMARY KEY,
          label TEXT NOT NULL,
          position INTEGER NOT NULL
        )
      `);

      this.ctx.storage.sql.exec(`
        CREATE TABLE IF NOT EXISTS settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL
        )
      `);

      const columns = [...this.ctx.storage.sql.exec<{ name: string }>("PRAGMA table_info(cards)")];
      if (!columns.some((column) => column.name === "author_id")) {
        this.ctx.storage.sql.exec("ALTER TABLE cards ADD COLUMN author_id TEXT");
      }

      const columnCount = [
        ...this.ctx.storage.sql.exec<{ count: number }>(
          "SELECT COUNT(*) as count FROM retro_columns",
        ),
      ][0]?.count;

      if (!columnCount) {
        for (const column of DEFAULT_COLUMNS) {
          this.ctx.storage.sql.exec(
            "INSERT INTO retro_columns (id, label, position) VALUES (?, ?, ?)",
            column.id,
            column.label,
            column.position,
          );
        }
      }

      this.ctx.storage.sql.exec(
        "INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)",
        "blurred",
        "true",
      );
      this.ctx.storage.sql.exec(
        "INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)",
        "sortByUpvotes",
        "false",
      );

      this.ctx.storage.sql.exec(
        "UPDATE cards SET column_id = ? WHERE column_id = ?",
        "highlights",
        "start",
      );
      this.ctx.storage.sql.exec(
        "UPDATE cards SET column_id = ? WHERE column_id = ?",
        "highlights",
        "continue",
      );
      this.ctx.storage.sql.exec(
        "UPDATE cards SET column_id = ? WHERE column_id = ?",
        "challenges",
        "stop",
      );
      this.ctx.storage.sql.exec(
        "UPDATE cards SET column_id = ? WHERE column_id = ?",
        "notes",
        "actions",
      );
    });

    // Restore sessions from hibernation
    for (const ws of this.ctx.getWebSockets()) {
      const attachment = ws.deserializeAttachment() as SessionData | null;
      if (attachment) {
        this.sessions.set(ws, attachment);
      }
    }

    this.ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair("ping", "pong"));
  }

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Expected WebSocket", { status: 400 });
    }

    const url = new URL(request.url);
    const userId = url.searchParams.get("userId") ?? crypto.randomUUID();
    const userName = url.searchParams.get("name") ?? "Anonymous";
    const color = USER_COLORS[this.colorIndex % USER_COLORS.length];
    this.colorIndex++;

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    const session: SessionData = { id: userId, name: userName, color };
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment(session);
    this.sessions.set(server, session);

    // Send initial state to the new client
    const state = this.getFullState();
    server.send(JSON.stringify(state));

    // Notify others about new user
    this.broadcast({ type: "user:joined", user: { id: userId, name: userName, color } }, server);

    return new Response(null, { status: 101, webSocket: client });
  }

  async deleteAll(): Promise<void> {
    this.broadcast({ type: "retro:deleted" });

    for (const ws of this.ctx.getWebSockets()) {
      ws.close(1000, "Retro deleted");
    }

    await this.ctx.storage.deleteAll();
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    if (typeof message !== "string") return;

    const session = this.sessions.get(ws);
    if (!session) return;

    let msg: ClientMessage;
    try {
      msg = JSON.parse(message) as ClientMessage;
    } catch {
      return;
    }

    switch (msg.type) {
      case "join":
        session.name = msg.name;
        ws.serializeAttachment(session);
        this.broadcast({
          type: "user:joined",
          user: { id: session.id, name: session.name, color: session.color },
        });
        break;

      case "cursor":
        this.broadcast(
          {
            type: "cursor",
            userId: session.id,
            name: session.name,
            color: session.color,
            x: msg.x,
            y: msg.y,
            anchor: msg.anchor,
          },
          ws,
        );
        break;

      case "click":
        this.broadcast(
          {
            type: "click",
            userId: session.id,
            name: session.name,
            color: session.color,
            x: msg.x,
            y: msg.y,
            anchor: msg.anchor,
          },
          ws,
        );
        break;

      case "card:create":
        this.handleCardCreate(ws, session, msg.columnId, msg.content);
        break;

      case "card:update":
        this.handleCardUpdate(msg.cardId, msg.content);
        break;

      case "card:delete":
        this.handleCardDelete(msg.cardId);
        break;

      case "card:move":
        this.handleCardMove(msg.cardId, msg.columnId, msg.position);
        break;

      case "card:group":
        this.handleCardGroup(msg.cardId, msg.targetCardId);
        break;

      case "card:ungroup":
        this.handleCardUngroup(msg.cardId);
        break;

      case "column:update":
        this.handleColumnUpdate(msg.columnId, msg.label);
        break;

      case "blur:set":
        this.handleBlurSet(msg.blurred);
        break;

      case "sort:set":
        this.handleSortSet(msg.sortByUpvotes);
        break;

      case "upvote:toggle":
        this.handleUpvoteToggle(msg.cardId, session.id);
        break;

      case "reaction:toggle":
        this.handleReactionToggle(msg.cardId, msg.emoji, session.name);
        break;
    }
  }

  async webSocketClose(ws: WebSocket, code: number, reason: string): Promise<void> {
    const session = this.sessions.get(ws);
    if (session) {
      this.broadcast({ type: "user:left", userId: session.id }, ws);
    }
    this.sessions.delete(ws);
    ws.close(code, reason);
  }

  async webSocketError(ws: WebSocket, _error: unknown): Promise<void> {
    const session = this.sessions.get(ws);
    if (session) {
      this.broadcast({ type: "user:left", userId: session.id }, ws);
    }
    this.sessions.delete(ws);
  }

  // --- Card operations ---

  private handleCardCreate(
    _ws: WebSocket,
    session: SessionData,
    columnId: ColumnId,
    content: string,
  ): void {
    if (!COLUMNS.includes(columnId)) return;
    if (!content.trim()) return;

    const id = crypto.randomUUID();
    const position = this.getNextPosition(columnId);
    const createdAt = Date.now();

    this.ctx.storage.sql.exec(
      "INSERT INTO cards (id, column_id, content, author, author_id, group_id, position, created_at) VALUES (?, ?, ?, ?, ?, NULL, ?, ?)",
      id,
      columnId,
      content.trim(),
      session.name,
      session.id,
      position,
      createdAt,
    );

    const card: Card = {
      id,
      columnId,
      content: content.trim(),
      author: session.name,
      authorId: session.id,
      groupId: null,
      position,
      createdAt,
    };

    this.broadcast({ type: "card:created", card });
  }

  private handleCardUpdate(cardId: string, content: string): void {
    if (!content.trim()) return;

    this.ctx.storage.sql.exec("UPDATE cards SET content = ? WHERE id = ?", content.trim(), cardId);

    const card = this.getCard(cardId);
    if (card) {
      this.broadcast({ type: "card:updated", card });
    }
  }

  private handleCardDelete(cardId: string): void {
    // Also ungroup any cards grouped under this one
    this.ctx.storage.sql.exec("UPDATE cards SET group_id = NULL WHERE group_id = ?", cardId);
    this.ctx.storage.sql.exec("DELETE FROM reactions WHERE card_id = ?", cardId);
    this.ctx.storage.sql.exec("DELETE FROM upvotes WHERE card_id = ?", cardId);
    this.ctx.storage.sql.exec("DELETE FROM cards WHERE id = ?", cardId);
    this.broadcast({ type: "card:deleted", cardId });
  }

  private handleCardMove(cardId: string, columnId: ColumnId, position: number): void {
    if (!COLUMNS.includes(columnId)) return;

    this.ctx.storage.sql.exec(
      "UPDATE cards SET column_id = ?, position = ?, group_id = NULL WHERE id = ?",
      columnId,
      position,
      cardId,
    );

    const card = this.getCard(cardId);
    if (card) {
      this.broadcast({ type: "card:moved", card });
    }
  }

  private handleCardGroup(cardId: string, targetCardId: string): void {
    // The target card becomes the group parent
    const target = this.getCard(targetCardId);
    if (!target) return;

    // If the target itself is grouped, use its group parent
    const groupId = target.groupId ?? targetCardId;

    this.ctx.storage.sql.exec(
      "UPDATE cards SET group_id = ?, column_id = ?, position = ? WHERE id = ?",
      groupId,
      target.columnId,
      target.position + 0.001,
      cardId,
    );

    this.broadcast({ type: "card:grouped", cardId, groupId });
  }

  private handleCardUngroup(cardId: string): void {
    const card = this.getCard(cardId);
    if (!card || !card.groupId) return;

    const position = this.getNextPosition(card.columnId);
    this.ctx.storage.sql.exec(
      "UPDATE cards SET group_id = NULL, position = ? WHERE id = ?",
      position,
      cardId,
    );

    this.broadcast({ type: "card:ungrouped", cardId, columnId: card.columnId, position });
  }

  private handleReactionToggle(cardId: string, emoji: string, userName: string): void {
    // Check if this user already reacted with this emoji
    const existing = [
      ...this.ctx.storage.sql.exec<{ card_id: string }>(
        "SELECT card_id FROM reactions WHERE card_id = ? AND emoji = ? AND user_name = ?",
        cardId,
        emoji,
        userName,
      ),
    ];

    if (existing.length > 0) {
      this.ctx.storage.sql.exec(
        "DELETE FROM reactions WHERE card_id = ? AND emoji = ? AND user_name = ?",
        cardId,
        emoji,
        userName,
      );
    } else {
      this.ctx.storage.sql.exec(
        "INSERT INTO reactions (card_id, emoji, user_name) VALUES (?, ?, ?)",
        cardId,
        emoji,
        userName,
      );
    }

    const reactions = this.getReactionsForCard(cardId);
    this.broadcast({ type: "reaction:toggled", cardId, emoji, userName, reactions });
  }

  private handleColumnUpdate(columnId: ColumnId, label: string): void {
    if (!COLUMNS.includes(columnId)) return;

    const trimmed = label.trim().slice(0, 40);
    if (!trimmed) return;

    this.ctx.storage.sql.exec("UPDATE retro_columns SET label = ? WHERE id = ?", trimmed, columnId);
    const column = this.getColumn(columnId);
    if (column) {
      this.broadcast({ type: "column:updated", column });
    }
  }

  private handleBlurSet(blurred: boolean): void {
    this.ctx.storage.sql.exec(
      "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
      "blurred",
      String(blurred),
    );
    this.broadcast({ type: "blur:updated", blurred });
  }

  private handleSortSet(sortByUpvotes: boolean): void {
    this.ctx.storage.sql.exec(
      "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
      "sortByUpvotes",
      String(sortByUpvotes),
    );
    this.broadcast({ type: "sort:updated", sortByUpvotes });
  }

  private handleUpvoteToggle(cardId: string, userId: string): void {
    const existing = [
      ...this.ctx.storage.sql.exec<{ card_id: string }>(
        "SELECT card_id FROM upvotes WHERE card_id = ? AND user_id = ?",
        cardId,
        userId,
      ),
    ];

    if (existing.length > 0) {
      this.ctx.storage.sql.exec(
        "DELETE FROM upvotes WHERE card_id = ? AND user_id = ?",
        cardId,
        userId,
      );
    } else {
      this.ctx.storage.sql.exec(
        "INSERT INTO upvotes (card_id, user_id) VALUES (?, ?)",
        cardId,
        userId,
      );
    }

    const upvotes = this.getUpvotesForCard(cardId);
    this.broadcast({ type: "upvote:toggled", cardId, upvotes });
  }

  // --- Helpers ---

  private getColumn(id: ColumnId): RetroColumn | null {
    const row = [
      ...this.ctx.storage.sql.exec<{ id: string; label: string; position: number }>(
        "SELECT id, label, position FROM retro_columns WHERE id = ?",
        id,
      ),
    ][0];

    if (!row) return null;
    return { id: row.id as ColumnId, label: row.label, position: row.position };
  }

  private getColumns(): RetroColumn[] {
    const rows = this.ctx.storage.sql.exec<{ id: string; label: string; position: number }>(
      "SELECT id, label, position FROM retro_columns ORDER BY position ASC",
    );

    return [...rows].map((row) => ({
      id: row.id as ColumnId,
      label: row.label,
      position: row.position,
    }));
  }

  private getCard(id: string): Card | null {
    const rows = [
      ...this.ctx.storage.sql.exec<{
        id: string;
        column_id: string;
        content: string;
        author: string;
        author_id: string | null;
        group_id: string | null;
        position: number;
        created_at: number;
      }>("SELECT * FROM cards WHERE id = ?", id),
    ];

    const row = rows[0];
    if (!row) return null;
    return {
      id: row.id,
      columnId: row.column_id as ColumnId,
      content: row.content,
      author: row.author,
      authorId: row.author_id,
      groupId: row.group_id,
      position: row.position,
      createdAt: row.created_at,
    };
  }

  private getAllCards(): Card[] {
    const rows = this.ctx.storage.sql.exec<{
      id: string;
      column_id: string;
      content: string;
      author: string;
      author_id: string | null;
      group_id: string | null;
      position: number;
      created_at: number;
    }>("SELECT * FROM cards ORDER BY position ASC");

    return [...rows].map((row) => ({
      id: row.id,
      columnId: row.column_id as ColumnId,
      content: row.content,
      author: row.author,
      authorId: row.author_id,
      groupId: row.group_id,
      position: row.position,
      createdAt: row.created_at,
    }));
  }

  private getAllReactions(): Reaction[] {
    const rows = this.ctx.storage.sql.exec<{
      card_id: string;
      emoji: string;
      user_name: string;
    }>("SELECT * FROM reactions");

    return [...rows].map((row) => ({
      cardId: row.card_id,
      emoji: row.emoji,
      userName: row.user_name,
    }));
  }

  private getAllUpvotes(): Upvote[] {
    const rows = this.ctx.storage.sql.exec<{ card_id: string; user_id: string }>(
      "SELECT * FROM upvotes",
    );

    return [...rows].map((row) => ({
      cardId: row.card_id,
      userId: row.user_id,
    }));
  }

  private getUpvotesForCard(cardId: string): Upvote[] {
    const rows = this.ctx.storage.sql.exec<{ card_id: string; user_id: string }>(
      "SELECT * FROM upvotes WHERE card_id = ?",
      cardId,
    );

    return [...rows].map((row) => ({
      cardId: row.card_id,
      userId: row.user_id,
    }));
  }

  private getReactionsForCard(cardId: string): Reaction[] {
    const rows = this.ctx.storage.sql.exec<{
      card_id: string;
      emoji: string;
      user_name: string;
    }>("SELECT * FROM reactions WHERE card_id = ?", cardId);

    return [...rows].map((row) => ({
      cardId: row.card_id,
      emoji: row.emoji,
      userName: row.user_name,
    }));
  }

  private getNextPosition(columnId: ColumnId): number {
    const rows = [
      ...this.ctx.storage.sql.exec<{ max_pos: number | null }>(
        "SELECT MAX(position) as max_pos FROM cards WHERE column_id = ? AND group_id IS NULL",
        columnId,
      ),
    ];
    const maxPos = rows[0]?.max_pos ?? 0;
    return maxPos + 1;
  }

  private getBlurred(): boolean {
    const row = [
      ...this.ctx.storage.sql.exec<{ value: string }>(
        "SELECT value FROM settings WHERE key = ?",
        "blurred",
      ),
    ][0];
    return row?.value !== "false";
  }

  private getSortByUpvotes(): boolean {
    const row = [
      ...this.ctx.storage.sql.exec<{ value: string }>(
        "SELECT value FROM settings WHERE key = ?",
        "sortByUpvotes",
      ),
    ][0];
    return row?.value === "true";
  }

  private getFullState(): ServerMessage {
    const columns = this.getColumns();
    const cards = this.getAllCards();
    const reactions = this.getAllReactions();
    const upvotes = this.getAllUpvotes();
    const blurred = this.getBlurred();
    const sortByUpvotes = this.getSortByUpvotes();
    const users: RetroUser[] = [];
    for (const session of this.sessions.values()) {
      users.push({ id: session.id, name: session.name, color: session.color });
    }
    return { type: "state", cards, columns, reactions, upvotes, users, blurred, sortByUpvotes };
  }

  private broadcast(message: ServerMessage, exclude?: WebSocket): void {
    const json = JSON.stringify(message);
    for (const ws of this.ctx.getWebSockets()) {
      if (ws !== exclude) {
        try {
          ws.send(json);
        } catch {
          // Client disconnected, will be cleaned up in webSocketClose
        }
      }
    }
  }
}

// Column definitions
export const DEFAULT_COLUMNS = [
  { id: "highlights", label: "Highlights", position: 0 },
  { id: "challenges", label: "Challenges", position: 1 },
  { id: "questions", label: "Questions", position: 2 },
  { id: "notes", label: "Notes", position: 3 },
] as const;

export type ColumnId = (typeof DEFAULT_COLUMNS)[number]["id"];
export const COLUMNS = DEFAULT_COLUMNS.map((column) => column.id) as ColumnId[];

export interface RetroColumn {
  id: ColumnId;
  label: string;
  position: number;
}

// Data models
export interface Card {
  id: string;
  columnId: ColumnId;
  content: string;
  author: string;
  authorId: string | null;
  groupId: string | null;
  position: number;
  createdAt: number;
}

export interface Reaction {
  cardId: string;
  emoji: string;
  userName: string;
}

export interface Upvote {
  cardId: string;
  userId: string;
}

export interface RetroUser {
  id: string;
  name: string;
  color: string;
}

// Where a remote cursor or click is pointing, resolved against the same element
// on every viewport so it lands in the right place regardless of window size.
// ox/oy are offsets within the resolved element (0..1), or board-relative
// ratios when scope is "board".
export interface CursorAnchor {
  scope: "card" | "column" | "global" | "board";
  id?: string;
  control?: string;
  ox: number;
  oy: number;
}

export interface RetroSummary {
  id: string;
  title: string;
  createdAt: number;
  createdBy: string | null;
}

// WebSocket messages: Client → Server
export type ClientMessage =
  | { type: "join"; name: string }
  | { type: "cursor"; x: number; y: number; anchor?: CursorAnchor }
  | { type: "click"; x: number; y: number; anchor?: CursorAnchor }
  | { type: "card:create"; columnId: ColumnId; content: string }
  | { type: "card:update"; cardId: string; content: string }
  | { type: "card:delete"; cardId: string }
  | { type: "card:move"; cardId: string; columnId: ColumnId; position: number }
  | { type: "card:group"; cardId: string; targetCardId: string }
  | { type: "card:ungroup"; cardId: string }
  | { type: "column:update"; columnId: ColumnId; label: string }
  | { type: "blur:set"; blurred: boolean }
  | { type: "sort:set"; sortByUpvotes: boolean }
  | { type: "upvote:toggle"; cardId: string }
  | { type: "reaction:toggle"; cardId: string; emoji: string };

// WebSocket messages: Server → Client
export type ServerMessage =
  | {
      type: "state";
      cards: Card[];
      columns: RetroColumn[];
      reactions: Reaction[];
      upvotes: Upvote[];
      users: RetroUser[];
      blurred: boolean;
      sortByUpvotes: boolean;
    }
  | { type: "user:joined"; user: RetroUser }
  | { type: "user:left"; userId: string }
  | {
      type: "cursor";
      userId: string;
      name: string;
      color: string;
      x: number;
      y: number;
      anchor?: CursorAnchor;
    }
  | {
      type: "click";
      userId: string;
      name: string;
      color: string;
      x: number;
      y: number;
      anchor?: CursorAnchor;
    }
  | { type: "card:created"; card: Card }
  | { type: "card:updated"; card: Card }
  | { type: "card:deleted"; cardId: string }
  | { type: "card:moved"; card: Card }
  | { type: "card:grouped"; cardId: string; groupId: string }
  | { type: "card:ungrouped"; cardId: string; columnId: ColumnId; position: number }
  | { type: "column:updated"; column: RetroColumn }
  | { type: "blur:updated"; blurred: boolean }
  | { type: "sort:updated"; sortByUpvotes: boolean }
  | { type: "upvote:toggled"; cardId: string; upvotes: Upvote[] }
  | { type: "retro:deleted" }
  | {
      type: "reaction:toggled";
      cardId: string;
      emoji: string;
      userName: string;
      reactions: Reaction[];
    };

// User colors for cursors
export const USER_COLORS = [
  "#FF4801",
  "#0A95FF",
  "#EE0DDB",
  "#19E306",
  "#9616FF",
  "#FF9900",
  "#4285F4",
  "#E91E63",
  "#00BCD4",
  "#FF5722",
  "#8BC34A",
  "#FFC107",
];

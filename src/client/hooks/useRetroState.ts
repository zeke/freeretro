import { useEffect, useCallback, useReducer } from "react";
import { DEFAULT_COLUMNS } from "../../types";
import type {
  Card,
  CardComment,
  Reaction,
  RetroUser,
  ServerMessage,
  ColumnId,
  RetroColumn,
  Upvote,
} from "../../types";

interface RetroState {
  cards: Card[];
  columns: RetroColumn[];
  reactions: Reaction[];
  upvotes: Upvote[];
  comments: CardComment[];
  users: RetroUser[];
  blurred: boolean;
  sortByUpvotes: boolean;
  loaded: boolean;
}

type RetroAction =
  | {
      type: "state";
      cards: Card[];
      columns: RetroColumn[];
      reactions: Reaction[];
      upvotes: Upvote[];
      comments: CardComment[];
      users: RetroUser[];
      blurred: boolean;
      sortByUpvotes: boolean;
    }
  | { type: "user:joined"; user: RetroUser }
  | { type: "user:left"; userId: string }
  | { type: "card:created"; card: Card }
  | { type: "card:updated"; card: Card }
  | { type: "card:deleted"; cardId: string }
  | { type: "card:moved"; card: Card }
  | { type: "card:grouped"; cardId: string; groupId: string }
  | { type: "card:ungrouped"; cardId: string; columnId: ColumnId; position: number }
  | { type: "comment:created"; comment: CardComment }
  | { type: "column:updated"; column: RetroColumn }
  | { type: "blur:updated"; blurred: boolean }
  | { type: "sort:updated"; sortByUpvotes: boolean }
  | { type: "upvote:toggled"; cardId: string; upvotes: Upvote[] }
  | { type: "reaction:toggled"; cardId: string; reactions: Reaction[] };

function reducer(state: RetroState, action: RetroAction): RetroState {
  switch (action.type) {
    case "state":
      return {
        cards: action.cards,
        columns: action.columns,
        reactions: action.reactions,
        upvotes: action.upvotes,
        comments: action.comments,
        users: action.users,
        blurred: action.blurred,
        sortByUpvotes: action.sortByUpvotes,
        loaded: true,
      };

    case "user:joined": {
      const existing = state.users.find((u) => u.id === action.user.id);
      if (existing) {
        return {
          ...state,
          users: state.users.map((u) => (u.id === action.user.id ? action.user : u)),
        };
      }
      return { ...state, users: [...state.users, action.user] };
    }

    case "user:left":
      return { ...state, users: state.users.filter((u) => u.id !== action.userId) };

    case "card:created":
      return { ...state, cards: [...state.cards, action.card] };

    case "card:updated":
      return {
        ...state,
        cards: state.cards.map((c) => (c.id === action.card.id ? action.card : c)),
      };

    case "card:deleted":
      return {
        ...state,
        cards: state.cards.filter((c) => c.id !== action.cardId && c.groupId !== action.cardId),
        reactions: state.reactions.filter((r) => r.cardId !== action.cardId),
        upvotes: state.upvotes.filter((upvote) => upvote.cardId !== action.cardId),
        comments: state.comments.filter((comment) => comment.cardId !== action.cardId),
      };

    case "card:moved":
      return {
        ...state,
        cards: state.cards.map((c) => (c.id === action.card.id ? action.card : c)),
      };

    case "card:grouped":
      return {
        ...state,
        cards: state.cards.map((c) =>
          c.id === action.cardId ? { ...c, groupId: action.groupId } : c,
        ),
      };

    case "card:ungrouped":
      return {
        ...state,
        cards: state.cards.map((c) =>
          c.id === action.cardId
            ? { ...c, groupId: null, columnId: action.columnId, position: action.position }
            : c,
        ),
      };

    case "reaction:toggled": {
      const otherReactions = state.reactions.filter((r) => r.cardId !== action.cardId);
      return { ...state, reactions: [...otherReactions, ...action.reactions] };
    }

    case "column:updated":
      return {
        ...state,
        columns: state.columns
          .map((column) => (column.id === action.column.id ? action.column : column))
          .sort((a, b) => a.position - b.position),
      };

    case "blur:updated":
      return { ...state, blurred: action.blurred };

    case "sort:updated":
      return { ...state, sortByUpvotes: action.sortByUpvotes };

    case "upvote:toggled": {
      const otherUpvotes = state.upvotes.filter((upvote) => upvote.cardId !== action.cardId);
      return { ...state, upvotes: [...otherUpvotes, ...action.upvotes] };
    }

    case "comment:created":
      return { ...state, comments: [...state.comments, action.comment] };

    default:
      return state;
  }
}

const initialState: RetroState = {
  cards: [],
  columns: DEFAULT_COLUMNS.map((column) => ({ ...column })),
  reactions: [],
  upvotes: [],
  comments: [],
  users: [],
  blurred: true,
  sortByUpvotes: false,
  loaded: false,
};

export function useRetroState(subscribe: (handler: (msg: ServerMessage) => void) => () => void) {
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    return subscribe((msg) => {
      switch (msg.type) {
        case "state":
          dispatch({
            type: "state",
            cards: msg.cards,
            columns: msg.columns,
            reactions: msg.reactions,
            upvotes: msg.upvotes,
            comments: msg.comments,
            users: msg.users,
            blurred: msg.blurred,
            sortByUpvotes: msg.sortByUpvotes,
          });
          break;
        case "user:joined":
          dispatch({ type: "user:joined", user: msg.user });
          break;
        case "user:left":
          dispatch({ type: "user:left", userId: msg.userId });
          break;
        case "card:created":
          dispatch({ type: "card:created", card: msg.card });
          break;
        case "card:updated":
          dispatch({ type: "card:updated", card: msg.card });
          break;
        case "card:deleted":
          dispatch({ type: "card:deleted", cardId: msg.cardId });
          break;
        case "card:moved":
          dispatch({ type: "card:moved", card: msg.card });
          break;
        case "card:grouped":
          dispatch({ type: "card:grouped", cardId: msg.cardId, groupId: msg.groupId });
          break;
        case "card:ungrouped":
          dispatch({
            type: "card:ungrouped",
            cardId: msg.cardId,
            columnId: msg.columnId,
            position: msg.position,
          });
          break;
        case "column:updated":
          dispatch({ type: "column:updated", column: msg.column });
          break;
        case "blur:updated":
          dispatch({ type: "blur:updated", blurred: msg.blurred });
          break;
        case "sort:updated":
          dispatch({ type: "sort:updated", sortByUpvotes: msg.sortByUpvotes });
          break;
        case "upvote:toggled":
          dispatch({ type: "upvote:toggled", cardId: msg.cardId, upvotes: msg.upvotes });
          break;
        case "reaction:toggled":
          dispatch({
            type: "reaction:toggled",
            cardId: msg.cardId,
            reactions: msg.reactions,
          });
          break;
        case "comment:created":
          dispatch({ type: "comment:created", comment: msg.comment });
          break;
      }
    });
  }, [subscribe]);

  const getCardsForColumn = useCallback(
    (columnId: ColumnId) => {
      return state.cards
        .filter((c) => c.columnId === columnId && c.groupId === null)
        .sort((a, b) => {
          if (state.sortByUpvotes) {
            const aUpvotes = state.upvotes.filter((upvote) => upvote.cardId === a.id).length;
            const bUpvotes = state.upvotes.filter((upvote) => upvote.cardId === b.id).length;
            if (aUpvotes !== bUpvotes) return bUpvotes - aUpvotes;
          }
          return a.position - b.position;
        });
    },
    [state.cards, state.sortByUpvotes, state.upvotes],
  );

  const getGroupedCards = useCallback(
    (groupId: string) => {
      return state.cards
        .filter((c) => c.groupId === groupId)
        .sort((a, b) => a.position - b.position);
    },
    [state.cards],
  );

  const getReactionsForCard = useCallback(
    (cardId: string) => {
      return state.reactions.filter((r) => r.cardId === cardId);
    },
    [state.reactions],
  );

  const getUpvotesForCard = useCallback(
    (cardId: string) => {
      return state.upvotes.filter((upvote) => upvote.cardId === cardId);
    },
    [state.upvotes],
  );

  const getCommentsForCard = useCallback(
    (cardId: string) => {
      return state.comments.filter((comment) => comment.cardId === cardId);
    },
    [state.comments],
  );

  return {
    ...state,
    getCardsForColumn,
    getGroupedCards,
    getReactionsForCard,
    getUpvotesForCard,
    getCommentsForCard,
  };
}

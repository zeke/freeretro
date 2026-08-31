import { useRef, useEffect, useState } from "react";
import {
  draggable,
  dropTargetForElements,
} from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import {
  attachClosestEdge,
  extractClosestEdge,
  type Edge,
} from "@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge";
import type {
  Card as CardType,
  CardComment,
  Upvote,
  ColumnId,
  RetroColumn,
  ClientMessage,
} from "../../types";
import { RetroCard } from "./Card";
import { CardForm } from "./CardForm";

interface ColumnProps {
  columnId: ColumnId;
  label: string;
  index: number;
  columns: RetroColumn[];
  cards: CardType[];
  getGroupedCards: (groupId: string) => CardType[];
  getUpvotesForCard: (cardId: string) => Upvote[];
  getCommentsForCard: (cardId: string) => CardComment[];
  send: (msg: ClientMessage) => void;
  userName: string;
  userId: string;
  blurred: boolean;
  allCards: CardType[];
  draggedCardIds: Set<string>;
}

export function Column({
  columnId,
  label,
  index,
  columns,
  cards,
  getGroupedCards,
  getUpvotesForCard,
  getCommentsForCard,
  send,
  userName,
  userId,
  blurred,
  allCards,
  draggedCardIds,
}: ColumnProps) {
  const columnRef = useRef<HTMLDivElement>(null);
  const columnHeaderHandleRef = useRef<HTMLDivElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isDraggingColumn, setIsDraggingColumn] = useState(false);
  const [columnDropEdge, setColumnDropEdge] = useState<Edge | null>(null);
  const [isEditingLabel, setIsEditingLabel] = useState(false);
  const [draftLabel, setDraftLabel] = useState(label);

  useEffect(() => {
    if (!isEditingLabel) {
      setDraftLabel(label);
    }
  }, [isEditingLabel, label]);

  useEffect(() => {
    const el = columnRef.current;
    const handle = columnHeaderHandleRef.current;
    if (!el || !handle) return;

    return draggable({
      element: el,
      dragHandle: handle,
      getInitialData: () => ({ type: "column", columnId, index }),
      onDragStart: () => setIsDraggingColumn(true),
      onDrop: () => setIsDraggingColumn(false),
    });
  }, [columnId, index]);

  useEffect(() => {
    const el = columnRef.current;
    if (!el) return;

    return dropTargetForElements({
      element: el,
      getData: ({ input, element }) =>
        attachClosestEdge({ columnId }, { input, element, allowedEdges: ["left", "right"] }),
      canDrop: ({ source }) => {
        return source.data.type === "card" || source.data.type === "column";
      },
      onDrag: ({ source, self }) => {
        if (source.data.type === "column") {
          setColumnDropEdge(extractClosestEdge(self.data));
        }
      },
      onDragEnter: ({ source, self }) => {
        if (source.data.type === "column") {
          setColumnDropEdge(extractClosestEdge(self.data));
        } else {
          setIsDragOver(true);
        }
      },
      onDragLeave: () => {
        setIsDragOver(false);
        setColumnDropEdge(null);
      },
      onDrop: ({ source, self }) => {
        setIsDragOver(false);
        const edge = extractClosestEdge(self.data);
        setColumnDropEdge(null);

        if (source.data.type === "column") {
          const sourceColumnId = source.data.columnId as string;
          if (sourceColumnId === columnId) return;

          // Drop to the left inserts before this column; to the right inserts after it.
          const others = columns
            .filter((column) => column.id !== sourceColumnId)
            .sort((a, b) => a.position - b.position);
          const targetIndex = others.findIndex((column) => column.id === columnId);

          let position: number;
          if (edge === "right") {
            const before = others[targetIndex]?.position ?? 0;
            const after = others[targetIndex + 1]?.position ?? before + 2;
            position = (before + after) / 2;
          } else {
            const before = others[targetIndex - 1]?.position;
            const after = others[targetIndex]?.position ?? (before ?? 0) + 2;
            position = before !== undefined ? (before + after) / 2 : after - 1;
          }

          send({ type: "column:move", columnId: sourceColumnId, position });
          return;
        }

        const cardId = source.data.cardId as string;
        const sourceColumnId = source.data.columnId as string;

        if (sourceColumnId !== columnId) {
          // Calculate position at the end of this column
          const lastCard = cards[cards.length - 1];
          const position = lastCard ? lastCard.position + 1 : 1;

          send({
            type: "card:move",
            cardId,
            columnId,
            position,
          });
        }
      },
    });
  }, [columnId, cards, columns, send]);

  const handleCreateCard = (content: string) => {
    send({ type: "card:create", columnId, content });
  };

  const saveLabel = () => {
    const trimmed = draftLabel.trim().slice(0, 40);
    if (trimmed && trimmed !== label) {
      send({ type: "column:update", columnId, label: trimmed });
    }
    setDraftLabel(trimmed || label);
    setIsEditingLabel(false);
  };

  const handleDeleteColumn = () => {
    if (cards.length > 0) {
      const confirmed = window.confirm(
        `Delete "${label}"? This will also delete ${cards.length} card${
          cards.length === 1 ? "" : "s"
        }. This can't be undone.`,
      );
      if (!confirmed) return;
    }
    send({ type: "column:delete", columnId });
  };

  return (
    <div
      ref={columnRef}
      data-agent="column"
      data-column-id={columnId}
      className={`relative flex min-h-80 w-full min-w-0 flex-col transition-all md:h-full md:min-h-0 ${
        isDraggingColumn ? "opacity-40" : ""
      } ${isDragOver ? "ring-cf-orange ring-opacity-50 ring-2" : ""}`}
    >
      {columnDropEdge && (
        <div
          aria-hidden="true"
          className={`bg-cf-orange pointer-events-none absolute top-0 bottom-0 z-20 w-0.5 rounded-full ${
            columnDropEdge === "left" ? "-left-2" : "-right-2"
          }`}
        />
      )}

      {/* Column header */}
      <div className="relative flex items-center justify-between px-1 py-3">
        <div
          ref={columnHeaderHandleRef}
          aria-hidden="true"
          className="absolute inset-0 cursor-grab active:cursor-grabbing"
        />
        {isEditingLabel ? (
          <input
            value={draftLabel}
            onChange={(event) => setDraftLabel(event.target.value)}
            onBlur={saveLabel}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                saveLabel();
              }
              if (event.key === "Escape") {
                setDraftLabel(label);
                setIsEditingLabel(false);
              }
            }}
            autoFocus
            maxLength={40}
            className="border-cf-border bg-cf-bg-card text-cf-text focus:border-cf-orange relative z-10 w-full rounded border px-2 py-1 font-medium tracking-tight outline-none"
          />
        ) : (
          <button
            type="button"
            onClick={() => setIsEditingLabel(true)}
            data-agent-control="rename"
            data-agent-prefer-api="rename_column"
            title="Rename column"
            className="text-cf-text hover:text-cf-orange relative z-10 cursor-pointer truncate text-left font-medium tracking-tight transition-colors"
          >
            {label}
          </button>
        )}
        <div className="relative z-10 flex items-center gap-2">
          <span className="text-cf-text-muted text-xs">{cards.length}</span>
          <button
            type="button"
            onClick={handleDeleteColumn}
            data-agent-control="delete"
            data-agent-prefer-api="delete_column"
            title="Delete column"
            className="text-cf-text-muted cursor-pointer opacity-40 transition-opacity hover:text-red-500 hover:opacity-100"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Cards */}
      <div className="min-h-0 flex-1 space-y-2 overflow-x-hidden overflow-y-auto pb-3">
        {cards.map((card, cardIndex) => (
          <RetroCard
            key={card.id}
            card={card}
            index={cardIndex}
            groupedCards={getGroupedCards(card.id)}
            upvotes={getUpvotesForCard(card.id)}
            comments={getCommentsForCard(card.id)}
            send={send}
            userName={userName}
            userId={userId}
            blurred={blurred}
            allCards={allCards}
            remoteDragging={draggedCardIds.has(card.id)}
          />
        ))}
        <CardForm onSubmit={handleCreateCard} />
      </div>
    </div>
  );
}

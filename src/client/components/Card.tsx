import { useRef, useEffect, useState } from "react";
import {
  draggable,
  dropTargetForElements,
} from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import type {
  Card as CardType,
  Reaction,
  Upvote,
  ClientMessage,
  ColumnId,
  RetroColumn,
} from "../../types";
import { EmojiReaction } from "./EmojiReaction";
import { MoveCardMenu } from "./MoveCardMenu";
import { CardGroup } from "./CardGroup";

interface RetroCardProps {
  card: CardType;
  index: number;
  columns: RetroColumn[];
  groupedCards: CardType[];
  reactions: Reaction[];
  upvotes: Upvote[];
  send: (msg: ClientMessage) => void;
  userName: string;
  userId: string;
  blurred: boolean;
  allCards: CardType[];
}

export function RetroCard({
  card,
  index,
  columns,
  groupedCards,
  reactions,
  upvotes,
  send,
  userName,
  userId,
  blurred,
  allCards,
}: RetroCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const dragHandleRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isDropTarget, setIsDropTarget] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(card.content);
  const isOwnCard = card.authorId === userId || (!card.authorId && card.author === userName);
  const shouldBlur = blurred && !isOwnCard;
  const userUpvoted = upvotes.some((upvote) => upvote.userId === userId);

  useEffect(() => {
    const el = cardRef.current;
    const handle = dragHandleRef.current;
    if (!el || !handle) return;

    return draggable({
      element: el,
      dragHandle: handle,
      getInitialData: () => ({
        type: "card",
        cardId: card.id,
        columnId: card.columnId,
        index,
      }),
      onDragStart: () => setIsDragging(true),
      onDrop: () => setIsDragging(false),
    });
  }, [card.id, card.columnId, index]);

  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;

    return dropTargetForElements({
      element: el,
      getData: () => ({
        type: "card-target",
        cardId: card.id,
        columnId: card.columnId,
        index,
      }),
      canDrop: ({ source }) => {
        return source.data.type === "card" && source.data.cardId !== card.id;
      },
      onDragEnter: () => setIsDropTarget(true),
      onDragLeave: () => setIsDropTarget(false),
      onDrop: ({ source, self }) => {
        setIsDropTarget(false);
        const sourceCardId = source.data.cardId as string;
        const sourceColumnId = source.data.columnId as string;
        const targetCardId = self.data.cardId as string;
        const targetColumnId = self.data.columnId as string;
        const targetIndex = self.data.index as number;

        if (sourceColumnId === targetColumnId) {
          // Same column: check if this is a group action or reorder
          // If dropped directly on a card center, group it
          send({ type: "card:group", cardId: sourceCardId, targetCardId });
        } else {
          // Different column: move to position
          const cardsInColumn = allCards
            .filter((c) => c.columnId === targetColumnId && c.groupId === null)
            .sort((a, b) => a.position - b.position);

          let position: number;
          if (targetIndex === 0) {
            position = (cardsInColumn[0]?.position ?? 1) - 1;
          } else if (targetIndex >= cardsInColumn.length) {
            position = (cardsInColumn[cardsInColumn.length - 1]?.position ?? 0) + 1;
          } else {
            const before = cardsInColumn[targetIndex - 1]?.position ?? 0;
            const after = cardsInColumn[targetIndex]?.position ?? before + 2;
            position = (before + after) / 2;
          }

          send({
            type: "card:move",
            cardId: sourceCardId,
            columnId: targetColumnId as CardType["columnId"],
            position,
          });
        }
      },
    });
  }, [card.id, card.columnId, index, send, allCards]);

  const handleSaveEdit = () => {
    if (editContent.trim() && editContent.trim() !== card.content) {
      send({ type: "card:update", cardId: card.id, content: editContent.trim() });
    }
    setIsEditing(false);
  };

  const handleDelete = () => {
    send({ type: "card:delete", cardId: card.id });
  };

  const handleMove = (targetColumnId: ColumnId) => {
    if (targetColumnId === card.columnId) return;
    const cardsInColumn = allCards
      .filter((c) => c.columnId === targetColumnId && c.groupId === null)
      .sort((a, b) => a.position - b.position);
    const lastCard = cardsInColumn[cardsInColumn.length - 1];
    const position = lastCard ? lastCard.position + 1 : 1;
    send({ type: "card:move", cardId: card.id, columnId: targetColumnId, position });
  };

  // Aggregate reactions by emoji
  const reactionCounts = reactions.reduce(
    (acc, r) => {
      if (!acc[r.emoji]) acc[r.emoji] = { count: 0, users: [], userReacted: false };
      acc[r.emoji].count++;
      acc[r.emoji].users.push(r.userName);
      if (r.userName === userName) acc[r.emoji].userReacted = true;
      return acc;
    },
    {} as Record<string, { count: number; users: string[]; userReacted: boolean }>,
  );

  return (
    <div>
      <div
        ref={cardRef}
        data-agent="card"
        data-card-id={card.id}
        className={`group bg-cf-bg-hover relative border transition-all ${
          isDragging ? "opacity-40" : ""
        } ${
          isDropTarget
            ? "border-cf-orange ring-cf-orange border-dashed ring-1"
            : "border-cf-border hover:border-cf-orange hover:border-dashed"
        }`}
      >
        {/* Corner brackets */}
        <div className="border-cf-border bg-cf-bg-page absolute -top-1 -left-1 h-2 w-2 rounded-[1.5px] border" />
        <div className="border-cf-border bg-cf-bg-page absolute -top-1 -right-1 h-2 w-2 rounded-[1.5px] border" />
        <div className="border-cf-border bg-cf-bg-page absolute -bottom-1 -left-1 h-2 w-2 rounded-[1.5px] border" />
        <div className="border-cf-border bg-cf-bg-page absolute -right-1 -bottom-1 h-2 w-2 rounded-[1.5px] border" />

        {/* Drag handle */}
        <div
          ref={dragHandleRef}
          className="absolute top-1 left-1 cursor-grab p-1 opacity-0 transition-opacity group-hover:opacity-60 active:cursor-grabbing"
        >
          <svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor">
            <circle cx="2" cy="2" r="1.5" />
            <circle cx="8" cy="2" r="1.5" />
            <circle cx="2" cy="7" r="1.5" />
            <circle cx="8" cy="7" r="1.5" />
            <circle cx="2" cy="12" r="1.5" />
            <circle cx="8" cy="12" r="1.5" />
          </svg>
        </div>

        <div className="p-3 pt-4">
          {isEditing ? (
            <div>
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                onBlur={handleSaveEdit}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSaveEdit();
                  }
                  if (e.key === "Escape") {
                    setEditContent(card.content);
                    setIsEditing(false);
                  }
                }}
                autoFocus
                className="border-cf-border bg-cf-bg-page text-cf-text focus:border-cf-orange w-full resize-none rounded border p-1 text-sm outline-none"
                rows={3}
              />
            </div>
          ) : (
            <p
              data-agent-control="content"
              className={`text-cf-text text-sm whitespace-pre-wrap transition-[filter] ${
                shouldBlur ? "cursor-default blur-sm select-none" : "cursor-text"
              }`}
              onClick={() => {
                if (shouldBlur) return;
                setEditContent(card.content);
                setIsEditing(true);
              }}
            >
              {card.content}
            </p>
          )}

          {/* Author and actions */}
          <div className="mt-2 flex items-center justify-between">
            <span className="text-cf-text-muted text-xs">{card.author}</span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => send({ type: "upvote:toggle", cardId: card.id })}
                data-agent-control="upvote"
                className={`rounded-full border px-2 py-0.5 text-xs transition-all ${
                  userUpvoted
                    ? "border-cf-orange text-cf-orange bg-orange-50"
                    : "border-cf-border text-cf-text-muted hover:border-cf-orange hover:text-cf-orange"
                }`}
                title="Upvote"
              >
                ↑ {upvotes.length}
              </button>
              <MoveCardMenu columns={columns} currentColumnId={card.columnId} onMove={handleMove} />
              <button
                onClick={handleDelete}
                data-agent-control="delete"
                className="text-cf-text-muted rounded px-1.5 py-0.5 text-xs opacity-0 transition-opacity group-hover:opacity-100 hover:bg-red-50 hover:text-red-500"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Reactions */}
          <div className="mt-2 flex flex-wrap gap-1">
            {Object.entries(reactionCounts).map(([emoji, data]) => (
              <button
                key={emoji}
                onClick={() => send({ type: "reaction:toggle", cardId: card.id, emoji })}
                data-agent-control={`reaction-${emoji}`}
                title={data.users.join(", ")}
                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-all ${
                  data.userReacted
                    ? "border-cf-orange text-cf-orange bg-orange-50"
                    : "border-cf-border text-cf-text-muted hover:border-cf-orange"
                }`}
              >
                <span>{emoji}</span>
                <span>{data.count}</span>
              </button>
            ))}
            <EmojiReaction
              onSelect={(emoji) => send({ type: "reaction:toggle", cardId: card.id, emoji })}
            />
          </div>
        </div>
      </div>

      {/* Grouped cards */}
      {groupedCards.length > 0 && (
        <CardGroup
          cards={groupedCards}
          parentCard={card}
          send={send}
          userName={userName}
          userId={userId}
          blurred={blurred}
          getReactionsForCard={() => []}
        />
      )}
    </div>
  );
}

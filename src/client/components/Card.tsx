import { useRef, useEffect, useState } from "react";
import type { FormEvent } from "react";
import {
  draggable,
  dropTargetForElements,
} from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import type {
  Card as CardType,
  CardComment,
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
  comments: CardComment[];
  send: (msg: ClientMessage) => void;
  userName: string;
  userId: string;
  blurred: boolean;
  allCards: CardType[];
  remoteDragging?: boolean;
}

export function RetroCard({
  card,
  index,
  columns,
  groupedCards,
  reactions,
  upvotes,
  comments,
  send,
  userName,
  userId,
  blurred,
  allCards,
  remoteDragging = false,
}: RetroCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const dragHandleRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isDropTarget, setIsDropTarget] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(card.content);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [commentDraft, setCommentDraft] = useState("");
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
      onDragStart: () => {
        setIsDragging(true);
        send({ type: "drag:start", cardId: card.id });
      },
      onDrop: () => {
        setIsDragging(false);
        send({ type: "drag:end" });
      },
    });
  }, [card.id, card.columnId, index, send]);

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
    const confirmed = window.confirm(
      "Delete this card? This removes its reactions, upvotes, and comments.",
    );
    if (!confirmed) return;
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

  const handleCreateComment = (event: FormEvent) => {
    event.preventDefault();
    const content = commentDraft.trim();
    if (!content) return;
    send({ type: "comment:create", cardId: card.id, content });
    setCommentDraft("");
    setCommentsOpen(true);
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
          isDragging || remoteDragging ? "opacity-40" : ""
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

        <button
          type="button"
          onClick={handleDelete}
          data-agent-control="delete"
          data-agent-prefer-api="delete_card"
          className="text-cf-text-muted absolute top-1 right-1 rounded px-1.5 py-0.5 text-xs opacity-0 transition-opacity group-hover:opacity-100 hover:bg-red-50 hover:text-red-500"
          title="Delete card"
        >
          x
        </button>

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
              data-agent-prefer-api="edit_card"
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

          <div className="mt-2">
            <span className="text-cf-text-muted text-xs">{card.author}</span>
          </div>

          {commentsOpen && (
            <div className="border-cf-border mt-3 border-t pt-3">
              {comments.length > 0 && (
                <div className="mb-2 space-y-2">
                  {comments.map((comment) => (
                    <div key={comment.id} className="text-xs">
                      <div className="text-cf-text-muted mb-0.5 flex items-center justify-between gap-2">
                        <span>{comment.author}</span>
                        <span>
                          {new Date(comment.createdAt).toLocaleTimeString([], {
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                      <p className="text-cf-text whitespace-pre-wrap">{comment.content}</p>
                    </div>
                  ))}
                </div>
              )}
              <form onSubmit={handleCreateComment} className="flex flex-col gap-2">
                <textarea
                  value={commentDraft}
                  onChange={(event) => setCommentDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") {
                      setCommentDraft("");
                      setCommentsOpen(false);
                    }
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      event.currentTarget.form?.requestSubmit();
                    }
                  }}
                  maxLength={500}
                  rows={2}
                  placeholder="Add a comment..."
                  className="border-cf-border bg-cf-bg-page text-cf-text placeholder:text-cf-text-muted focus:border-cf-orange w-full resize-none rounded border p-2 text-xs outline-none"
                />
                <div className="flex items-center justify-between gap-2">
                  <span className="text-cf-text-muted text-[11px]">{commentDraft.length}/500</span>
                  <button
                    type="submit"
                    disabled={!commentDraft.trim()}
                    className="bg-cf-orange rounded-full px-3 py-1 text-xs font-medium text-white transition-opacity disabled:opacity-40"
                  >
                    Add comment
                  </button>
                </div>
              </form>
            </div>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-1">
            <div
              ref={dragHandleRef}
              className="border-cf-border text-cf-text-muted hover:border-cf-orange hover:text-cf-orange inline-flex cursor-grab items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-all active:cursor-grabbing"
              title="Drag card"
              aria-label="Drag card"
            >
              <svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor">
                <circle cx="2" cy="2" r="1.5" />
                <circle cx="8" cy="2" r="1.5" />
                <circle cx="2" cy="7" r="1.5" />
                <circle cx="8" cy="7" r="1.5" />
                <circle cx="2" cy="12" r="1.5" />
                <circle cx="8" cy="12" r="1.5" />
              </svg>
              <span>Drag</span>
            </div>
            <button
              onClick={() => send({ type: "upvote:toggle", cardId: card.id })}
              data-agent-control="upvote"
              data-agent-prefer-api="upvote_card"
              className={`rounded-full border px-2 py-0.5 text-xs transition-all ${
                userUpvoted
                  ? "border-cf-orange text-cf-orange bg-orange-50"
                  : "border-cf-border text-cf-text-muted hover:border-cf-orange hover:text-cf-orange"
              }`}
              title="Upvote"
            >
              ↑ {upvotes.length}
            </button>
            <button
              type="button"
              onClick={() => setCommentsOpen((open) => !open)}
              data-agent-control="comment"
              data-agent-prefer-api="comment_card"
              className="border-cf-border text-cf-text-muted hover:border-cf-orange hover:text-cf-orange rounded-full border px-2 py-0.5 text-xs transition-all"
              title="Comments"
            >
              {comments.length === 0 ? "Comment" : `Comments ${comments.length}`}
            </button>
            <MoveCardMenu columns={columns} currentColumnId={card.columnId} onMove={handleMove} />
            {Object.entries(reactionCounts).map(([emoji, data]) => (
              <button
                key={emoji}
                onClick={() => send({ type: "reaction:toggle", cardId: card.id, emoji })}
                data-agent-control={`reaction-${emoji}`}
                data-agent-prefer-api="react_to_card"
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

import { useRef, useEffect, useState } from "react";
import type { FormEvent } from "react";
import {
  draggable,
  dropTargetForElements,
} from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import type { Card as CardType, CardComment, Upvote, ClientMessage } from "../../types";
import { CardGroup } from "./CardGroup";
import { MarkdownContent } from "./MarkdownContent";

interface RetroCardProps {
  card: CardType;
  index: number;
  groupedCards: CardType[];
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
  groupedCards,
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
  const dragHandleRef = useRef<HTMLButtonElement>(null);
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
    const confirmed = window.confirm("Delete this card? This removes its upvotes and comments.");
    if (!confirmed) return;
    send({ type: "card:delete", cardId: card.id });
  };

  const handleCreateComment = (event: FormEvent) => {
    event.preventDefault();
    const content = commentDraft.trim();
    if (!content) return;
    send({ type: "comment:create", cardId: card.id, content });
    setCommentDraft("");
    setCommentsOpen(true);
  };

  const controlBase =
    "text-cf-text-muted hover:text-cf-orange group/tooltip relative inline-flex h-9 min-w-9 items-center justify-center gap-1 rounded-full px-2 text-sm transition-all hover:-translate-y-px hover:bg-orange-50 focus-visible:text-cf-orange focus-visible:outline-none";
  const activeControl = "text-cf-orange";

  return (
    <div>
      <div
        ref={cardRef}
        data-agent="card"
        data-card-id={card.id}
        className={`group relative border bg-white transition-all ${
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
            <div
              data-agent-control="content"
              data-agent-prefer-api="edit_card"
              className={`text-cf-text cursor-text text-sm transition-[filter] ${
                shouldBlur ? "cursor-default blur-sm select-none" : "cursor-text"
              }`}
              onClick={() => {
                if (shouldBlur) return;
                setEditContent(card.content);
                setIsEditing(true);
              }}
            >
              <div className="text-cf-text-muted mb-1 text-xs">{card.author}</div>
              <MarkdownContent content={card.content} />
            </div>
          )}

          {commentsOpen && (
            <div className="border-cf-border mt-3 ml-4 border-l-2 pl-3">
              {comments.length > 0 && (
                <div className="mb-3 space-y-3">
                  {comments.map((comment) => (
                    <div key={comment.id} className="text-sm">
                      <div className="text-cf-text-muted mb-1 flex items-center justify-between gap-2 text-xs">
                        <span>{comment.author}</span>
                        <span>
                          {new Date(comment.createdAt).toLocaleTimeString([], {
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                      <MarkdownContent content={comment.content} />
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

          <div className="mt-3 flex flex-wrap items-center gap-1.5 pl-4">
            <button
              type="button"
              onClick={() => send({ type: "upvote:toggle", cardId: card.id })}
              data-agent-control="upvote"
              data-agent-prefer-api="upvote_card"
              aria-label={`Upvote card, ${upvotes.length} ${upvotes.length === 1 ? "vote" : "votes"}`}
              className={`${controlBase} ${userUpvoted ? activeControl : ""}`}
            >
              <UpvoteIcon />
              {upvotes.length > 0 && <span>{upvotes.length}</span>}
              <ControlTooltip>Upvote</ControlTooltip>
            </button>
            <button
              type="button"
              onClick={() => setCommentsOpen((open) => !open)}
              data-agent-control="comment"
              data-agent-prefer-api="comment_card"
              aria-label={`${commentsOpen ? "Hide" : "Show"} comments, ${comments.length} total`}
              className={`${controlBase} ${commentsOpen ? activeControl : ""}`}
            >
              <CommentIcon />
              {comments.length > 0 && <span>{comments.length}</span>}
              <ControlTooltip>{commentsOpen ? "Hide comments" : "Comments"}</ControlTooltip>
            </button>
            <button
              type="button"
              ref={dragHandleRef}
              className={`${controlBase} cursor-grab px-2 active:cursor-grabbing`}
              aria-label="Drag card"
            >
              <DragIcon />
              <ControlTooltip>Drag card</ControlTooltip>
            </button>
            <button
              type="button"
              onClick={handleDelete}
              data-agent-control="delete"
              data-agent-prefer-api="delete_card"
              aria-label="Delete card"
              className={`${controlBase} hover:bg-red-50 hover:text-red-500 focus-visible:text-red-500`}
            >
              <TrashIcon />
              <ControlTooltip>Delete card</ControlTooltip>
            </button>
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
        />
      )}
    </div>
  );
}

function ControlTooltip({ children }: { children: string }) {
  return (
    <span className="bg-cf-text pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 -translate-x-1/2 rounded px-2 py-1 text-[11px] whitespace-nowrap text-white opacity-0 shadow-sm transition-opacity group-hover/delete:opacity-100 group-hover/tooltip:opacity-100 group-focus-visible/delete:opacity-100 group-focus-visible/tooltip:opacity-100">
      {children}
    </span>
  );
}

function UpvoteIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4" fill="none">
      <path
        d="M7.5 20H5.8a1.8 1.8 0 0 1-1.8-1.8v-6.4A1.8 1.8 0 0 1 5.8 10h1.7m0 10V9.5l3.6-5.1c.6-.8 1.9-.5 2 .5l.3 3.1h4.1a2.5 2.5 0 0 1 2.4 3.1l-1.4 5.6A4.4 4.4 0 0 1 14.2 20H7.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CommentIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4" fill="none">
      <path
        d="M6 6.5h12a2 2 0 0 1 2 2v6.25a2 2 0 0 1-2 2h-5.5L8 20v-3.25H6a2 2 0 0 1-2-2V8.5a2 2 0 0 1 2-2Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function DragIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4" fill="currentColor">
      <circle cx="8" cy="6" r="1.6" />
      <circle cx="16" cy="6" r="1.6" />
      <circle cx="8" cy="12" r="1.6" />
      <circle cx="16" cy="12" r="1.6" />
      <circle cx="8" cy="18" r="1.6" />
      <circle cx="16" cy="18" r="1.6" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4" fill="none">
      <path d="M9 5h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M5.5 7h13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path
        d="m8 7 .6 11.5A1.6 1.6 0 0 0 10.2 20h3.6a1.6 1.6 0 0 0 1.6-1.5L16 7"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M10.5 10v6M13.5 10v6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

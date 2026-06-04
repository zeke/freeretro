import { useRef, useEffect, useState } from "react";
import { dropTargetForElements } from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import type {
  Card as CardType,
  Reaction,
  Upvote,
  ColumnId,
  ClientMessage,
  RetroColumn,
} from "../../types";
import { RetroCard } from "./Card";
import { CardForm } from "./CardForm";

interface ColumnProps {
  columnId: ColumnId;
  label: string;
  columns: RetroColumn[];
  cards: CardType[];
  getGroupedCards: (groupId: string) => CardType[];
  getReactionsForCard: (cardId: string) => Reaction[];
  getUpvotesForCard: (cardId: string) => Upvote[];
  send: (msg: ClientMessage) => void;
  userName: string;
  userId: string;
  blurred: boolean;
  allCards: CardType[];
}

export function Column({
  columnId,
  label,
  columns,
  cards,
  getGroupedCards,
  getReactionsForCard,
  getUpvotesForCard,
  send,
  userName,
  userId,
  blurred,
  allCards,
}: ColumnProps) {
  const columnRef = useRef<HTMLDivElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isEditingLabel, setIsEditingLabel] = useState(false);
  const [draftLabel, setDraftLabel] = useState(label);

  useEffect(() => {
    if (!isEditingLabel) {
      setDraftLabel(label);
    }
  }, [isEditingLabel, label]);

  useEffect(() => {
    const el = columnRef.current;
    if (!el) return;

    return dropTargetForElements({
      element: el,
      getData: () => ({ columnId }),
      canDrop: ({ source }) => {
        return source.data.type === "card";
      },
      onDragEnter: () => setIsDragOver(true),
      onDragLeave: () => setIsDragOver(false),
      onDrop: ({ source }) => {
        setIsDragOver(false);
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
  }, [columnId, cards, send]);

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

  return (
    <div
      ref={columnRef}
      className={`flex min-h-80 w-full min-w-0 flex-col transition-all ${
        isDragOver ? "ring-cf-orange ring-opacity-50 ring-2" : ""
      }`}
    >
      {/* Column header */}
      <div className="flex items-center justify-between px-1 py-3">
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
            className="border-cf-border bg-cf-bg-card text-cf-text focus:border-cf-orange w-full rounded border px-2 py-1 font-medium tracking-tight outline-none"
          />
        ) : (
          <button
            type="button"
            onClick={() => setIsEditingLabel(true)}
            title="Rename column"
            className="text-cf-text hover:text-cf-orange truncate text-left font-medium tracking-tight transition-colors"
          >
            {label}
          </button>
        )}
        <span className="text-cf-text-muted text-xs">{cards.length}</span>
      </div>

      {/* Cards */}
      <div className="flex-1 space-y-2 overflow-x-hidden overflow-y-auto pb-3">
        {cards.map((card, index) => (
          <RetroCard
            key={card.id}
            card={card}
            index={index}
            columns={columns}
            groupedCards={getGroupedCards(card.id)}
            reactions={getReactionsForCard(card.id)}
            upvotes={getUpvotesForCard(card.id)}
            send={send}
            userName={userName}
            userId={userId}
            blurred={blurred}
            allCards={allCards}
          />
        ))}
        <CardForm onSubmit={handleCreateCard} />
      </div>
    </div>
  );
}

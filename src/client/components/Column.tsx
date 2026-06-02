import { useRef, useEffect, useState } from "react";
import { dropTargetForElements } from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import type { Card as CardType, Reaction, ColumnId, ClientMessage } from "../../types";
import { RetroCard } from "./Card";
import { CardForm } from "./CardForm";

interface ColumnProps {
  columnId: ColumnId;
  label: string;
  cards: CardType[];
  getGroupedCards: (groupId: string) => CardType[];
  getReactionsForCard: (cardId: string) => Reaction[];
  send: (msg: ClientMessage) => void;
  userName: string;
  allCards: CardType[];
}

export function Column({
  columnId,
  label,
  cards,
  getGroupedCards,
  getReactionsForCard,
  send,
  userName,
  allCards,
}: ColumnProps) {
  const columnRef = useRef<HTMLDivElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

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

  return (
    <div
      ref={columnRef}
      className={`border-cf-border bg-cf-bg-hover flex min-h-80 w-full min-w-0 flex-col rounded-xl border transition-all ${
        isDragOver ? "ring-cf-orange ring-opacity-50 ring-2" : ""
      }`}
    >
      {/* Column header */}
      <div className="flex items-center justify-between px-4 py-3">
        <h2 className="text-cf-text font-medium tracking-tight">{label}</h2>
        <span className="text-cf-text-muted text-xs">{cards.length}</span>
      </div>

      {/* Cards */}
      <div className="flex-1 space-y-2 overflow-y-auto px-3 pb-3">
        {cards.map((card, index) => (
          <RetroCard
            key={card.id}
            card={card}
            index={index}
            groupedCards={getGroupedCards(card.id)}
            reactions={getReactionsForCard(card.id)}
            send={send}
            userName={userName}
            allCards={allCards}
          />
        ))}
        <CardForm onSubmit={handleCreateCard} />
      </div>
    </div>
  );
}

import type { Card, Reaction, ClientMessage } from "../../types";

interface CardGroupProps {
  cards: Card[];
  parentCard: Card;
  send: (msg: ClientMessage) => void;
  userName: string;
  userId: string;
  blurred: boolean;
  getReactionsForCard: (cardId: string) => Reaction[];
}

export function CardGroup({
  cards,
  parentCard: _parentCard,
  send,
  userName,
  userId,
  blurred,
}: CardGroupProps) {
  return (
    <div className="border-cf-border mt-1 ml-4 space-y-1 border-l-2 pl-3">
      {cards.map((card) => {
        const isOwnCard = card.authorId === userId || (!card.authorId && card.author === userName);
        const shouldBlur = blurred && !isOwnCard;

        return (
          <div
            key={card.id}
            className="group border-cf-border bg-cf-bg-hover hover:border-cf-orange relative border p-2 transition-all hover:border-dashed"
          >
            <p
              className={`text-cf-text text-xs whitespace-pre-wrap transition-[filter] ${
                shouldBlur ? "blur-sm select-none" : ""
              }`}
            >
              {card.content}
            </p>
            <div className="mt-1 flex items-center justify-between">
              <span className="text-cf-text-muted text-xs">{card.author}</span>
              <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                <button
                  onClick={() => send({ type: "card:ungroup", cardId: card.id })}
                  className="text-cf-text-muted rounded px-1.5 py-0.5 text-xs hover:bg-blue-50 hover:text-blue-500"
                  title="Ungroup"
                >
                  ↗
                </button>
                <button
                  onClick={() => send({ type: "card:delete", cardId: card.id })}
                  className="text-cf-text-muted rounded px-1.5 py-0.5 text-xs hover:bg-red-50 hover:text-red-500"
                >
                  ✕
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

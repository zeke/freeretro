import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";

interface EmojiReactionProps {
  onSelect: (emoji: string) => void;
}

const QUICK_EMOJIS = ["👍", "👎", "❤️", "🎉", "🤔", "👀", "🔥", "💯", "😂", "😢", "🚀", "⭐"];

export function EmojiReaction({ onSelect }: EmojiReactionProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ left: 0, top: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const rect = buttonRef.current?.getBoundingClientRect();
    if (rect) {
      setPosition({ left: rect.left, top: rect.top - 58 });
    }

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        pickerRef.current &&
        !pickerRef.current.contains(target) &&
        !buttonRef.current?.contains(target)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        type="button"
        data-agent-control="react"
        aria-label="Add reaction"
        className="text-cf-text-muted hover:text-cf-orange group/tooltip focus-visible:text-cf-orange relative inline-flex h-8 w-8 items-center justify-center rounded-full text-sm transition-all hover:-translate-y-px hover:bg-orange-50 focus-visible:outline-none"
      >
        <span className="opacity-70 grayscale transition-opacity group-hover/tooltip:opacity-100">
          ☺
        </span>
        <span className="bg-cf-text pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 -translate-x-1/2 rounded px-2 py-1 text-[11px] whitespace-nowrap text-white opacity-0 shadow-sm transition-opacity group-hover/tooltip:opacity-100 group-focus-visible/tooltip:opacity-100">
          Add reaction
        </span>
      </button>

      {isOpen &&
        createPortal(
          <div
            ref={pickerRef}
            className="border-cf-border bg-cf-bg-card fixed z-50 rounded-lg border p-2 shadow-lg"
            style={{ left: position.left, top: Math.max(8, position.top) }}
          >
            <div className="grid grid-cols-6 gap-1">
              {QUICK_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  data-agent-control={`emoji-${emoji}`}
                  onClick={() => {
                    onSelect(emoji);
                    setIsOpen(false);
                  }}
                  className="hover:bg-cf-bg-hover flex h-8 w-8 items-center justify-center rounded text-lg leading-none"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}

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
        className="border-cf-border text-cf-text-muted hover:border-cf-orange hover:text-cf-orange inline-flex items-center rounded-full border border-dashed px-2 py-0.5 text-xs transition-all"
      >
        +
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

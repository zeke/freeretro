import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import type { ColumnId, RetroColumn } from "../../types";

interface MoveCardMenuProps {
  columns: RetroColumn[];
  currentColumnId: ColumnId;
  onMove: (columnId: ColumnId) => void;
}

// Accessible alternative to drag-and-drop for moving a card between columns.
// Keyboard users, screen readers, and automated agents can all use this, since
// native HTML5 drag-and-drop is not reachable without a real pointer drag.
export function MoveCardMenu({ columns, currentColumnId, onMove }: MoveCardMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ left: 0, top: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const targets = columns.filter((column) => column.id !== currentColumnId);

  useEffect(() => {
    if (!isOpen) return;

    const rect = buttonRef.current?.getBoundingClientRect();
    if (rect) {
      setPosition({ left: rect.left, top: rect.bottom + 4 });
    }

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        menuRef.current &&
        !menuRef.current.contains(target) &&
        !buttonRef.current?.contains(target)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  if (targets.length === 0) return null;

  return (
    <>
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        type="button"
        data-agent-control="move"
        title="Move to column"
        aria-label="Move card to another column"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        className="text-cf-text-muted hover:text-cf-orange rounded px-1.5 py-0.5 text-xs opacity-0 transition-opacity group-hover:opacity-100"
      >
        ⇄
      </button>

      {isOpen &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            aria-label="Move card to column"
            className="border-cf-border bg-cf-bg-card fixed z-50 min-w-40 rounded-lg border p-1 shadow-lg"
            style={{ left: position.left, top: position.top }}
          >
            {targets.map((column) => (
              <button
                key={column.id}
                type="button"
                role="menuitem"
                data-agent-control={`movecol-${column.id}`}
                onClick={() => {
                  onMove(column.id);
                  setIsOpen(false);
                }}
                className="text-cf-text hover:bg-cf-bg-hover block w-full truncate rounded px-3 py-1.5 text-left text-sm"
              >
                {column.label}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}

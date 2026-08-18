import { useEffect, useRef, useState } from "react";

interface HeaderMenuProps {
  blurred: boolean;
  sortByUpvotes: boolean;
  copiedLink: boolean;
  onShare: () => void;
  onToggleBlur: () => void;
  onToggleSort: () => void;
  onAddColumn: () => void;
  onDelete: () => void;
}

export function HeaderMenu({
  blurred,
  sortByUpvotes,
  copiedLink,
  onShare,
  onToggleBlur,
  onToggleSort,
  onAddColumn,
  onDelete,
}: HeaderMenuProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const menuItemClass =
    "text-cf-text w-full rounded px-3 py-2 text-left text-sm transition-colors hover:bg-cf-bg-page";

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label="Board menu"
        data-agent-control="menu"
        className="border-cf-border text-cf-text-muted hover:border-cf-orange hover:text-cf-orange flex h-9 w-9 items-center justify-center rounded-full border transition-all"
      >
        <span className="sr-only">Board menu</span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          className="h-4 w-4"
        >
          <line x1="4" y1="6" x2="20" y2="6" />
          <line x1="4" y1="12" x2="20" y2="12" />
          <line x1="4" y1="18" x2="20" y2="18" />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          className="border-cf-border bg-cf-bg-card absolute right-0 z-10 mt-2 flex w-48 flex-col gap-0.5 rounded-lg border p-1.5 shadow-lg"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              onShare();
            }}
            data-agent-control="share"
            className={menuItemClass}
          >
            {copiedLink ? "Copied!" : "Share link"}
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              onToggleBlur();
              setOpen(false);
            }}
            data-agent-control="blur"
            data-agent-prefer-api="set_blur"
            className={menuItemClass}
          >
            {blurred ? "Show cards" : "Blur cards"}
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              onToggleSort();
              setOpen(false);
            }}
            data-agent-control="sort"
            data-agent-prefer-api="set_sort"
            className={menuItemClass}
          >
            {sortByUpvotes ? "Manual order" : "Sort by votes"}
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              onAddColumn();
              setOpen(false);
            }}
            data-agent-control="add-column"
            data-agent-prefer-api="create_column"
            className={menuItemClass}
          >
            + Column
          </button>
          <div className="border-cf-border my-1 border-t" />
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              onDelete();
              setOpen(false);
            }}
            data-agent-control="delete-retro"
            data-agent-prefer-api="delete_retro"
            className={`${menuItemClass} hover:bg-red-50 hover:text-red-500`}
          >
            Delete board
          </button>
        </div>
      )}
    </div>
  );
}

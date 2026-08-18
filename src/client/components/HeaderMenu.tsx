import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

interface HeaderMenuProps {
  blurred: boolean;
  sortByUpvotes: boolean;
  copiedLink: boolean;
  onShare: () => void;
  onToggleBlur: () => void;
  onToggleSort: (sortByUpvotes: boolean) => void;
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
  const toggleItemClass = `${menuItemClass} flex items-center justify-between gap-3`;

  const renderSwitch = (checked: boolean) => (
    <span
      aria-hidden="true"
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
        checked ? "bg-cf-orange" : "bg-cf-border"
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
          checked ? "translate-x-4" : "translate-x-0.5"
        }`}
      />
    </span>
  );

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label="Board menu"
        data-agent-control="menu"
        className="text-cf-text-muted hover:text-cf-orange flex h-9 w-9 items-center justify-center rounded-full transition-all"
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
          className="border-cf-border bg-cf-bg-card absolute right-0 z-50 mt-2 flex w-52 flex-col gap-0.5 rounded-lg border p-1.5 shadow-lg"
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
            {copiedLink ? "Copied to clipboard!" : "Copy link"}
          </button>
          <button
            type="button"
            role="menuitemcheckbox"
            aria-checked={blurred}
            onClick={() => {
              onToggleBlur();
            }}
            data-agent-control="blur"
            data-agent-prefer-api="set_blur"
            className={toggleItemClass}
          >
            Blur cards
            {renderSwitch(blurred)}
          </button>
          <div className={`${menuItemClass} flex items-center justify-between gap-3`}>
            <label htmlFor="sort-order">Sort</label>
            <select
              id="sort-order"
              value={sortByUpvotes ? "votes" : "manual"}
              onChange={(event) => onToggleSort(event.target.value === "votes")}
              data-agent-control="sort"
              data-agent-prefer-api="set_sort"
              className="border-cf-border bg-cf-bg-page text-cf-text rounded border px-2 py-1 text-sm outline-none"
            >
              <option value="manual">Manual order</option>
              <option value="votes">By votes</option>
            </select>
          </div>
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
            New column
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
          <div className="border-cf-border my-1 border-t" />
          <a href="https://github.com/zeke/freeretro" className={menuItemClass}>
            GitHub repo
          </a>
          <Link to="/about" className={menuItemClass}>
            About
          </Link>
        </div>
      )}
    </div>
  );
}

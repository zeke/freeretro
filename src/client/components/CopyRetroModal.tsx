import { useState } from "react";

interface CopyRetroModalProps {
  defaultTitle: string;
  columnLabels: string[];
  copying: boolean;
  onCancel: () => void;
  onConfirm: (options: { title: string; includeCards: boolean }) => void;
}

export function CopyRetroModal({
  defaultTitle,
  columnLabels,
  copying,
  onCancel,
  onConfirm,
}: CopyRetroModalProps) {
  const [title, setTitle] = useState(defaultTitle);
  const [includeCards, setIncludeCards] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || copying) return;
    onConfirm({ title: title.trim(), includeCards });
  };

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/40 px-6"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="border-cf-border bg-cf-bg-card relative w-full max-w-md rounded-lg border p-6 shadow-lg">
        <h2 className="text-cf-text mb-2 text-xl font-medium tracking-tight">Duplicate board</h2>
        <p className="text-cf-text-muted mb-4 text-sm">
          Creates a new retro with the same {columnLabels.length} column
          {columnLabels.length === 1 ? "" : "s"} and order: {columnLabels.join(", ")}.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="copy-title" className="text-cf-text mb-1 block text-sm font-medium">
              Title
            </label>
            <input
              id="copy-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={80}
              autoFocus
              className="border-cf-border bg-cf-bg-page text-cf-text placeholder:text-cf-text-muted focus:border-cf-orange focus:ring-cf-orange w-full rounded-lg border p-3 outline-none focus:ring-1"
            />
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={includeCards}
              onChange={(e) => setIncludeCards(e.target.checked)}
              className="accent-cf-orange h-4 w-4"
            />
            <span className="text-cf-text">Also copy cards, upvotes, and comments</span>
          </label>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="text-cf-text-muted hover:text-cf-text rounded-full px-4 py-2 text-sm font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!title.trim() || copying}
              className="border-cf-orange bg-cf-orange rounded-full border px-5 py-2 text-sm font-medium text-white transition-all hover:opacity-95 active:translate-y-[1px] active:scale-[0.98] disabled:opacity-50"
            >
              {copying ? "Duplicating..." : "Duplicate"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

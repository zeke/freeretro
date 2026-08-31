import { useState } from "react";

interface RenameModalProps {
  currentName: string;
  onCancel: () => void;
  onConfirm: (name: string) => void;
}

export function RenameModal({ currentName, onCancel, onConfirm }: RenameModalProps) {
  const [name, setName] = useState(currentName);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onConfirm(name.trim());
  };

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/40 px-6"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="border-cf-border bg-cf-bg-card relative w-full max-w-sm rounded-lg border p-6 shadow-lg">
        <h2 className="text-cf-text mb-4 text-xl font-medium tracking-tight">Change name</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            autoFocus
            className="border-cf-border bg-cf-bg-page text-cf-text placeholder:text-cf-text-muted focus:border-cf-orange focus:ring-cf-orange w-full rounded-lg border p-3 outline-none focus:ring-1"
          />

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="text-cf-text-muted hover:text-cf-text rounded-full px-4 py-2 text-sm font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim()}
              className="border-cf-orange bg-cf-orange rounded-full border px-5 py-2 text-sm font-medium text-white transition-all hover:opacity-95 active:translate-y-[1px] active:scale-[0.98] disabled:opacity-50"
            >
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

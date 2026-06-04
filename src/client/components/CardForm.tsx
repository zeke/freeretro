import { useState } from "react";

interface CardFormProps {
  onSubmit: (content: string) => void;
}

export function CardForm({ onSubmit }: CardFormProps) {
  const [content, setContent] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (content.trim()) {
      onSubmit(content.trim());
      setContent("");
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        data-agent="add-card"
        data-agent-control="add-card"
        className="border-cf-border text-cf-text-muted hover:border-cf-orange hover:text-cf-orange w-full rounded-lg border border-dashed p-2 text-sm transition-all"
      >
        + Add card
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="What's on your mind?"
        autoFocus
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSubmit(e);
          }
          if (e.key === "Escape") {
            setContent("");
            setIsOpen(false);
          }
        }}
        onBlur={() => {
          if (!content.trim()) setIsOpen(false);
        }}
        className="border-cf-border bg-cf-bg-card text-cf-text placeholder:text-cf-text-muted focus:border-cf-orange focus:ring-cf-orange w-full resize-none rounded-lg border p-2 text-sm outline-none focus:ring-1"
        rows={3}
      />
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={!content.trim()}
          className="bg-cf-orange rounded-full px-4 py-1.5 text-sm font-medium text-white transition-all hover:opacity-95 active:translate-y-[1px] active:scale-[0.98] disabled:opacity-50"
        >
          Add
        </button>
        <button
          type="button"
          onClick={() => {
            setContent("");
            setIsOpen(false);
          }}
          className="border-cf-border text-cf-text-muted hover:border-cf-orange hover:text-cf-orange rounded-full border px-4 py-1.5 text-sm transition-all"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

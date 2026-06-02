import { useState, useEffect } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { useWebSocket } from "../hooks/useWebSocket";
import { useRetroState } from "../hooks/useRetroState";
import { useCursors } from "../hooks/useCursors";
import { Column } from "../components/Column";
import { CursorOverlay } from "../components/CursorOverlay";
import { NamePrompt } from "../components/NamePrompt";
import { Footer } from "../components/Footer";
import { COLUMNS, COLUMN_LABELS } from "../../types";
import type { RetroSummary } from "../../types";

export function Board() {
  const { retroId } = useParams<{ retroId: string }>();
  const navigate = useNavigate();
  const [name, setName] = useState(() => localStorage.getItem("retro-name") ?? "");
  const [showNamePrompt, setShowNamePrompt] = useState(!name);
  const [retro, setRetro] = useState<RetroSummary | null>(null);
  const [notFound, setNotFound] = useState(false);

  const { send, subscribe, connected, userId } = useWebSocket(retroId!, name);
  const state = useRetroState(subscribe);
  const { cursors, boardRef } = useCursors(send, subscribe, userId, state.users);
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    if (name) {
      localStorage.setItem("retro-name", name);
    }
  }, [name]);

  useEffect(() => {
    fetch(`/api/retros/${retroId}`)
      .then(async (res) => {
        if (res.status === 404) {
          setNotFound(true);
          return;
        }
        setRetro((await res.json()) as RetroSummary);
      })
      .catch(() => setNotFound(true));
  }, [retroId]);

  useEffect(() => {
    return subscribe((msg) => {
      if (msg.type === "retro:deleted") {
        navigate("/");
      }
    });
  }, [navigate, subscribe]);

  const handleNameSubmit = (newName: string) => {
    setName(newName);
    setShowNamePrompt(false);
  };

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const deleteRetro = async () => {
    const confirmed = window.confirm(
      "Delete this retro forever? This removes all cards and reactions and can't be undone.",
    );
    if (!confirmed) return;

    await fetch(`/api/retros/${retroId}`, { method: "DELETE" });
    navigate("/");
  };

  if (notFound) {
    return (
      <div className="flex min-h-screen flex-col">
        <main className="mx-auto flex max-w-xl flex-1 flex-col items-center justify-center px-6 text-center">
          <h1 className="text-cf-text mb-3 text-3xl font-medium">Retro not found</h1>
          <p className="text-cf-text-muted mb-6">
            This retro may have been deleted, or the link may be wrong.
          </p>
          <Link
            to="/"
            className="border-cf-orange bg-cf-orange rounded-full border px-6 py-3 font-medium text-white transition-all hover:opacity-95"
          >
            Create a new retro
          </Link>
        </main>
        <Footer />
      </div>
    );
  }

  if (showNamePrompt) {
    return (
      <div className="flex min-h-screen flex-col">
        <NamePrompt onSubmit={handleNameSubmit} />
        <Footer />
      </div>
    );
  }

  return (
    <div className="bg-cf-bg-page flex h-screen flex-col">
      {/* Header */}
      <header className="border-cf-border flex flex-wrap items-center justify-between gap-3 border-b px-6 py-3">
        <div className="flex items-center gap-4">
          <Link to="/" className="text-cf-orange hover:underline hover:underline-offset-4">
            ← Back
          </Link>
          <h1 className="text-cf-text text-lg font-medium tracking-tight">
            {retro?.title ?? "Free Retro"}
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Online users */}
          <div className="flex -space-x-2">
            {state.users.map((user) => (
              <div
                key={user.id}
                title={user.name}
                className="border-cf-bg-page flex h-7 w-7 items-center justify-center rounded-full border-2 text-xs font-medium text-white"
                style={{ backgroundColor: user.color }}
              >
                {user.name.charAt(0).toUpperCase()}
              </div>
            ))}
          </div>

          {/* Connection status */}
          <div className="flex items-center gap-1.5">
            <div className={`h-2 w-2 rounded-full ${connected ? "bg-green-500" : "bg-red-400"}`} />
            <span className="text-cf-text-muted text-xs">
              {connected ? `${state.users.length} online` : "Reconnecting..."}
            </span>
          </div>

          <button
            onClick={copyLink}
            className="border-cf-border text-cf-text-muted hover:border-cf-orange hover:text-cf-orange rounded-full border px-4 py-1.5 text-sm transition-all"
          >
            {copiedLink ? "Copied!" : "Share link"}
          </button>
          <button
            onClick={deleteRetro}
            className="border-cf-border text-cf-text-muted rounded-full border px-4 py-1.5 text-sm transition-all hover:border-red-400 hover:text-red-500"
          >
            Delete
          </button>
        </div>
      </header>

      {/* Board */}
      <div
        ref={boardRef}
        className="relative grid flex-1 grid-cols-1 gap-4 overflow-y-auto p-4 md:grid-cols-[repeat(auto-fit,minmax(18rem,1fr))]"
      >
        {COLUMNS.map((columnId) => (
          <Column
            key={columnId}
            columnId={columnId}
            label={COLUMN_LABELS[columnId]}
            cards={state.getCardsForColumn(columnId)}
            getGroupedCards={state.getGroupedCards}
            getReactionsForCard={state.getReactionsForCard}
            send={send}
            userName={name}
            allCards={state.cards}
          />
        ))}
        <CursorOverlay cursors={cursors} boardRef={boardRef} />
      </div>
      <Footer />
    </div>
  );
}

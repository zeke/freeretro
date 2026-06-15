import { useState, useEffect, useMemo } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { useWebSocket } from "../hooks/useWebSocket";
import { useRetroState } from "../hooks/useRetroState";
import { useCursors } from "../hooks/useCursors";
import { useAgentTools } from "../hooks/useAgentTools";
import { useDemoSwarm } from "../hooks/useDemoSwarm";
import { Column } from "../components/Column";
import { CursorOverlay } from "../components/CursorOverlay";
import { NamePrompt } from "../components/NamePrompt";
import { Footer } from "../components/Footer";
import type { RetroSummary } from "../../types";
import { removeLocalRetro, saveLocalRetro } from "../localRetros";

export function Board() {
  const { retroId } = useParams<{ retroId: string }>();
  const navigate = useNavigate();
  const isAutomated = typeof navigator !== "undefined" && navigator.webdriver === true;
  const [name, setName] = useState(() => {
    const stored = localStorage.getItem("retro-name");
    if (stored) return stored;
    return isAutomated ? "Agent" : "";
  });
  const [showNamePrompt, setShowNamePrompt] = useState(!name);
  const [retro, setRetro] = useState<RetroSummary | null>(null);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");
  const [notFound, setNotFound] = useState(false);

  const { send, subscribe, connected, userId } = useWebSocket(retroId!, name);
  const state = useRetroState(subscribe);
  const {
    cursors,
    clicks,
    drags,
    boardRef,
    moveCursorTo,
    broadcastClick,
    setEmbodied,
    isEmbodied,
  } = useCursors(send, subscribe, userId, state.users, connected);
  useAgentTools({ send, state, moveCursorTo, broadcastClick, setEmbodied, isEmbodied, setName });
  const demoActive = useDemoSwarm(retroId);
  const [copiedLink, setCopiedLink] = useState(false);
  const draggedCardIds = useMemo(() => new Set(drags.values()), [drags]);

  useEffect(() => {
    if (name) {
      localStorage.setItem("retro-name", name);
    }
  }, [name]);

  useEffect(() => {
    if (!isEditingTitle) {
      setDraftTitle(retro?.title ?? "");
    }
  }, [isEditingTitle, retro?.title]);

  useEffect(() => {
    fetch(`/api/retros/${retroId}`)
      .then(async (res) => {
        if (res.status === 404) {
          setNotFound(true);
          if (retroId) {
            removeLocalRetro(retroId);
          }
          return;
        }
        const nextRetro = (await res.json()) as RetroSummary;
        setRetro(nextRetro);
        saveLocalRetro(nextRetro);
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

  const toggleBlur = () => {
    send({ type: "blur:set", blurred: !state.blurred });
  };

  const toggleSort = () => {
    send({ type: "sort:set", sortByUpvotes: !state.sortByUpvotes });
  };

  const saveTitle = async () => {
    const trimmed = draftTitle.trim().slice(0, 80);
    if (!trimmed || !retro || trimmed === retro.title) {
      setDraftTitle(retro?.title ?? "");
      setIsEditingTitle(false);
      return;
    }

    const res = await fetch(`/api/retros/${retro.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: trimmed }),
    });

    if (res.ok) {
      const nextRetro = (await res.json()) as RetroSummary;
      setRetro(nextRetro);
      saveLocalRetro(nextRetro);
    }

    setIsEditingTitle(false);
  };

  const deleteRetro = async () => {
    const confirmed = window.confirm(
      "Delete this retro forever? This removes all cards and reactions and can't be undone.",
    );
    if (!confirmed) return;

    await fetch(`/api/retros/${retroId}`, { method: "DELETE" });
    if (retroId) {
      removeLocalRetro(retroId);
    }
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
          {isEditingTitle ? (
            <input
              value={draftTitle}
              onChange={(event) => setDraftTitle(event.target.value)}
              onBlur={saveTitle}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  saveTitle();
                }
                if (event.key === "Escape") {
                  setDraftTitle(retro?.title ?? "");
                  setIsEditingTitle(false);
                }
              }}
              autoFocus
              maxLength={80}
              className="border-cf-border bg-cf-bg-card text-cf-text focus:border-cf-orange min-w-48 rounded border px-2 py-1 text-lg font-medium tracking-tight outline-none"
            />
          ) : (
            <button
              type="button"
              onClick={() => setIsEditingTitle(true)}
              data-agent-control="title"
              title="Rename retro"
              className="text-cf-text hover:text-cf-orange text-left text-lg font-medium tracking-tight transition-colors"
            >
              {retro?.title ?? "Free Retro"}
            </button>
          )}
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
            data-agent-control="share"
            className="border-cf-border text-cf-text-muted hover:border-cf-orange hover:text-cf-orange rounded-full border px-4 py-1.5 text-sm transition-all"
          >
            {copiedLink ? "Copied!" : "Share link"}
          </button>
          <button
            onClick={toggleBlur}
            data-agent-control="blur"
            className="border-cf-border text-cf-text-muted hover:border-cf-orange hover:text-cf-orange rounded-full border px-4 py-1.5 text-sm transition-all"
          >
            {state.blurred ? "Show cards" : "Blur cards"}
          </button>
          <button
            onClick={toggleSort}
            data-agent-control="sort"
            className="border-cf-border text-cf-text-muted hover:border-cf-orange hover:text-cf-orange rounded-full border px-4 py-1.5 text-sm transition-all"
          >
            {state.sortByUpvotes ? "Manual order" : "Sort by votes"}
          </button>
          <button
            onClick={deleteRetro}
            data-agent-control="delete-retro"
            className="border-cf-border text-cf-text-muted rounded-full border px-4 py-1.5 text-sm transition-all hover:border-red-400 hover:text-red-500"
          >
            Delete
          </button>
        </div>
      </header>

      {/* Board */}
      <div
        ref={boardRef}
        className="relative grid flex-1 grid-cols-1 overflow-x-hidden overflow-y-auto p-4 md:grid-cols-[repeat(auto-fit,minmax(18rem,1fr))]"
      >
        <p className="sr-only">
          Automated agent: this retro exposes tools via document.modelContext (WebMCP) and
          window.freeretro. Call window.freeretro.help() in the console for usage.
        </p>
        {state.columns.map((column, index) => (
          <div
            key={column.id}
            className={`min-w-0 ${index > 0 ? "border-cf-border md:border-l md:pl-4" : ""} ${
              index < state.columns.length - 1 ? "pb-6 md:pr-4" : ""
            }`}
          >
            <Column
              columnId={column.id}
              label={column.label}
              columns={state.columns}
              cards={state.getCardsForColumn(column.id)}
              getGroupedCards={state.getGroupedCards}
              getReactionsForCard={state.getReactionsForCard}
              getUpvotesForCard={state.getUpvotesForCard}
              send={send}
              userName={name}
              userId={userId}
              blurred={state.blurred}
              allCards={state.cards}
              draggedCardIds={draggedCardIds}
            />
          </div>
        ))}
        <CursorOverlay
          cursors={cursors}
          clicks={clicks}
          drags={drags}
          cards={state.cards}
          boardRef={boardRef}
        />
      </div>
      {demoActive && (
        <div className="border-cf-orange bg-cf-bg-card text-cf-orange fixed bottom-4 left-4 z-[10000] flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium shadow-sm">
          <span className="bg-cf-orange inline-block h-2 w-2 animate-pulse rounded-full" />
          Demo mode
        </div>
      )}
      <Footer />
    </div>
  );
}

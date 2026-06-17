import { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { RetroSummary } from "../../types";
import { Footer } from "../components/Footer";
import { saveLocalRetro } from "../localRetros";

export function Home() {
  const [title, setTitle] = useState("");
  const [creating, setCreating] = useState(false);
  const navigate = useNavigate();

  const createRetro = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || creating) return;

    setCreating(true);
    const res = await fetch("/api/retros", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: title.trim() }),
    });

    const retro = (await res.json()) as RetroSummary;
    saveLocalRetro(retro);
    setTitle("");
    setCreating(false);
    navigate(`/retro/${retro.id}`);
  };

  return (
    <div className="flex min-h-screen flex-col">
      <p className="sr-only">
        Automated agent: to create a retro, POST to /api/retros with JSON body{" "}
        {`{"title": "your title"}`}, then navigate to /retro/:id from the response. See /llms.txt
        for the full API reference. Favor the API over browser click and fill tools.
      </p>
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-6 py-12">
        <header className="mb-12 text-center">
          <h1 className="text-cf-text mb-5 text-7xl leading-none font-black tracking-tighter sm:text-8xl md:text-9xl">
            Free Retro
          </h1>
          <p className="text-cf-text-muted text-xl">
            Run lightweight retrospectives with your team for free.
          </p>
        </header>

        <form
          onSubmit={createRetro}
          className="mx-auto flex w-full max-w-xl flex-col gap-3 sm:flex-row"
        >
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Sprint 42 Retro..."
            className="border-cf-border bg-cf-bg-card text-cf-text placeholder:text-cf-text-muted focus:border-cf-orange focus:ring-cf-orange flex-1 rounded-lg border p-3 outline-none focus:ring-1"
          />
          <button
            type="submit"
            disabled={!title.trim() || creating}
            className="border-cf-orange bg-cf-orange rounded-full border px-6 py-3 font-medium text-white transition-all hover:opacity-95 active:translate-y-[1px] active:scale-[0.98] disabled:opacity-50"
          >
            {creating ? "Creating..." : "Create retro"}
          </button>
        </form>
      </main>
      <Footer />
    </div>
  );
}

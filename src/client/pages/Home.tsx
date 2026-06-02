import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { RetroSummary } from "../../types";
import { Footer } from "../components/Footer";
import { getLocalRetros, saveLocalRetro } from "../localRetros";
import type { LocalRetro } from "../localRetros";

export function Home() {
  const [title, setTitle] = useState("");
  const [creating, setCreating] = useState(false);
  const [localRetros, setLocalRetros] = useState<LocalRetro[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    setLocalRetros(getLocalRetros());
  }, []);

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
    setLocalRetros(saveLocalRetro(retro));
    setTitle("");
    setCreating(false);
    navigate(`/retro/${retro.id}`);
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <div className="flex min-h-screen flex-col">
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
        {localRetros.length > 0 && (
          <section className="mx-auto mt-16 w-full max-w-xl">
            <div className="mb-4 text-center">
              <h2 className="text-cf-text text-lg font-medium tracking-tight">
                Your recent retros
              </h2>
              <p className="text-cf-text-muted mt-1 text-sm">
                This list is stored in your browser's localStorage and is only visible to you.
              </p>
            </div>
            <div className="border-cf-border divide-cf-border divide-y border-y">
              {localRetros.map((retro) => (
                <Link
                  key={retro.id}
                  to={`/retro/${retro.id}`}
                  className="hover:bg-cf-bg-hover block py-3 transition-colors"
                >
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-cf-text truncate font-medium">{retro.title}</span>
                    <span className="text-cf-text-muted shrink-0 text-xs">
                      {formatDate(retro.lastOpenedAt)}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>
      <Footer />
    </div>
  );
}

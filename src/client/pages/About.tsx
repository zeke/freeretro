import { Link } from "react-router-dom";
import { Footer } from "../components/Footer";

export function About() {
  return (
    <div className="flex min-h-screen flex-col">
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-6 py-12">
        <Link to="/" className="text-cf-orange mb-8 hover:underline hover:underline-offset-4">
          ← Back
        </Link>

        <article className="space-y-6">
          <header>
            <h1 className="text-cf-text text-5xl font-black tracking-tight sm:text-6xl">
              What is this?
            </h1>
          </header>

          <p className="text-cf-text-muted text-lg leading-8">
            Free Retro is a lightweight tool for running team retrospectives.
          </p>

          <p className="text-cf-text-muted text-lg leading-8">
            Retrospectives are a simple way for people working together to reflect on a recent
            project, event, or collaboration. They create space to talk about what went well, what
            did not go so well, and what could be improved next time.
          </p>

          <p className="text-cf-text-muted text-lg leading-8">
            Team retrospectives are especially useful because they encourage participation from
            everyone involved, not just the loudest voices in the room. Everyone gets a chance to
            add input before the group discusses it together.
          </p>

          <p className="text-cf-text-muted text-lg leading-8">
            Every new retro gets a unique, unguessable URL that you can share with anyone. Free
            Retro is fun, multiplayer, hosted on Cloudflare, open source on GitHub, and free to use.
          </p>

          <div className="pt-4">
            <Link
              to="/"
              className="border-cf-orange bg-cf-orange inline-flex rounded-full border px-6 py-3 font-medium text-white transition-all hover:opacity-95 active:translate-y-[1px] active:scale-[0.98]"
            >
              Create a retro
            </Link>
          </div>
        </article>
      </main>
      <Footer />
    </div>
  );
}

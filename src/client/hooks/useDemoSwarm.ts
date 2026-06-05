import { useEffect, useRef } from "react";
import { startDemoSwarm } from "../demo/swarm";

// Hidden shortcut: type the word "demo" (outside any text field) to toggle a
// swarm of simulated participants on the current retro. Used for recording the
// multiplayer announcement video; it never triggers during normal use.
const TRIGGER = "demo";

export function useDemoSwarm(retroId: string | undefined) {
  const stopRef = useRef<(() => void) | null>(null);
  const bufferRef = useRef("");

  useEffect(() => {
    if (!retroId) return;

    const onKey = (event: KeyboardEvent) => {
      const el = document.activeElement as HTMLElement | null;
      const tag = el?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || el?.isContentEditable) return;
      if (event.key.length !== 1) return;

      bufferRef.current = (bufferRef.current + event.key.toLowerCase()).slice(-TRIGGER.length);
      if (bufferRef.current !== TRIGGER) return;
      bufferRef.current = "";

      if (stopRef.current) {
        stopRef.current();
        stopRef.current = null;
        console.info("[freeretro] demo swarm stopped");
      } else {
        stopRef.current = startDemoSwarm(retroId);
        console.info("[freeretro] demo swarm started");
      }
    };

    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      stopRef.current?.();
      stopRef.current = null;
    };
  }, [retroId]);
}

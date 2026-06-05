import { useEffect, useRef, useState } from "react";
import { startDemoSwarm } from "../demo/swarm";

// Hidden shortcut: Ctrl+Shift+D toggles a swarm of simulated participants on the
// current retro. Used for recording the multiplayer announcement video; it
// never triggers during normal use.
function isTrigger(event: KeyboardEvent): boolean {
  return (
    (event.ctrlKey || event.metaKey) && event.shiftKey && (event.key === "d" || event.key === "D")
  );
}

export function useDemoSwarm(retroId: string | undefined) {
  const stopRef = useRef<(() => void) | null>(null);
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (!retroId) return;

    const onKey = (event: KeyboardEvent) => {
      if (!isTrigger(event)) return;
      event.preventDefault();

      if (stopRef.current) {
        stopRef.current();
        stopRef.current = null;
        setActive(false);
        console.info("[freeretro] demo swarm stopped");
      } else {
        stopRef.current = startDemoSwarm(retroId);
        setActive(true);
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

  return active;
}

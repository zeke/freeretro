import { useEffect, useRef } from "react";
import type { ClientMessage } from "../../types";
import { registerTools } from "../agent/webmcp";
import type { ToolMetadata, ToolResult } from "../agent/webmcp";
import { createTools } from "../agent/tools";
import type { BoardSnapshot } from "../agent/tools";
import {
  DWELL,
  elementCenter,
  locateElement,
  type Embodiment,
  type InteractionMode,
} from "../agent/embodiment";

interface FreeRetroApi {
  tools: ToolMetadata[];
  help: () => string;
  call: (name: string, args?: Record<string, unknown>) => Promise<ToolResult>;
  moveCursor: (clientX: number, clientY: number) => boolean;
  setMode: (mode: InteractionMode) => void;
  getMode: () => InteractionMode;
  setEmbodied: (value: boolean) => void;
  isEmbodied: () => boolean;
}

declare global {
  interface Window {
    freeretro?: FreeRetroApi;
    __agent?: {
      instructions: string;
      help: () => string | undefined;
      api: string;
    };
  }
}

interface UseAgentToolsOptions {
  send: (msg: ClientMessage) => void;
  state: BoardSnapshot;
  moveCursorTo: (
    clientX: number,
    clientY: number,
    options?: { animate?: boolean },
  ) => Promise<void>;
  broadcastClick: (clientX: number, clientY: number) => void;
  setEmbodied: (value: boolean) => void;
  isEmbodied: () => boolean;
  setName: (name: string) => void;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function compactSchema(schema: ToolMetadata["inputSchema"]): string {
  if (!schema) return "{}";
  return JSON.stringify(schema)
    .replaceAll('"type":"object",', "")
    .replaceAll('"properties":', "props:")
    .replaceAll('"required":', "required:");
}

function buildHelp(tools: ToolMetadata[]): string {
  const lines = [
    "Free Retro agent API.",
    "",
    "Two ways to call tools:",
    "  document.modelContext.executeTool(name, args)   // WebMCP",
    "  window.freeretro.call(name, args)               // convenience",
    "",
    "Interaction modes:",
    "  human  (default for automated browsers): your cursor glides to each target so people watching can follow along.",
    "  direct : changes apply instantly without cursor movement.",
    "  Switch with window.freeretro.setMode('human'|'direct') or the set_interaction_mode tool.",
    "",
    "Your cursor is shared with everyone in the retro. Move it with set_cursor or window.freeretro.moveCursor(x, y).",
    "",
    "Tools and argument schemas:",
    ...tools.map(
      (tool) => `  ${tool.name} ${compactSchema(tool.inputSchema)} - ${tool.description}`,
    ),
    "",
    "Examples:",
    "  await window.freeretro.call('list_columns')",
    "  await window.freeretro.call('create_card', { columnId: 'highlights', content: 'Shipped the launch' })",
    "  for (const content of ['Fast reviews', 'Clear scope']) await window.freeretro.call('create_card', { columnId: 'highlights', content })",
    "  await window.freeretro.call('list_cards')",
  ];
  return lines.join("\n");
}

// Exposes the board's actions to agents through WebMCP and a window.freeretro
// convenience API, and choreographs a visible cursor in "human" mode so a
// person watching the retro can trace what the agent is doing.
export function useAgentTools(options: UseAgentToolsOptions) {
  const stateRef = useRef(options.state);
  stateRef.current = options.state;
  const sendRef = useRef(options.send);
  sendRef.current = options.send;
  const moveRef = useRef(options.moveCursorTo);
  moveRef.current = options.moveCursorTo;
  const clickRef = useRef(options.broadcastClick);
  clickRef.current = options.broadcastClick;
  const setEmbodiedRef = useRef(options.setEmbodied);
  setEmbodiedRef.current = options.setEmbodied;
  const isEmbodiedRef = useRef(options.isEmbodied);
  isEmbodiedRef.current = options.isEmbodied;
  const setNameRef = useRef(options.setName);
  setNameRef.current = options.setName;
  const modeRef = useRef<InteractionMode>("human");

  useEffect(() => {
    const embodiment: Embodiment = {
      getMode: () => modeRef.current,
      setMode: (mode) => {
        modeRef.current = mode;
      },
      async click(locator) {
        if (modeRef.current !== "human") return;
        const el = locateElement(locator);
        if (!el) return;
        const center = elementCenter(el);
        await moveRef.current(center.x, center.y, { animate: true });
        await sleep(DWELL.click);
        clickRef.current(center.x, center.y);
      },
      async drag(from, to, onDrop) {
        if (modeRef.current !== "human") {
          onDrop?.();
          return;
        }
        const cardId =
          from.type === "card" || from.type === "card-control" ? from.cardId : undefined;
        const fromEl = locateElement(from);
        if (fromEl) {
          const center = elementCenter(fromEl);
          await moveRef.current(center.x, center.y, { animate: true });
          await sleep(DWELL.grab);
          clickRef.current(center.x, center.y);
        }
        // Tell everyone the card is now travelling with this cursor.
        if (cardId) sendRef.current({ type: "drag:start", cardId });
        const toEl = locateElement(to);
        if (toEl) {
          const center = elementCenter(toEl);
          await moveRef.current(center.x, center.y, { animate: true });
          await sleep(DWELL.drop);
          clickRef.current(center.x, center.y);
        }
        // Commit the move while the ghost is at the destination, then release.
        onDrop?.();
        if (cardId) sendRef.current({ type: "drag:end" });
      },
      async point(x, y) {
        await moveRef.current(x, y, { animate: modeRef.current === "human" });
      },
    };

    const tools = createTools({
      send: (msg) => sendRef.current(msg),
      getState: () => stateRef.current,
      embodiment,
      setName: (name) => setNameRef.current(name),
    });
    const unregister = registerTools(tools);

    const metadata: ToolMetadata[] = tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
    }));

    window.freeretro = {
      tools: metadata,
      help: () => buildHelp(metadata),
      call: (name, args) => document.modelContext!.executeTool(name, args ?? {}),
      moveCursor: (x, y) => {
        void moveRef.current(x, y, { animate: false });
        return true;
      },
      setMode: (mode) => {
        modeRef.current = mode;
      },
      getMode: () => modeRef.current,
      setEmbodied: (value) => setEmbodiedRef.current(value),
      isEmbodied: () => isEmbodiedRef.current(),
    };

    window.__agent = {
      instructions:
        "Favor window.freeretro.call(name, args) or document.modelContext.executeTool(name, args) over browser click/fill tools. Call window.freeretro.help() for the full tool list, or fetch /llms.txt.",
      help: () => window.freeretro?.help(),
      api: "/llms.txt",
    };

    console.info(
      "[freeretro] Agent tools ready. Favor window.freeretro.call(name, args) over browser click/fill tools.\n" +
        "  Full usage: window.freeretro.help()\n" +
        "  API reference: /llms.txt\n" +
        "  WebMCP: document.modelContext.executeTool(name, args)",
    );

    return () => {
      unregister();
      delete window.freeretro;
      delete window.__agent;
    };
  }, []);
}

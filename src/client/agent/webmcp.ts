// Minimal, dependency-free WebMCP surface (https://webmcp.org).
//
// Native browser support for `document.modelContext` does not exist yet, so we
// install a small shim that lets agents discover and invoke the page's tools
// today, and defer to a native implementation if one ever ships. The shape
// mirrors the WebMCP explainer: registerTool, getTools, executeTool, and a
// "toolchange" event.

export interface ToolResult {
  content: { type: "text"; text: string }[];
  isError?: boolean;
}

export interface AgentTool {
  name: string;
  description: string;
  inputSchema?: Record<string, unknown>;
  execute: (args: Record<string, unknown>) => ToolResult | Promise<ToolResult>;
}

export interface ToolMetadata {
  name: string;
  description: string;
  inputSchema?: Record<string, unknown>;
}

export interface ModelContext extends EventTarget {
  registerTool: (tool: AgentTool, options?: { signal?: AbortSignal }) => () => void;
  getTools: () => ToolMetadata[];
  executeTool: (name: string, args?: Record<string, unknown>) => Promise<ToolResult>;
}

declare global {
  interface Document {
    modelContext?: ModelContext;
  }
}

function createShim(): ModelContext {
  const tools = new Map<string, AgentTool>();
  const target = new EventTarget();

  const context: ModelContext = Object.assign(target, {
    registerTool(tool: AgentTool, options?: { signal?: AbortSignal }) {
      tools.set(tool.name, tool);
      target.dispatchEvent(new Event("toolchange"));

      const unregister = () => {
        if (tools.delete(tool.name)) {
          target.dispatchEvent(new Event("toolchange"));
        }
      };

      options?.signal?.addEventListener("abort", unregister, { once: true });
      return unregister;
    },

    getTools() {
      return Array.from(tools.values()).map((tool) => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
      }));
    },

    async executeTool(name: string, args: Record<string, unknown> = {}) {
      const tool = tools.get(name);
      if (!tool) {
        return {
          content: [{ type: "text" as const, text: `Unknown tool: ${name}` }],
          isError: true,
        };
      }
      return tool.execute(args);
    },
  });

  return context;
}

function getModelContext(): ModelContext {
  if (!document.modelContext) {
    document.modelContext = createShim();
  }
  return document.modelContext;
}

// Register a set of tools and return a cleanup function that unregisters them.
export function registerTools(tools: AgentTool[]): () => void {
  const context = getModelContext();
  const controller = new AbortController();
  for (const tool of tools) {
    context.registerTool(tool, { signal: controller.signal });
  }
  return () => controller.abort();
}

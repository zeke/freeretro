# Free Retro

Free Retro is a real-time retrospective board. Create an unlisted retro, share the link with your team, and delete it when you are done.

Live at [freeretro.ziki.workers.dev](https://freeretro.ziki.workers.dev).

Built with 🧡 by Cloudflare.

## What is this?

Free Retro is a lightweight tool for running team retrospectives.

Retrospectives are a simple way for people working together to reflect on a recent project, event, or collaboration. They create space to talk about what went well, what did not go so well, and what could be improved next time.

Team retrospectives are especially useful because they encourage participation from everyone involved, not just the loudest voices in the room. Everyone gets a chance to add input before the group discusses it together.

Every new retro gets a unique, unguessable URL that you can share with anyone. Free Retro is fun, multiplayer, hosted on Cloudflare, open source on GitHub, and free to use.

## For AI agents (automated browser sessions)

This section is for AI agents that interact with a live retro through an automated browser session (Playwright, Puppeteer, Chrome DevTools / CDP, an agent harness with a browser, and the like). It is not about coding agents working on this repo; for that see [AGENTS.md](./AGENTS.md).

Every retro page exposes its actions to an agent driving the page, so it can join a retro and add or organize cards on your behalf. No setup or keys required.

Running the browser: any automated browser works. [Cloudflare Browser Run](https://developers.cloudflare.com/browser-run/) is a convenient hosted option, headless Chrome you drive over CDP from a Worker or an agent harness, so an agent can open a retro and act on it without managing local browser infrastructure.

How an agent discovers it:

- On load the page logs to the console:
  `[freeretro] Agent tools available: document.modelContext (WebMCP) or window.freeretro.help(). Modes: human (default, visible cursor) / direct.`
- A screen-reader-only note in the board points there for agents reading the accessibility tree.
- `window.freeretro.help()` returns the full API description and current tool list (the source of truth).

Calling tools, two equivalent ways:

```js
// WebMCP (a shim provides document.modelContext until browsers ship it natively)
await document.modelContext.executeTool("create_card", {
  columnId: "highlights",
  content: "Shipping smaller PRs sped us up.",
});

// window.freeretro convenience wrapper
await window.freeretro.call("upvote_card", { cardId });
```

Tools:

- Read: `list_cards`, `list_columns`, `list_users`, `get_board_state`
- Write: `create_card`, `edit_card`, `delete_card`, `move_card`, `upvote_card`, `react_to_card`, `rename_column`, `set_blur`, `set_sort`
- Cursor: `set_cursor`, `set_interaction_mode`

Interaction modes: in `human` mode (the default for automated browsers, detected via `navigator.webdriver`) the agent's shared cursor glides to each target so people watching can follow along; `direct` applies changes instantly. Switch with `window.freeretro.setMode("human" | "direct")` or the `set_interaction_mode` tool.

On WebMCP and discoverability: [WebMCP](https://webmcp.org) is an experimental proposal in the W3C Web Machine Learning community group, not an official web standard, and no browser implements `document.modelContext` natively yet. Free Retro ships a small shim so the WebMCP surface works today, but none of this depends on WebMCP: the same tools are reachable through the plain `window.freeretro` global, and the console message plus the accessibility-tree note make them discoverable by any automated session using ordinary DOM and JavaScript. Agents can interact regardless of WebMCP's readiness or official status; native WebMCP support is a forward-looking bonus for harnesses that adopt it.

## For coding agents

See [AGENTS.md](./AGENTS.md) for project-specific instructions for coding agents.

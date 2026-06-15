# Free Retro

Free Retro is a real-time retrospective board. Create an unlisted retro, share the link with your team, and delete it when you are done.

Live at [freeretro.ziki.workers.dev](https://freeretro.ziki.workers.dev).

Built with 🧡 by Cloudflare.

## What is this?

Free Retro is a lightweight tool for running team retrospectives.

Retrospectives are a simple way for people working together to reflect on a recent project, event, or collaboration. They create space to talk about what went well, what did not go so well, and what could be improved next time.

Team retrospectives are especially useful because they encourage participation from everyone involved, not just the loudest voices in the room. Everyone gets a chance to add input before the group discusses it together.

Every new retro gets a unique, unguessable URL that you can share with anyone. Free Retro is fun, multiplayer, hosted on Cloudflare, open source on GitHub, and free to use.

## Agent discoverability (WebMCP)

Free Retro is agent-friendly! 😎 🤝 🤖

It has some client-side customizations that make it easily discoverable and usable by AI agents using automated browser sessions. In a nutshell, it exposes some JavaScript functions that agents can call on the page to read and write retro content, without having to inspect the DOM structure or reverse-engineer the site to figure out how to interact with it. The tools follow [WebMCP](https://developer.chrome.com/docs/ai/webmcp), an emerging proposal for exposing in-page tools to agents.

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

Tools. Each takes a single arguments object; `columnId` is one of `highlights`, `challenges`, `questions`, or `notes`.

Read:

- `list_cards()` — list every card with its column, author, content, upvote count, and reactions
- `list_columns()` — list columns with labels, positions, and card counts
- `list_users()` — list the people and agents connected to the retro
- `get_board_state()` — report blur state, sort mode, online count, and card count

Write:

- `create_card({ columnId, content })` — add a card to a column
- `edit_card({ cardId, content })` — replace a card's text
- `delete_card({ cardId })` — delete a card
- `move_card({ cardId, columnId, position? })` — move a card to another column (defaults to the end)
- `upvote_card({ cardId })` — toggle your upvote on a card
- `react_to_card({ cardId, emoji })` — toggle an emoji reaction on a card
- `rename_column({ columnId, label })` — rename a column
- `set_blur({ blurred })` — blur or reveal all cards for everyone
- `set_sort({ sortByUpvotes })` — sort cards by upvotes or restore manual order

Identity, cursor, and mode:

- `set_name({ name })` — set the display name others see for you
- `set_cursor({ x, y })` — move your shared cursor to viewport coordinates
- `set_interaction_mode({ mode })` — `"human"` animates the cursor to each target; `"direct"` applies changes instantly

Interaction modes: in `human` mode (the default for automated browsers, detected via `navigator.webdriver`) the agent's shared cursor glides to each target so people watching can follow along; `direct` applies changes instantly. Switch with `window.freeretro.setMode("human" | "direct")` or the `set_interaction_mode` tool.

On WebMCP and discoverability: WebMCP is an experimental proposal in the W3C Web Machine Learning community group, not an official web standard, and no browser implements `document.modelContext` natively yet. Free Retro ships a small shim so the WebMCP surface works today, but none of this depends on WebMCP: the same tools are reachable through the plain `window.freeretro` global, and the console message plus the accessibility-tree note make them discoverable by any automated session using ordinary DOM and JavaScript. Agents can interact regardless of WebMCP's readiness or official status; native WebMCP support is a forward-looking bonus for harnesses that adopt it.

Free Retro uses the imperative WebMCP surface, not the form-based [declarative API](https://developer.chrome.com/docs/ai/webmcp/declarative-api): most retro actions (querying state, dragging cards, moving a shared cursor) aren't HTML form submissions, and the imperative shim works in any automated browser today rather than only in Chrome.

### Try it out

To put an agent to work on a retro, you'll need:

- an agent harness like OpenCode, Claude Code, or Codex
- a Free Retro URL
- an agent configured to [drive a browser in the cloud](https://zeke.sikelianos.com/browsers-in-the-cloud/) or [drive a browser locally](https://zeke.sikelianos.com/driving-chrome-with-an-agent/) over MCP

Any automated browser works. [Browser Run](https://developers.cloudflare.com/browser-run/) is a convenient hosted option: headless Chrome you drive over CDP from a Worker or an agent harness, so an agent can open a retro and act on it without managing local browser infrastructure.

Give the agent the URL, tell it what you want to add, and let it go to work!

## For coding agents

See [AGENTS.md](./AGENTS.md) for project-specific instructions for coding agents.

# AGENTS.md

- This is a Cloudflare Workers app using Durable Objects for retro metadata, board state, WebSockets, and storage.
- Use `script/setup`, `script/dev`, `script/lint`, and `script/test` for common tasks.
- Run `script/lint`, `script/test`, `npm run typecheck`, and `npm run build` before saying changes are done.
- Deploy with `script/deploy`. CI deploys from `main` using the `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` GitHub Actions secrets.
- Retros are unlisted. Do not add a public retro listing, index, sitemap, or browse endpoint.
- Retro IDs must be UUIDs created with `crypto.randomUUID()`.
- Keep GitHub Actions as the only CI/CD system.
- Keep this file updated when project-specific scripts, architecture, or gotchas change.

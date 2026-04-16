# CLAUDE.md — Jira Worker

This file is loaded automatically by Claude Code for every session in this repository.

## Quick references

- **[agents.md](../agents.md)** — full architecture guide, code conventions, where to add code, and common pitfalls. **Read this first.**
- **[docs/features.md](../docs/features.md)** — comprehensive feature overview (views, API layer, IPC channels, persistence).

## Essential rules

1. Renderer (`src/renderer/`) must **never** call `fetch()` directly. All Jira API calls go through `window.api.jiraRequest()` → IPC → main process.
2. Adding a new IPC channel requires changes in **three** files: `src/main/index.ts`, `src/preload/index.ts`, `src/preload/index.d.ts`.
3. Agile API endpoints (`/board`, `/sprint`) use `agileRequest()`, not `request()`.
4. Do not move credentials to the renderer process.
5. Use Tailwind utility classes for styling; complex shared patterns belong in `src/renderer/src/styles/globals.css` under `@layer components`.

## Allowed shell commands

Defined in [settings.local.json](settings.local.json):
- `npm install:*`, `npm view:*`, `node:*`

## Build commands

```bash
yarn dev        # dev server with hot-reload
yarn build      # production bundle → out/
yarn dist:win   # NSIS installer for Windows → dist/
```

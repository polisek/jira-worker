# GitHub Copilot Instructions — Jira Worker

## Key references

- **[agents.md](../agents.md)** — architecture overview, code conventions, where to add code, and common pitfalls.
- **[docs/features.md](../docs/features.md)** — full feature inventory (views, API methods, IPC channels, data persistence).
- **[.claude/CLAUDE.md](../.claude/CLAUDE.md)** — concise quick-start rules shared with Claude Code.

## Architecture summary

Three-process Electron app:

```
renderer (React 18 + TS + Tailwind)
  → window.api.*            (preload contextBridge)
  → ipcMain handlers        (main process)
  → fetch() → Jira Cloud
```

- **Never** call `fetch()` from the renderer — always delegate through `window.api.jiraRequest()`.
- New IPC channels require edits in `main/index.ts`, `preload/index.ts`, and `preload/index.d.ts`.
- Agile endpoints use `agileRequest()` (prefix `__agile__`); REST v3 endpoints use `request()`.

## Code conventions

- All files are `.ts` / `.tsx` — no plain JS in `src/`.
- Named exports for all components except `App.tsx`.
- Props typed via local `interface Props { … }`.
- Tailwind classes for styling; shared patterns in `globals.css` under `@layer components`.
- IPC channel names follow the `resource:action` pattern (e.g. `jira:request`, `settings:get`).

## CI/CD

Automated builds and releases via [.github/workflows/release.yml](workflows/release.yml) — push to `main` auto-tags, builds Windows + macOS installers, and publishes a GitHub Release.

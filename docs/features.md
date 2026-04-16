# Jira Worker — Feature Overview

Jira Worker is a frameless Electron desktop application (Windows primary, macOS supported) that serves as a clean native client for Jira Cloud. The renderer is React 18 + TypeScript + Tailwind CSS; all Jira communication is proxied through the main process.

---

## AI Agent Files

| File / Folder | Purpose |
|---|---|
| [agents.md](../agents.md) | Codebase guide for AI agents — architecture, conventions, common pitfalls |
| [.claude/settings.local.json](../.claude/settings.local.json) | Claude AI local permissions for this project |
| [.github/workflows/release.yml](../.github/workflows/release.yml) | GitHub Actions CI/CD — auto-tag, Windows & macOS builds, GitHub Releases |

---

## Views

### Board View
Kanban-style board driven directly from Jira statuses.

- Dynamic columns generated from actual issue statuses (no hardcoded columns)
- Status category colour coding: **grey** = To Do, **blue** = In Progress, **green** = Done
- Drag & drop cards between columns → calls Jira transition API with optimistic UI update
- Drag & drop columns to reorder; order persisted per project in `localStorage` (`boardColumnOrder_{projectKey}`)
- Sprint selector: Active sprint / All issues / No sprint / specific sprint by ID
- Column headers show issue count; skeleton loading state while fetching
- Escape key closes the detail panel

### List View
Tabular overview of issues.

- Columns: Key (with issue type icon), Summary, Status badge, Priority, Assignee avatar, Due date
- Click any row to open the detail panel
- Striped alternating rows, refresh button, total count display

### Time Tracking View
Built-in stopwatch and work-log interface — no external timer needed.

- **Timer**: HH:MM:SS display (colour-coded: blue = running, yellow = paused, grey = stopped)
- Start / Pause-Resume / Stop controls
- Associate a Jira issue via live search (by key or summary)
- Optional notes field per entry
- History list: date, duration (Xh Ym), linked task, notes; edit, delete, or log to Jira
- Duration editor accepts `1h 30m`, `1:30`, or `90` (minutes) formats
- Logs directly to Jira via `logWork()` API (minimum 60 s required)
- Total time logged today shown at top
- Entries persisted in `electron-store` (max 200 entries)

### Settings View
One-stop configuration panel.

| Section | Fields |
|---|---|
| **Jira Access** | Base URL, Email, API Token (show/hide toggle), Test Connection button |
| **Tasks** | Show completed tasks (0 / 3 / 7 / 14 / 30 / 90 / ∞ days), Default filter, Default view, Max results (50–500) |
| **Notifications** | Poll interval (1–30 min), Notification window (1–24 h) |

Settings saved to `electron-store`; preferences to `localStorage`. Auto-save with 2 s confirmation feedback.

---

## Issue Detail Panel

Slide-in right panel (default 480 px, draggable to resize).

- Breadcrumb navigation: traverse parent issues and subtasks
- Available Jira transitions shown as buttons; optimistic status update on click
- Meta grid: Assignee (with UserPicker), Reporter, Priority, Story Points, Created/Updated dates
- Labels display
- Description: view (ADF rendered to HTML) + edit mode (plain text → ADF)
- Subtasks list (clickable)
- Comments (last 10, ADF rendered); new comment input with **Ctrl+Enter** to submit
- Loading states and error handling throughout

---

## Issue Creation

Modal dialog for creating new Jira issues.

- Fields: Project, Issue Type, Priority, Summary (required), Description, Assignee, Sprint, Story Points, Epic, Labels (multi-add with Enter)
- Dynamic async loading of issue types, users, sprints, epics per selected project
- Sensible defaults: Story/Task type, active sprint pre-selected
- 800 ms success feedback; full issue fetched after creation

---

## Sidebar

Persistent left navigation panel.

- **Search**: real-time input with 400 ms debounce
- **View switcher**: Board / List / Time Tracking / Settings
- **Filter**: My tasks / All tasks / Unassigned
- **Project list**: all Jira projects with avatars; "All projects" wildcard; refresh button
- **Notifications**: collapsible Recent Assignments panel — see below

---

## Notifications

- Background polling for issues recently assigned to the current user
- Configurable poll interval (1–30 min) and look-back window (1–24 h)
- Native OS notification on first detection of a new assignment
- Unread badge count in sidebar; collapses to mark all read
- Seen IDs persisted to `localStorage` (`jw_seen_assignments`); first load silently marks all read to avoid spam

---

## ADF Rendering

Jira issue descriptions and comments use Atlassian Document Format (ADF — a JSON tree).

- `adfToText()` — plain-text conversion (used for notifications / previews)
- `adfToHtml()` — full HTML conversion rendered via `dangerouslySetInnerHTML`
- `AdfImage` component: fetches Jira-authenticated images through the main-process IPC proxy, converts to data URLs, shows a lightbox on click
- `ImageLightbox`: full-screen viewer, dismiss by clicking backdrop or pressing Escape

---

## Window & System Integration

- **Frameless window** (1 400 × 900, min 900 × 600) with custom `TitleBar` component
- Title bar adapts to platform: macOS uses `hiddenInset` traffic-light style; Windows shows custom min/max/close buttons
- **Media interceptor**: `session.defaultSession.webRequest.onBeforeSendHeaders` injects `Authorization: Basic …` for all requests to the configured Jira domain so `<img>` tags in issue content load correctly
- **Auto-updater** (`electron-updater`): checks 3 s after launch and every hour; auto-downloads; `UpdateBanner` component shows download progress and a Restart-to-Install button

---

## API Layer (`src/renderer/src/lib/jira-api.ts`)

All calls flow through `window.api.jiraRequest()` → IPC → `fetch()` in main process (credentials never reach the renderer).

| Category | Methods |
|---|---|
| Auth | `getMyself()` |
| Issues | `searchIssues(jql, maxResults, nextPageToken)`, `getIssue(key)`, `updateIssue(key, fields)`, `createIssue(fields)` |
| Transitions | `getTransitions(key)`, `doTransition(key, transitionId)` |
| Comments | `addComment(key, text)` |
| Projects | `getProjects()`, `getIssueTypes(projectKey)`, `getProjectStatuses(projectKey)` |
| Users | `getAssignableUsers(projectKey)`, `assignIssue(key, accountId\|null)` |
| Sprints / Boards | `getBoards(projectKey)`, `getBoardSprints(boardId)` |
| Epics | `getEpics(projectKey)` |
| Labels | `getLabels()` |
| Statuses | `getAllStatuses()` |
| Time Tracking | `logWork(issueKey, timeSpentSeconds, comment)` |

REST API v3 (`/rest/api/3`) and Agile API v1.0 (`/rest/agile/1.0`) are both supported; the Agile path is signalled by the `__agile__` prefix handled in `main/index.ts`.

---

## IPC Channels

| Channel | Direction | Purpose |
|---|---|---|
| `settings:get` / `settings:set` | renderer → main | Read / write Jira credentials |
| `prefs:get` / `prefs:set` | renderer → main | Read / write app preferences |
| `jira:request` | renderer → main | Proxy Jira REST / Agile API call |
| `notify` | renderer → main | Trigger native OS notification |
| `media:fetch` | renderer → main | Download Jira attachment / image with auth |
| `time:getEntries` / `time:saveEntry` / `time:deleteEntry` | renderer → main | CRUD for time tracking entries |
| `update:available` / `update:downloaded` / `update:install` | main → renderer | Auto-update lifecycle events |
| `window-minimize` / `window-maximize` / `window-close` | renderer → main | Frameless window controls |

---

## Data Persistence

| Store | Key | Contents |
|---|---|---|
| `electron-store` | `settings` | Jira credentials (plaintext) |
| `electron-store` | `prefs` | App preferences (JSON) |
| `electron-store` | `timeEntries` | Time tracking history (array, max 200) |
| `localStorage` | `jw_seen_assignments` | Notification seen IDs |
| `localStorage` | `boardColumnOrder_{projectKey}` | Column reorder state per project |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Desktop shell | Electron 33 |
| Bundler | electron-vite |
| Renderer framework | React 18 |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS v3 + custom `@layer components` |
| Persistence | electron-store |
| Drag & drop | Native HTML5 drag events |
| Updates | electron-updater |
| CI/CD | GitHub Actions (see [release.yml](../.github/workflows/release.yml)) |

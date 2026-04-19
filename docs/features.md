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

Seven views routed by `ViewMode` (`"board" | "list" | "settings" | "time" | "worklog" | "activity" | "graph"`). The active view is stored in `App.tsx` state and persisted as `AppPrefs.defaultView` for Board/List only.

### Board View (`BoardView.tsx`)
Kanban-style board driven directly from Jira statuses.

- Dynamic columns generated from actual Jira project statuses via `getProjectStatuses()` / `getAllStatuses()` (no hardcoded columns)
- Status category colour coding: **grey** = To Do, **blue** = In Progress, **green** = Done
- Columns sorted by category order (To Do → In Progress → Done), then alphabetically within category
- **Drag & drop cards** between columns → fetches available transitions, applies exact-status match first, falls back to category match; optimistic UI update; no rollback on error
- **Drag & drop columns** to reorder; per-project order persisted in `localStorage` (`boardColumnOrder_{projectKey}` or `boardColumnOrder___all__`)
- Sprint selector dropdown: Active sprint / All issues / No sprint / specific sprint (detected from loaded issues' `customfield_10020` field)
- `Create issue` button opens `CreateIssueModal`
- Column headers show issue count
- Transitioning card shows spinner overlay and is pointer-events-none during API call

### List View (`ListView.tsx`)
Tabular overview of issues.

- Columns: Key (with issue type icon), Summary, Status badge, Priority (coloured dot + name), Assignee avatar, Due date
- Click any row to open the `TaskDetail` panel
- Striped alternating rows, refresh button, total count display
- **Advanced filter** button (`SlidersHorizontal` icon) opens `FilterModal`; active filter shown with blue dot indicator on button
- `Create issue` button opens `CreateIssueModal`

### Time Tracking View (`TimeTrackingView.tsx`)
Built-in stopwatch and manual work-log interface — no external timer needed.

- **Timer panel**: HH:MM:SS display (colour-coded: blue = running, yellow = paused, grey = stopped)
- Start / Pause-Resume / Stop controls; stop saves entry immediately
- Associate a Jira issue via live search (400 ms debounce; searches by key or summary via `searchIssues`)
- Optional notes field per entry
- **History list**: date/time, duration (Xh Ym), linked task key+summary, notes; total time logged today shown in toolbar
- **Edit mode** for each entry: editable duration (accepts `1h 30m`, `HH:MM`, `HH:MM:SS`, `90` = minutes), notes, and re-assignable issue (with live search)
- Delete entry (calls `window.api.deleteTimeEntry`)
- **Log to Jira** button: calls `jiraApi.logWork()`; minimum 60 s enforced (rounded up with note); marks entry as `loggedToJira: true`
- Entries persisted in `electron-store` (`timeEntries` key, max 200, deduped by `id`)
- Inline success / error feedback per entry after Jira log attempt

### Worklog View (`WorkLogView.tsx`)
Monthly calendar view for browsing and adding worklogs across all issues.

- Month calendar grid (Monday-first, Czech day/month labels)
- Navigation ← / → between months
- **User picker**: defaults to the currently logged-in user (`getMyself()`); can switch to any Jira user via search (`searchUsers`)
- Each calendar day cell shows the total time logged by the selected user (summed across all issues)
- Colour-coded day cells: **green** ≥ 80 % of `dailyWorkHours`, **yellow** ≥ 50 %, **red** < 50 % (weekends left unstyled)
- Click a day → opens **DayPopup** modal
  - Lists all worklog entries already logged for that day (issue key, summary, time spent)
  - Issue search filtered to the selected user's assigned/updated issues
  - Time input field (same formats as TimeTrackingView)
  - Optional note
  - Submit → calls `jiraApi.logWork(issueKey, seconds, note, toDayStarted(day))` with `started = YYYY-MM-DDT09:00:00.000+0000`
  - On success, optimistically updates the calendar totals
- Worklog data loaded via `getIssueWorklogs()` in parallel for all issues updated in the displayed period

### Activity View (`ActivityView.tsx`)
Chronological feed of a user's Jira activity.

- **User picker**: defaults to self (`getMyself()`); live search via `searchUsers()` to view any user
- **Date range selector**: 7 / 14 / 30 / 90 days
- Activity types (each with a distinct colour badge):
  | Type | Colour | Source |
  |---|---|---|
  | Created | yellow | `reporter` on issue |
  | Status change | blue | Changelog `status` field |
  | Comment | green | `issue.fields.comment.comments` |
  | Worklog | purple | `getIssueWorklogs()` |
  | Assignment | orange | Changelog `assignee` field |
  | Field change | grey | Changelog for meaningful fields (priority, summary, duedate, labels, sprint, story_points, issuetype, resolution) |
- Loads up to 30 issues via JQL `(assignee = X OR reporter = X OR worklogAuthor = X) AND updated >= "-Nd"`, then fetches changelogs + worklogs in parallel for the first 20
- Relative timestamps ("před 5 min", "před 2 d", etc.) with full absolute on hover
- Click an activity entry → opens `TaskDetail` for that issue
- Refresh button; loading spinner; error banner

### Graph View (`GraphView.tsx` + `IssueNode.tsx` + `LinkEdge.tsx`)

Interactive dependency graph for a selected epic. Built on **React Flow** (`@xyflow/react`).

#### Layout

- Toolbar at top: EPIC label, epic selector dropdown, Refresh button, Save layout button, edge-type legend
- Full-canvas React Flow instance below; `MiniMap` + `Controls` widgets; dot-grid background
- Empty state prompt when no epic is selected

#### Data loading (`useGraphData` hook)

- Fetches all issues belonging to the selected epic via `jiraApi.getEpicIssues()`:
  - Parallel: POST `/search/jql` (direct children by Epic Link / parentEpic / parent) + GET `/issue/:epicKey` (the epic itself)
  - Second phase: any subtasks referenced in `fields.subtasks` that weren't returned by the JQL are fetched in a second POST `/search/jql`
- Fields fetched: `summary`, `status`, `priority`, `assignee`, `issuetype`, `issuelinks`, `customfield_10014`, `customfield_10016`, `parent`, `subtasks`

#### Nodes (`IssueNode`)

Each issue is a card node showing: issue type icon, key (monospace), status badge, summary (2-line clamp), story points, priority badge, assignee initials.

Handle layout per node type:

| Node type | Handles |
|---|---|
| **Epic** | `top` / `left` (target, purple), `right` / `bottom` (source, purple) + invisible `left-src` / `right-tgt` ghosts for RTL programmatic edges |
| **Task / Subtask** | `top` (target, purple), `bottom` (source, purple), `left-relates` / `left-blocks` (target, blue/red at 33%/67%), `right-relates` / `right-blocks` (source, blue/red at 33%/67%) + invisible RTL ghost handles for all four side handles |

Ghost handles (`connectable={false}`, `opacity: 0`, 1 px) carry the opposite `type` to the visible handle so that programmatic edges with RTL routing always reference a handle with the correct source/target type (React Flow silently drops edges that reference a handle with the wrong type).

#### Edges

Two edge categories:

**Parent-child** (purple, dashed `4 2`, `type: "default"` bezier):
- Source handle `bottom`, target handle `top`
- Direction: parent → child (Epic→Task, Task→Subtask) derived from `issue.fields.parent`

**Issue links** (BLOCKS / RELATES, `type: "linkEdge"` custom component):
- BLOCKS: red (`#f85149`), animated, label "blocks"
- RELATES: blue (`#58a6ff`), dashed `5 3`, label "relates to"
- Direction derived from `outwardIssue` / `inwardIssue`; deduped by sorted `sourceKey--destKey` edge ID
- **Position-based handle routing**: compares node X positions; LTR → `right-*` source / `left-*` target; RTL → `left-*-src` ghost / `right-*-tgt` ghost
- `LinkEdge` custom component: renders `BaseEdge` + `EdgeLabelRenderer` label pill containing the link type text and an `×` delete button

#### Interactions

| Action | Behaviour |
|---|---|
| Click node | Fetches full issue via `getIssue()` and opens `TaskDetail` panel |
| Drag node | Node position updated in state; 800 ms debounce then auto-saves layout |
| Save layout button | Saves all current node positions to `AppPrefs.graphLayouts` |
| Connect `right-blocks` / `left-blocks-src` → task | Creates BLOCKS Jira link; adds optimistic `linkEdge`; fetches `linkId` from refetched issue; enables delete button immediately |
| Connect `right-relates` / `left-relates-src` → task | Same flow for RELATES link |
| Connect any handle → empty canvas (Epic) | Opens `CreateIssueModal` with `defaultEpic` pre-filled, `defaultIssueTypeName="Task"` |
| Drag `bottom` handle → empty canvas (Task/Subtask) | Opens `CreateIssueModal` with `defaultParentKey` pre-filled for subtask creation |
| After creating issue via canvas drag | Drop coordinates converted via `screenToFlowPosition`; saved to layout so new node appears at drop location on reload |
| Click `×` on link edge label | Calls `jiraApi.deleteIssueLink(linkId)`, removes edge from state immediately |

#### Layout persistence

Node positions stored per `{ epicKey, projectKey }` in `AppPrefs.graphLayouts` (array of `GraphLayout`). On load, saved positions are applied first; any new node falls back to auto-grid placement (`60 + col * 280`, `60 + row * 180`). The `saveNewNodePosition` helper merges a single new key into the existing layout without overwriting others.

### Settings View (`SettingsView.tsx`)
One-stop configuration panel.

| Section | Fields |
|---|---|
| **Appearance** | Theme: Light / Dark / Auto (follows OS `prefers-color-scheme`) |
| **Tasks** | Show completed tasks (0 / 3 / 7 / 14 / 30 / 90 / ∞ days), Default filter, Default view (Board/List), Max results (50 / 100 / 200 / 500), Daily work hours (4 / 6 / 7 / 7.5 / 8 / 9 / 10 h) |
| **Notifications** | Poll interval (1 / 2 / 5 / 10 / 30 min), Notification window (1 / 4 / 8 / 24 / 48 h) |
| **Jira Account** | Base URL, Email, API Token (show/hide toggle), Test Connection button (calls `getMyself()`), Save button |

- Theme change applied as live preview immediately (before save)
- App prefs saved to `electron-store` via `window.api.setPrefs()`; 2 s confirmation flash
- Jira credentials saved separately via `window.api.setSettings()`; 2 s confirmation flash
- Test connection result shown inline (green success with display name / red error message)
- On first launch (no settings), the full app renders only `SettingsView` until credentials are saved

---

## Issue Detail Panel (`TaskDetail.tsx`)

Slide-in right panel (default 480 px wide, draggable left edge to resize; minimum 480 px).

- **Breadcrumb navigation**: clicking a subtask or parent pushes the current issue onto a nav stack; clicking a breadcrumb item navigates back; transitions are fetched fresh for each navigation target
- **Transitions**: available transitions shown as pill buttons; clicking calls `doTransition()` then reloads the issue
- **Meta grid** (2-column): Assignee (editable via `UserPicker`), Reporter (avatar + name), Priority (icon + name), Story Points (`customfield_10016`), Created, Updated, Due date, Parent issue key
- **Labels**: displayed as grey badges
- **Time section** (`TimeTracking` component): shows spent / original estimate / remaining with progress bar (turns red when over-budget); aggregates time from subtasks (fetched via `getIssueTime()` in parallel, cached in memory); **Zaznamenat práci** button opens `LogWorkDialog`
- **Description**: rendered via `AdfContent`; double-click to enter edit mode (plain text textarea → saved as ADF paragraphs via `updateIssue()`); Cancel / Save buttons
- **Subtasks**: list with issue type icon, key (clickable → navigates into that issue), summary, status badge
- **Comments**: full ADF-rendered comment thread; new comment textarea at bottom with Send button (calls `addComment()` then reloads)
- Refresh button in header (re-fetches issue + transitions)
- Error display

### Log Work Dialog (`LogWorkDialog.tsx`)

Modal opened from **Zaznamenat práci** in `TaskDetail`. Issue is pre-set to the current `TaskDetail` issue.

**Layout — two-panel:**

| Left (mini-calendar) | Right (day detail) |
|---|---|
| Month calendar grid | Selected-day date label (Czech locale) |
| Month navigation ← / → | Total already logged for this day |
| Each day shows total logged time (current user, this issue only) | List of existing worklog entries for this day |
| Green/yellow/red colour-coding vs `dailyWorkHours` | Time input (`2h 30m` · `1.5h` · `45m` · `1:30`) |
| Click day → select (blue ring) | Optional note field |
| | **Zalogovat** submit button |

- Calls `getIssueWorklogs()` and `getMyself()` on mount; re-fetches when month changes
- `started` timestamp set to `YYYY-MM-DDT09:00:00.000+0000` for the selected day
- After successful log: calendar updates optimistically, form resets (can log multiple times without closing), `onLogged()` callback triggers `loadDetail()` in `TaskDetail`
- `dailyWorkHours` from `AppPrefs`

---

## Issue Creation (`CreateIssueModal.tsx`)

Modal dialog for creating new Jira issues.

Fields: Project (selector), Issue Type, Priority (Highest/High/Medium/Low/Lowest), Summary (required), Description, Assignee (`UserPicker`), Sprint (dropdown), Story Points, Epic (dropdown), Labels (multi-add with Enter key)

- On project change: loads issue types, assignable users, boards → active sprints, epics in parallel via `Promise.allSettled`
- Defaults: Story type (fallback Task), active sprint pre-selected
- On submit: calls `createIssue()` then `getIssue()` to fetch the full object; 800 ms success flash then calls `onCreated(issue)` and closes

---

## Advanced Filter (`FilterModal.tsx`)

Modal for the List View's filter button.

- Fields: Summary (text), Assignee (`UserPicker`), Reporter (`UserPicker`), Status (dropdown from `getProjectStatuses()` or `getAllStatuses()`)
- **Saved filters**: named presets stored in `localStorage` (`jira-worker-saved-filters`); shown as pills; click to load, × to delete; saving with an existing name overwrites it
- Apply button sets `advancedFilter` state in `ListView`; active filter highlighted with blue dot on the filter button
- When an advanced filter is active, the sidebar's "mine/all/unassigned" filter is overridden to "all"

---

## Sidebar (`Sidebar.tsx`)

Persistent left navigation panel (256 px wide).

- **Search**: text input, passed as `searchQuery` to Board/List/Time views; debounced 400 ms in `useIssues`
- **View switcher**: Board / List / Měření času (Time) / Worklog / Aktivita (Activity) / Nastavení (Settings); each as a sidebar item button
- **Notifications**: collapsible `RecentAssignments` panel — collapsing marks all as read
- **Filter**: My tasks / All tasks / Unassigned (affects Board and List views)
- **Project list**: loaded once on mount via `getProjects()`; "All projects" wildcard entry; refresh button; avatar images
  - **Favourite projects** (Star icon / edit mode): lists all projects with checkboxes; unchecking hides from normal list; confirmed by Check icon; saved to `AppPrefs.hiddenProjectKeys` via `electron-store`
- Selected project persisted to `AppPrefs.selectedProjectKey` via `electron-store` on every change

---

## Notifications (`useNotifications.ts`)

- Polls `assignee = currentUser() AND updated >= "-Xh"` every N minutes (`prefs.pollIntervalMinutes`)
- Fetches up to 20 issues; first poll silently marks all as seen (no notification spam on launch)
- Subsequent polls: new (unseen) issues trigger native OS notification via `window.api.notify()`
  - 1 new issue: "Nový task: KEY — summary"
  - Multiple: "N nové tasky — KEY1, KEY2, …"
- `unreadCount` badge on the Notifications section header
- `markAllRead()` resets badge (called when panel is expanded)
- Seen IDs persisted to `localStorage` (`jw_seen_assignments`)
- Returns `{ recent, unreadCount, loading, markAllRead, refresh }` to `App.tsx` → passed to `Sidebar` → `RecentAssignments`

---

## ADF Rendering

Jira issue descriptions and comments use Atlassian Document Format (ADF — a JSON tree).

- `adfToText(node)` — plain-text conversion (used for description edit draft)
- `adfToHtml(node)` — full HTML conversion rendered via `dangerouslySetInnerHTML`
- `setAdfJiraBaseUrl(url)` — called in `App.tsx` on init and after settings save; needed to resolve image URLs
- `AdfContent` component: splits ADF into HTML segments and `media`/`mediaSingle` nodes; renders HTML via `dangerouslySetInnerHTML` and images via `AdfImage`; resolves attachments by filename or file size from `JiraAttachment[]`
- `AdfImage` component: calls `window.api.fetchMedia(contentUrl)` → IPC → main process fetches with Basic auth → returns base64 data URL; renders with zoom-in hover overlay; click opens `ImageLightbox`
- `ImageLightbox`: full-screen viewer with backdrop blur; dismiss by clicking backdrop or pressing Escape

---

## IssueCard (`IssueCard.tsx`)

Used in Board View columns.

- Displays: issue type icon, key, priority dot, story points badge (SP), summary (2-line clamp), labels (up to 3), due date, comment count, assignee avatar
- Grip handle visible on hover
- Draggable; `dragging` prop adds opacity + tilt; `transitioning` prop shows spinner overlay and disables pointer events

---

## UserPicker (`UserPicker.tsx`)

Reusable dropdown for selecting a Jira user from a pre-loaded list.

- Trigger shows current user avatar + name, or placeholder text
- Dropdown with search input (filters by display name and email)
- "Unassign" option (null value); clear button on trigger
- Closes on outside click

---

## Theming (Light / Dark / Auto)

The entire UI supports three colour modes controlled by `AppPrefs.theme`.

- **Dark** (default): dark palette (`#0f1117` base, gray-800/900 surfaces)
- **Light**: light palette (`#f5f6f8` base, white/gray-100 surfaces)
- **Auto**: follows OS `prefers-color-scheme` media query; `change` event listener keeps it in sync at runtime without a page reload

### Implementation

- All colours are CSS custom properties on `:root` (dark) and `:root.light` (light); no Tailwind `dark:` variants needed
- `App.tsx` toggles the `light` class on `<html>` whenever `prefs.theme` changes; also sets up the media query listener for Auto mode
- `SettingsView` applies the theme immediately on button click (live preview before save)
- Tailwind gray utility classes in JSX are overridden by unlayered CSS selectors (`:root.light .text-gray-200 { … }`)
- Structural component classes (`.sidebar`, `.modal-panel`, `.table-head`, `.issue-card`, etc.) use `var(--c-*)` CSS variables and adapt automatically

---

## Window & System Integration

- **Frameless window** (1 400 × 900 px, min 900 × 600 px) with custom `TitleBar` component
- `TitleBar` adapts to platform: macOS renders centred title only (traffic-light buttons from `hiddenInset`); Windows renders custom min/max/close buttons
- All external link clicks are handled by `shell.openExternal()` (denied in renderer)
- **Media interceptor** (`setupMediaInterceptor`): `session.defaultSession.webRequest.onBeforeSendHeaders` injects `Authorization: Basic …` for all requests to the Jira hostname, enabling `<img>` tags in issue content to load without extra proxy calls; re-applied on every `settings:changed` event
- **Auto-updater** (`electron-updater`): `autoDownload = true`, `autoInstallOnAppQuit = true`; checks 3 s after launch then every hour; sends `update:available` (with version string) and `update:downloaded` events to renderer
- `UpdateBanner` component: appears below title bar; shows "downloading vX.Y.Z…" then "ready to install" with a Restart button (`window.api.installUpdate()`); dismissable with ×
- App User Model ID set to `com.jiraworker.app`

---

## API Layer (`src/renderer/src/lib/jira-api.ts`)

All calls flow: `jiraApi.*()` → `window.api.jiraRequest()` → IPC `jira:request` → `fetch()` in main process (credentials never reach the renderer).

Two internal helpers:
- `request(method, path, body?)` — REST API v3: `{baseUrl}/rest/api/3{path}`
- `agileRequest(path)` — Agile API v1.0: `{baseUrl}/rest/agile/1.0{path}` (prefix `__agile__` signals main process)

| Category | Method | Signature |
|---|---|---|
| Auth | `getMyself` | `() → JiraUser` |
| Issues | `searchIssues` | `(jql, maxResults?, nextPageToken?) → { issues, total, nextPageToken? }` |
| Issues | `getIssue` | `(key) → JiraIssue` — includes attachment field |
| Issues | `getIssueTime` | `(key) → { timespent, timeestimate, timeoriginalestimate }` — lightweight fetch for subtask aggregation |
| Issues | `updateIssue` | `(key, fields) → void` |
| Issues | `createIssue` | `(fields) → { id, key }` |
| Transitions | `getTransitions` | `(key) → { transitions }` |
| Transitions | `doTransition` | `(key, transitionId) → void` |
| Comments | `addComment` | `(key, text) → JiraComment` — wraps text in ADF paragraph |
| Projects | `getProjects` | `() → JiraProject[]` — ordered by name |
| Projects | `getIssueTypes` | `(projectKey) → JiraIssueType[]` |
| Projects | `getProjectStatuses` | `(projectKey) → { id, name, statuses }[]` |
| Users | `getAssignableUsers` | `(projectKey) → JiraUser[]` — max 50 |
| Users | `assignIssue` | `(key, accountId\|null) → void` |
| Users | `searchUsers` | `(query) → JiraUser[]` — max 30, global search |
| Sprints / Boards | `getBoards` | `(projectKey) → { values: { id, name }[] }` — Agile API |
| Sprints / Boards | `getBoardSprints` | `(boardId) → { values: JiraSprint[] }` — active + future, max 20 |
| Epics | `getEpics` | `(projectKey) → { issues }` — JQL `issuetype = Epic` |
| Epics | `getEpicIssues` | `(epicKey, projectKey?) → JiraIssue[]` — two-phase fetch (JQL children + epic itself + missing subtasks) |
| Labels | `getLabels` | `() → { values: string[] }` — max 100 |
| Statuses | `getAllStatuses` | `() → JiraStatus[]` |
| Statuses | `getProjectStatuses` | `(projectKey) → { id, name, statuses }[]` |
| Worklog | `logWork` | `(issueKey, timeSpentSeconds, comment?, started?) → void` — comment as ADF; started as ISO |
| Worklog | `getIssueWorklogs` | `(issueKey, startedAfter?) → { worklogs, total }` — max 1000 |
| Changelog | `getIssueChangelog` | `(issueKey) → { values: JiraChangelog[], total }` — max 100 |
| Issue links | `createIssueLink` | `(outwardKey, inwardKey, typeName) → string` — creates link then re-fetches source issue to return the new `linkId` |
| Issue links | `deleteIssueLink` | `(linkId) → void` — DELETE `/issueLink/:id` |
| Ranking | `rankIssue` | `(issueKey, beforeKey\|null, afterKey\|null) → void` — Agile API PUT `/issue/rank` |

---

## IPC Channels

| Channel | Type | Direction | Purpose |
|---|---|---|---|
| `settings:get` | `handle` | renderer → main | Returns stored `JiraSettings` or `null` |
| `settings:set` | `handle` | renderer → main | Stores `JiraSettings`; emits `settings:changed` |
| `prefs:get` | `handle` | renderer → main | Returns `AppPrefs` merged with defaults |
| `prefs:set` | `handle` | renderer → main | Stores `AppPrefs` |
| `jira:request` | `handle` | renderer → main | Proxies REST/Agile API call with credentials |
| `notify` | `handle` | renderer → main | Shows native OS notification |
| `media:fetch` | `handle` | renderer → main | Downloads Jira URL with auth → returns base64 data URL |
| `time:getEntries` | `handle` | renderer → main | Returns deduped time entry array |
| `time:saveEntry` | `handle` | renderer → main | Upserts entry by `id`; trims to 200 |
| `time:deleteEntry` | `handle` | renderer → main | Removes entry by `id` |
| `update:available` | `send` | main → renderer | Payload: version string |
| `update:downloaded` | `send` | main → renderer | No payload |
| `update:install` | `on` | renderer → main | Calls `autoUpdater.quitAndInstall()` |
| `settings:changed` | `emit` | internal | Triggers `attachInterceptor()` re-run |
| `window-minimize` | `on` | renderer → main | `mainWindow.minimize()` |
| `window-maximize` | `on` | renderer → main | Toggle maximize/unmaximize |
| `window-close` | `on` | renderer → main | `mainWindow.close()` |

---

## Global State (`App.tsx`)

| State | Type | Persisted |
|---|---|---|
| `settings` | `JiraSettings \| null` | `electron-store` `settings` |
| `prefs` | `AppPrefs` | `electron-store` `prefs` |
| `view` | `ViewMode` | `prefs.defaultView` (Board/List only) |
| `selectedProject` | `JiraProject \| null` | `prefs.selectedProjectKey` |
| `projects` | `JiraProject[]` | — (loaded on mount by `Sidebar`) |
| `selectedIssue` | `JiraIssue \| null` | — |
| `searchQuery` | `string` | — |
| `filter` | `"all" \| "mine" \| "unassigned"` | `prefs.defaultFilter` |
| `notifications` | `NotificationState` | seen IDs in `localStorage` |

Boot sequence: `Promise.all([getSettings(), getPrefs()])` → apply theme → set `filter` and `view` from prefs → set `pendingProjectKey` → when `Sidebar` calls `setProjects()`, restore `selectedProject` from `pendingProjectKey`.

---

## Hooks

### `useIssues` (`hooks/useIssues.ts`)

Builds a JQL query and fetches issues via `jiraApi.searchIssues()`.

| Option | Type | Effect |
|---|---|---|
| `selectedProject` | `JiraProject \| null` | Adds `project = "KEY"` |
| `filter` | `"all" \| "mine" \| "unassigned"` | Adds assignee clause |
| `searchQuery` | `string` | Adds `summary ~ "…" OR description ~ "…"`; 400 ms debounce |
| `prefs.doneMaxAgeDays` | `number` | 0 = exclude Done; >0 = Done only if updated within N days; -1 = no filter |
| `prefs.maxResults` | `number` | Passed to `searchIssues` |
| `sprint` | `"active" \| "all" \| "none" \| string` | Adds sprint JQL clause |
| `advancedFilter` | `AdvancedFilter \| null` | Adds summary/assignee/reporter/status clauses |
| `assigneeAccountId` | `string` | Overrides `currentUser()` for `filter="mine"` |
| `updatedSince` | `"YYYY-MM-DD"` | Adds `updated >= "date"` |

Returns `{ issues, setIssues, loading, error, total, reload }`. Non-search changes trigger an immediate fetch (no debounce).

### `useGraphData` (`hooks/useGraphData.ts`)

Drives `GraphView`. Accepts `{ epicKey, projectKey, prefs, onPrefsChange }`.

- On `epicKey` / `projectKey` change: calls `getEpicIssues()`, builds nodes via `issuesToNodes` (saved positions first, auto-grid fallback), builds edges via `issuesToEdges` (parent-child + issuelinks with position-based handle routing)
- Returns `{ nodes, edges, loading, error, reload, saveLayout, saveNewNodePosition }`
- `saveLayout(nodes)` — serialises all current node positions into `AppPrefs.graphLayouts`
- `saveNewNodePosition(issueKey, position)` — merges a single new entry into the saved layout without overwriting existing positions (used after canvas-drop issue creation)

### `useNotifications` (`hooks/useNotifications.ts`)

Polls Jira for recent assignments; returns `NotificationState` (`{ recent, unreadCount, loading, markAllRead, refresh }`). See [Notifications](#notifications-usenotificationsts) section for full behaviour.

---

## TypeScript Types (`src/renderer/src/types/jira.ts`)

### Core entity types
`JiraSettings`, `JiraUser`, `JiraPriority`, `JiraStatus`, `JiraIssueType`, `JiraProject`, `JiraComment`, `ContentNode`, `JiraAttachment`, `JiraSprint`, `JiraIssue`, `JiraTransition`, `JiraChangelogItem`, `JiraChangelog`, `JiraWorklog`

`JiraIssueLink` — `{ id, type: { id, name, inward, outward }, inwardIssue?, outwardIssue? }`; referenced from `JiraIssue.fields.issuelinks`

### Graph types
- `GraphNodePosition` — `{ x: number; y: number }`
- `GraphLayout` — `{ epicKey, projectKey, positions: Record<string, GraphNodePosition>, updatedAt: number }`
- `GraphEdgeData` — `{ linkType, linkId, isBlocking }`

### App types
- `ViewMode` — `"board" | "list" | "settings" | "time" | "worklog" | "activity" | "graph"`
- `StatusCategory` — `"todo" | "inprogress" | "done"`
- `TimeEntry` — `{ id, startTime, endTime, duration, issueKey?, issueSummary?, notes?, loggedToJira? }`
- `AdvancedFilter` — `{ summary, assignee, reporter, status }`
- `SavedFilter extends AdvancedFilter` — `{ id, name, … }`

### `AppPrefs`

| Field | Type | Default | Purpose |
|---|---|---|---|
| `doneMaxAgeDays` | `number` | `14` | 0 = hide Done, -1 = show all |
| `defaultFilter` | `"all" \| "mine" \| "unassigned"` | `"mine"` | Filter applied on startup |
| `defaultView` | `"board" \| "list"` | `"board"` | View on startup |
| `maxResults` | `number` | `100` | Max issues per fetch |
| `pollIntervalMinutes` | `number` | `2` | Notification polling interval |
| `notifWindowHours` | `number` | `24` | Look-back window for notifications |
| `selectedProjectKey` | `string \| null` | `null` | Last selected project |
| `dailyWorkHours` | `number` | `8` | Used for worklog colour-coding |
| `theme` | `"dark" \| "light" \| "auto"` | `"dark"` | Colour mode |
| `hiddenProjectKeys` | `string[]` | `[]` | Projects hidden from sidebar list |
| `graphLayouts` | `GraphLayout[]` | `[]` | Saved node positions per epic+project |

Constants exported: `DEFAULT_PREFS`, `DEFAULT_ADVANCED_FILTER`

---

## Data Persistence

| Store | Key | Contents |
|---|---|---|
| `electron-store` | `settings` | `JiraSettings` (Jira credentials, plaintext) |
| `electron-store` | `prefs` | `AppPrefs` (JSON, merged with defaults on read) — includes `graphLayouts` array |
| `electron-store` | `timeEntries` | `TimeEntry[]` (max 200, deduped by `id`) |
| `localStorage` | `jw_seen_assignments` | JSON array of seen issue IDs |
| `localStorage` | `boardColumnOrder_{projectKey}` | JSON array of status IDs (column order) |
| `localStorage` | `jira-worker-saved-filters` | JSON array of `SavedFilter` objects |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Desktop shell | Electron 33 |
| Bundler | electron-vite |
| Renderer framework | React 18 |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS v3 + custom `@layer components` + CSS variable theming (light/dark/auto) |
| Persistence | electron-store |
| Drag & drop | Native HTML5 drag events |
| Updates | electron-updater |
| CI/CD | GitHub Actions (see [release.yml](../.github/workflows/release.yml)) |

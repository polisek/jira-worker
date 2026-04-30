# RoadmapView – implementační plán pro Claude Code

Tento dokument popisuje přidání nového pohledu **Roadmap** do aplikace Jira Worker.
Postupuj **přesně v pořadí commitů**. Každý commit je samostatný, buildovatelný krok.
Nepřeskakuj kroky, nepřidávej nic navíc.

---

## Přehled architektury

```
RoadmapView.tsx          ← hlavní komponenta (tabulka sprint × uživatel)
  useRoadmapData.ts      ← hook: načítání sprintů, uživatelů, issues
  RoadmapIssueCard.tsx   ← karta úkolu s drag handle
  RoadmapBacklog.tsx     ← vysouvací sekce backlogu bez sprintu
  RoadmapUserHeader.tsx  ← záhlaví sloupce uživatele s capacity
  RoadmapSprintCell.tsx  ← buňka sprint × uživatel (drop target)
```

Nový `ViewMode`: `'roadmap'` přidat do existujícího union typu.
Persistujeme pouze `roadmapUserIds` (vybraní uživatelé) do `AppPrefs` přes existující `prefs:set` kanál.

---

## Závislosti

Žádné nové npm balíčky. Používáme pouze:
- React 18 (drag & drop přes nativní HTML5 Drag Events)
- Tailwind CSS + existující `globals.css`
- Lucide React (ikony `Map`, `Plus`, `X`, `ChevronDown`, `ChevronUp`, `Grip`)
- `jiraApi` existující metody (viz níže)

---

## Potřebné API metody

Všechny metody již existují v `src/renderer/src/lib/jira-api.ts`:

| Metoda | Použití |
|---|---|
| `getBoards(projectKey)` | Načtení board ID pro projekt |
| `getBoardSprints(boardId)` | Aktivní + budoucí sprinty |
| `getAssignableUsers(projectKey)` | Uživatelé projektu |
| `searchIssues(jql, maxResults)` | Issues pro sprint / backlog |

---

## Nové typy

Přidat do `src/renderer/src/types/jira.ts` na konec souboru (bez změny existujících typů).

---

## Commit 1 — Nové typy + ViewMode

**Soubor:** `src/renderer/src/types/jira.ts`

### Změny:

1. Rozšiř `ViewMode` union:
```typescript
// PŘED:
export type ViewMode = 'board' | 'list' | 'settings' | 'time' | 'worklog' | 'activity'

// PO:
export type ViewMode = 'board' | 'list' | 'settings' | 'time' | 'worklog' | 'activity' | 'roadmap'
```

2. Přidej nové typy na konec souboru:
```typescript
export interface RoadmapUser {
  user: JiraUser
  colorIndex: number   // index do ROADMAP_USER_COLORS konstanty
}

export interface RoadmapSprint {
  id: number
  name: string
  state: 'active' | 'future' | 'closed'
  startDate?: string
  endDate?: string
}

export interface RoadmapIssue extends JiraIssue {
  // žádná nová pole – používáme existující JiraIssue
  // sprintId dostaneme z customfield_10020[0].id
}

export type RoadmapDragPayload = {
  issueId: string
  fromUserId: string
  fromSprintId: number | null
}
```

3. Rozšiř `AppPrefs` o nové pole:
```typescript
// Přidej do interface AppPrefs:
roadmapUserIds?: string[]          // accountId vybraných uživatelů
roadmapSprintCapacity?: number     // SP kapacita na uživatele na sprint (default 40)
```

4. Rozšiř `DEFAULT_PREFS` konstantu:
```typescript
// Přidej do DEFAULT_PREFS:
roadmapUserIds: [],
roadmapSprintCapacity: 40,
```

**Commit message:** `feat(types): add RoadmapView types and ViewMode extension`

---

## Commit 2 — useRoadmapData hook

**Soubor:** `src/renderer/src/hooks/useRoadmapData.ts` *(nový soubor)*

Hook zodpovídá za načítání všech dat potřebných pro RoadmapView.

```typescript
import { useState, useEffect, useCallback } from 'react'
import type { JiraProject, RoadmapSprint, JiraUser, JiraIssue } from '../types/jira'
import { jiraApi } from '../lib/jira-api'

interface UseRoadmapDataOptions {
  selectedProject: JiraProject | null
  userIds: string[]             // accountId vybraných uživatelů
}

interface RoadmapData {
  sprints: RoadmapSprint[]
  allProjectUsers: JiraUser[]   // pro picker (přidat/odebrat uživatele)
  issuesByUser: Record<string, JiraIssue[]>  // klíč: accountId
  loading: boolean
  error: string | null
  reload: () => void
}

export function useRoadmapData({ selectedProject, userIds }: UseRoadmapDataOptions): RoadmapData
```

### Implementace hooku:

**Krok A – načtení sprintů:**
```
getBoards(projectKey) → vezmi první board (values[0].id)
getBoardSprints(boardId) → filtruj state === 'active' | 'future'
seřaď sprinty: active první, pak future podle startDate
```

**Krok B – načtení uživatelů projektu:**
```
getAssignableUsers(projectKey) → ulož jako allProjectUsers
```

**Krok C – načtení issues:**
Pro každý sprint a backlog paralelně fetchuj issues:

```typescript
// Pro každý sprint:
const jql = `project = "${projectKey}" AND sprint = ${sprint.id} ORDER BY assignee`

// Pro backlog (nezařazené):
const jql = `project = "${projectKey}" AND sprint is EMPTY AND statusCategory != Done ORDER BY assignee`

// Maximálně 200 issues celkem (prefs.maxResults nebo 200)
```

Výsledek rozděl do `issuesByUser`: pro každého uživatele v `userIds` filtruj issues kde `issue.fields.assignee?.accountId === userId`.

**Chování:**
- Při změně `selectedProject` nebo `userIds` znovu načti
- `loading = true` po dobu načítání, `error` při selhání
- Pokud `selectedProject === null`, vrať prázdná data bez fetch

**Commit message:** `feat(hooks): add useRoadmapData for sprint/user/issue loading`

---

## Commit 3 — RoadmapIssueCard komponenta

**Soubor:** `src/renderer/src/components/RoadmapIssueCard.tsx` *(nový soubor)*

```typescript
interface Props {
  issue: JiraIssue
  userColorIndex: number
  onDragStart: (payload: RoadmapDragPayload) => void
  onClick: (issue: JiraIssue) => void
}

export function RoadmapIssueCard({ issue, userColorIndex, onDragStart, onClick }: Props)
```

### Vizuální design:

Karta zobrazuje:
- Vlevo: `Grip` ikona (drag handle, viditelná on hover)
- Issue key (malý text, poloprůhledný)
- Summary (2-line clamp, `text-ellipsis overflow-hidden`)
- Spodní řádek: barevná tečka priority + typ ikona + SP badge

Barvy karty:

```typescript
// Definuj jako konstantu MIMO komponentu (stabilní reference):
export const ROADMAP_USER_COLORS: Array<{ bg: string; text: string; dot: string }> = [
  { bg: '#E1F5EE', text: '#0F6E56', dot: '#1D9E75' },  // teal
  { bg: '#E6F1FB', text: '#185FA5', dot: '#378ADD' },  // blue
  { bg: '#FAECE7', text: '#993C1D', dot: '#D85A30' },  // coral
  { bg: '#FAEEDA', text: '#854F0B', dot: '#EF9F27' },  // amber
  { bg: '#EEEDFE', text: '#3C3489', dot: '#7F77DD' },  // purple
  { bg: '#FBEAF0', text: '#993556', dot: '#D4537E' },  // pink
  { bg: '#EAF3DE', text: '#3B6D11', dot: '#639922' },  // green
  { bg: '#F1EFE8', text: '#444441', dot: '#888780' },  // gray
]
```

Barvu priorit definuj jako konstantu:
```typescript
const PRIO_COLORS: Record<string, string> = {
  Highest: '#E24B4A', High: '#D85A30', Medium: '#EF9F27', Low: '#378ADD', Lowest: '#888780'
}
```

### Drag events:
```typescript
// Na <div draggable>:
onDragStart={(e) => {
  e.dataTransfer.effectAllowed = 'move'
  onDragStart({ issueId: issue.id, fromUserId: ..., fromSprintId: ... })
}}
```

SP hodnota: `issue.fields.story_points ?? issue.fields.customfield_10016 ?? null`

Pokud SP není dostupné, SP badge nezobrazuj.

**Commit message:** `feat(components): add RoadmapIssueCard with drag support`

---

## Commit 4 — RoadmapSprintCell komponenta

**Soubor:** `src/renderer/src/components/RoadmapSprintCell.tsx` *(nový soubor)*

```typescript
interface Props {
  issues: JiraIssue[]
  userId: string
  sprintId: number | null          // null = backlog
  sprintCapacity: number           // SP kapacita (z prefs)
  userColorIndex: number
  dragOverPayload: RoadmapDragPayload | null   // probíhající drag
  onDrop: (targetUserId: string, targetSprintId: number | null) => void
  onDragOver: (userId: string, sprintId: number | null) => void
  onDragLeave: () => void
  onIssueClick: (issue: JiraIssue) => void
  onIssueCardDragStart: (payload: RoadmapDragPayload) => void
}

export function RoadmapSprintCell({ ... }: Props)
```

### Capacity bar:
```typescript
const usedSP = issues.reduce((sum, i) => sum + (i.fields.story_points ?? i.fields.customfield_10016 ?? 0), 0)
const pct = Math.min(Math.round((usedSP / sprintCapacity) * 100), 100)
const isOver = usedSP > sprintCapacity
```

Barvy capacity baru:
- `pct <= 80` → zelená (`#1D9E75`)
- `pct <= 100` → žlutá (`#EF9F27`)
- `isOver` → červená (`#E24B4A`)

### Drop highlight:
Pokud `dragOverPayload` míří na tuto buňku:
- Přetažení nepřekračuje kapacitu → `bg-blue-50` tint
- Překračuje kapacitu → `bg-amber-50` tint + warning text

### Over-capacity badge:
Pokud `isOver`, zobraz malý červený badge `+{usedSP - sprintCapacity} SP` v pravém horním rohu buňky.

### Layout buňky:
```
┌─────────────────────┐
│ capacity bar (4px)  │
│ "12/40 SP (30%)"    │  ← 9px text
│ [karta]             │
│ [karta]             │
│ [karta]             │
└─────────────────────┘
```

**Commit message:** `feat(components): add RoadmapSprintCell with capacity tracking`

---

## Commit 5 — RoadmapView hlavní komponenta

**Soubor:** `src/renderer/src/components/RoadmapView.tsx` *(nový soubor)*

```typescript
interface Props {
  selectedProject: JiraProject | null
  prefs: AppPrefs
  onPrefsChange: (prefs: AppPrefs) => void
  onIssueSelect: (issue: JiraIssue) => void
}

export function RoadmapView({ selectedProject, prefs, onPrefsChange, onIssueSelect }: Props)
```

### State:
```typescript
const [selectedUserIds, setSelectedUserIds] = useState<string[]>(prefs.roadmapUserIds ?? [])
const [dragPayload, setDragPayload] = useState<RoadmapDragPayload | null>(null)
const [dragOverTarget, setDragOverTarget] = useState<{ userId: string; sprintId: number | null } | null>(null)
const [backlogOpen, setBacklogOpen] = useState(true)
const [showUserPicker, setShowUserPicker] = useState(false)

const { sprints, allProjectUsers, issuesByUser, loading, error, reload } = useRoadmapData({
  selectedProject,
  userIds: selectedUserIds,
})
```

### Lokální mutace issues (optimistic update):

Uchovej lokální kopii `localIssues` jako `useState<JiraIssue[]>([])`.
Při dropu okamžitě (optimistic) přesuň issue v `localIssues` (změn sprint a assignee).
Následně zavolej `jiraApi.updateIssue(key, { assignee: { accountId }, customfield_10020: ... })`.
Při chybě API obnov `localIssues` z `issuesByUser` (rollback) a zobraz chybovou hlášku.

> **Poznámka:** Jira API neumožňuje přiřadit issue ke sprintu přes `updateIssue` fields – sprint se mění přes Agile API: `POST /rest/agile/1.0/sprint/{sprintId}/issue`. Přidej tuto metodu do `jira-api.ts` jako `addIssuesToSprint(sprintId: number, issueKeys: string[]): Promise<void>`.

### Layout tabulky:

```
┌──────────────┬─────────────┬─────────────┬─────────────┐
│  (sticky)    │  Uživatel 1 │  Uživatel 2 │  Uživatel 3 │
│  Sprint / os.│ [capacity]  │ [capacity]  │ [capacity]  │
├──────────────┼─────────────┼─────────────┼─────────────┤
│  Sprint 23   │   [cell]    │   [cell]    │   [cell]    │
│  12.5–26.5   │             │             │             │
│  28/120 SP   │             │             │             │
├──────────────┼─────────────┼─────────────┼─────────────┤
│  Sprint 24   │   [cell]    │   [cell]    │   [cell]    │
├──────────────┴─────────────┴─────────────┴─────────────┤
│  ▾ Backlog bez sprintu (N úkolů · X SP)                 │
│  [col user1]   [col user2]   [col user3]                │
└─────────────────────────────────────────────────────────┘
```

Implementuj jako `<div>` s CSS Grid nebo `<table>`:
- Levý sloupec sprintů: `position: sticky; left: 0; z-index: 5`
- Záhlaví uživatelů: `position: sticky; top: 0; z-index: 10`
- Celý kontejner: `overflow-x: auto; overflow-y: auto; max-height: calc(100vh - 120px)`

### Toolbar (nad tabulkou):

```
[stat: X naplánováno] [stat: Y backlog] [stat: Z% průměr] | [+ Přidat uživatele ▾] [↻]
```

Stat boxy: `bg-gray-800/60 rounded px-3 py-1.5 text-xs`

Tlačítko "Přidat uživatele" otevře dropdown/popup s checkboxy pro `allProjectUsers`.
Při změně výběru: `setSelectedUserIds(...)` + `onPrefsChange({ ...prefs, roadmapUserIds: newIds })`.

### Drag & drop flow:
```
onDragStart na kartě → setDragPayload(payload)
onDragOver na buňce → setDragOverTarget({ userId, sprintId })
onDragLeave → setDragOverTarget(null)
onDrop → handleDrop(targetUserId, targetSprintId)
         → optimistic update localIssues
         → API call (addIssuesToSprint + assignIssue)
         → při chybě rollback + toast error
document onDragEnd (window listener) → setDragPayload(null) + setDragOverTarget(null)
```

### Sprint záhlaví (levý sloupec):

```
Sprint 23          ← název (font-weight: 500, 12px)
12.5 – 26.5        ← daty (10px, muted)
28 / 120 SP        ← součet SP za sprint / (počet uživatelů × capacity)
████░░░░  23%      ← celkový progress bar sprintu
```

**Commit message:** `feat(components): add RoadmapView main component with drag & drop`

---

## Commit 6 — Nová API metoda addIssuesToSprint

**Soubor:** `src/renderer/src/lib/jira-api.ts`

Přidej metodu do objektu `jiraApi`:

```typescript
async addIssuesToSprint(sprintId: number, issueKeys: string[]): Promise<void> {
  await agileRequest(
    'POST',
    `/sprint/${sprintId}/issue`,
    { issues: issueKeys }
  )
}
```

> **Poznámka:** Zkontroluj signaturu `agileRequest` v souboru – pokud nepodporuje `body`, přidej parametr konzistentně s existující `request()` funkcí.

Pokud chceš odstranit issue ze sprintu (přesun do backlogu), použij:
```typescript
async removeIssueFromSprint(issueKey: string): Promise<void> {
  // Jira nemá přímé "remove from sprint" – issue update na sprint = null
  // nebo přes rank API. Bezpečná varianta:
  await request('PUT', `/issue/${issueKey}`, {
    fields: { customfield_10020: null }
  })
}
```

**Commit message:** `feat(api): add addIssuesToSprint and removeIssueFromSprint methods`

---

## Commit 7 — Sidebar integrace

**Soubor:** `src/renderer/src/components/Sidebar.tsx`

Přidej tlačítko pro Roadmap view do sekce view-switcheru (vedle Board / List / Měření času atd.).

Importuj ikonu:
```typescript
import { Map } from 'lucide-react'
```

Přidej položku konzistentně s ostatními view tlačítky v Sidebaru:
```tsx
<button
  className={`sidebar-item ${view === 'roadmap' ? 'active' : ''}`}
  onClick={() => onViewChange('roadmap')}
  title="Roadmap"
>
  <Map size={16} />
  <span>Roadmap</span>
</button>
```

Zkontroluj přesný název CSS třídy a strukturu ostatních tlačítek v Sidebaru – přizpůsob se existujícímu vzoru.

**Commit message:** `feat(sidebar): add Roadmap view navigation item`

---

## Commit 8 — App.tsx routing

**Soubor:** `src/renderer/src/App.tsx`

### Import:
```typescript
import { RoadmapView } from './components/RoadmapView'
```

### Přidání do render logiky:

Najdi místo kde se renderují ostatní views (BoardView, ListView, atd.) a přidej:

```tsx
{view === 'roadmap' && (
  <RoadmapView
    selectedProject={selectedProject}
    prefs={prefs}
    onPrefsChange={handlePrefsChange}
    onIssueSelect={setSelectedIssue}
  />
)}
```

> `handlePrefsChange` by měl volat `window.api.setPrefs(newPrefs)` a updatovat lokální stav – zkontroluj, jak je to implementováno pro ostatní prefs změny a použij stejný vzor.

**Commit message:** `feat(app): wire RoadmapView into App routing`

---

## Commit 9 — CSS pro Roadmap

**Soubor:** `src/renderer/src/styles/globals.css`

Přidej do sekce `@layer components`:

```css
.roadmap-table {
  border-collapse: separate;
  border-spacing: 0;
}

.roadmap-sprint-col {
  position: sticky;
  left: 0;
  z-index: 5;
  background: var(--c-bg-sidebar);
  min-width: 120px;
  max-width: 120px;
}

.roadmap-user-th {
  position: sticky;
  top: 0;
  z-index: 10;
  background: var(--c-bg-primary);
  min-width: 180px;
  padding: 8px;
  border-bottom: 1px solid var(--c-border);
  border-right: 1px solid var(--c-border);
  vertical-align: bottom;
}

.roadmap-cell {
  min-width: 180px;
  vertical-align: top;
  padding: 6px;
  border-bottom: 1px solid var(--c-border);
  border-right: 1px solid var(--c-border);
  transition: background 0.1s;
  position: relative;
}

.roadmap-cell.drop-ok {
  background: rgba(55, 138, 221, 0.08);
}

.roadmap-cell.drop-warn {
  background: rgba(239, 159, 39, 0.1);
}

.roadmap-capacity-bar {
  height: 3px;
  border-radius: 2px;
  background: var(--c-border);
  overflow: hidden;
  margin-bottom: 4px;
}

.roadmap-issue-card {
  border-radius: 5px;
  padding: 5px 7px;
  margin-bottom: 3px;
  cursor: grab;
  font-size: 11px;
  user-select: none;
}

.roadmap-issue-card:active {
  cursor: grabbing;
  opacity: 0.65;
}
```

> **Poznámka:** Zkontroluj existující CSS proměnné v `globals.css` (např. `--c-bg-primary`, `--c-bg-sidebar`, `--c-border`) a přizpůsob se jejich přesným názvům v projektu. Pokud se jmenují jinak, použij správné názvy.

**Commit message:** `feat(styles): add RoadmapView CSS classes`

---

## Finální checklist před PR

- [ ] `yarn build` projde bez TypeScript chyb
- [ ] RoadmapView se zobrazuje při kliknutí na "Roadmap" v Sidebaru
- [ ] Issues se načítají pro vybrané sprinty
- [ ] Drag & drop přesouvá issue v UI okamžitě (optimistic)
- [ ] API volání po dropu: `addIssuesToSprint` + `assignIssue`
- [ ] Přidání/odebrání uživatele funguje a persistuje do `AppPrefs`
- [ ] Capacity bar mění barvu podle naplněnosti
- [ ] Backlog sekce se správně otevírá/zavírá
- [ ] Drag z backlogu do sprintu funguje obousměrně
- [ ] TaskDetail se otevírá kliknutím na kartu (přes `onIssueSelect`)
- [ ] Žádné `console.error` v dev tools při normálním použití

---

## Odhadovaný čas implementace

| Commit | Odhadovaný čas |
|---|---|
| 1 – Typy | 5 min |
| 2 – useRoadmapData | 20 min |
| 3 – RoadmapIssueCard | 15 min |
| 4 – RoadmapSprintCell | 15 min |
| 5 – RoadmapView | 35 min |
| 6 – API metoda | 5 min |
| 7 – Sidebar | 5 min |
| 8 – App.tsx routing | 5 min |
| 9 – CSS | 10 min |
| **Celkem** | **~115 min** |

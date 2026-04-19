# GraphView — Implementační plán

> Přidání dependency graph view do Jira Worker pomocí React Flow.  
> Cílový stav: nový pohled `"graph"` v `ViewMode`, persistent layout, Epic selector, plná integrace s existující architekturou.

---

## Přehled změn

| Oblast | Soubory | Rozsah |
|---|---|---|
| Závislost | `package.json` | +1 balíček |
| Typy | `src/renderer/src/types/jira.ts` | rozšíření |
| API | `src/renderer/src/lib/jira-api.ts` | +1 metoda |
| Komponenty | `src/renderer/src/components/` | +3 nové soubory |
| Hook | `src/renderer/src/hooks/` | +1 nový soubor |
| Routing | `src/renderer/src/App.tsx` | drobná úprava |
| Sidebar | `src/renderer/src/components/Sidebar.tsx` | +1 tlačítko |
| CSS | `src/renderer/src/styles/globals.css` | +React Flow overrides |

---

## Krok 1 — Instalace React Flow

```bash
yarn add @xyflow/react
```

React Flow v12+ používá package `@xyflow/react` (přejmenování z `reactflow`). Nemá žádné peer závislosti mimo React 18, který projekt již má.

---

## Krok 2 — Nové typy (`src/renderer/src/types/jira.ts`)

### 2a. Rozšíření `ViewMode`

```typescript
// Před:
type ViewMode = 'board' | 'list' | 'settings' | 'time' | 'worklog' | 'activity'

// Po:
type ViewMode = 'board' | 'list' | 'settings' | 'time' | 'worklog' | 'activity' | 'graph'
```

### 2b. Nové typy pro graph view

Přidat za existující typy:

```typescript
// Typ závislosti mezi issues (mapuje issuelinks z Jira API)
type IssueLinkType = 'blocks' | 'is blocked by' | 'relates to' | 'duplicates' | 'is duplicated by' | 'clones' | 'is cloned by'

interface GraphEdgeData {
  linkType: IssueLinkType
  label: string
}

// Persistovaná pozice nodu — uloženo v electron-store
interface GraphNodePosition {
  x: number
  y: number
}

interface GraphLayout {
  epicKey: string
  projectKey: string
  positions: Record<string, GraphNodePosition> // issueKey → position
  updatedAt: number
}

// Rozšíření AppPrefs — přidat do existujícího interface:
// graphLayouts?: GraphLayout[]   ← přidat toto pole
```

### 2c. Rozšíření `AppPrefs`

```typescript
interface AppPrefs {
  // ... existující pole ...
  graphLayouts?: GraphLayout[]   // persistované pozice nodů per epic
}
```

---

## Krok 3 — Jira API metoda (`src/renderer/src/lib/jira-api.ts`)

Přidat do objektu `jiraApi`:

```typescript
// Načte issues patřící k danému epicu, včetně jejich issuelinks
getEpicIssues: async (epicKey: string, projectKey?: string): Promise<JiraIssue[]> => {
  // JQL: issues patřící pod epic + samotný epic
  const jql = projectKey
    ? `(issueFunction in subtasksOf("key = ${epicKey}") OR "Epic Link" = ${epicKey} OR parentEpic = ${epicKey} OR parent = ${epicKey}) AND project = "${projectKey}" ORDER BY created ASC`
    : `("Epic Link" = ${epicKey} OR parentEpic = ${epicKey} OR parent = ${epicKey}) ORDER BY created ASC`

  const { issues } = await request('GET',
    `/search?jql=${encodeURIComponent(jql)}&maxResults=100&fields=summary,status,priority,assignee,issuetype,issuelinks,customfield_10014,customfield_10016,parent`
  )

  // Fetch samotný epic a přidej ho na začátek
  const epic = await request('GET', `/issue/${epicKey}?fields=summary,status,priority,assignee,issuetype,issuelinks`)
  return [epic, ...issues]
},
```

> **Poznámka:** `customfield_10014` je standardní "Epic Link" field. `customfield_10016` jsou Story Points. Pole `issuelinks` obsahuje závislosti — každý item má `type.name`, `inwardIssue` nebo `outwardIssue`.

---

## Krok 4 — Hook `useGraphData` (`src/renderer/src/hooks/useGraphData.ts`)

Tento hook zapouzdřuje veškerou logiku pro transformaci Jira dat na React Flow nodes/edges a správu persistovaného layoutu.

```typescript
import { useState, useEffect, useCallback } from 'react'
import type { Node, Edge } from '@xyflow/react'
import { jiraApi } from '../lib/jira-api'
import type { JiraIssue, GraphLayout, AppPrefs } from '../types/jira'

interface UseGraphDataProps {
  epicKey: string | null
  projectKey: string | null
  prefs: AppPrefs
  onPrefsChange: (prefs: Partial<AppPrefs>) => void
}

interface UseGraphDataReturn {
  nodes: Node[]
  edges: Edge[]
  setNodes: (nodes: Node[]) => void
  setEdges: (edges: Edge[]) => void
  loading: boolean
  error: string | null
  reload: () => void
  saveLayout: (nodes: Node[]) => void
}

// Barvy statusů — kopíruje logiku z BoardView
const STATUS_COLORS: Record<string, string> = {
  'To Do':       '#374151',
  'In Progress': '#1d3a5c',
  'Done':        '#14532d',
  'In Review':   '#2d3a1d',
  'Blocked':     '#4a1c1c',
}

// Transformace JiraIssue[] → React Flow Node[]
function issuesToNodes(issues: JiraIssue[], savedPositions: Record<string, GraphNodePosition>): Node[] {
  return issues.map((issue, index) => {
    const pos = savedPositions[issue.key] ?? autoPosition(index, issues.length)
    return {
      id: issue.key,
      type: 'issueNode',           // custom node type, definován v GraphView.tsx
      position: pos,
      data: {
        issue,
        isEpic: issue.fields.issuetype.name === 'Epic',
      },
    }
  })
}

// Fallback layout — dagre-like mřížka pokud nejsou uloženy pozice
function autoPosition(index: number, total: number): { x: number, y: number } {
  const cols = Math.ceil(Math.sqrt(total))
  return {
    x: 60 + (index % cols) * 280,
    y: 60 + Math.floor(index / cols) * 180,
  }
}

// Transformace issuelinks → React Flow Edge[]
function issuesToEdges(issues: JiraIssue[]): Edge[] {
  const edges: Edge[] = []
  const seen = new Set<string>()
  const issueKeys = new Set(issues.map(i => i.key))

  issues.forEach(issue => {
    issue.fields.issuelinks?.forEach(link => {
      const targetKey = link.outwardIssue?.key ?? link.inwardIssue?.key
      if (!targetKey || !issueKeys.has(targetKey)) return

      const edgeId = [issue.key, targetKey].sort().join('--')
      if (seen.has(edgeId)) return
      seen.add(edgeId)

      const isBlocking = link.type.name.toLowerCase().includes('block')
      edges.push({
        id: edgeId,
        source: link.outwardIssue ? issue.key : targetKey,
        target: link.outwardIssue ? targetKey : issue.key,
        type: 'smoothstep',
        animated: isBlocking,
        label: link.type.outward || link.type.inward,
        data: { linkType: link.type.name },
        style: {
          stroke: isBlocking ? '#f85149' : '#58a6ff',
          strokeWidth: isBlocking ? 2 : 1.5,
          strokeDasharray: link.type.name.includes('relates') ? '5 3' : undefined,
        },
        markerEnd: { type: 'arrowclosed', color: isBlocking ? '#f85149' : '#58a6ff' },
      })
    })
  })

  return edges
}

export function useGraphData({ epicKey, projectKey, prefs, onPrefsChange }: UseGraphDataProps): UseGraphDataReturn {
  const [nodes, setNodes] = useState<Node[]>([])
  const [edges, setEdges] = useState<Edge[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const getSavedLayout = useCallback((): Record<string, GraphNodePosition> => {
    if (!epicKey) return {}
    const layout = prefs.graphLayouts?.find(l => l.epicKey === epicKey && l.projectKey === projectKey)
    return layout?.positions ?? {}
  }, [epicKey, projectKey, prefs.graphLayouts])

  const load = useCallback(async () => {
    if (!epicKey) return
    setLoading(true)
    setError(null)
    try {
      const issues = await jiraApi.getEpicIssues(epicKey, projectKey ?? undefined)
      const savedPositions = getSavedLayout()
      setNodes(issuesToNodes(issues, savedPositions))
      setEdges(issuesToEdges(issues))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Chyba při načítání')
    } finally {
      setLoading(false)
    }
  }, [epicKey, projectKey, getSavedLayout])

  useEffect(() => { load() }, [load])

  const saveLayout = useCallback((currentNodes: Node[]) => {
    if (!epicKey || !projectKey) return
    const positions: Record<string, GraphNodePosition> = {}
    currentNodes.forEach(n => { positions[n.id] = n.position })

    const existing = prefs.graphLayouts?.filter(
      l => !(l.epicKey === epicKey && l.projectKey === projectKey)
    ) ?? []

    onPrefsChange({
      graphLayouts: [
        ...existing,
        { epicKey, projectKey, positions, updatedAt: Date.now() },
      ],
    })
  }, [epicKey, projectKey, prefs.graphLayouts, onPrefsChange])

  return { nodes, edges, setNodes, setEdges, loading, error, reload: load, saveLayout }
}
```

---

## Krok 5 — Custom node `IssueNode` (`src/renderer/src/components/IssueNode.tsx`)

Standalone komponenta — custom React Flow node typ.

```typescript
import { Handle, Position } from '@xyflow/react'
import type { NodeProps } from '@xyflow/react'
import type { JiraIssue } from '../types/jira'

interface IssueNodeData {
  issue: JiraIssue
  isEpic: boolean
  onSelect: (issue: JiraIssue) => void
}

const ISSUE_TYPE_COLORS: Record<string, string> = {
  Epic:    '#7c3aed',
  Story:   '#1d4ed8',
  Task:    '#0369a1',
  Bug:     '#dc2626',
  Subtask: '#6b7280',
}

const STATUS_BG: Record<string, string> = {
  'To Do':       'bg-gray-700/50',
  'In Progress': 'bg-blue-900/50',
  'Done':        'bg-green-900/50',
}

export function IssueNode({ data }: NodeProps<IssueNodeData>) {
  const { issue, isEpic, onSelect } = data
  const typeColor = ISSUE_TYPE_COLORS[issue.fields.issuetype.name] ?? '#6b7280'
  const statusBg = STATUS_BG[issue.fields.status.name] ?? 'bg-gray-800/60'
  const sp = issue.fields.customfield_10016

  return (
    <>
      <Handle type="target" position={Position.Left} className="!bg-gray-500 !border-gray-600 !w-2 !h-2" />

      <div
        className={`issue-card w-52 cursor-pointer select-none transition-all hover:ring-1 hover:ring-blue-500/50 ${statusBg} ${isEpic ? 'ring-2 ring-purple-500/40' : ''}`}
        onClick={() => onSelect(issue)}
      >
        {/* Header */}
        <div className="flex items-center gap-2 mb-2">
          <span
            className="text-[9px] font-bold px-1.5 py-0.5 rounded text-white shrink-0"
            style={{ backgroundColor: typeColor }}
          >
            {issue.fields.issuetype.name[0]}
          </span>
          <span className="text-blue-400 font-mono text-[10px] font-medium">{issue.key}</span>
          <span className={`ml-auto text-[9px] font-semibold px-1.5 py-0.5 rounded-full uppercase tracking-wide
            ${issue.fields.status.statusCategory.key === 'done' ? 'bg-green-900/70 text-green-400' :
              issue.fields.status.statusCategory.key === 'indeterminate' ? 'bg-blue-900/70 text-blue-400' :
              'bg-gray-700/70 text-gray-400'}`}>
            {issue.fields.status.name}
          </span>
        </div>

        {/* Summary */}
        <p className="text-xs text-gray-200 font-medium leading-snug line-clamp-2 mb-2">
          {issue.fields.summary}
        </p>

        {/* Meta */}
        <div className="flex items-center gap-1.5">
          {sp != null && (
            <span className="text-[9px] bg-purple-900/40 text-purple-300 border border-purple-700/30 px-1.5 py-0.5 rounded">
              {sp} SP
            </span>
          )}
          {issue.fields.priority && (
            <span className={`text-[9px] px-1.5 py-0.5 rounded border
              ${issue.fields.priority.name === 'High' || issue.fields.priority.name === 'Highest'
                ? 'bg-red-900/30 text-red-400 border-red-700/30'
                : issue.fields.priority.name === 'Low' || issue.fields.priority.name === 'Lowest'
                ? 'bg-gray-800/50 text-gray-500 border-gray-700/20'
                : 'bg-yellow-900/30 text-yellow-400 border-yellow-700/30'}`}>
              {issue.fields.priority.name}
            </span>
          )}
          {issue.fields.assignee && (
            <div
              className="ml-auto w-5 h-5 rounded-full bg-blue-800 text-blue-200 text-[8px] font-bold flex items-center justify-center shrink-0"
              title={issue.fields.assignee.displayName}
            >
              {issue.fields.assignee.displayName.slice(0, 2).toUpperCase()}
            </div>
          )}
        </div>
      </div>

      <Handle type="source" position={Position.Right} className="!bg-gray-500 !border-gray-600 !w-2 !h-2" />
    </>
  )
}
```

---

## Krok 6 — Hlavní komponenta `GraphView` (`src/renderer/src/components/GraphView.tsx`)

```typescript
import { useCallback, useRef } from 'react'
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  addEdge,
  type Connection,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import { IssueNode } from './IssueNode'
import { useGraphData } from '../hooks/useGraphData'
import type { JiraProject, JiraIssue, AppPrefs } from '../types/jira'

// Registrace custom node typů — musí být mimo komponent (jinak remount na každý render)
const NODE_TYPES = { issueNode: IssueNode }

interface Props {
  selectedProject: JiraProject | null
  prefs: AppPrefs
  onPrefsChange: (prefs: Partial<AppPrefs>) => void
  onIssueSelect: (issue: JiraIssue) => void
}

// Vnitřní komponenta (musí být child of ReactFlowProvider)
function GraphCanvas({ selectedProject, prefs, onPrefsChange, onIssueSelect }: Props) {
  const [selectedEpicKey, setSelectedEpicKey] = useState<string | null>(null)
  const [epics, setEpics] = useState<JiraIssue[]>([])
  const [loadingEpics, setLoadingEpics] = useState(false)
  const saveTimeout = useRef<ReturnType<typeof setTimeout>>()

  const { nodes: initNodes, edges: initEdges, loading, error, reload, saveLayout } = useGraphData({
    epicKey: selectedEpicKey,
    projectKey: selectedProject?.key ?? null,
    prefs,
    onPrefsChange,
  })

  const [nodes, setNodes, onNodesChange] = useNodesState(initNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initEdges)

  // Sync initNodes/initEdges do stavu při reload
  useEffect(() => { setNodes(initNodes) }, [initNodes, setNodes])
  useEffect(() => { setEdges(initEdges) }, [initEdges, setEdges])

  // Load epiců pro vybraný projekt
  useEffect(() => {
    if (!selectedProject) return
    setLoadingEpics(true)
    jiraApi.getEpics(selectedProject.key)
      .then(({ issues }) => setEpics(issues))
      .catch(() => setEpics([]))
      .finally(() => setLoadingEpics(false))
  }, [selectedProject])

  // Autosave layoutu 800ms po posledním drag
  const onNodeDragStop = useCallback(() => {
    clearTimeout(saveTimeout.current)
    saveTimeout.current = setTimeout(() => saveLayout(nodes), 800)
  }, [nodes, saveLayout])

  // Vytvoření hrany přetažením mezi porty
  const onConnect = useCallback((connection: Connection) => {
    setEdges(eds => addEdge({
      ...connection,
      type: 'smoothstep',
      style: { stroke: '#58a6ff', strokeWidth: 1.5 },
      markerEnd: { type: 'arrowclosed', color: '#58a6ff' },
    }, eds))
  }, [setEdges])

  // IssueNode potřebuje callback jako data prop
  const nodesWithCallback = useMemo(
    () => nodes.map(n => ({ ...n, data: { ...n.data, onSelect: onIssueSelect } })),
    [nodes, onIssueSelect]
  )

  if (!selectedProject) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500 text-sm">
        Vyber projekt v sidebaru
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-2 bg-gray-900/50 border-b border-gray-800 shrink-0">
        <span className="text-xs font-semibold text-purple-400 bg-purple-900/30 border border-purple-700/30 px-2 py-0.5 rounded">
          EPIC
        </span>
        <select
          className="input text-xs h-7 py-0 min-w-0 w-56"
          value={selectedEpicKey ?? ''}
          onChange={e => setSelectedEpicKey(e.target.value || null)}
          disabled={loadingEpics}
        >
          <option value="">
            {loadingEpics ? 'Načítám epicy…' : '— Vyber epic —'}
          </option>
          {epics.map(e => (
            <option key={e.key} value={e.key}>
              {e.key} · {e.fields.summary}
            </option>
          ))}
        </select>

        {selectedEpicKey && (
          <>
            <button className="btn-primary text-xs px-3 h-7" onClick={reload} disabled={loading}>
              {loading ? 'Načítám…' : '↻ Refresh'}
            </button>
            <button
              className="btn-secondary text-xs px-3 h-7 ml-auto"
              onClick={() => saveLayout(nodes)}
              title="Uložit aktuální rozmístění nodů"
            >
              💾 Uložit layout
            </button>
          </>
        )}

        {/* Legenda */}
        <div className="flex items-center gap-3 ml-auto text-[10px] text-gray-500">
          <span className="flex items-center gap-1"><span className="w-4 h-px bg-red-500 inline-block"></span> Blokuje</span>
          <span className="flex items-center gap-1"><span className="w-4 h-px bg-blue-400 inline-block border-dashed"></span> Souvisí</span>
        </div>
      </div>

      {/* Chybový stav */}
      {error && (
        <div className="mx-4 mt-2 px-3 py-2 bg-red-900/30 border border-red-700/30 rounded text-red-400 text-xs shrink-0">
          {error}
        </div>
      )}

      {/* Prázdný stav */}
      {!selectedEpicKey && !loading && (
        <div className="flex-1 flex flex-col items-center justify-center gap-2 text-gray-600">
          <span className="text-4xl">◈</span>
          <p className="text-sm">Vyber epic pro zobrazení dependency grafu</p>
        </div>
      )}

      {/* React Flow kanvas */}
      {selectedEpicKey && (
        <div className="flex-1 relative">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-900/50 z-10">
              <div className="text-gray-400 text-sm animate-pulse">Načítám issues…</div>
            </div>
          )}
          <ReactFlow
            nodes={nodesWithCallback}
            edges={edges}
            nodeTypes={NODE_TYPES}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeDragStop={onNodeDragStop}
            fitView
            fitViewOptions={{ padding: 0.15 }}
            deleteKeyCode="Delete"
            colorMode="dark"
            defaultEdgeOptions={{ type: 'smoothstep' }}
          >
            <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#1f2937" />
            <Controls className="!bg-gray-900 !border-gray-700 !rounded-lg" />
            <MiniMap
              nodeColor={n => {
                const status = n.data?.issue?.fields?.status?.statusCategory?.key
                return status === 'done' ? '#14532d' : status === 'indeterminate' ? '#1d3a5c' : '#374151'
              }}
              className="!bg-gray-900/80 !border-gray-700 !rounded-lg"
            />
          </ReactFlow>
        </div>
      )}
    </div>
  )
}

// Export s ReactFlowProvider wrapperem
export function GraphView(props: Props) {
  return (
    <ReactFlowProvider>
      <GraphCanvas {...props} />
    </ReactFlowProvider>
  )
}
```

---

## Krok 7 — CSS overrides (`src/renderer/src/styles/globals.css`)

React Flow injektuje vlastní styly. Přepsat je v `@layer components` aby ladily s existující paletou projektu:

```css
@layer components {
  /* React Flow — přepsání výchozích stylů na dark theme projektu */
  .react-flow__node {
    @apply outline-none;
  }

  .react-flow__handle {
    @apply opacity-0 transition-opacity;
  }
  .react-flow__node:hover .react-flow__handle {
    @apply opacity-100;
  }

  .react-flow__controls {
    @apply shadow-none;
  }
  .react-flow__controls-button {
    @apply border-gray-700 bg-gray-900 text-gray-400 hover:bg-gray-800 hover:text-gray-200;
  }

  .react-flow__minimap {
    @apply shadow-none;
  }

  .react-flow__edge-path {
    stroke-opacity: 0.7;
  }

  .react-flow__attribution {
    @apply hidden; /* Skrýt watermark (akceptovatelné pro interní desktop app) */
  }
}
```

---

## Krok 8 — Routing v `App.tsx`

### 8a. Import

```typescript
import { GraphView } from './components/GraphView'
```

### 8b. Render switch

V místě kde se přepíná mezi `BoardView`, `ListView` atd. — přidat větev:

```typescript
{view === 'graph' && (
  <GraphView
    selectedProject={selectedProject}
    prefs={prefs}
    onPrefsChange={handlePrefsChange}
    onIssueSelect={setSelectedIssue}
  />
)}
```

### 8c. Handler pro uložení prefs (pokud ještě neexistuje)

```typescript
const handlePrefsChange = useCallback(async (partial: Partial<AppPrefs>) => {
  const updated = { ...prefs, ...partial }
  setPrefs(updated)
  await window.api.setPrefs(updated)
}, [prefs])
```

---

## Krok 9 — Sidebar (`src/renderer/src/components/Sidebar.tsx`)

Přidat tlačítko `Graf` do view switcheru hned za tlačítko `Aktivita`:

```tsx
<button
  className={`sidebar-item ${view === 'graph' ? 'active' : ''}`}
  onClick={() => onViewChange('graph')}
  title="Dependency graf"
>
  <GitBranch size={15} />
  <span>Graf</span>
</button>
```

Import ikony (lucide-react je již v projektu):

```typescript
import { GitBranch } from 'lucide-react'
```

---

## Krok 10 — Perzistence layoutu přes `electron-store`

Pozice nodů se ukládají do `AppPrefs.graphLayouts` a přes existující `window.api.setPrefs()` tečou do `electron-store`. **Nevyžaduje žádný nový IPC kanál** — využívá stávající `prefs:set`.

Schéma v `electron-store`:

```json
{
  "prefs": {
    "graphLayouts": [
      {
        "epicKey": "PRJ-42",
        "projectKey": "PRJ",
        "updatedAt": 1713450000000,
        "positions": {
          "PRJ-42": { "x": 40, "y": 60 },
          "PRJ-43": { "x": 320, "y": 60 },
          "PRJ-44": { "x": 600, "y": 160 }
        }
      }
    ]
  }
}
```

Pokud `graphLayouts` pole roste příliš (stovky epiců), lze přidat trim na max posledních 20 layoutů při ukládání v hooku.

---

## Pořadí implementace pro Claude Code

Doporučené pořadí pro postupné commit-ování:

```
1. yarn add @xyflow/react
2. types/jira.ts          — přidat IssueLinkType, GraphEdgeData, GraphNodePosition, GraphLayout; rozšířit AppPrefs a ViewMode
3. lib/jira-api.ts        — přidat getEpicIssues()
4. hooks/useGraphData.ts  — nový soubor
5. components/IssueNode.tsx — nový soubor
6. components/GraphView.tsx — nový soubor
7. styles/globals.css     — React Flow CSS overrides
8. components/Sidebar.tsx — přidat tlačítko Graf + import GitBranch
9. App.tsx                — import GraphView, přidat {view === 'graph'} větev, přidat handlePrefsChange pokud chybí
```

---

## Časté pasti specifické pro tento feature

**React Flow musí mít `ReactFlowProvider` jako ancestor.** `GraphView` exportuje komponentu s providerem; `GraphCanvas` uvnitř používá hooky. Neplést pořadí.

**`nodeTypes` objekt musí být konstantní reference** (definovat mimo komponent nebo `useMemo`). Pokud se rekreuje na každý render, React Flow remountuje všechny nody při každé změně stavu.

**`issuelinks` v Jira API vrací pouze klíče issues.** Pokud chceš zobrazit detail linked issue (summary, status) přímo na hraně, musíš buď provést batch fetch nebo přijmout, že detaily jsou jen v nodech které jsou součástí epicu. Issues mimo epic (external dependencies) nebudou mít svůj node — doporučeno je zobrazit je jako "ghost node" (disabled, jiná barva).

**`customfield_10014` (Epic Link) je deprecated** v novějších Jira instancích. Pro Jira Next-Gen projekty používají `parent`. JQL v `getEpicIssues` pokrývá obě varianty.

**`window.api.setPrefs` je async.** Autosave layoutu po drag by měl být fire-and-forget s debounce — viz `onNodeDragStop` výše. Nezapomeň clearovat timeout při unmount komponenty (`useEffect` cleanup).

---

## Rozsah práce

| Krok | Odhadovaný čas |
|---|---|
| Kroky 1–3 (závislost + typy + API) | ~15 min |
| Krok 4 (hook) | ~20 min |
| Krok 5 (IssueNode) | ~20 min |
| Krok 6 (GraphView) | ~30 min |
| Kroky 7–9 (integrace) | ~15 min |
| **Celkem** | **~100 min** |

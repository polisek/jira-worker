import { useState, useCallback } from 'react'
import { RefreshCw, AlertCircle } from 'lucide-react'
import { useIssues } from '../hooks/useIssues'
import { IssueCard } from './IssueCard'
import { jiraApi } from '../lib/jira-api'
import type { JiraIssue, JiraProject, AppPrefs } from '../types/jira'

interface Props {
  selectedProject: JiraProject | null
  filter: 'all' | 'mine' | 'unassigned'
  searchQuery: string
  onSelectIssue: (issue: JiraIssue) => void
  prefs: AppPrefs
}

// Mapování sloupce na statusCategory.key
const COL_CATEGORY: Record<string, string> = {
  todo: 'new',
  inprogress: 'indeterminate',
  done: 'done'
}

const COLUMNS = [
  { key: 'todo',       label: 'K řešení', dot: 'bg-gray-500' },
  { key: 'inprogress', label: 'V řešení', dot: 'bg-blue-500' },
  { key: 'done',       label: 'Hotovo',   dot: 'bg-green-500' }
]

export function BoardView({ selectedProject, filter, searchQuery, onSelectIssue, prefs }: Props) {
  const { issues, loading, error, total, reload, setIssues } = useIssues({ selectedProject, filter, searchQuery, prefs })

  // Drag state
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragOverCol, setDragOverCol] = useState<string | null>(null)
  const [transitioning, setTransitioning] = useState<Set<string>>(new Set())

  const getColumnIssues = (categoryKey: string) =>
    issues.filter((i) => {
      const cat = i.fields.status.statusCategory.key
      if (categoryKey === 'todo') return cat === 'new'
      if (categoryKey === 'inprogress') return cat === 'indeterminate'
      if (categoryKey === 'done') return cat === 'done'
      return false
    })

  // ── Drag handlers ──────────────────────────────────────────────

  const handleDragStart = useCallback((e: React.DragEvent, issueId: string) => {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('issueId', issueId)
    setDraggingId(issueId)
  }, [])

  const handleDragEnd = useCallback(() => {
    setDraggingId(null)
    setDragOverCol(null)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent, colKey: string) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverCol(colKey)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    // Jen pokud opouštíme sloupec (ne child element)
    if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) {
      setDragOverCol(null)
    }
  }, [])

  const handleDrop = useCallback(async (e: React.DragEvent, targetColKey: string) => {
    e.preventDefault()
    setDragOverCol(null)

    const issueId = e.dataTransfer.getData('issueId')
    if (!issueId) return

    const issue = issues.find((i) => i.id === issueId)
    if (!issue) return

    const currentCat = issue.fields.status.statusCategory.key
    const targetCat = COL_CATEGORY[targetColKey]
    if (currentCat === targetCat) return // už je tam

    setTransitioning((prev) => new Set(prev).add(issueId))

    try {
      // Načteme dostupné transitions pro tento issue
      const { transitions } = await jiraApi.getTransitions(issue.key)

      // Vybereme první transition která vede do cílové kategorie
      const transition = transitions.find(
        (t) => t.to.statusCategory.key === targetCat
      )

      if (!transition) {
        console.warn(`Žádná transition do kategorie "${targetCat}" pro ${issue.key}`)
        return
      }

      // Optimistický update — okamžitě přesuneme kartu v UI
      setIssues((prev) =>
        prev.map((i) =>
          i.id === issueId
            ? {
                ...i,
                fields: {
                  ...i.fields,
                  status: {
                    ...i.fields.status,
                    name: transition.to.name,
                    statusCategory: transition.to.statusCategory
                  }
                }
              }
            : i
        )
      )

      // Zavoláme Jira API
      await jiraApi.doTransition(issue.key, transition.id)
    } catch (err) {
      console.error('Transition failed:', err)
      // Rollback — znovu načteme issues ze serveru
      reload()
    } finally {
      setTransitioning((prev) => {
        const next = new Set(prev)
        next.delete(issueId)
        return next
      })
    }
  }, [issues, reload, setIssues])

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <h1 className="font-semibold text-gray-100">
            {selectedProject ? selectedProject.name : 'Všechny projekty'}
          </h1>
          {!loading && <span className="text-xs text-gray-500">{total} tasků celkem</span>}
        </div>
        <button onClick={reload} className="btn-icon" disabled={loading}>
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {error && (
        <div className="mx-4 mt-3 p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {/* Board */}
      <div className="flex-1 flex gap-3 p-4 overflow-x-auto overflow-y-hidden">
        {COLUMNS.map((col) => {
          const colIssues = getColumnIssues(col.key)
          const isOver = dragOverCol === col.key
          const isDraggingHere = draggingId !== null

          return (
            <div
              key={col.key}
              className={`board-column flex flex-col min-w-72 max-w-72 transition-colors ${
                isOver ? 'ring-2 ring-blue-500/60 bg-blue-500/5' : ''
              }`}
              onDragOver={(e) => handleDragOver(e, col.key)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, col.key)}
            >
              {/* Column header */}
              <div className="flex items-center justify-between mb-3 px-1">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${col.dot}`} />
                  <span className="text-sm font-semibold text-gray-300">{col.label}</span>
                </div>
                <span className="text-xs text-gray-600 bg-gray-800 rounded-full px-2 py-0.5">
                  {loading ? '...' : colIssues.length}
                </span>
              </div>

              {/* Drop hint */}
              {isOver && (
                <div className="mx-1 mb-2 h-1 rounded-full bg-blue-500/60 animate-pulse" />
              )}

              {/* Cards */}
              <div className="flex-1 flex flex-col gap-2 overflow-y-auto pr-1">
                {loading && colIssues.length === 0 && (
                  <div className="flex flex-col gap-2">
                    {[1, 2, 3].map((n) => (
                      <div key={n} className="issue-card skeleton h-24" />
                    ))}
                  </div>
                )}

                {colIssues.map((issue) => (
                  <IssueCard
                    key={issue.id}
                    issue={issue}
                    onClick={() => onSelectIssue(issue)}
                    dragging={draggingId === issue.id}
                    transitioning={transitioning.has(issue.id)}
                    onDragStart={(e) => handleDragStart(e, issue.id)}
                    onDragEnd={handleDragEnd}
                  />
                ))}

                {!loading && colIssues.length === 0 && (
                  <div className={`flex items-center justify-center h-20 text-sm rounded-lg border border-dashed transition-colors ${
                    isOver
                      ? 'border-blue-500/60 text-blue-400/60 bg-blue-500/5'
                      : 'border-gray-800 text-gray-600'
                  }`}>
                    {isOver ? 'Pustit sem' : 'Žádné tasky'}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

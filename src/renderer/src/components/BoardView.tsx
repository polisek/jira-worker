import { RefreshCw, AlertCircle } from 'lucide-react'
import { useIssues } from '../hooks/useIssues'
import { IssueCard } from './IssueCard'
import type { JiraIssue, JiraProject } from '../types/jira'

interface Props {
  selectedProject: JiraProject | null
  filter: 'all' | 'mine' | 'unassigned'
  searchQuery: string
  onSelectIssue: (issue: JiraIssue) => void
}

const COLUMNS = [
  { key: 'todo', label: 'K řešení', categories: ['To Do', 'new'] },
  { key: 'inprogress', label: 'V řešení', categories: ['In Progress', 'indeterminate'] },
  { key: 'done', label: 'Hotovo', categories: ['Done', 'done'] }
]

export function BoardView({ selectedProject, filter, searchQuery, onSelectIssue }: Props) {
  const { issues, loading, error, total, reload } = useIssues({ selectedProject, filter, searchQuery })

  const getColumnIssues = (categoryKey: string) => {
    return issues.filter((i) => {
      const cat = i.fields.status.statusCategory.key
      if (categoryKey === 'todo') return cat === 'new'
      if (categoryKey === 'inprogress') return cat === 'indeterminate'
      if (categoryKey === 'done') return cat === 'done'
      return false
    })
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <h1 className="font-semibold text-gray-100">
            {selectedProject ? selectedProject.name : 'Všechny projekty'}
          </h1>
          {!loading && (
            <span className="text-xs text-gray-500">{total} tasků celkem</span>
          )}
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
          return (
            <div key={col.key} className="board-column flex flex-col min-w-72 max-w-72">
              {/* Column header */}
              <div className="flex items-center justify-between mb-3 px-1">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${
                    col.key === 'todo' ? 'bg-gray-500' :
                    col.key === 'inprogress' ? 'bg-blue-500' :
                    'bg-green-500'
                  }`} />
                  <span className="text-sm font-semibold text-gray-300">{col.label}</span>
                </div>
                <span className="text-xs text-gray-600 bg-gray-800 rounded-full px-2 py-0.5">
                  {loading ? '...' : colIssues.length}
                </span>
              </div>

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
                  />
                ))}
                {!loading && colIssues.length === 0 && (
                  <div className="flex items-center justify-center h-20 text-gray-600 text-sm border border-dashed border-gray-800 rounded-lg">
                    Žádné tasky
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

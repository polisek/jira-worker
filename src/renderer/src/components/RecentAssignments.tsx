import { Bell, RefreshCw, ChevronDown, ChevronRight } from 'lucide-react'
import type { NotificationState } from '../hooks/useNotifications'
import type { JiraIssue } from '../types/jira'

const statusDot: Record<string, string> = {
  new: 'bg-gray-500',
  indeterminate: 'bg-blue-500',
  done: 'bg-green-500'
}

interface Props {
  state: NotificationState
  onSelectIssue: (issue: JiraIssue) => void
  collapsed: boolean
  onToggle: () => void
}

export function RecentAssignments({ state, onSelectIssue, collapsed, onToggle }: Props) {
  const { recent, unreadCount, loading, markAllRead, refresh } = state

  const handleOpen = (issue: JiraIssue) => {
    onSelectIssue(issue)
  }

  const handleToggle = () => {
    if (!collapsed && unreadCount > 0) markAllRead()
    onToggle()
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <button
          onClick={handleToggle}
          className="flex items-center gap-1.5 flex-1 sidebar-label mb-0 hover:text-gray-400 transition-colors"
        >
          {collapsed
            ? <ChevronRight className="w-3 h-3" />
            : <ChevronDown className="w-3 h-3" />
          }
          Nové přiřazení
          {unreadCount > 0 && (
            <span className="ml-1 bg-blue-500 text-white text-xs rounded-full px-1.5 py-0 leading-4 font-semibold">
              {unreadCount}
            </span>
          )}
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); refresh() }}
          className="text-gray-600 hover:text-gray-400 p-0.5 rounded transition-colors"
          title="Obnovit"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* List */}
      {!collapsed && (
        <div className="flex flex-col gap-0.5">
          {recent.length === 0 && !loading && (
            <p className="text-xs text-gray-600 px-2 py-2">Žádné nedávné tasky</p>
          )}
          {recent.map((issue) => (
            <button
              key={issue.id}
              onClick={() => handleOpen(issue)}
              className="flex items-start gap-2 w-full px-2 py-1.5 rounded hover:bg-gray-800/60 transition-colors text-left group"
            >
              <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${statusDot[issue.fields.status.statusCategory.key] ?? 'bg-gray-500'}`} />
              <div className="min-w-0 flex-1">
                <span className="text-xs font-mono text-gray-500">{issue.key}</span>
                <p className="text-xs text-gray-400 group-hover:text-gray-200 leading-snug truncate transition-colors">
                  {issue.fields.summary}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
